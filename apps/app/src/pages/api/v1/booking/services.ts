import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { allowCors } from '../../../../utils/cors';
import { verifyFeatureForOrganization } from '../../../../utils/planFeatures';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * GET /api/v1/booking/services
 * Query Parameter: organization_id
 * Returns a list of active public services for the clinic (bypasses RLS).
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organization_id } = req.query;

  if (!organization_id || typeof organization_id !== 'string') {
    return res.status(400).json({ error: 'El parámetro organization_id es obligatorio.' });
  }

  // Verify booking feature is active for this tenant
  const isFeatureActive = await verifyFeatureForOrganization(organization_id, 'booking');
  if (!isFeatureActive) {
    return res.status(403).json({ error: 'El plan contratado para esta clínica no incluye la funcionalidad de reservas.' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch active services for this organization
    const { data: services, error: fetchErr } = await supabase
      .from('services')
      .select('id, title, id_slug, duration_minutes, price, currency')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .order('title', { ascending: true });

    if (fetchErr) {
      console.error('Error fetching services:', fetchErr);
      return res.status(500).json({ error: 'Error al recuperar los servicios de la clínica.' });
    }

    return res.status(200).json({
      success: true,
      services: services || [],
    });
  } catch (err: any) {
    console.error('Unexpected error in services API:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
