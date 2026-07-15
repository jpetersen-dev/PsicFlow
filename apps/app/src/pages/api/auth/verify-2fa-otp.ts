import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email y código son obligatorios.' });
  }

  try {
    const { data: isValid, error: verifyErr } = await supabase.rpc('verify_superadmin_otp', {
      p_email: email.trim().toLowerCase(),
      p_otp_code: code.trim()
    });

    if (verifyErr) {
      throw verifyErr;
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Código de verificación incorrecto o expirado.' });
    }

    return res.status(200).json({ success: true, message: 'Código verificado con éxito.' });
  } catch (err: any) {
    console.error('Error in verify-2fa-otp:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
