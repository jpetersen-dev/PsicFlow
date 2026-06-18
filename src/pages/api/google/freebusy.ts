import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { queryFreeBusy, computeAvailableSlots } from '../../../lib/googleCalendar';

/**
 * POST /api/google/freebusy
 * Queries Google Calendar FreeBusy for the user's active calendars,
 * combines with internal PsicFlow sessions, and returns availability.
 *
 * Body: { date: "YYYY-MM-DD", dayStartHour?: number, dayEndHour?: number }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

  const { date, dayStartHour = 8, dayEndHour = 20 } = req.body;
  if (!date) {
    return res.status(400).json({ error: 'Falta el parámetro date' });
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

    // Get profile with timezone
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, timezone')
      .eq('user_id', user.id)
      .eq('organization_id', tenantId)
      .limit(1)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const tz = profile.timezone || 'America/Santiago';

    // 1. Fetch internal PsicFlow sessions for this date
    const { data: internalSessions } = await supabase
      .from('sessions')
      .select('id, time_session, status_session, patient:patient_id (full_name)')
      .eq('date_session', date)
      .eq('professional_id', profile.id)
      .in('status_session', ['Programada', 'Completa']);

    // Convert internal sessions to busy blocks (assume 1 hour per session)
    const internalBusy: { start: string; end: string; label: string; source: 'psicflow' }[] = [];
    if (internalSessions) {
      for (const session of internalSessions) {
        const time = session.time_session; // "HH:mm:ss" or "HH:mm"
        if (time) {
          const [h, m] = time.split(':').map(Number);
          const startMin = h * 60 + m;
          const endMin = startMin + 60; // Default 1 hour duration
          const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const endH = Math.floor(endMin / 60);
          const endM = endMin % 60;
          const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

          const patientName = (session.patient as any)?.full_name || 'Paciente';
          internalBusy.push({
            start: startStr,
            end: endStr,
            label: `Sesión: ${patientName}`,
            source: 'psicflow',
          });
        }
      }
    }

    // 2. Fetch personal events for this date
    const { data: personalEvents } = await supabase
      .from('personal_events')
      .select('title, start_time, end_time')
      .eq('event_date', date);

    if (personalEvents) {
      for (const evt of personalEvents) {
        if (evt.start_time && evt.end_time) {
          internalBusy.push({
            start: evt.start_time.substring(0, 5),
            end: evt.end_time.substring(0, 5),
            label: evt.title || 'Evento',
            source: 'psicflow',
          });
        }
      }
    }

    // 3. Check for Google Calendar connection
    const { data: connection } = await supabase
      .from('google_calendar_connections')
      .select('id, refresh_token')
      .eq('profile_id', profile.id)
      .eq('organization_id', tenantId)
      .limit(1)
      .single();

    const googleBusy: { start: string; end: string; label: string; source: 'google' }[] = [];
    let googleConnected = false;

    if (connection?.refresh_token) {
      googleConnected = true;

      // Get active calendars
      const { data: activeCalendars } = await supabase
        .from('google_calendar_selections')
        .select('calendar_id, calendar_name')
        .eq('connection_id', connection.id)
        .eq('is_active', true);

      if (activeCalendars && activeCalendars.length > 0) {
        const calendarIds = activeCalendars.map((c) => c.calendar_id);
        const calendarNameMap = Object.fromEntries(
          activeCalendars.map((c) => [c.calendar_id, c.calendar_name])
        );

        // Build time range for the given date in the user's timezone
        // Google FreeBusy API requires RFC3339 timestamps
        // We pass the timeZone in the request body, so Google handles conversion
        const timeMin = `${date}T00:00:00Z`;
        const timeMax = `${date}T23:59:59Z`;

        try {
          const freeBusyResults = await queryFreeBusy(
            connection.refresh_token,
            calendarIds,
            timeMin,
            timeMax,
            tz
          );

          for (const result of freeBusyResults) {
            const calName = calendarNameMap[result.calendarId] || 'Google';
            for (const block of result.busy) {
              // Convert UTC timestamps to local timezone
              const bStart = new Date(block.start);
              const bEnd = new Date(block.end);
              const startLocal = bStart.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
              const endLocal = bEnd.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
              googleBusy.push({
                start: startLocal,
                end: endLocal,
                label: calName,
                source: 'google',
              });
            }
          }
        } catch (googleErr: any) {
          console.error('Error querying Google FreeBusy:', googleErr.message);
          // Continue without Google data — graceful degradation
        }
      }
    }

    // 4. Combine all busy blocks and compute available slots
    const allBusy = [
      ...internalBusy.map((b) => ({ start: `${date}T${b.start}:00`, end: `${date}T${b.end}:00` })),
      ...googleBusy.map((b) => ({ start: `${date}T${b.start}:00`, end: `${date}T${b.end}:00` })),
    ];

    const availableSlots = computeAvailableSlots(allBusy, dayStartHour, dayEndHour, date);

    // 5. Build unified timeline
    const timeline = [
      ...internalBusy.map((b) => ({
        start: b.start,
        end: b.end,
        label: b.label,
        source: b.source as string,
        type: 'busy' as const,
      })),
      ...googleBusy.map((b) => ({
        start: b.start,
        end: b.end,
        label: b.label,
        source: b.source as string,
        type: 'busy' as const,
      })),
      ...availableSlots.map((s) => ({
        start: s.start,
        end: s.end,
        label: 'Disponible',
        source: 'available' as string,
        type: 'available' as const,
      })),
    ].sort((a, b) => a.start.localeCompare(b.start));

    return res.status(200).json({
      date,
      googleConnected,
      timeline,
      busyCount: internalBusy.length + googleBusy.length,
      availableCount: availableSlots.length,
    });
  } catch (err: any) {
    console.error('Error in /api/google/freebusy:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
