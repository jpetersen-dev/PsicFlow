import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { createGoogleEvent } from '../../../lib/googleCalendar';
import { sendEmail } from '../../../utils/emails';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * POST /api/webhooks/wise
 * Receives Wise Business payment webhook notifications, reconciles sessions, and locks Google Calendar.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Robustly extract transfer reference (e.g. SM-A3X9R)
  const body = req.body || {};
  const reference = 
    body.reference || 
    (body.data?.resource?.reference) || 
    (body.data?.reference);

  if (!reference || typeof reference !== 'string') {
    console.warn('Wise Webhook: Received payload without a valid reference field.', req.body);
    return res.status(400).json({ error: 'Falta la referencia de transferencia.' });
  }

  console.log(`Wise Webhook: Processing reconciliation for reference: ${reference}`);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Confirm session payment and retrieve clinical details via SECURITY DEFINER RPC
    const { data: updatedSessions, error: confirmErr } = await supabase.rpc('confirm_session_payment', {
      p_transaction_id: reference.trim(),
    });

    if (confirmErr) {
      console.error('Wise Webhook: Error calling confirm_session_payment RPC:', confirmErr);
      return res.status(500).json({ error: 'Error al conciliar el pago en base de datos.' });
    }

    if (!updatedSessions || updatedSessions.length === 0) {
      console.log(`Wise Webhook: No pending session found matching transaction_id: ${reference}`);
      return res.status(200).json({ success: true, message: 'Referencia procesada. No se encontró cita pendiente asociada.' });
    }

    const session = updatedSessions[0];
    console.log(`Wise Webhook: Session reconciled successfully. ID: ${session.session_id}, Patient: ${session.patient_name}`);

    let hangoutLink: string | null = null;
    const dateStr = session.date_session; // "YYYY-MM-DD"
    const timeStr = session.time_session; // "HH:MM:SS" or "HH:MM"
    const startISO = `${dateStr}T${timeStr}`;

    // Compute 1 hour duration
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

    // 2. Sync to Google Calendar if psychologist has a connection mapped
    if (session.google_refresh_token && session.clinical_calendar_id) {
      try {
        const eventPayload = {
          summary: `Cita Clínica: ${session.patient_name}`,
          description: `Cita confirmada mediante transferencia Wise.\nModalidad: ${session.modality || 'Online'}\nRef: ${reference}`,
          start: startISO,
          end: endISO,
          timeZone: session.specialist_timezone || 'America/Santiago',
          attendees: session.patient_email ? [session.patient_email] : [],
        };

        console.log(`Wise Webhook: Inserting Google Calendar event for session ${session.session_id}...`);
        const result = await createGoogleEvent(
          session.google_refresh_token,
          session.clinical_calendar_id,
          eventPayload
        );

        const googleEventId = result.id;
        hangoutLink = result.hangoutLink;

        if (googleEventId) {
          // Save the google_event_id in Supabase
          const { error: updateEventErr } = await supabase.rpc('update_session_google_event_id', {
            p_session_id: session.session_id,
            p_google_event_id: googleEventId,
          });
          if (updateEventErr) {
            console.error('Wise Webhook: Error saving google_event_id:', updateEventErr);
          } else {
            console.log(`Wise Webhook: Google Calendar event synced. ID: ${googleEventId}`);
          }

          // If we got a Google Meet link, save it to comments so it shows up in dashboards
          if (hangoutLink) {
            const meetComment = `Enlace de Google Meet: ${hangoutLink}`;
            await supabase
              .from('sessions')
              .update({ comentarios_internos: meetComment })
              .eq('id', session.session_id);
          }
        }
      } catch (calendarErr: any) {
        console.error('Wise Webhook: Failed to sync event to Google Calendar:', calendarErr.message);
      }
    } else {
      console.log('Wise Webhook: Psychologist does not have active Google Calendar integration. Skipped sync.');
    }

    // 3. Send confirmation emails using Brevo SMTP
    // Patient Email
    if (session.patient_email) {
      try {
        const formattedDate = new Date(`${dateStr}T${timeStr}`).toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const patientHtml = `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #F9F7F5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #EAEAEA;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #1A3020; margin: 0;">Sentido Migrante</h2>
                <p style="font-size: 12px; color: #7F8C8D; margin: 5px 0 0 0;">Psicoterapia y Vínculo Cultural</p>
              </div>
              <hr style="border: none; border-top: 1px solid #EEEEEE; margin-bottom: 25px;">
              <p>Hola <strong>${session.patient_name}</strong>,</p>
              <p>Te confirmamos que hemos recibido tu pago para la sesión clínica con <strong>${session.specialist_name || 'tu especialista'}</strong>.</p>
              
              <div style="background-color: #F0F4F1; border-left: 4px solid #1A3020; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0 0 5px 0;"><strong>Detalles de la sesión:</strong></p>
                <p style="margin: 0;">📅 Fecha: ${formattedDate}</p>
                <p style="margin: 5px 0 0 0;">🗣️ Modalidad: ${session.modality || 'Online'}</p>
                ${hangoutLink ? `<p style="margin: 5px 0 0 0;">💻 Enlace de Google Meet: <a href="${hangoutLink}" style="color: #1A3020; font-weight: bold; text-decoration: underline;">Unirse a la videollamada</a></p>` : ''}
              </div>

              <p>Te hemos adjuntado una invitación de calendario (.ics) a este correo. Puedes abrirla para agregar la sesión directamente a tu agenda (Google Calendar, Outlook o Apple Calendar).</p>
              
              <p>Para gestionar tus citas, subir documentos o comunicarte con tu terapeuta, puedes acceder a tu **Portal del Paciente** en cualquier momento:</p>
              <p style="text-align: center; margin: 25px 0;">
                <a href="http://localhost:3001/portal" style="background-color: #1A3020; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Ir al Portal del Paciente</a>
              </p>

              <p>Si tienes alguna pregunta, no dudes en responder a este correo.</p>
              <p>Un cálido abrazo,<br>El equipo de Sentido Migrante</p>
            </div>
          </body>
          </html>
        `;

        // Generate ICS content
        const icsContent = generateICS({
          uid: `session-${session.session_id}@psicflow.com`,
          summary: `Sesión de Terapia - ${session.specialist_name}`,
          description: `Cita confirmada con ${session.specialist_name}.\nEnlace de videollamada (Meet): ${hangoutLink || 'Por confirmar'}\nModalidad: ${session.modality || 'Online'}\nRef: ${reference}`,
          startStr: startISO,
          endStr: endISO,
          location: hangoutLink || 'Videollamada de Google Meet',
          organizerName: session.specialist_name,
          organizerEmail: session.specialist_email || 'soporte@psicflow.com',
          attendeeName: session.patient_name,
          attendeeEmail: session.patient_email,
          timeZone: session.specialist_timezone || 'America/Santiago',
        });

        await sendEmail({
          to: [{ name: session.patient_name, email: session.patient_email }],
          subject: `Cita Confirmada con ${session.specialist_name || 'Especialista'} - Sentido Migrante`,
          htmlContent: patientHtml,
          attachment: [
            {
              content: Buffer.from(icsContent).toString('base64'),
              name: 'invitacion-sesion.ics',
            },
          ],
        });
        console.log(`Wise Webhook: Confirmation email sent to patient: ${session.patient_email}`);
      } catch (emailErr: any) {
        console.error('Wise Webhook: Error sending patient email:', emailErr);
      }
    }

    // Specialist Email
    if (session.specialist_email) {
      try {
        const formattedDate = new Date(`${dateStr}T${timeStr}`).toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const therapistHtml = `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #F9F7F5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #EAEAEA;">
              <h3 style="color: #1A3020; margin-top: 0;">Nueva Cita Agendada y Confirmada</h3>
              <p>Hola <strong>${session.specialist_name}</strong>,</p>
              <p>Se ha confirmado una nueva cita para tu agenda a través del agendamiento automático de Sentido Migrante.</p>
              
              <div style="background-color: #F7F9FA; border-left: 4px solid #3498DB; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0 0 5px 0;"><strong>Detalles del Paciente:</strong></p>
                <p style="margin: 0;">👤 Nombre: ${session.patient_name}</p>
                <p style="margin: 5px 0 0 0;">📧 Correo: ${session.patient_email || 'N/A'}</p>
                <p style="margin: 15px 0 5px 0;"><strong>Detalles del Evento:</strong></p>
                <p style="margin: 0;">📅 Fecha: ${formattedDate}</p>
                <p style="margin: 5px 0 0 0;">🗣️ Modalidad: ${session.modality || 'Online'}</p>
                ${hangoutLink ? `<p style="margin: 5px 0 0 0;">💻 Enlace de Google Meet: <a href="${hangoutLink}" style="color: #2980B9; font-weight: bold; text-decoration: underline;">Unirse a Google Meet</a></p>` : ''}
              </div>

              <p>El evento ya ha sido sincronizado e insertado en tu Google Calendar configurado (e invitando al paciente).</p>
              <p>Puedes ver los detalles clínicos de este paciente en tu panel de PsicFlow.</p>
              <p style="margin-top: 20px;">Saludos cordiales,<br>Ecosistema PsicFlow</p>
            </div>
          </body>
          </html>
        `;

        await sendEmail({
          to: [{ name: session.specialist_name, email: session.specialist_email }],
          subject: `[Nueva Cita] ${session.patient_name} - ${formattedDate}`,
          htmlContent: therapistHtml,
        });
        console.log(`Wise Webhook: Notification email sent to specialist: ${session.specialist_email}`);
      } catch (emailErr: any) {
        console.error('Wise Webhook: Error sending specialist email:', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Cita conciliada y calendarizada con éxito.',
      session_id: session.session_id,
      patient_name: session.patient_name,
      meeting_link: hangoutLink,
    });
  } catch (err: any) {
    console.error('Wise Webhook: Unexpected server error:', err);
    return res.status(500).json({ error: 'Error interno de webhook.' });
  }
}

function generateICS({
  uid,
  summary,
  description,
  startStr,
  endStr,
  location,
  organizerName,
  organizerEmail,
  attendeeName,
  attendeeEmail,
  timeZone,
}: {
  uid: string;
  summary: string;
  description: string;
  startStr: string;
  endStr: string;
  location?: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  timeZone: string;
}): string {
  const formatICSDate = (isoStr: string) => {
    return isoStr.replace(/[-:]/g, '').split('.')[0];
  };

  const dtstart = formatICSDate(startStr);
  const dtend = formatICSDate(endStr);
  const dtstamp = formatICSDate(new Date().toISOString());

  const escapeText = (str: string) => {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  };

  const escSummary = escapeText(summary);
  const escDescription = escapeText(description);
  const escLocation = escapeText(location || '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PsicFlow//Calendar Event//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${timeZone}:${dtstart}`,
    `DTEND;TZID=${timeZone}:${dtend}`,
    `SUMMARY:${escSummary}`,
    `DESCRIPTION:${escDescription}`,
    `LOCATION:${escLocation}`,
    `ORGANIZER;CN="${organizerName}":MAILTO:${organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${attendeeName}":MAILTO:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

