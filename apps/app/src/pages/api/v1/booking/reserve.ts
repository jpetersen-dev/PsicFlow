import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * POST /api/v1/booking/reserve
 * Payload: {
 *   organization_id,
 *   specialist_id,
 *   date,
 *   start_time,
 *   patient_data: { first_name, last_name, email, phone }
 * }
 * Creates patient (if not exists) and a session in state 'Pending payment' with unique transaction id.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organization_id, specialist_id, date, start_time, patient_data } = req.body;

  if (!organization_id || !specialist_id || !date || !start_time || !patient_data) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios en el cuerpo del mensaje.' });
  }

  const { first_name, last_name, email, phone } = patient_data;
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'Faltan campos del paciente (first_name, last_name, email).' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Fetch booking prefix dynamically
    const { data: settings } = await supabase
      .from('booking_settings')
      .select('booking_prefix')
      .eq('organization_id', organization_id)
      .maybeSingle();

    const prefix = settings?.booking_prefix || 'PF';
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const transactionId = `${prefix}-${randomSuffix}`;

    const fullName = `${first_name.trim()} ${last_name.trim()}`;

    // 2. Call RPC create_booking_reservation
    const { data: reservationList, error: reserveErr } = await supabase.rpc('create_booking_reservation', {
      p_organization_id: organization_id,
      p_specialist_id: specialist_id,
      p_date: date,
      p_time: start_time,
      p_full_name: fullName,
      p_email: email.trim().toLowerCase(),
      p_phone: phone ? phone.trim() : null,
      p_transaction_id: transactionId,
      p_value: 0.00, // Or configure standard booking price if required
    });

    if (reserveErr || !reservationList || reservationList.length === 0) {
      console.error('Error executing booking reservation RPC:', reserveErr);
      return res.status(500).json({ error: 'Error al registrar la reserva de cita preventiva.' });
    }

    const reservation = reservationList[0];

    return res.status(200).json({
      success: true,
      message: 'Reserva temporal creada con éxito. Bloqueada por 15 minutos.',
      transaction_id: reservation.transaction_id,
      session_id: reservation.session_id,
      status_session: reservation.status_session,
      status_payment: reservation.status_payment,
    });
  } catch (err: any) {
    console.error('Unexpected error in booking reserve API:', err);
    return res.status(500).json({ error: 'Error interno de reserva.' });
  }
}

export default allowCors(handler);
