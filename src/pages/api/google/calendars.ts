import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * GET  /api/google/calendars — List calendars with active status
 * PATCH /api/google/calendars — Toggle a calendar's is_active status
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  // Get profile for this user + tenant
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

  // Get Google Calendar connection
  const { data: connection } = await supabase
    .from('google_calendar_connections')
    .select('id, google_email, clinical_calendar_id, personal_calendar_id')
    .eq('profile_id', profile.id)
    .eq('organization_id', tenantId)
    .limit(1)
    .single();

  if (!connection) {
    return res.status(200).json({ connected: false, calendars: [] });
  }

  if (req.method === 'GET') {
    // Fetch all calendar selections
    const { data: selections, error: selError } = await supabase
      .from('google_calendar_selections')
      .select('id, calendar_id, calendar_name, calendar_color, is_active')
      .eq('connection_id', connection.id)
      .order('added_at', { ascending: true });

    if (selError) {
      return res.status(500).json({ error: 'Error al cargar calendarios' });
    }

    return res.status(200).json({
      connected: true,
      googleEmail: connection.google_email,
      clinicalCalendarId: connection.clinical_calendar_id,
      personalCalendarId: connection.personal_calendar_id,
      calendars: selections || [],
    });
  }

  if (req.method === 'PUT') {
    const { clinicalCalendarId, personalCalendarId } = req.body;

    const { error: updateError } = await supabase
      .from('google_calendar_connections')
      .update({
        clinical_calendar_id: clinicalCalendarId || null,
        personal_calendar_id: personalCalendarId || null,
      })
      .eq('id', connection.id);

    if (updateError) {
      return res.status(500).json({ error: 'Error al actualizar mapeo de calendarios' });
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { calendarId, isActive } = req.body;

    if (!calendarId || typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Parámetros inválidos: calendarId y isActive requeridos' });
    }

    const { error: updateError } = await supabase
      .from('google_calendar_selections')
      .update({ is_active: isActive })
      .eq('connection_id', connection.id)
      .eq('calendar_id', calendarId);

    if (updateError) {
      return res.status(500).json({ error: 'Error al actualizar calendario' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
