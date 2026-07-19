import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey } from '../../../../utils/authIntegration';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // 1. Validate API Key
  const authHeader = req.headers.authorization;
  const validation = await validateApiKey(authHeader);

  if (validation.error || !validation.organization_id) {
    return res.status(validation.status || 401).json({ error: validation.error });
  }

  const organizationId = validation.organization_id;

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 2. Fetch booking settings
    const { data: settings, error: settingsErr } = await supabase
      .from('booking_settings')
      .select('currency, payment_links, bank_transfer_details, terms_text')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (settingsErr) {
      console.error('Error fetching booking settings:', settingsErr);
      return res.status(500).json({ error: 'Error al consultar configuración de la clínica.' });
    }

    if (!settings) {
      return res.status(200).json({
        success: true,
        currency: 'CLP',
        terms_text: '',
        payment_links: {},
        bank_transfer_details: {},
        active_gateways: []
      });
    }

    // 3. Fetch active payment gateways
    const { data: gateways, error: gatewaysErr } = await supabase
      .from('organization_payment_gateways')
      .select('provider, credentials')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (gatewaysErr) {
      console.error('Error fetching payment gateways:', gatewaysErr);
      return res.status(500).json({ error: 'Error al consultar pasarelas de pago.' });
    }

    // 4. Map gateways to filter out secret credentials, returning only public ones
    const activeGateways = (gateways || []).map(g => {
      const publicCreds: Record<string, any> = {};
      
      if (g.credentials) {
        if (g.provider === 'stripe') {
          publicCreds.publicKey = g.credentials.publicKey || g.credentials.public_key || null;
        } else if (g.provider === 'mercadopago') {
          publicCreds.publicKey = g.credentials.publicKey || g.credentials.public_key || null;
        } else if (g.provider === 'dlocal_go') {
          publicCreds.publicKey = g.credentials.publicKey || g.credentials.public_key || null;
        }
      }

      return {
        provider: g.provider,
        credentials: publicCreds
      };
    });

    return res.status(200).json({
      success: true,
      organization_id: organizationId,
      currency: settings.currency,
      terms_text: settings.terms_text || '',
      payment_links: settings.payment_links || {},
      bank_transfer_details: settings.bank_transfer_details || {},
      active_gateways: activeGateways
    });
  } catch (error: any) {
    console.error('Error inside payment-methods integration route:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
