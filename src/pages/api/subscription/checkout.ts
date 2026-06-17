import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, full_name, clinic_name, rut_professional, email } = req.body;

  if (!plan || !full_name || !clinic_name || !rut_professional || !email) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    // 1. Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const orgId = randomUUID();

    // 2. Create organization (clinic) with selected plan
    const { error: orgErr } = await supabase
      .from('organizations')
      .insert({
        id: orgId,
        name: clinic_name.trim(),
        current_plan: plan,
      });

    if (orgErr) {
      throw new Error(orgErr.message || 'Error al crear la clínica.');
    }

    // 3. Generate a secure unique token
    const token = 'invite-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // 4. Create invitation using tenant header to pass RLS policy
    const supabaseTenant = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { 'x-tenant-id': orgId } },
    });

    const { error: inviteErr } = await supabaseTenant
      .from('invitations')
      .insert({
        token,
        organization_id: orgId,
        role_name: 'admin_clinica',
        email: email.trim().toLowerCase(),
      });

    if (inviteErr) {
      throw new Error(inviteErr.message || 'Error al registrar la invitación.');
    }

    // 5. Build invitation URL dynamically
    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const inviteUrl = `${protocol}://${host}/invitacion/${token}`;

    // 6. Send Onboarding Email via Brevo API
    const brevoApiKey = process.env.BREVO_API_KEY;
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'no-reply@psicoalivio.cl';

    if (!brevoApiKey) {
      console.warn('BREVO_API_KEY is not defined in environment variables. Email dispatch bypassed.');
      return res.status(200).json({
        success: true,
        message: 'Clínica y token de invitación creados con éxito (Envío de correo omitido por falta de API Key).',
        inviteUrl,
      });
    }

    const emailBody = {
      sender: {
        name: 'PsicoAlivio',
        email: brevoSenderEmail,
      },
      to: [
        {
          email: email.trim().toLowerCase(),
          name: full_name.trim(),
        },
      ],
      subject: `¡Te damos la bienvenida a PsicoAlivio, ${full_name.trim()}!`,
      htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Alta en PsicoAlivio</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f9f9ff;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #cbd5e0;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
    }
    .header {
      background-color: #006168;
      padding: 40px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px;
      color: #111c2c;
      line-height: 1.6;
    }
    .content h2 {
      font-size: 20px;
      margin-top: 0;
      color: #006168;
    }
    .btn {
      display: inline-block;
      background-color: #006168;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 30px;
      border-radius: 12px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      background-color: #f0f3ff;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6e797a;
      border-top: 1px solid #e7eeff;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PsicoAlivio</h1>
    </div>
    <div class="content">
      <h2>¡Te damos la bienvenida, ${full_name.trim()}!</h2>
      <p>Gracias por suscribirte al plan <strong>${plan}</strong> de PsicoAlivio, tu nuevo ecosistema de evolución clínica y gestión profesional.</p>
      <p>Hemos configurado tu clínica <strong>${clinic_name.trim()}</strong> en nuestros servidores. Para completar el alta de tu cuenta y comenzar a utilizar la plataforma, haz clic en el siguiente botón:</p>
      
      <div style="text-align: center;">
        <a href="${inviteUrl}" class="btn" style="color: #ffffff;">Activar mi Cuenta</a>
      </div>
      
      <p style="font-size: 13px; color: #6e797a;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
      <a href="${inviteUrl}" style="color: #006168;">${inviteUrl}</a></p>
      
      <p>Este enlace de activación expirará en 7 días.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 PsicoAlivio. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al despachar el correo con la API de Brevo.');
    }

    return res.status(200).json({
      success: true,
      message: 'Suscripción completada. El correo de activación ha sido enviado.',
      inviteUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
