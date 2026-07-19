import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { queryFreeBusy } from '../../../../lib/googleCalendar';
import { validateApiKey } from '../../../../utils/authIntegration';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * GET /api/v1/integrations/availability
 * Query parameters: specialist_id, date (YYYY-MM-DD)
 * Headers: Authorization: Bearer pf_live_...
 * Returns available 60-minute booking slots for the specialist.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // 1. Validate API Key
  const authHeader = req.headers.authorization;
  const validation = await validateApiKey(authHeader);

  if (validation.error || !validation.organization_id) {
    return res.status(validation.status || 401).json({ error: validation.error });
  }

  const organizationId = validation.organization_id;

  const { specialist_id, date } = req.query;

  if (!specialist_id || !date) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos: specialist_id, date.' });
  }

  if (typeof specialist_id !== 'string' || typeof date !== 'string') {
    return res.status(400).json({ error: 'Parámetros inválidos.' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 2. Get specialist calendar connection, working hours, and timezone
    const { data: infoList, error: infoErr } = await supabase.rpc('get_specialist_calendar_info', {
      p_organization_id: organizationId,
      p_specialist_id: specialist_id,
    });

    if (infoErr || !infoList || infoList.length === 0) {
      console.error('Error fetching calendar info:', infoErr);
      return res.status(404).json({ error: 'Especialista no encontrado en esta clínica.' });
    }

    const info = infoList[0];
    const tz = info.timezone || 'America/Santiago';
    const dayStartHour = info.work_start_hour !== null && info.work_start_hour !== undefined ? info.work_start_hour : 8;
    const dayEndHour = info.work_end_hour !== null && info.work_end_hour !== undefined ? info.work_end_hour : 20;

    // 3. Fetch internal busy sessions
    const { data: sessions, error: sessionsErr } = await supabase.rpc('get_specialist_sessions', {
      p_organization_id: organizationId,
      p_specialist_id: specialist_id,
      p_date: date,
    });

    if (sessionsErr) {
      console.error('Error fetching specialist sessions:', sessionsErr);
      return res.status(500).json({ error: 'Error al consultar sesiones ocupadas.' });
    }

    const busyBlocks: { start: number; end: number }[] = [];

    // Parse internal sessions to minute blocks
    if (sessions) {
      for (const s of sessions) {
        const timeStr = s.time_session;
        if (timeStr) {
          const [h, m] = timeStr.split(':').map(Number);
          const startMin = h * 60 + m;
          const endMin = startMin + 60; // Assume 1 hour session duration
          busyBlocks.push({ start: startMin, end: endMin });
        }
      }
    }

    // 4. Query Google Calendar FreeBusy if connected
    if (info.refresh_token && info.calendar_ids && info.calendar_ids.length > 0) {
      const nextDateObj = new Date(date + 'T12:00:00');
      nextDateObj.setDate(nextDateObj.getDate() + 1);
      const nextDate = nextDateObj.toISOString().split('T')[0];

      const timeMin = `${date}T00:00:00Z`;
      const timeMax = `${nextDate}T12:00:00Z`;

      try {
        const googleBusyResults = await queryFreeBusy(
          info.refresh_token,
          info.calendar_ids,
          timeMin,
          timeMax,
          tz
        );

        for (const result of googleBusyResults) {
          for (const block of result.busy) {
            const bStart = new Date(block.start);
            const bEnd = new Date(block.end);

            // Convert to minutes of the day in specialist timezone
            const sParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(bStart);
            const eParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(bEnd);

            const sh = parseInt(sParts.find(p => p.type === 'hour')?.value || '0', 10);
            const sm = parseInt(sParts.find(p => p.type === 'minute')?.value || '0', 10);
            const eh = parseInt(eParts.find(p => p.type === 'hour')?.value || '0', 10);
            const em = parseInt(eParts.find(p => p.type === 'minute')?.value || '0', 10);

            const startMin = sh * 60 + sm;
            const endMin = eh * 60 + em;

            if (startMin < endMin) {
              busyBlocks.push({ start: startMin, end: endMin });
            }
          }
        }
      } catch (googleErr: any) {
        console.error('Error querying Google Calendar FreeBusy:', googleErr.message);
      }
    }

    // 5. Sort and merge overlapping blocks
    busyBlocks.sort((a, b) => a.start - b.start);
    const mergedBusy: { start: number; end: number }[] = [];
    for (const b of busyBlocks) {
      if (mergedBusy.length > 0 && b.start < mergedBusy[mergedBusy.length - 1].end) {
        mergedBusy[mergedBusy.length - 1].end = Math.max(mergedBusy[mergedBusy.length - 1].end, b.end);
      } else {
        mergedBusy.push({ ...b });
      }
    }

    // 6. Compute available 60-minute slots
    const availableSlots: string[] = [];
    const dayStartMin = dayStartHour * 60;
    const dayEndMin = dayEndHour * 60;

    let cursor = dayStartMin;
    while (cursor + 60 <= dayEndMin) {
      const slotStart = cursor;
      const slotEnd = cursor + 60;

      const isBusy = mergedBusy.some((b) => slotStart < b.end && b.start < slotEnd);

      if (!isBusy) {
        const h = Math.floor(slotStart / 60);
        const m = slotStart % 60;
        availableSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
      cursor += 60; // 1-hour intervals
    }

    return res.status(200).json({
      success: true,
      date,
      timezone: tz,
      available_slots: availableSlots,
    });
  } catch (err: any) {
    console.error('Error in availability API integrations:', err);
    return res.status(500).json({ error: 'Error al calcular disponibilidad.' });
  }
}

export default allowCors(handler);
