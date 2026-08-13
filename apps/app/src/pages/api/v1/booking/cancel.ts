import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { deleteGoogleEvent } from '../../../../lib/googleCalendar';
import { sendEmail } from '../../../../utils/emails';
import { allowCors } from '../../../../utils/cors';
import { WebhookService } from '../../../../lib/webhookService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * POST /api/v1/booking/cancel
 * Body: { sessionId }
 * Cancels a future session. Validates patient auth and ownership.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado: Falta token de sesión.' });
  }

  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Falta el parámetro sessionId.' });
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
      console.error('[Cancel Session API] Patient profile not found for user:', user.id, patientErr);
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
      console.error('[Cancel Session API] Session not found or access denied:', sessionId, sessionErr);
      return res.status(404).json({ error: 'La sesión no existe o no tienes permiso para cancelarla.' });
    }

    // Check if session is already cancelled
    if (session.status_session === 'Cancelada') {
      return res.status(400).json({ error: 'La sesión ya se encuentra cancelada.' });
    }

    // Check if session is in the past
    const now = new Date();
    const sessionDateTime = new Date(`${session.date_session}T${session.time_session}`);
    if (sessionDateTime < now) {
      return res.status(400).json({ error: 'No se pueden cancelar citas que ya han ocurrido.' });
    }

    // 4. Update session status to 'Cancelada'
    const { error: updateErr } = await serviceSupabase
      .from('sessions')
      .update({ status_session: 'Cancelada' })
      .eq('id', sessionId);

    if (updateErr) {
      console.error('[Cancel Session API] Database update error:', updateErr);
      return res.status(500).json({ error: 'Error al cancelar la sesión en la base de datos.' });
    }

    // 5. De-sync Google Calendar event if it exists
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
          await deleteGoogleEvent(connection.refresh_token, connection.clinical_calendar_id, session.google_event_id);
          // Clear google_event_id column
          await serviceSupabase
            .from('sessions')
            .update({ google_event_id: null })
            .eq('id', sessionId);
          calendarMessage = 'Sincronizado y eliminado';
        } catch (calErr: any) {
          console.error('[Cancel Session API] Google Calendar deletion error:', calErr);
          calendarMessage = 'Error al eliminar el evento de Google Calendar';
        }
      }
    }

    // 6. Send notification email via Brevo
    const formattedDate = new Date(`${session.date_session}T${session.time_session}`).toLocaleDateString('es-ES', {
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
            <h3 style="color: #BA1A1A; margin-top: 0;">Cancelación de Cita</h3>
            <p>Hola <strong>${patient.full_name}</strong>,</p>
            <p>Te confirmamos que tu cita programada con el terapeuta <strong>${specialistName}</strong> ha sido cancelada exitosamente.</p>
            
            <div style="background-color: #FDF2F2; border-left: 4px solid #BA1A1A; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Detalles de la Cita Cancelada:</strong></p>
              <p style="margin: 5px 0 0 0;">📅 Fecha y hora: ${formattedDate}</p>
              <p style="margin: 5px 0 0 0;">🗣️ Modalidad: ${session.modality || 'Online'}</p>
            </div>

            <p>Si deseas agendar un nuevo horario, puedes hacerlo ingresando a tu portal personal.</p>
            <p>Saludos cordiales,<br>Equipo Sentido Migrante</p>
          </div>
        </body>
        </html>
      `;
      await sendEmail({
        to: [{ name: patient.full_name, email: patient.email }],
        subject: `Confirmación de Cancelación de Cita - Sentido Migrante`,
        htmlContent: patientHtml,
      });
    } catch (emailErr) {
      console.error('[Cancel Session API] Failed to send email to patient:', emailErr);
    }

    // Specialist email
    if (specialistEmail) {
      try {
        const specialistHtml = `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #F9F7F5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #EAEAEA;">
              <h3 style="color: #BA1A1A; margin-top: 0;">Cita Cancelada por el Paciente</h3>
              <p>Hola <strong>${specialistName}</strong>,</p>
              <p>El paciente <strong>${patient.full_name}</strong> ha cancelado su cita programada.</p>
              
              <div style="background-color: #FDF2F2; border-left: 4px solid #BA1A1A; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Detalles de la Cita Cancelada:</strong></p>
                <p style="margin: 5px 0 0 0;">👤 Paciente: ${patient.full_name}</p>
                <p style="margin: 5px 0 0 0;">📅 Fecha y hora: ${formattedDate}</p>
              </div>

              <p>La cita ha sido liberada en tu agenda digital y se eliminó de tu Google Calendar sincronizado.</p>
              <p>Saludos cordiales,<br>Ecosistema PsicFlow</p>
            </div>
          </body>
          </html>
        `;
        await sendEmail({
          to: [{ name: specialistName, email: specialistEmail }],
          subject: `[Cita Cancelada] ${patient.full_name} - ${formattedDate}`,
          htmlContent: specialistHtml,
        });
      } catch (emailErr) {
        console.error('[Cancel Session API] Failed to send email to specialist:', emailErr);
      }
    }

    // 7. Trigger webhook
    WebhookService.trigger('appointment.cancelled', session.organization_id, {
      id: session.id,
      patient_name: patient.full_name,
      patient_email: patient.email,
      date: session.date_session,
      time: session.time_session,
      status: 'Cancelada',
    }).catch(err => {
      console.error('[Cancel Session API] Webhook dispatch error:', err);
    });

    return res.status(200).json({
      success: true,
      message: 'Cita cancelada con éxito.',
      calendar: calendarMessage
    });
  } catch (err: any) {
    console.error('[Cancel Session API] Unexpected exception:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
