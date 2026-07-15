import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { sendEmail } from '../../../utils/emails';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || email.trim().toLowerCase() !== 'jpz.dev.solutions@gmail.com') {
    return res.status(400).json({ error: 'Email inválido o no autorizado.' });
  }

  try {
    // 1. Generate 6-digit random code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // 2. Save OTP code in DB
    const { error: otpErr } = await supabase.rpc('generate_superadmin_otp', {
      p_email: email.trim().toLowerCase(),
      p_otp_code: otpCode,
      p_expires_at: expiresAt
    });

    if (otpErr) {
      throw new Error('Error al registrar OTP en base de datos: ' + otpErr.message);
    }

    // 3. Send email via Brevo
    const emailSubject = 'Código de Verificación - PsicFlow Superadmin';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #fafbfc;">
        <h2 style="color: #0d9488; font-size: 20px; font-weight: bold; margin-bottom: 10px;">Verificación en Dos Pasos - PsicFlow</h2>
        <p style="color: #4b5563; font-size: 14px;">Has solicitado iniciar sesión como Superadmin en la plataforma PsicFlow.</p>
        <p style="color: #4b5563; font-size: 14px;">Utiliza el siguiente código de verificación de un solo uso para completar el acceso:</p>
        
        <div style="background-color: #f3f4f6; border: 1px solid #d1d5db; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; color: #111827; margin: 20px 0;">
          ${otpCode}
        </div>
        
        <p style="color: #9ca3af; font-size: 11px;">Este código expira en 10 minutos. Si no has solicitado este acceso, puedes ignorar este correo de forma segura.</p>
      </div>
    `;

    const emailResult = await sendEmail({
      to: [{ name: 'Superadmin', email: email.trim().toLowerCase() }],
      subject: emailSubject,
      htmlContent: emailHtml,
      senderName: 'PsicFlow',
    });

    if (!emailResult.success) {
      throw new Error('No se pudo enviar el correo de verificación.');
    }

    return res.status(200).json({ success: true, message: 'Código OTP enviado con éxito.' });
  } catch (err: any) {
    console.error('Error in send-2fa-otp:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
