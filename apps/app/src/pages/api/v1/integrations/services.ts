import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey } from '../../../../utils/authIntegration';
import { verifyFeatureForOrganization } from '../../../../utils/planFeatures';
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

  // 2. Verify booking feature is active for this tenant
  const isFeatureActive = await verifyFeatureForOrganization(organizationId, 'booking');
  if (!isFeatureActive) {
    return res.status(403).json({ error: 'El plan contratado para esta clínica no incluye la funcionalidad de reservas.' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 3. Fetch active services for this organization
    const { data: services, error: fetchErr } = await supabase
      .from('services')
      .select('id, title, id_slug, duration_minutes, price, currency, image_url, desc, clinical_approach, seo_description, icon, color, alternate_prices')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('title', { ascending: true });

    if (fetchErr) {
      console.error('Error fetching services:', fetchErr);
      return res.status(500).json({ error: 'Error al recuperar los servicios de la clínica.' });
    }

    return res.status(200).json({
      success: true,
      organization_id: organizationId,
      services: services || [],
    });
  } catch (error: any) {
    console.error('Error inside services integration route:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
