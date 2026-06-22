import type { NextApiRequest, NextApiResponse } from 'next';
import { allowCors } from '../../../utils/cors';

/**
 * POST /api/webhooks/simulate-wise
 * Body: { reference }
 * Simulates a webhook notification coming from Wise Business.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference } = req.body;

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ error: 'El parámetro reference (ej: SM-102) es obligatorio.' });
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3001';
    const webhookUrl = `${protocol}://${host}/api/webhooks/wise`;

    console.log(`Simulation: Sending mock Wise webhook to ${webhookUrl} for reference: ${reference}`);

    // Mock Wise webhook payload
    const mockPayload = {
      event_type: 'transfer-state-change',
      data: {
        resource: {
          id: Math.floor(Math.random() * 10000000),
          reference: reference.trim(),
          status: 'incoming_payment_settled',
        },
      },
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockPayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: responseData.error || 'El webhook retornó un error.',
        details: responseData,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Simulación de transferencia Wise enviada con éxito.',
      webhook_response: responseData,
    });
  } catch (err: any) {
    console.error('Simulation: Error triggering mock webhook:', err);
    return res.status(500).json({ error: 'Error al simular webhook de Wise.', details: err.message });
  }
}

export default allowCors(handler);
