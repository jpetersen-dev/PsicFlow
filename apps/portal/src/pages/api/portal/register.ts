import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { validateEmail } from '../../../utils/validators';
import { sendEmail } from '../../../utils/emails';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, full_name } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'El correo, la contraseña y el nombre son requeridos.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!validateEmail(cleanEmail)) {
    return res.status(400).json({ error: 'El formato de correo electrónico es incorrecto.' });
  }

  try {
    // 1. Check if user is already registered in patients or profiles table with a user_id
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id, user_id')
      .eq('email', cleanEmail)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (existingPatient || existingProfile) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // 2. Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // 3. Insert OTP verification code
    const { error: insertErr } = await supabase
      .from('patient_verifications')
      .insert({
        email: cleanEmail,
        code: otpCode,
        expires_at: expiresAt
      });

    if (insertErr) {
      console.error('Error inserting OTP verification:', insertErr);
      return res.status(500).json({ error: 'Error al generar el código de verificación.' });
    }

    // 4. Send email using Brevo SMTP
    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #FCFBF9; border-radius: 24px; border: 1px solid #F2EFE8; color: #1C1917;">
        <h2 style="font-size: 24px; font-weight: 700; color: #516750; margin-bottom: 24px; text-align: center;">Verifica tu correo electrónico</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #44403C; margin-bottom: 32px; text-align: center;">Hola ${full_name}, gracias por registrarte en el Portal del Paciente de Sentido Migrante. Por favor, usa el siguiente código de verificación de 6 dígitos para completar tu registro:</p>
        <div style="background-color: #DAEDDF; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px;">
          <span style="font-family: monospace; font-size: 36px; font-weight: 700; color: #1A3020; letter-spacing: 6px;">${otpCode}</span>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #78716C; text-align: center; margin-top: 32px; border-top: 1px solid #E7E5E4; padding-top: 24px;">Este código expira en 15 minutos. Si no solicitaste este código, puedes ignorar este correo de forma segura.</p>
      </div>
    `;

    const emailRes = await sendEmail({
      to: [{ name: full_name, email: cleanEmail }],
      subject: `Código de verificación: ${otpCode} - Sentido Migrante`,
      htmlContent,
    });

    if (!emailRes.success) {
      console.error('Error sending Brevo email:', emailRes.error);
      return res.status(500).json({ error: 'Error al despachar el correo de verificación.' });
    }

    return res.status(200).json({ success: true, message: 'Código de verificación enviado.' });
  } catch (err: any) {
    console.error('Unexpected error in register API:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
