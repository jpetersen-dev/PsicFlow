import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey } from '../../../../utils/authIntegration';
import { allowCors } from '../../../../utils/cors';
import { sendEmail } from '../../../../utils/emails';
import { createGoogleEvent } from '../../../../lib/googleCalendar';
import { WebhookService } from '@/lib/webhookService';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
 
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
  const { ref } = req.query;
 
  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: 'El parámetro ref (transaction_id) es obligatorio.' });
  }
 
  try {
    const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
    const supabase = createClient(supabaseUrl, dbKey);
 
    // 2. Fetch the session details
    const { data: session, error: fetchErr } = await supabase
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
        google_event_id,
        comentarios_internos,
        patient:patient_id (id, full_name, email, phone, status, ficha_id_num),
        professional:professional_id (id, full_name, email, timezone),
        service:service_id (id, title, duration_minutes, id_slug)
      `)
      .eq('transaction_id', ref)
      .eq('organization_id', organizationId)
      .maybeSingle();
 
    if (fetchErr || !session) {
      console.error('[Confirm Orientation API Error] Session not found:', fetchErr);
      return res.status(404).json({ error: 'No se encontró la cita de orientación asociada a esta referencia.' });
    }
 
    const patient = session.patient as any;
    const professional = session.professional as any;
    const service = session.service as any;
 
    // Verify it is indeed the free orientation interview
    if (service?.id_slug !== 'entrevista-orientacion-psicologica-online' && Number(session.value_session) > 0) {
      return res.status(400).json({ error: 'Esta referencia no corresponde a una entrevista de orientación gratuita.' });
    }
 
    const isPendingAssignment = session.comentarios_internos?.includes('[PENDIENTE_ASIGNACION]');
 
    // If already confirmed, return success immediately
    if (session.status_payment === 'Pagado') {
      let hangoutLink: string | null = null;
      if (session.comentarios_internos && session.comentarios_internos.includes('Google Meet:')) {
        hangoutLink = session.comentarios_internos.split('Google Meet:')[1]?.trim() || null;
      }
 
      return res.status(200).json({
        success: true,
        message: 'La cita ya se encontraba confirmada.',
        patientName: patient?.full_name || '',
        specialistName: isPendingAssignment ? 'Pendiente de asignación' : (professional?.full_name || ''),
        date: session.date_session,
        time: session.time_session?.substring(0, 5) || '',
        hangoutLink,
        pendingAssignment: isPendingAssignment
      });
    }
 
    // 3. Confirm the Session
    const { error: updateErr } = await supabase
      .from('sessions')
      .update({
        status_payment: 'Pagado',
        status_session: 'Programada',
        payment_type: 'Enlace Correo',
        payment_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', session.id);
 
    if (updateErr) {
      console.error('[Confirm Orientation API Error] Updating session:', updateErr);
      return res.status(500).json({ error: 'Error al confirmar el agendamiento.' });
    }
 
    // 4. Check & Open Clinical Chart (ficha_id_num) for prospecto patient
    if (patient && !patient.ficha_id_num) {
      const today = new Date();
      const yy = String(today.getFullYear()).slice(-2);
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const datePrefix = `${yy}${mm}${dd}`;
 
      const { data: countData } = await supabase
        .from('patients')
        .select('ficha_id_num')
        .eq('organization_id', organizationId)
        .like('ficha_id_num', `${datePrefix}%`);
 
      const count = countData ? countData.length : 0;
      const fichaIdNum = `${datePrefix}${String(count + 1).padStart(2, '0')}`;
 
      console.log(`[Confirm Orientation API] Generating ficha_id_num ${fichaIdNum} for prospecto patient ${patient.id}`);
      await supabase
        .from('patients')
        .update({ ficha_id_num: fichaIdNum })
        .eq('id', patient.id);
    }
 
    // 5. Flow branch based on PENDIENTE_ASIGNACION
    if (isPendingAssignment) {
      // Send Pending Assignment email to patient
      if (patient.email) {
        sendEmail({
          to: [{ name: patient.full_name, email: patient.email }],
          subject: '¡Correo Verificado! Tu Entrevista de Orientación está en proceso | Sentido Migrante',
          htmlContent: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0eade; border-radius: 12px;">
              <h2 style="color: #1a3020; border-bottom: 2px solid #516750; padding-bottom: 10px;">¡Correo Verificado con éxito!</h2>
              <p>Hola <strong>${patient.full_name}</strong>,</p>
              <p>Tu correo electrónico ha sido verificado. Tu entrevista de orientación gratuita de 20 minutos está siendo procesada para la asignación de un terapeuta disponible.</p>
              
              <div style="background-color: #fcfbf9; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Fecha Solicitada:</strong> ${session.date_session}</p>
                <p style="margin: 5px 0;"><strong>Hora Solicitada:</strong> ${session.time_session?.substring(0, 5)} hrs</p>
                <p style="margin: 5px 0;"><strong>Estado:</strong> Esperando asignación de terapeuta</p>
              </div>
              
              <p>En las próximas horas recibirás un segundo correo con la invitación definitiva de calendario (.ics), el nombre del profesional asignado y el enlace de Google Meet para la videollamada.</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 11px; color: #888; text-align: center;">Sentido Migrante - Apoyo psicológico transcultural en tu idioma.</p>
            </div>
          `
        }).catch(err => console.error('[Confirm Orientation API] Error sending pending assignment email:', err));
      }
 
      // Webhook for confirmed but pending assignment
      WebhookService.trigger('appointment.confirmed', organizationId, {
        id: session.id,
        patient_name: patient.full_name,
        patient_email: patient.email,
        date: session.date_session,
        time: session.time_session,
        status_payment: 'Pagado',
        pendingAssignment: true
      }).catch(err => console.error('[Confirm Orientation API] Webhook trigger error:', err));
 
      return res.status(200).json({
        success: true,
        message: 'Cita de orientación confirmada y pendiente de asignación.',
        patientName: patient.full_name,
        specialistName: 'Pendiente de asignación',
        date: session.date_session,
        time: session.time_session?.substring(0, 5) || '',
        meetingLink: null,
        pendingAssignment: true
      });
    }
 
    // Otherwise, therapist is already assigned (e.g. manually reassigned before patient clicked confirm)
    let hangoutLink: string | null = null;
    const { data: connection } = await supabase
      .from('google_calendar_connections')
      .select('refresh_token, clinical_calendar_id')
      .eq('profile_id', professional.id)
      .eq('organization_id', organizationId)
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
          description: `Entrevista de orientación clínica gratuita de 20 minutos.\nEnlace confirmado vía correo.\nRef: ${ref}`,
          start: startISO,
          end: endISO,
          timeZone: professional.timezone || 'America/Santiago',
          attendees: patient.email ? [patient.email] : [],
        };
 
        console.log(`[Confirm Orientation API] Inserting Google Calendar event for session ${session.id}...`);
        const result = await createGoogleEvent(
          connection.refresh_token,
          connection.clinical_calendar_id,
          eventPayload
        );
 
        const googleEventId = result.id;
        hangoutLink = result.hangoutLink;
 
        if (googleEventId) {
          await supabase
            .from('sessions')
            .update({ google_event_id: googleEventId })
            .eq('id', session.id);
 
          if (hangoutLink) {
            const meetComment = `Enlace de Google Meet: ${hangoutLink}`;
            await supabase
              .from('sessions')
              .update({ comentarios_internos: meetComment })
              .eq('id', session.id);
          }
        }
      } catch (calendarErr: any) {
        console.error('[Confirm Orientation API] Failed to sync event to Google Calendar:', calendarErr.message || calendarErr);
      }
    }
 
    // Send email notification to patient with ICS file attached
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
        description: `Entrevista de orientación clínica de 20 minutos con ${professional.full_name}.\nEnlace: ${hangoutLink || 'Meet'}`,
        startStr: startISO,
        endStr: endISO,
        location: hangoutLink || 'Videollamada Online',
        organizerName: professional.full_name,
        organizerEmail: professional.email || 'hola@sentidomigrante.com',
        attendeeName: patient.full_name,
        attendeeEmail: patient.email,
        timeZone: professional.timezone || 'America/Santiago'
      });
 
      sendEmail({
        to: [{ name: patient.full_name, email: patient.email }],
        subject: '¡Entrevista de Orientación Agendada y Confirmada! | Sentido Migrante',
        htmlContent: `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0eade; border-radius: 12px;">
            <h2 style="color: #1a3020; border-bottom: 2px solid #516750; padding-bottom: 10px;">Tu Entrevista de Orientación está Confirmada</h2>
            <p>Hola <strong>${patient.full_name}</strong>,</p>
            <p>Tu correo ha sido verificado con éxito y tu sesión de orientación clínica gratuita de 20 minutos ha quedado agendada de forma definitiva con el terapeuta <strong>${professional.full_name}</strong>.</p>
            
            <div style="background-color: #fcfbf9; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Especialista:</strong> ${professional.full_name}</p>
              <p style="margin: 5px 0;"><strong>Contacto:</strong> ${professional.email || ''}</p>
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
      }).catch(err => console.error('[Confirm Orientation API] Error sending patient confirmation email:', err));
    }
 
    // Send email notification to therapist (Jonathan/Specialist)
    if (professional.email) {
      sendEmail({
        to: [{ name: professional.full_name, email: professional.email }],
        subject: `Entrevista de Orientación Confirmada: ${patient.full_name}`,
        htmlContent: `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0eade; border-radius: 12px;">
            <h2 style="color: #1a3020; border-bottom: 2px solid #516750; padding-bottom: 10px;">Nueva Cita de Orientación Confirmada</h2>
            <p>Hola <strong>${professional.full_name}</strong>,</p>
            <p>El paciente <strong>${patient.full_name}</strong> ha confirmado su correo electrónico y su entrevista de orientación gratuita ya está agendada en tu calendario.</p>
            
            <div style="background-color: #fcfbf9; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Paciente:</strong> ${patient.full_name} (${patient.email})</p>
              <p style="margin: 5px 0;"><strong>Fecha:</strong> ${session.date_session}</p>
              <p style="margin: 5px 0;"><strong>Hora:</strong> ${session.time_session?.substring(0, 5)} hrs</p>
              <p style="margin: 5px 0;"><strong>Enlace Google Meet:</strong> ${hangoutLink || 'No disponible (Revisa tu conexión de Google Calendar)'}</p>
            </div>
            
            <p>El paciente permanece registrado con el estado de <strong>prospecto</strong>, y se le ha asignado el número de ficha clínica correspondiente.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 11px; color: #888; text-align: center;">Notificaciones automáticas de PsicFlow.</p>
          </div>
        `
      }).catch(err => console.error('[Confirm Orientation API] Error sending specialist email:', err));
    }
 
    // Trigger webhook for appointment.confirmed
    WebhookService.trigger('appointment.confirmed', organizationId, {
      id: session.id,
      patient_name: patient.full_name,
      patient_email: patient.email,
      date: session.date_session,
      time: session.time_session,
      status_payment: 'Pagado',
      hangoutLink
    }).catch(err => console.error('[Confirm Orientation API] Webhook trigger error:', err));
 
    return res.status(200).json({
      success: true,
      message: 'Cita de orientación confirmada y sincronizada.',
      patientName: patient.full_name,
      specialistName: professional.full_name,
      date: session.date_session,
      time: session.time_session?.substring(0, 5) || '',
      meetingLink: hangoutLink
    });
  } catch (err: any) {
    console.error('[Confirm Orientation API Exception]:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
 
export default allowCors(handler);
