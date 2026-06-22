/**
 * Email utility helper using Brevo SMTP API.
 */

export async function sendEmail({
  to,
  subject,
  htmlContent,
  senderName = 'Sentido Migrante',
  senderEmail = process.env.BREVO_SENDER_EMAIL || 'no-reply@sentidomigrante.com',
  attachment,
}: {
  to: { name?: string; email: string }[];
  subject: string;
  htmlContent: string;
  senderName?: string;
  senderEmail?: string;
  attachment?: { content: string; name: string }[];
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    console.warn('BREVO_API_KEY is not defined in environment variables. Email dispatch bypassed.');
    return { success: false, error: 'Brevo API key missing' };
  }

  const emailBody: any = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: to.map(t => ({
      name: t.name || t.email,
      email: t.email.trim().toLowerCase()
    })),
    subject,
    htmlContent,
  };

  if (attachment) {
    emailBody.attachment = attachment;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API Error Response:', data);
      throw new Error(data.message || 'Error al despachar el correo con la API de Brevo.');
    }

    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    console.error('Error in sendEmail utility:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
