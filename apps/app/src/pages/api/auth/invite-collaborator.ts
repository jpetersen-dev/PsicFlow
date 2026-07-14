import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabaseClient';
import { sendEmail } from '../../../utils/emails';
import { PLAN_FEATURES, PlanLevel } from '../../../utils/planFeatures';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const accessToken = authHeader && authHeader.split(' ')[1];
  if (!accessToken) {
    return res.status(401).json({ error: 'Falta token de sesión.' });
  }

  const { email, role_name, organization_id } = req.body;

  if (!email || !role_name || !organization_id) {
    return res.status(400).json({ error: 'Email, rol y clínica son obligatorios.' });
  }

  try {
    // 1. Initialize request-scoped Supabase client propagating user's session & tenant
    const supabaseTenant = createClient(supabaseUrl, supabaseAnonKey, {
      global: { 
        headers: { 
          'x-tenant-id': organization_id,
          'Authorization': `Bearer ${accessToken}`
        } 
      },
    });

    // Authenticate user from global Auth layer
    const { data: { user }, error: authErr } = await supabaseTenant.auth.getUser(accessToken);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }

    // 2. Validate user has admin role in this organization
    const { data: adminProfile, error: profileErr } = await supabaseTenant
      .from('profiles')
      .select('role_name')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .limit(1)
      .single();

    if (profileErr || !adminProfile || adminProfile.role_name !== 'admin_clinica') {
      return res.status(403).json({ 
        error: 'No tienes permisos de administrador para invitar colaboradores en esta clínica.' 
      });
    }

    // 3. Plan Limit Verification (maxUsers) using SECURITY DEFINER helpers
    const { data: planLevel, error: planErr } = await supabaseTenant.rpc('get_organization_plan', {
      p_organization_id: organization_id
    });

    if (planErr || !planLevel) {
      return res.status(400).json({ error: 'No se pudo obtener el plan de la clínica.' });
    }

    // Get clinic name for template
    const { data: orgData, error: orgErr } = await supabaseTenant
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .limit(1)
      .single();

    if (orgErr || !orgData) {
      return res.status(400).json({ error: 'No se pudo obtener la información de la clínica.' });
    }

    const plan = planLevel as PlanLevel;
    const features = PLAN_FEATURES[plan];
    const maxUsers = features ? features.maxUsers : 1;

    // Count existing team members
    const { data: currentUsersCount, error: countErr } = await supabaseTenant.rpc('get_organization_user_count', {
      p_organization_id: organization_id
    });

    if (countErr) {
      return res.status(400).json({ error: 'Error al verificar capacidad de la clínica.' });
    }

    // Count active pending invitations
    const { count: pendingInvitesCount, error: pendingErr } = await supabaseTenant
      .from('invitations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString());

    if (pendingErr) {
      return res.status(400).json({ error: 'Error al verificar invitaciones pendientes.' });
    }

    const totalAllocated = (currentUsersCount || 0) + (pendingInvitesCount || 0);

    if (totalAllocated >= maxUsers) {
      return res.status(400).json({ 
        error: `Límite de especialistas alcanzado para el plan ${plan} de esta clínica (${maxUsers} máx, asignados ${totalAllocated}). Por favor, cancela alguna invitación pendiente o actualiza tu plan.` 
      });
    }

    // 4. Create Invitation Token
    const token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { data: invite, error: inviteErr } = await supabaseTenant
      .from('invitations')
      .insert({
        email: email.trim().toLowerCase(),
        token,
        organization_id,
        role_name,
        expires_at
      })
      .select()
      .single();

    if (inviteErr || !invite) {
      return res.status(400).json({ error: 'Error al generar la invitación: ' + inviteErr?.message });
    }

    // 5. Send Email via Brevo SMTP
    const host = req.headers.host || 'app.psicflow.com';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const inviteLink = `${protocol}://${host}/invitacion/${token}`;
    const clinicName = orgData.name || 'Tu clínica';

    let emailSent = false;
    let emailError = '';

    try {
      const emailRes = await sendEmail({
        to: [{ name: email, email: email.trim().toLowerCase() }],
        subject: `Te han invitado a unirte a la clínica ${clinicName} en PsicFlow`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
            <div style="background-color: #1e3a8a; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold;">Invitación de PsicFlow</h1>
            </div>
            <div style="padding: 30px; line-height: 1.6; color: #334155;">
              <p style="font-size: 16px; font-weight: bold; margin-top: 0; color: #0f172a;">¡Hola!</p>
              <p>El administrador de la clínica <strong>${clinicName}</strong> te ha invitado a formar parte de su equipo de profesionales en la plataforma PsicFlow con el rol de <strong>${role_name === 'psicologo' ? 'Psicólogo/Terapeuta' : role_name === 'admin_clinica' ? 'Co-Administrador' : role_name}</strong>.</p>
              <p>Para activar tu cuenta, definir tus credenciales y unirte a la clínica, haz clic en el siguiente enlace:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">Aceptar Invitación y Registrarse</a>
              </div>
              <p style="font-size: 12px; color: #64748b;">Si el botón superior no funciona, copia y pega esta dirección en tu navegador:</p>
              <p style="font-size: 12px; color: #2563eb; word-break: break-all;"><a href="${inviteLink}">${inviteLink}</a></p>
              
              <div style="margin-top: 25px; padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
                <p style="font-size: 11px; color: #64748b; margin: 0 0 5px 0; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Código de invitación manual:</p>
                <code style="font-family: monospace; font-size: 15px; font-weight: bold; color: #0f172a; background-color: #e2e8f0; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.05em;">${token}</code>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
                Este correo fue enviado automáticamente por PsicFlow. Cumple con la encriptación estándar HIPAA.
              </p>
            </div>
          </div>
        `,
        senderName: 'PsicFlow Plataforma',
        senderEmail: process.env.BREVO_SENDER_EMAIL || 'no-reply@sentidomigrante.com'
      });
      emailSent = emailRes.success;
      if (!emailRes.success) {
        emailError = emailRes.error || 'Unknown Brevo error';
      }
    } catch (mailErr: any) {
      emailError = mailErr.message || 'Mail transport error';
      console.error('Brevo API send error:', mailErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Invitación creada correctamente.',
      invitation: invite,
      inviteLink,
      emailSent,
      emailError
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
