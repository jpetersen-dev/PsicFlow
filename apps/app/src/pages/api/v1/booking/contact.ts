import type { NextApiRequest, NextApiResponse } from 'next';
import { sendEmail } from '../../../../utils/emails';
import { allowCors } from '../../../../utils/cors';

/**
 * POST /api/v1/booking/contact
 * Centralized contact email sender using the Brevo integration.
 * Sends contact details directly to contacto@sentidomigrante.com.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Todos los campos (nombre, email, mensaje) son requeridos.' });
  }

  try {
    const emailRes = await sendEmail({
      to: [{ name: 'Contacto Sentido Migrante', email: 'contacto@sentidomigrante.com' }],
      subject: `[Contacto Web] Nuevo mensaje de ${name}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Nuevo mensaje de contacto</h2>
          <p>Has recibido un nuevo mensaje a través del formulario de la landing page:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 120px;">Nombre:</td>
              <td style="padding: 8px 0;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Mensaje:</td>
              <td style="padding: 8px 0; white-space: pre-wrap;">${message}</td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #666; text-align: center;">
            Este correo fue enviado automáticamente por el sistema de contacto de Sentido Migrante.
          </p>
        </div>
      `,
      senderName: name,
      senderEmail: 'no-reply@sentidomigrante.com'
    });

    if (!emailRes.success) {
      console.error('Brevo Contact dispatch error:', emailRes.error);
      return res.status(500).json({ error: 'Error al enviar el correo a través de Brevo: ' + emailRes.error });
    }

    return res.status(200).json({
      success: true,
      message: 'Mensaje enviado exitosamente.'
    });
  } catch (err: any) {
    console.error('Unexpected error in contact API:', err);
    return res.status(500).json({ error: 'Error interno al enviar el correo.' });
  }
}

export default allowCors(handler);
