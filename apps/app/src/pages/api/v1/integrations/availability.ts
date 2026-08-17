import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { queryFreeBusy } from '../../../../lib/googleCalendar';
import { validateApiKey } from '../../../../utils/authIntegration';
import { allowCors } from '../../../../utils/cors';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
 
async function calculateSpecialistSlots(
  supabase: any,
  organizationId: string,
  specialistId: string,
  date: string,
  durationMinutes: number,
  buffer: number,
  minAnticipationHours: number
): Promise<{ availableSlots: string[]; tz: string }> {
  // RPC to get calendar info
  const { data: infoList, error: infoErr } = await supabase.rpc('get_specialist_calendar_info', {
    p_organization_id: organizationId,
    p_specialist_id: specialistId,
  });
 
  if (infoErr || !infoList || infoList.length === 0) {
    return { availableSlots: [], tz: 'America/Santiago' };
  }
 
  const info = infoList[0];
  const tz = info.timezone || 'America/Santiago';
  const dayStartHour = info.work_start_hour !== null && info.work_start_hour !== undefined ? info.work_start_hour : 8;
  const dayEndHour = info.work_end_hour !== null && info.work_end_hour !== undefined ? info.work_end_hour : 20;
 
  // Fetch internal busy sessions
  const { data: sessions, error: sessionsErr } = await supabase.rpc('get_specialist_sessions', {
    p_organization_id: organizationId,
    p_specialist_id: specialistId,
    p_date: date,
  });
 
  if (sessionsErr) {
    console.error(`[calculateSpecialistSlots] Error sessions for ${specialistId}:`, sessionsErr);
    return { availableSlots: [], tz };
  }
 
  const busyBlocks: { start: number; end: number }[] = [];
 
  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map((s: any) => s.session_id);
    const { data: sessionsWithDuration } = await supabase
      .from('sessions')
      .select('id, time_session, service:service_id(duration_minutes)')
      .in('id', sessionIds);
      
    const sessionDurationMap = new Map<string, number>();
    if (sessionsWithDuration) {
      for (const s of sessionsWithDuration) {
        const duration = (s.service as any)?.duration_minutes || 60;
        sessionDurationMap.set(s.id, duration);
      }
    }
 
    for (const s of sessions) {
      const timeStr = s.time_session;
      if (timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        const startMin = h * 60 + m;
        const duration = sessionDurationMap.get(s.session_id) || 60;
        const endMin = startMin + duration;
        busyBlocks.push({ start: startMin, end: endMin });
      }
    }
  }
 
  // Google Calendar FreeBusy
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
      console.error(`[Google FreeBusy] Error for specialist ${specialistId}:`, googleErr.message);
    }
  }
 
  // Merge busy blocks
  busyBlocks.sort((a, b) => a.start - b.start);
  const mergedBusy: { start: number; end: number }[] = [];
  for (const b of busyBlocks) {
    if (mergedBusy.length > 0 && b.start < mergedBusy[mergedBusy.length - 1].end) {
      mergedBusy[mergedBusy.length - 1].end = Math.max(mergedBusy[mergedBusy.length - 1].end, b.end);
    } else {
      mergedBusy.push({ ...b });
    }
  }
 
  const availableSlots: string[] = [];
  const dayStartMin = dayStartHour * 60;
  const dayEndMin = dayEndHour * 60;
  const step = durationMinutes + buffer;
 
  const now = Date.now();
  const minAnticipationMs = minAnticipationHours * 60 * 60 * 1000;
 
  function getSlotTimestamp(dateStr: string, hour: number, minute: number, tz: string): number {
    const tempDate = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(tempDate);
    
    const map: Record<string, string> = {};
    parts.forEach(p => { map[p.type] = p.value; });
    
    const tzYear = parseInt(map.year || '0', 10);
    const tzMonth = parseInt(map.month || '0', 10);
    const tzDay = parseInt(map.day || '0', 10);
    const tzHour = parseInt(map.hour || '0', 10);
    const tzMin = parseInt(map.minute || '0', 10);
    
    const perceivedLocal = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, 0);
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetLocal = Date.UTC(year, month - 1, day, hour, minute, 0);
    
    const diff = targetLocal - perceivedLocal;
    return tempDate.getTime() + diff;
  }
 
  let cursor = dayStartMin;
  while (cursor + durationMinutes <= dayEndMin) {
    const slotStart = cursor;
    const slotEnd = cursor + durationMinutes;
 
    const isBusy = mergedBusy.some(
      (b) => slotStart < b.end + buffer && b.start - buffer < slotEnd
    );
 
    if (!isBusy) {
      const h = Math.floor(slotStart / 60);
      const m = slotStart % 60;
      const slotTimestamp = getSlotTimestamp(date, h, m, tz);
 
      if (slotTimestamp >= now + minAnticipationMs) {
        availableSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    cursor += step;
  }
 
  return { availableSlots, tz };
}
 
/**
 * GET /api/v1/integrations/availability
 * Query parameters: specialist_id (optional), date (YYYY-MM-DD), service_id (optional)
 * Headers: Authorization: Bearer pf_live_...
 * Returns available booking slots (union of slots if specialist_id is 'all' or empty).
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
  const { specialist_id, date, service_id } = req.query;
 
  if (!date) {
    return res.status(400).json({ error: 'Falta el parámetro requerido: date.' });
  }
 
  if (typeof date !== 'string') {
    return res.status(400).json({ error: 'Parámetro date inválido.' });
  }
 
  if (specialist_id && typeof specialist_id !== 'string') {
    return res.status(400).json({ error: 'specialist_id inválido.' });
  }
 
  if (service_id && typeof service_id !== 'string') {
    return res.status(400).json({ error: 'service_id inválido.' });
  }
 
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
 
    // 2. Fetch booking settings for buffer and anticipation
    const { data: bookSettings } = await supabase
      .from('booking_settings')
      .select('min_anticipation_hours, buffer_between_sessions_minutes')
      .eq('organization_id', organizationId)
      .maybeSingle();
 
    const minAnticipationHours = bookSettings?.min_anticipation_hours ?? 24;
    const buffer = bookSettings?.buffer_between_sessions_minutes ?? 10;
 
    // 3. Fetch the service's duration_minutes if service_id is provided
    let durationMinutes = 60; // Default to 60 if not specified
    if (service_id) {
      const { data: serviceData } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', service_id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (serviceData) {
        durationMinutes = serviceData.duration_minutes;
      }
    }
 
    const isMultiSpecialist = !specialist_id || specialist_id === 'all' || specialist_id === 'undefined' || specialist_id === 'null';
 
    if (isMultiSpecialist) {
      // Query all clinic specialists
      const { data: professionals, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, full_name, timezone')
        .eq('organization_id', organizationId);
 
      if (profilesErr || !professionals || professionals.length === 0) {
        return res.status(200).json({
          success: true,
          date,
          timezone: 'America/Santiago',
          available_slots: []
        });
      }
 
      const slotResults = await Promise.all(
        professionals.map(p =>
          calculateSpecialistSlots(
            supabase,
            organizationId,
            p.id,
            date,
            durationMinutes,
            buffer,
            minAnticipationHours
          )
        )
      );
 
      // Union of all available slots
      const unionSet = new Set<string>();
      slotResults.forEach(res => {
        res.availableSlots.forEach(slot => unionSet.add(slot));
      });
 
      const sortedSlots = Array.from(unionSet).sort((a, b) => {
        const [ah, am] = a.split(':').map(Number);
        const [bh, bm] = b.split(':').map(Number);
        return ah * 60 + am - (bh * 60 + bm);
      });
 
      const firstTz = professionals[0]?.timezone || 'America/Santiago';
 
      return res.status(200).json({
        success: true,
        date,
        timezone: firstTz,
        available_slots: sortedSlots
      });
    } else {
      // Single specialist
      const { availableSlots, tz } = await calculateSpecialistSlots(
        supabase,
        organizationId,
        specialist_id!,
        date,
        durationMinutes,
        buffer,
        minAnticipationHours
      );
 
      return res.status(200).json({
        success: true,
        date,
        timezone: tz,
        available_slots: availableSlots
      });
    }
  } catch (err: any) {
    console.error('Error in availability API integrations:', err);
    return res.status(500).json({ error: 'Error al calcular disponibilidad.' });
  }
}
 
export default allowCors(handler);
