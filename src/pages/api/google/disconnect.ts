import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createOAuth2Client } from '../../../lib/googleCalendar';

/**
 * DELETE /api/google/disconnect
 * Revokes the Google OAuth token and removes the connection from the database.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'Falta el tenant activo' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
        'x-tenant-id': tenantId,
      },
    },
  });

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Sesión inválida' });
    }

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', tenantId)
      .limit(1)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    // Get the connection to revoke the token
    const { data: connection } = await supabase
      .from('google_calendar_connections')
      .select('id, refresh_token, access_token')
      .eq('profile_id', profile.id)
      .eq('organization_id', tenantId)
      .limit(1)
      .single();

    if (!connection) {
      return res.status(200).json({ success: true, message: 'No hay conexión para desconectar' });
    }

    // Try to revoke the token with Google (best effort)
    try {
      const client = createOAuth2Client();
      await client.revokeToken(connection.refresh_token || connection.access_token);
    } catch (revokeErr: any) {
      // Token might already be revoked — continue with DB cleanup
      console.warn('Token revocation warning:', revokeErr.message);
    }

    // Delete calendar selections (cascade will handle this, but be explicit)
    await supabase
      .from('google_calendar_selections')
      .delete()
      .eq('connection_id', connection.id);

    // Delete the connection
    const { error: deleteError } = await supabase
      .from('google_calendar_connections')
      .delete()
      .eq('id', connection.id);

    if (deleteError) {
      return res.status(500).json({ error: 'Error al eliminar la conexión' });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/google/disconnect:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
