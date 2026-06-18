import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from '../../../lib/googleCalendar';

/**
 * POST /api/google/sync-event
 * Body: { type: 'session' | 'event', id: string, action: 'create' | 'update' | 'delete' }
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

  const { type, id, action } = req.body;
  if (!type || !id || !action) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
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

    // Get professional profile
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

    // Get Google Calendar connection
    const { data: connection } = await supabase
      .from('google_calendar_connections')
      .select('refresh_token, clinical_calendar_id, personal_calendar_id')
      .eq('profile_id', profile.id)
      .eq('organization_id', tenantId)
      .limit(1)
      .single();

    if (!connection || !connection.refresh_token) {
      // No Google connection, skip sync gracefully
      return res.status(200).json({ success: true, message: 'Google Calendar no conectado' });
    }

    const tz = profile.timezone || 'America/Santiago';

    // Handle Clinical Sessions Sync
    if (type === 'session') {
      const calendarId = connection.clinical_calendar_id;
      if (!calendarId) {
        // No clinical calendar mapped, skip sync
        return res.status(200).json({ success: true, message: 'Calendario clínico no mapeado' });
      }

      // If it is a delete action, we must delete it first
      if (action === 'delete') {
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('google_event_id')
          .eq('id', id)
          .single();

        if (sessionData?.google_event_id) {
          await deleteGoogleEvent(connection.refresh_token, calendarId, sessionData.google_event_id);
        }
        return res.status(200).json({ success: true, message: 'Sesión eliminada de Google Calendar' });
      }

      // If create or update, fetch the session details
      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .select('*, patient:patient_id (full_name)')
        .eq('id', id)
        .single();

      if (sessionErr || !sessionData) {
        return res.status(404).json({ error: 'Sesión no encontrada' });
      }

      // If session is cancelled, remove from Google Calendar
      if (sessionData.status_session === 'Cancelada') {
        if (sessionData.google_event_id) {
          await deleteGoogleEvent(connection.refresh_token, calendarId, sessionData.google_event_id);
          await supabase.from('sessions').update({ google_event_id: null }).eq('id', id);
        }
        return res.status(200).json({ success: true, message: 'Evento eliminado (sesión cancelada)' });
      }

      const patientName = sessionData.patient?.full_name || 'Paciente';
      const summary = `Cita Clínica: ${patientName}`;
      const description = `Cita programada en PsicFlow.\nModalidad: ${sessionData.modality || 'Online'}\nEstado de pago: ${sessionData.status_payment || 'Pendiente'}`;

      // Construct local timestamps without offset, let google parse with timezone
      const dateStr = sessionData.date_session;
      const timeStr = sessionData.time_session;
      const startISO = `${dateStr}T${timeStr}`;

      // Add 1 hour to start time
      const [y, mon, d] = dateStr.split('-').map(Number);
      const [h, m] = timeStr.split(':').map(Number);
      const dateObj = new Date(y, mon - 1, d, h, m, 0);
      dateObj.setHours(dateObj.getHours() + 1);

      const endYear = dateObj.getFullYear();
      const endMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
      const endDay = String(dateObj.getDate()).padStart(2, '0');
      const endHour = String(dateObj.getHours()).padStart(2, '0');
      const endMin = String(dateObj.getMinutes()).padStart(2, '0');
      const endISO = `${endYear}-${endMonth}-${endDay}T${endHour}:${endMin}:00`;

      const eventPayload = {
        summary,
        description,
        start: startISO,
        end: endISO,
        timeZone: tz,
      };

      if (sessionData.google_event_id) {
        // Update
        try {
          await updateGoogleEvent(connection.refresh_token, calendarId, sessionData.google_event_id, eventPayload);
          return res.status(200).json({ success: true, message: 'Evento de Google actualizado' });
        } catch (updateErr: any) {
          // If event was deleted in Google Calendar manually, recreate it
          if (updateErr.code === 404 || updateErr.code === 410) {
            const newEventId = await createGoogleEvent(connection.refresh_token, calendarId, eventPayload);
            await supabase.from('sessions').update({ google_event_id: newEventId }).eq('id', id);
            return res.status(200).json({ success: true, message: 'Evento de Google recreado' });
          }
          throw updateErr;
        }
      } else {
        // Create
        const googleEventId = await createGoogleEvent(connection.refresh_token, calendarId, eventPayload);
        await supabase.from('sessions').update({ google_event_id: googleEventId }).eq('id', id);
        return res.status(200).json({ success: true, googleEventId });
      }
    }

    // Handle Personal Events Sync
    if (type === 'event') {
      const calendarId = connection.personal_calendar_id;
      if (!calendarId) {
        // No personal calendar mapped, skip sync
        return res.status(200).json({ success: true, message: 'Calendario personal no mapeado' });
      }

      if (action === 'delete') {
        const { data: eventData } = await supabase
          .from('personal_events')
          .select('google_event_id')
          .eq('id', id)
          .single();

        if (eventData?.google_event_id) {
          await deleteGoogleEvent(connection.refresh_token, calendarId, eventData.google_event_id);
        }
        return res.status(200).json({ success: true, message: 'Evento personal eliminado de Google Calendar' });
      }

      const { data: eventData, error: eventErr } = await supabase
        .from('personal_events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventErr || !eventData) {
        return res.status(404).json({ error: 'Evento personal no encontrado' });
      }

      const summary = eventData.title || 'Evento Personal';
      const description = eventData.description || 'Actividad creada en PsicFlow';
      const dateStr = eventData.event_date;
      const startISO = `${dateStr}T${eventData.start_time}`;
      const endISO = `${dateStr}T${eventData.end_time}`;

      const eventPayload = {
        summary,
        description,
        start: startISO,
        end: endISO,
        timeZone: tz,
      };

      if (eventData.google_event_id) {
        // Update
        try {
          await updateGoogleEvent(connection.refresh_token, calendarId, eventData.google_event_id, eventPayload);
          return res.status(200).json({ success: true, message: 'Evento personal de Google actualizado' });
        } catch (updateErr: any) {
          if (updateErr.code === 404 || updateErr.code === 410) {
            const newEventId = await createGoogleEvent(connection.refresh_token, calendarId, eventPayload);
            await supabase.from('personal_events').update({ google_event_id: newEventId }).eq('id', id);
            return res.status(200).json({ success: true, message: 'Evento personal de Google recreado' });
          }
          throw updateErr;
        }
      } else {
        // Create
        const googleEventId = await createGoogleEvent(connection.refresh_token, calendarId, eventPayload);
        await supabase.from('personal_events').update({ google_event_id: googleEventId }).eq('id', id);
        return res.status(200).json({ success: true, googleEventId });
      }
    }

    return res.status(400).json({ error: 'Tipo de evento inválido' });
  } catch (err: any) {
    console.error('Error in /api/google/sync-event:', err);
    return res.status(500).json({ error: 'Error interno de sincronización', details: err.message });
  }
}
