import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * GET /api/v1/booking/specialists
 * Query Parameter: organization_id
 * Returns a list of active psychologists for the given organization using a secure RPC (bypasses RLS).
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Call public.get_public_specialists RPC
    const { data: specialists, error: fetchErr } = await supabase.rpc('get_public_specialists', {
      p_organization_id: organization_id,
    });

    if (fetchErr) {
      console.error('Error fetching specialists via RPC:', fetchErr);
      return res.status(500).json({ error: 'Error al recuperar terapeutas de la clínica.' });
    }

    return res.status(200).json({
      success: true,
      specialists: specialists || [],
    });
  } catch (err: any) {
    console.error('Unexpected error in specialists API:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
