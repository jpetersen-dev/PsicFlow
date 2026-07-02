import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { allowCors } from '../../../../../utils/cors';
import { verifyFeatureForOrganization } from '../../../../../utils/planFeatures';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * GET /api/v1/booking/articles
 * Query Parameter: organization_id
 * Returns a list of published articles/publications for the organization.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organization_id } = req.query;

  if (!organization_id || typeof organization_id !== 'string') {
    return res.status(400).json({ error: 'El parámetro organization_id es obligatorio.' });
  }

  // Verify plan features
  const isFeatureActive = await verifyFeatureForOrganization(organization_id, 'blog');
  if (!isFeatureActive) {
    return res.status(403).json({ error: 'El plan contratado para esta clínica no incluye la funcionalidad de artículos/publicaciones.' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Query published articles for the organization, joining author profile details
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        id,
        title,
        slug,
        description,
        category,
        tags,
        image_url,
        reading_time,
        published_at,
        created_at,
        author:author_id (
          id,
          full_name,
          specialization,
          bio,
          logo_url
        )
      `)
      .eq('status', 'published')
      .eq('organization_id', organization_id)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      return res.status(500).json({ error: 'Error al recuperar los artículos.' });
    }

    return res.status(200).json({
      success: true,
      articles: articles || [],
    });
  } catch (err: any) {
    console.error('Unexpected error in articles API:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
