import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { updateGoogleEvent } from '../../../../lib/googleCalendar';
import { sendEmail } from '../../../../utils/emails';
import { allowCors } from '../../../../utils/cors';
import { WebhookService } from '../../../../lib/webhookService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/v1/booking/reschedule
 * Body: { sessionId, newDate, newTime }
 * Reschedules a future session. Validates patient auth and checks slot availability.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado: Falta token de sesión.' });
  }

  const { sessionId, newDate, newTime } = req.body;
  if (!sessionId || !newDate || !newTime) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos: sessionId, newDate, newTime.' });
  }

  try {
    // 1. Authenticate patient user from JWT
    const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await clientSupabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }

    // 2. Query patient profile and session ownership using service role
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: patient, error: patientErr } = await serviceSupabase
      .from('patients')
      .select('id, organization_id, full_name, email')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (patientErr || !patient) {
      console.error('[Reschedule Session API] Patient profile not found for user:', user.id, patientErr);
      return res.status(404).json({ error: 'No se encontró la ficha del paciente.' });
    }

    // 3. Fetch session details and verify it belongs to this patient
    const { data: session, error: sessionErr } = await serviceSupabase
      .from('sessions')
      .select('*, professional:professional_id (id, full_name, email, timezone)')
      .eq('id', sessionId)
      .eq('patient_id', patient.id)
      .limit(1)
      .single();

    if (sessionErr || !session) {
      console.error('[Reschedule Session API] Session not found or access denied:', sessionId, sessionErr);
      return res.status(404).json({ error: 'La sesión no existe o no tienes permiso para reprogramarla.' });
    }

    // Check if session is already cancelled
    if (session.status_session === 'Cancelada') {
      return res.status(400).json({ error: 'No se puede reprogramar una sesión cancelada.' });
    }

    // 4. Verify that the new slot is available (no conflicting sessions)
    const { data: conflicting, error: conflictErr } = await serviceSupabase
      .from('sessions')
      .select('id')
      .eq('professional_id', session.professional_id)
      .eq('date_session', newDate)
      .eq('time_session', newTime)
      .neq('status_session', 'Cancelada')
      .limit(1);

    if (conflictErr) {
      console.error('[Reschedule Session API] Error checking conflict:', conflictErr);
      return res.status(500).json({ error: 'Error al verificar disponibilidad del horario.' });
    }

    if (conflicting && conflicting.length > 0) {
      return res.status(400).json({ error: 'El horario seleccionado ya se encuentra ocupado. Por favor elige otro bloque.' });
    }

    const oldDateStr = session.date_session;
    const oldTimeStr = session.time_session;

    // 5. Update session date and time in database
    const { error: updateErr } = await serviceSupabase
      .from('sessions')
      .update({
        date_session: newDate,
        time_session: newTime
      })
      .eq('id', sessionId);

    if (updateErr) {
      console.error('[Reschedule Session API] Database update error:', updateErr);
      return res.status(500).json({ error: 'Error al reprogramar la sesión en la base de datos.' });
    }

    // 6. Update Google Calendar event if it exists
    let calendarMessage = 'Sin sincronización de calendario';
    if (session.google_event_id) {
      const { data: connection } = await serviceSupabase
        .from('google_calendar_connections')
        .select('refresh_token, clinical_calendar_id')
        .eq('profile_id', session.professional_id)
        .limit(1)
        .single();

      if (connection?.refresh_token && connection?.clinical_calendar_id) {
        try {
          const tz = session.professional?.timezone || 'America/Santiago';
          const startISO = `${newDate}T${newTime}`;
          
          // Add 1 hour to start time
          const [y, mon, d] = newDate.split('-').map(Number);
          const [h, m] = newTime.split(':').map(Number);
          const dateObj = new Date(y, mon - 1, d, h, m, 0);
          dateObj.setHours(dateObj.getHours() + 1);

          const endYear = dateObj.getFullYear();
          const endMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
          const endDay = String(dateObj.getDate()).padStart(2, '0');
          const endHour = String(dateObj.getHours()).padStart(2, '0');
          const endMin = String(dateObj.getMinutes()).padStart(2, '0');
          const endISO = `${endYear}-${endMonth}-${endDay}T${endHour}:${endMin}:00`;

          const eventPayload = {
            summary: `Cita Clínica: ${patient.full_name}`,
            description: `Cita reprogramada en PsicFlow.\nModalidad: ${session.modality || 'Online'}\nEstado de pago: ${session.status_payment || 'Pagado'}`,
            start: startISO,
            end: endISO,
            timeZone: tz,
          };

          await updateGoogleEvent(connection.refresh_token, connection.clinical_calendar_id, session.google_event_id, eventPayload);
          calendarMessage = 'Sincronizado y actualizado';
        } catch (calErr: any) {
          console.error('[Reschedule Session API] Google Calendar update error:', calErr);
          calendarMessage = 'Error al actualizar el evento de Google Calendar';
        }
      }
    }

    // 7. Send notification emails via Brevo
    const formattedOldDate = new Date(`${oldDateStr}T${oldTimeStr}`).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const formattedNewDate = new Date(`${newDate}T${newTime}`).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const specialistName = session.professional?.full_name || 'Terapeuta';
    const specialistEmail = session.professional?.email;

    // Patient email
    try {
      const patientHtml = `
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #F9F7F5; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #EAEAEA;">
            <h3 style="color: #3E5C4E; margin-top: 0;">Reprogramación de Cita</h3>
            <p>Hola <strong>${patient.full_name}</strong>,</p>
            <p>Te confirmamos que tu cita con el terapeuta <strong>${specialistName}</strong> ha sido reprogramada exitosamente.</p>
            
            <div style="background-color: #F4F6F5; border-left: 4px solid #3E5C4E; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Detalles de la Cita:</strong></p>
              <p style="margin: 5px 0 0 0;">❌ Horario anterior: <span style="text-decoration: line-through;">${formattedOldDate}</span></p>
              <p style="margin: 5px 0 0 0;">✅ Horario nuevo: <strong>${formattedNewDate}</strong></p>
              <p style="margin: 5px 0 0 0;">🗣️ Modalidad: ${session.modality || 'Online'}</p>
            </div>

            <p>El enlace de videollamada seguirá siendo el mismo y estará activo 5 minutos antes de la hora acordada.</p>
            <p>Saludos cordiales,<br>Equipo Sentido Migrante</p>
          </div>
        </body>
        </html>
      `;
      await sendEmail({
        to: [{ name: patient.full_name, email: patient.email }],
        subject: `Confirmación de Reprogramación de Cita - Sentido Migrante`,
        htmlContent: patientHtml,
      });
    } catch (emailErr) {
      console.error('[Reschedule Session API] Failed to send email to patient:', emailErr);
    }

    // Specialist email
    if (specialistEmail) {
      try {
        const specialistHtml = `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #F9F7F5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #EAEAEA;">
              <h3 style="color: #3E5C4E; margin-top: 0;">Cita Reprogramada por el Paciente</h3>
              <p>Hola <strong>${specialistName}</strong>,</p>
              <p>El paciente <strong>${patient.full_name}</strong> ha reprogramado su cita clínica.</p>
              
              <div style="background-color: #F4F6F5; border-left: 4px solid #3E5C4E; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Detalles de la Cita:</strong></p>
                <p style="margin: 5px 0 0 0;">👤 Paciente: ${patient.full_name}</p>
                <p style="margin: 5px 0 0 0;">❌ Horario anterior: <span style="text-decoration: line-through;">${formattedOldDate}</span></p>
                <p style="margin: 5px 0 0 0;">✅ Horario nuevo: <strong>${formattedNewDate}</strong></p>
              </div>

              <p>El evento ya ha sido actualizado en tu Google Calendar.</p>
              <p>Saludos cordiales,<br>Ecosistema PsicFlow</p>
            </div>
          </body>
          </html>
        `;
        await sendEmail({
          to: [{ name: specialistName, email: specialistEmail }],
          subject: `[Cita Reprogramada] ${patient.full_name} - Nuevo horario: ${formattedNewDate}`,
          htmlContent: specialistHtml,
        });
      } catch (emailErr) {
        console.error('[Reschedule Session API] Failed to send email to specialist:', emailErr);
      }
    }

    // 8. Trigger webhook
    WebhookService.trigger('appointment.rescheduled', session.organization_id, {
      id: session.id,
      patient_name: patient.full_name,
      patient_email: patient.email,
      old_date: oldDateStr,
      old_time: oldTimeStr,
      new_date: newDate,
      new_time: newTime,
      status: session.status_session,
    }).catch(err => {
      console.error('[Reschedule Session API] Webhook dispatch error:', err);
    });

    return res.status(200).json({
      success: true,
      message: 'Cita reprogramada con éxito.',
      calendar: calendarMessage
    });
  } catch (err: any) {
    console.error('[Reschedule Session API] Unexpected exception:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
