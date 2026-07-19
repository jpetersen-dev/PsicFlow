import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, secret } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Falta la URL de destino.' });
  }

  if (!url.startsWith('https://')) {
    return res.status(400).json({ error: 'La URL debe comenzar con https:// para garantizar la seguridad.' });
  }

  const payload = {
    event: 'ping',
    timestamp: new Date().toISOString(),
    data: {
      message: 'Conexión de prueba exitosa.'
    }
  };

  const payloadString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'PsicFlow-Webhook-Ping/1.0',
  };

  if (secret) {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
    headers['x-psicflow-signature'] = signature;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Leer respuesta del destino si existe (máximo 150 caracteres para mostrar en UI)
    let bodyText = '';
    try {
      bodyText = (await response.text()).substring(0, 150);
    } catch (_) {}

    return res.status(200).json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      responseBody: bodyText
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[Webhook Ping Error]:', error);
    return res.status(200).json({
      success: false,
      error: error.name === 'AbortError' ? 'El servidor de destino excedió el tiempo límite (6s).' : error.message
    });
  }
}
