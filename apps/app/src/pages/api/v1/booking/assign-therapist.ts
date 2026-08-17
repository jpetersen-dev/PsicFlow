import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../../../../utils/emails';
import { createGoogleEvent } from '../../../../lib/googleCalendar';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
 
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
 
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
 
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado' });
  }
 
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'Falta el tenant activo' });
  }
 
  const { sessionId, professionalId } = req.body;
  if (!sessionId || !professionalId) {
    return res.status(400).json({ error: 'Faltan parámetros: sessionId, professionalId.' });
  }
 
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader, 'x-tenant-id': tenantId } }
    });
 
    // Verify user profile is admin_clinica
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }
 
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role_name')
      .eq('user_id', user.id)
      .eq('organization_id', tenantId)
      .limit(1)
      .single();
 
    if (!profile || profile.role_name !== 'admin_clinica') {
      return res.status(403).json({ error: 'No tienes permisos para reasignar terapeutas.' });
    }
 
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
 
    // Fetch session details
    const { data: session, error: sessionErr } = await supabaseService
      .from('sessions')
      .select(`
        id,
        date_session,
        time_session,
        modality,
        transaction_id,
        patient_id,
        professional_id,
        value_session,
        currency,
        status_payment,
        comentarios_internos,
        google_event_id,
        patient:patient_id (id, full_name, email, phone, status, ficha_id_num),
        professional:professional_id (id, full_name, email, timezone),
        service:service_id (id, title, duration_minutes, id_slug)
      `)
      .eq('id', sessionId)
      .eq('organization_id', tenantId)
      .maybeSingle();
 
    if (sessionErr || !session) {
      console.error('[Assign Therapist API Error] Session not found:', sessionErr);
      return res.status(404).json({ error: 'No se encontró la sesión.' });
    }
 
    // Fetch new specialist info
    const { data: newSpecialist, error: specErr } = await supabaseService
      .from('profiles')
      .select('id, full_name, email, timezone')
      .eq('id', professionalId)
      .eq('organization_id', tenantId)
      .maybeSingle();
 
    if (specErr || !newSpecialist) {
      return res.status(404).json({ error: 'No se encontró el terapeuta a asignar.' });
    }
 
    const cleanComments = (session.comentarios_internos || '').replace('[PENDIENTE_ASIGNACION]', '').trim();
 
    // Update the session's therapist and comments
    const { error: updateErr } = await supabaseService
      .from('sessions')
      .update({
        professional_id: professionalId,
        comentarios_internos: cleanComments
      })
      .eq('id', sessionId);
 
    if (updateErr) {
      console.error('[Assign Therapist API Error] Updating session:', updateErr);
      return res.status(500).json({ error: 'Error al reasignar el terapeuta en la base de datos.' });
    }
 
    const patient = session.patient as any;
    const service = session.service as any;
 
    let hangoutLink: string | null = null;
 
    // If the session is already confirmed (Pagado), do Google Calendar Sync & Emails!
    if (session.status_payment === 'Pagado') {
      const { data: connection } = await supabaseService
        .from('google_calendar_connections')
        .select('refresh_token, clinical_calendar_id')
        .eq('profile_id', professionalId)
        .eq('organization_id', tenantId)
        .maybeSingle();
 
      if (connection?.refresh_token && connection?.clinical_calendar_id) {
        try {
          const duration = service?.duration_minutes || 20;
          const startISO = `${session.date_session}T${session.time_session}`;
          
          const [y, mon, d] = session.date_session.split('-').map(Number);
          const [h, m] = session.time_session.split(':').map(Number);
          const dateObj = new Date(y, mon - 1, d, h, m, 0);
          dateObj.setMinutes(dateObj.getMinutes() + duration);
 
          const endYear = dateObj.getFullYear();
          const endMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
          const endDay = String(dateObj.getDate()).padStart(2, '0');
          const endHour = String(dateObj.getHours()).padStart(2, '0');
          const endMin = String(dateObj.getMinutes()).padStart(2, '0');
          const endISO = `${endYear}-${endMonth}-${endDay}T${endHour}:${endMin}:00`;
 
          const eventPayload = {
            summary: `Entrevista de Orientación: ${patient.full_name}`,
            description: `Entrevista de orientación clínica gratuita de 20 minutos.\nRef: ${session.transaction_id}`,
            start: startISO,
            end: endISO,
            timeZone: newSpecialist.timezone || 'America/Santiago',
            attendees: patient.email ? [patient.email] : [],
          };
 
          const result = await createGoogleEvent(
            connection.refresh_token,
            connection.clinical_calendar_id,
            eventPayload
          );
 
          const googleEventId = result.id;
          hangoutLink = result.hangoutLink;
 
          if (googleEventId) {
            await supabaseService
              .from('sessions')
              .update({ google_event_id: googleEventId })
              .eq('id', session.id);
 
            if (hangoutLink) {
              const meetComment = `Enlace de Google Meet: ${hangoutLink}`;
              await supabaseService
                .from('sessions')
                .update({ comentarios_internos: meetComment })
                .eq('id', session.id);
            }
          }
        } catch (calendarErr: any) {
          console.error('[Assign Therapist API] Failed Google Calendar Sync:', calendarErr.message || calendarErr);
        }
      }
 
      // Send Patient Confirmation Email with ICS attachment
      if (patient.email) {
        const formattedDate = new Date(`${session.date_session}T${session.time_session}`).toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const formattedTime = session.time_session?.substring(0, 5) || '';
        
        const meetSec = hangoutLink 
          ? `<p><strong>Enlace de Google Meet para unirse:</strong><br><a href="${hangoutLink}" style="color: #1a3020; font-weight: bold;">${hangoutLink}</a></p>`
          : `<p>Tu terapeuta se pondrá en contacto contigo para enviarte el enlace de conexión.</p>`;
 
        // Build ICS file content
        const startISO = `${session.date_session}T${session.time_session}`;
        const [y, mon, d] = session.date_session.split('-').map(Number);
        const [h, m] = session.time_session.split(':').map(Number);
        const duration = service?.duration_minutes || 20;
        const dateObj = new Date(y, mon - 1, d, h, m, 0);
        dateObj.setMinutes(dateObj.getMinutes() + duration);
        const endISO = dateObj.toISOString();
 
        const icsContent = generateICS({
          uid: `sm-session-${session.id}`,
          summary: `Entrevista de Orientación - Sentido Migrante`,
          description: `Entrevista de orientación clínica de 20 minutos con ${newSpecialist.full_name}.\nEnlace: ${hangoutLink || 'Meet'}`,
          startStr: startISO,
          endStr: endISO,
          location: hangoutLink || 'Videollamada Online',
          organizerName: newSpecialist.full_name,
          organizerEmail: newSpecialist.email || 'hola@sentidomigrante.com',
          attendeeName: patient.full_name,
          attendeeEmail: patient.email,
          timeZone: newSpecialist.timezone || 'America/Santiago'
        });
 
        sendEmail({
          to: [{ name: patient.full_name, email: patient.email }],
          subject: '¡Entrevista de Orientación Agendada y Confirmada! | Sentido Migrante',
          htmlContent: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0eade; border-radius: 12px;">
              <h2 style="color: #1a3020; border-bottom: 2px solid #516750; padding-bottom: 10px;">Tu Entrevista de Orientación está Confirmada</h2>
              <p>Hola <strong>${patient.full_name}</strong>,</p>
              <p>Te informamos que tu entrevista de orientación clínica gratuita de 20 minutos ha sido asignada al profesional <strong>${newSpecialist.full_name}</strong> y agendada de forma definitiva.</p>
              
              <div style="background-color: #fcfbf9; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Especialista:</strong> ${newSpecialist.full_name}</p>
                <p style="margin: 5px 0;"><strong>Contacto:</strong> ${newSpecialist.email || ''}</p>
                <p style="margin: 5px 0;"><strong>Fecha:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0;"><strong>Hora:</strong> ${formattedTime} hrs (horario del terapeuta)</p>
              </div>
              
              ${meetSec}
              
              <p>Te hemos adjuntado una invitación de calendario (.ics) a este correo para que agregues el bloque directamente a tu agenda personal.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 11px; color: #888; text-align: center;">Sentido Migrante - Apoyo psicológico transcultural en tu idioma.</p>
            </div>
          `,
          attachment: [
            {
              content: Buffer.from(icsContent).toString('base64'),
              name: 'invitacion-sesion.ics'
            }
          ]
        }).catch(err => console.error('[Assign Therapist API] Error sending patient confirmation email:', err));
      }
 
      // Send Specialist Confirmation Email
      if (newSpecialist.email) {
        sendEmail({
          to: [{ name: newSpecialist.full_name, email: newSpecialist.email }],
          subject: `Nueva Entrevista de Orientación Asignada: ${patient.full_name}`,
          htmlContent: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0eade; border-radius: 12px;">
              <h2 style="color: #1a3020; border-bottom: 2px solid #516750; padding-bottom: 10px;">Nueva Cita Asignada</h2>
              <p>Hola <strong>${newSpecialist.full_name}</strong>,</p>
              <p>Se te ha asignado la entrevista de orientación gratuita del paciente <strong>${patient.full_name}</strong>.</p>
              
              <div style="background-color: #fcfbf9; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Paciente:</strong> ${patient.full_name} (${patient.email})</p>
                <p style="margin: 5px 0;"><strong>Fecha:</strong> ${session.date_session}</p>
                <p style="margin: 5px 0;"><strong>Hora:</strong> ${session.time_session?.substring(0, 5)} hrs</p>
                <p style="margin: 5px 0;"><strong>Enlace Google Meet:</strong> ${hangoutLink || 'No disponible (Revisa tu conexión de Google Calendar)'}</p>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 11px; color: #888; text-align: center;">Notificaciones de PsicFlow.</p>
            </div>
          `
        }).catch(err => console.error('[Assign Therapist API] Error sending specialist email:', err));
      }
    }
 
    return res.status(200).json({
      success: true,
      message: 'Terapeuta asignado correctamente.',
      professionalName: newSpecialist.full_name,
      meetingLink: hangoutLink
    });
  } catch (err: any) {
    console.error('[Assign Therapist Exception]:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
