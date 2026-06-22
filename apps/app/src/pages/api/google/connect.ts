import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAuthUrl, createOAuthState } from '../../../lib/googleCalendar';

/**
 * GET /api/google/connect
 * Returns the Google OAuth2 authorization URL for the current user.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify required environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      return res.status(500).json({ error: 'Google Calendar no está configurado. Faltan variables de entorno.' });
    }

    // Get the auth token from the request
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({ error: 'Falta el tenant activo' });
    }

    // Create a Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
          'x-tenant-id': tenantId,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Sesión inválida' });
    }

    // Get the profile for this user + tenant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', tenantId)
      .limit(1)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Generate the OAuth state and auth URL
    const state = createOAuthState(profile.id, tenantId);
    const authUrl = getAuthUrl(state);

    return res.status(200).json({ authUrl });
  } catch (err: any) {
    console.error('Error in /api/google/connect:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
