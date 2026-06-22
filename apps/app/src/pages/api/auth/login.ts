import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { validateEmail } from '../../../utils/validators';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identificador y contraseña son requeridos.' });
  }

  try {
    let email = identifier.trim();
    let username = '';

    // If identifier is not an email, treat it as a username
    if (!validateEmail(email)) {
      username = email;
      
      // Query profiles to find the email associated with this username
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('email, organization_id')
        .eq('username', username)
        .limit(1)
        .single();

      if (profileErr || !profile || !profile.email) {
        return res.status(401).json({ error: 'Nombre de usuario o contraseña incorrectos.' });
      }

      email = profile.email;
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr || !authData.session) {
      return res.status(401).json({ error: authErr?.message || 'Error de autenticación.' });
    }

    // Fetch the profiles associated with this user (could belong to multiple organizations/clinics)
    const { data: userProfiles, error: userProfilesErr } = await supabase
      .from('profiles')
      .select('organization_id, role_name, full_name, username')
      .eq('user_id', authData.user?.id);

    if (userProfilesErr) {
      return res.status(401).json({ error: 'Error al recuperar los perfiles del usuario.' });
    }

    const defaultProfile = userProfiles && userProfiles.length > 0 ? userProfiles[0] : null;
    const organizationId = defaultProfile?.organization_id || null;

    return res.status(200).json({
      success: true,
      session: authData.session,
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
        full_name: defaultProfile?.full_name || '',
        username: defaultProfile?.username || '',
        role: defaultProfile?.role_name || '',
      },
      organization_id: organizationId,
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
