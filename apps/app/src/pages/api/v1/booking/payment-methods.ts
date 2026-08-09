import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * GET /api/v1/booking/payment-methods
 * Query Parameter: organization_id
 * Returns public booking settings and active payment gateways (filtering out secret keys).
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organization_id } = req.query;

  if (!organization_id || typeof organization_id !== 'string') {
    return res.status(400).json({ error: 'El parámetro organization_id es obligatorio.' });
  }

  try {
    const dbKey = supabaseServiceKey || supabaseAnonKey;
    const supabase = createClient(supabaseUrl, dbKey);

    // 1. Fetch booking settings
    const { data: settings, error: settingsErr } = await supabase
      .from('booking_settings')
      .select('currency, payment_links, bank_transfer_details, terms_text')
      .eq('organization_id', organization_id)
      .maybeSingle();

    if (settingsErr) {
      console.error('Error fetching booking settings:', settingsErr);
      return res.status(500).json({ error: 'Error al consultar configuración de la clínica.' });
    }

    if (!settings) {
      return res.status(404).json({ error: 'Configuración de reservas no encontrada para esta clínica.' });
    }

    // 2. Fetch active payment gateways
    const { data: gateways, error: gatewaysErr } = await supabase
      .from('organization_payment_gateways')
      .select('provider, credentials')
      .eq('organization_id', organization_id)
      .eq('is_active', true);

    if (gatewaysErr) {
      console.error('Error fetching payment gateways:', gatewaysErr);
      return res.status(500).json({ error: 'Error al consultar pasarelas de pago.' });
    }

    // 3. Map gateways to filter out secret credentials, returning only public ones
    const activeGateways = (gateways || []).map(g => {
      const publicCreds: Record<string, any> = {};
      
      if (g.credentials) {
        if (g.provider === 'paypal') {
          publicCreds.clientId = g.credentials.clientId || null;
        } else if (g.provider === 'lemonsqueezy') {
          publicCreds.storeId = g.credentials.storeId || null;
          publicCreds.variantId = g.credentials.variantId || null;
        }
      }

      return {
        provider: g.provider,
        credentials: publicCreds
      };
    });

    return res.status(200).json({
      success: true,
      currency: settings.currency,
      terms_text: settings.terms_text || '',
      payment_links: settings.payment_links || {},
      bank_transfer_details: settings.bank_transfer_details || {},
      active_gateways: activeGateways
    });
  } catch (err: any) {
    console.error('Unexpected error in payment-methods API:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
