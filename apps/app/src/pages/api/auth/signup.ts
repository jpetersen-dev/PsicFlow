import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabaseClient';
import { validateRut, validateEmail } from '../../../utils/validators';
import { PLAN_FEATURES, PlanLevel } from '../../../utils/planFeatures';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    token, 
    full_name, 
    username, 
    email, 
    password, 
    rut_professional, 
    is_google, 
    is_link_existing,
    clinic_name 
  } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'El código de invitación es obligatorio.' });
  }

  try {
    // 1. Verify Invitation Token
    const { data: invitation, error: inviteErr } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token.trim())
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .single();

    if (inviteErr || !invitation) {
      return res.status(400).json({ error: 'Invitación no encontrada, ya utilizada o expirada.' });
    }

    let organizationId = invitation.organization_id;

    if (!organizationId) {
      if (!clinic_name || !clinic_name.trim()) {
        return res.status(400).json({ error: 'El nombre de la clínica es obligatorio para dar de alta la organización.' });
      }
    } else {
      // 2. Plan Limit Verification (maxUsers) using SECURITY DEFINER helper to bypass RLS
      const { data: planLevel, error: planErr } = await supabase.rpc('get_organization_plan', {
        p_organization_id: organizationId
      });

      if (planErr || !planLevel) {
        return res.status(400).json({ error: 'No se pudo obtener la clínica asociada a la invitación.' });
      }

      const plan = planLevel as PlanLevel;
      const features = PLAN_FEATURES[plan];
      const maxUsers = features ? features.maxUsers : 1;

      // Count existing team members using SECURITY DEFINER helper to bypass RLS
      const { data: currentUsersCount, error: countErr } = await supabase.rpc('get_organization_user_count', {
        p_organization_id: organizationId
      });

      if (countErr) {
        return res.status(400).json({ error: 'Error al verificar capacidad de la clínica.' });
      }

      if (currentUsersCount !== null && currentUsersCount >= maxUsers) {
        return res.status(400).json({ 
          error: `Límite de especialistas alcanzado para el plan ${plan} de esta clínica (${maxUsers} máx).` 
        });
      }
    }

    let authUserId = '';
    let authEmail = '';
    let authEmailFromVerify = '';
    let finalFullName = '';
    let finalUsername = '';
    let finalRut = '';

    if (is_link_existing || is_google) {
      // Get accessToken from headers
      const authHeader = req.headers.authorization;
      const accessToken = authHeader && authHeader.split(' ')[1];
      if (!accessToken) {
        return res.status(401).json({ error: 'Falta token de sesión.' });
      }

      // Verify token via getUser
      const { data: { user }, error: verifyErr } = await supabase.auth.getUser(accessToken);
      if (verifyErr || !user) {
        return res.status(401).json({ error: 'Sesión inválida o expirada: ' + verifyErr?.message });
      }

      authUserId = user.id;
      authEmailFromVerify = user.email || '';

      if (is_link_existing) {
        // Link existing profile
        const { data: existingProfile, error: profileFetchErr } = await supabase
          .from('profiles')
          .select('full_name, username, email, rut_professional')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (profileFetchErr || !existingProfile) {
          return res.status(400).json({ error: 'No se encontró tu perfil existente para vincular.' });
        }

        finalFullName = existingProfile.full_name;
        finalUsername = existingProfile.username;
        finalRut = existingProfile.rut_professional;
      } else {
        // Google signup onboarding completion
        if (!full_name || !username || !rut_professional) {
          return res.status(400).json({ error: 'Nombre, usuario y RUT son obligatorios.' });
        }
        
        const cleanRutStr = rut_professional.trim().replace(/\./g, '').replace(/ /g, '').replace(/-/g, '');
        if (!validateRut(cleanRutStr)) {
          return res.status(400).json({ error: 'El RUT ingresado no es válido.' });
        }
        finalRut = cleanRutStr.slice(0, -1) + '-' + cleanRutStr.slice(-1).toUpperCase();
        finalFullName = full_name.trim();
        finalUsername = username.trim().toLowerCase();
      }
    } else {
      // Normal signup
      if (!full_name || !username || !email || !password || !rut_professional) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
      }

      const cleanRutStr = rut_professional.trim().replace(/\./g, '').replace(/ /g, '').replace(/-/g, '');
      if (!validateRut(cleanRutStr)) {
        return res.status(400).json({ error: 'El RUT ingresado no es válido.' });
      }

      if (!validateEmail(email.trim())) {
        return res.status(400).json({ error: 'El formato de correo electrónico es incorrecto.' });
      }

      finalRut = cleanRutStr.slice(0, -1) + '-' + cleanRutStr.slice(-1).toUpperCase();
      finalFullName = full_name.trim();
      finalUsername = username.trim().toLowerCase();
      authEmail = email.trim().toLowerCase();

      // Check if a profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', authEmail)
        .limit(1)
        .maybeSingle();

      let authData;
      let authErr;

      if (existingProfile) {
        // Authenticate password first
        const authResult = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });
        authData = authResult.data;
        authErr = authResult.error;

        if (authErr || !authData.user) {
          return res.status(400).json({ 
            error: 'Este correo ya está registrado. Ingresa la contraseña correcta para vincular la clínica.' 
          });
        }
      } else {
        // Sign up
        const authResult = await supabase.auth.signUp({
          email: authEmail,
          password,
        });
        authData = authResult.data;
        authErr = authResult.error;

        if (authErr || !authData.user) {
          return res.status(400).json({ error: authErr?.message || 'Error al registrar usuario.' });
        }
      }

      authUserId = authData.user.id;
    }

    // If organization_id was null, we must insert the new organization first
    if (!organizationId) {
      const { data: newOrgId, error: orgErr } = await supabase.rpc('create_organization_onboarding', {
        p_name: clinic_name.trim(),
        p_plan: invitation.target_plan || 'Starter'
      });

      if (orgErr || !newOrgId) {
        return res.status(400).json({ error: orgErr?.message || 'Error al crear la nueva clínica.' });
      }

      organizationId = newOrgId;
    }

    const supabaseTenant = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { 'x-tenant-id': organizationId } },
    });

    // 3. Create profile in DB
    const { data: newProfile, error: profileErr } = await supabaseTenant
      .from('profiles')
      .insert({
        organization_id: organizationId,
        user_id: authUserId,
        rut_professional: finalRut,
        full_name: finalFullName,
        role_name: invitation.role_name,
        username: finalUsername,
        email: authEmail || authEmailFromVerify,
      })
      .select('id')
      .single();

    if (profileErr) {
      if (profileErr.code === '23505' || profileErr.message.toLowerCase().includes('unique constraint')) {
        if (profileErr.message.includes('rut_professional') || profileErr.message.includes('idx_unique_rut_professional_pro')) {
          return res.status(400).json({ error: 'El RUT ingresado ya está asociado a otra cuenta profesional registrada.' });
        }
        if (profileErr.message.includes('username') || profileErr.message.includes('idx_unique_username_lower')) {
          return res.status(400).json({ error: 'El nombre de usuario ya está en uso. Por favor, elige otro.' });
        }
        return res.status(400).json({ error: 'El RUT o el nombre de usuario ya están registrados.' });
      }
      return res.status(400).json({ error: 'Error al registrar el perfil clínico: ' + profileErr.message });
    }

    // 4. Mark Invitation as used

    // Seed initial credits if this is a brand new organization
    if (!invitation.organization_id && newProfile?.id) {
      const { error: ledgerErr } = await supabaseTenant
        .from('credit_ledger')
        .insert([
          {
            organization_id: organizationId,
            profile_id: newProfile.id,
            type_unit: 'NOTA_IA',
            amount: 10,
            description: 'Carga inicial gratuita de bienvenida'
          },
          {
            organization_id: organizationId,
            profile_id: newProfile.id,
            type_unit: 'INFORME_CLINICO',
            amount: 5,
            description: 'Carga inicial gratuita de bienvenida'
          }
        ]);
      if (ledgerErr) {
        console.error('Error seeding initial credits:', ledgerErr);
      }
    }

    const { error: updateErr } = await supabaseTenant
      .from('invitations')
      .update({ is_used: true })
      .eq('id', invitation.id);

    if (updateErr) {
      console.error('Error al marcar la invitación como usada:', updateErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Cuenta registrada exitosamente.',
      user: {
        id: authUserId,
        email: authEmail || authEmailFromVerify,
        full_name: finalFullName,
        username: finalUsername,
        role: invitation.role_name,
      },
      organization_id: organizationId,
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
