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

    // 2. Fetch specialists using the secure get_public_specialists RPC
    const { data: specialists, error: fetchErr } = await supabase.rpc('get_public_specialists', {
      p_organization_id: organizationId,
    });

    if (fetchErr) {
      console.error('Error fetching specialists via RPC:', fetchErr);
      return res.status(500).json({ error: 'Error al recuperar terapeutas de la clínica.' });
    }

    return res.status(200).json({
      success: true,
      organization_id: organizationId,
      specialists: specialists || [],
    });
  } catch (error: any) {
    console.error('Error inside specialists integration route:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
