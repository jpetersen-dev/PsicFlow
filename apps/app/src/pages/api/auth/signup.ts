import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabaseClient';
import { validateRut, validateEmail } from '../../../utils/validators';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, full_name, username, email, password, rut_professional } = req.body;

  if (!token || !full_name || !username || !email || !password || !rut_professional) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  // Clear and format RUT
  const cleanRutStr = rut_professional.trim().replace(/\./g, '').replace(/ /g, '').replace(/-/g, '');
  const formattedRut = cleanRutStr.slice(0, -1) + '-' + cleanRutStr.slice(-1).toUpperCase();

  try {
    // 1. Validate RUT algoritmically
    if (!validateRut(cleanRutStr)) {
      return res.status(400).json({ error: 'El RUT ingresado no es válido.' });
    }

    // 2. Validate Email
    if (!validateEmail(email.trim())) {
      return res.status(400).json({ error: 'El formato de correo electrónico es incorrecto.' });
    }

    // 3. Verify Invitation Token
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

    // 4. Register or authenticate user
    // We check if a profile with this email already exists to determine if they are an existing user
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email.trim().toLowerCase())
      .limit(1)
      .maybeSingle();

    let authData;
    let authErr;

    if (existingProfile) {
      // User already exists, authenticate to verify password before linking
      const authResult = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      authData = authResult.data;
      authErr = authResult.error;

      if (authErr || !authData.user) {
        return res.status(400).json({ 
          error: 'Este correo ya está registrado en PsicFlow. Por favor, ingresa la contraseña correcta de tu cuenta existente para vincular esta clínica.' 
        });
      }
    } else {
      // New user registration
      const authResult = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      authData = authResult.data;
      authErr = authResult.error;

      if (authErr || !authData.user) {
        return res.status(400).json({ error: authErr?.message || 'Error al registrar la cuenta en autenticación.' });
      }
    }

    // 5. Create Profile in DB
    const { error: profileErr } = await supabase
      .from('profiles')
      .insert({
        organization_id: invitation.organization_id,
        user_id: authData.user.id,
        rut_professional: formattedRut,
        full_name: full_name.trim(),
        role_name: invitation.role_name,
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
      });

    if (profileErr) {
      // Rollback Auth user if profile creation fails? Supabase Auth does not easily support rollback from client,
      // but we return the error to the user.
      return res.status(400).json({ error: 'Error al registrar el perfil clínico: ' + profileErr.message });
    }

    // 6. Mark Invitation as used using tenant header to pass RLS policy
    const supabaseTenant = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { 'x-tenant-id': invitation.organization_id } },
    });

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
      session: authData.session,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: full_name.trim(),
        username: username.trim().toLowerCase(),
        role: invitation.role_name,
      },
      organization_id: invitation.organization_id,
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
