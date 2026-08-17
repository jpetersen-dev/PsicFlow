import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey } from '../../../../utils/authIntegration';
import { allowCors } from '../../../../utils/cors';
import { WebhookService } from '@/lib/webhookService';
import { sendEmail } from '../../../../utils/emails';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * POST /api/v1/integrations/reserve
 * Headers: Authorization: Bearer pf_live_...
 * Payload: {
 *   specialist_id,
 *   date,
 *   start_time,
 *   patient_data: { first_name, last_name, email, phone },
 *   service_id
 * }
 * Creates patient (if not exists) and a session in state 'Pending payment' with unique transaction id.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 1. Validate API Key
  const authHeader = req.headers.authorization;
  const validation = await validateApiKey(authHeader);

  if (validation.error || !validation.organization_id) {
    return res.status(validation.status || 401).json({ error: validation.error });
  }

  const organizationId = validation.organization_id;

  const { specialist_id, date, start_time, patient_data, service_id, currency } = req.body;

  if (!specialist_id || !date || !start_time || !patient_data) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios en el cuerpo del mensaje.' });
  }

  const { first_name, last_name, email, phone } = patient_data;
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'Faltan campos del paciente (first_name, last_name, email).' });
  }

  try {
    const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
    const supabase = createClient(supabaseUrl, dbKey);

    const { cancel_session_id } = req.body;

    if (cancel_session_id && typeof cancel_session_id === 'string') {
      console.log(`[Reserve API] Releasing previous pending session: ${cancel_session_id}`);
      await supabase
        .from('sessions')
        .delete()
        .eq('id', cancel_session_id)
        .eq('organization_id', organizationId)
        .eq('status_payment', 'Pendiente');
    }

    // 2. Fetch booking prefix dynamically
    const { data: settings } = await supabase
      .from('booking_settings')
      .select('booking_prefix')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const prefix = settings?.booking_prefix || 'PF';
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const transactionId = `${prefix}-${randomSuffix}`;

    const fullName = `${first_name.trim()} ${last_name.trim()}`;

    // 3. Call RPC create_booking_reservation
    const { data: reservationList, error: reserveErr } = await supabase.rpc('create_booking_reservation', {
      p_organization_id: organizationId,
      p_specialist_id: specialist_id,
      p_date: date,
      p_time: start_time,
      p_full_name: fullName,
      p_email: email.trim().toLowerCase(),
      p_phone: phone ? phone.trim() : null,
      p_transaction_id: transactionId,
      p_value: 0.00,
      p_service_id: service_id || null,
      p_currency: currency || 'CLP'
    });

    if (reserveErr || !reservationList || reservationList.length === 0) {
      console.error('Error executing booking reservation RPC in integrations:', reserveErr);
      return res.status(500).json({ error: 'Error al registrar la reserva de cita preventiva.' });
    }

    const reservation = reservationList[0];

    // Check if the service is free orientation (slug: 'entrevista-orientacion-psicologica-online')
    let isFreeOrientation = false;
    if (service_id) {
      const { data: srvData } = await supabase
        .from('services')
        .select('id_slug, price')
        .eq('id', service_id)
        .maybeSingle();
      if (srvData && srvData.id_slug === 'entrevista-orientacion-psicologica-online' && Number(srvData.price) === 0) {
        isFreeOrientation = true;
      }
    }

    if (isFreeOrientation) {
      console.log(`[Reserve API] Sending verification email for free orientation interview session ${reservation.session_id} / ref: ${reservation.transaction_id}`);
      
      // Mark session as pending assignment
      await supabase
        .from('sessions')
        .update({ comentarios_internos: '[PENDIENTE_ASIGNACION]' })
        .eq('id', reservation.session_id);

      const confirmationLink = `https://sentidomigrante.com/confirmar-cita?ref=${reservation.transaction_id}`;
      sendEmail({
        to: [{ name: fullName, email: email.trim().toLowerCase() }],
        subject: 'Confirma tu Entrevista de Orientación Gratuita | Sentido Migrante',
        htmlContent: `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0eade; border-radius: 12px;">
            <h2 style="color: #1a3020; border-bottom: 2px solid #516750; padding-bottom: 10px;">Confirma tu Entrevista de Orientación</h2>
            <p>Hola <strong>${fullName}</strong>,</p>
            <p>Has solicitado agendar una entrevista de orientación gratuita de 20 minutos en Sentido Migrante.</p>
            <p>Para asegurar tu bloque de horario en el sistema, necesitamos verificar tu correo electrónico. Por favor, haz clic en el siguiente botón para confirmar tu correo:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmationLink}" style="background-color: #1a3020; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block;">Verificar Correo Electrónico</a>
            </div>
            <p><strong>Nota importante:</strong> Una vez que verifiques tu correo, tu cita quedará registrada en el sistema y nuestro equipo te asignará un terapeuta disponible. Recibirás un segundo correo con los datos de tu profesional asignado y el enlace correspondiente para la videollamada.</p>
            <p style="font-size: 12px; color: #666;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${confirmationLink}">${confirmationLink}</a></p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 11px; color: #888; text-align: center;">Este es un correo automático. Por favor, no respondas a este mensaje.</p>
          </div>
        `
      }).catch(err => {
        console.error('[Reserve API] Error sending verification email:', err);
      });
    }

    // Trigger webhook asynchronously (non-blocking) for appointment.booked
    WebhookService.trigger('appointment.booked', organizationId, {
      id: reservation.session_id,
      patient_name: fullName,
      patient_email: email.trim().toLowerCase(),
      date,
      time: start_time,
      status: reservation.status_session
    }).catch((err) => {
      console.error('[Webhook] Failed to trigger appointment.booked:', err);
    });

    return res.status(200).json({
      success: true,
      message: 'Reserva temporal creada con éxito. Bloqueada por 15 minutos.',
      transaction_id: reservation.transaction_id,
      session_id: reservation.session_id,
      status_session: reservation.status_session,
      status_payment: reservation.status_payment,
    });
  } catch (err: any) {
    console.error('Unexpected error in booking reserve API integrations:', err);
    return res.status(500).json({ error: 'Error interno de reserva.' });
  }
}

export default allowCors(handler);
