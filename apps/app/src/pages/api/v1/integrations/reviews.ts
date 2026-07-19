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

  // 2. Verify plan features for reviews
  const isFeatureActive = await verifyFeatureForOrganization(organizationId, 'reviews');
  if (!isFeatureActive) {
    return res.status(403).json({ error: 'El plan contratado para esta clínica no incluye la funcionalidad de reseñas.' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 3. Fetch reviews using the secure get_public_reviews RPC
    const { data: reviews, error: fetchErr } = await supabase.rpc('get_public_reviews', {
      p_organization_id: organizationId,
    });

    if (fetchErr) {
      console.error('Error fetching reviews via RPC:', fetchErr);
      return res.status(500).json({ error: 'Error al recuperar las reseñas de la clínica.' });
    }

    return res.status(200).json({
      success: true,
      organization_id: organizationId,
      reviews: reviews || [],
    });
  } catch (error: any) {
    console.error('Error inside reviews integration route:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
