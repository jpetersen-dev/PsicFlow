import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey } from '../../../../../utils/authIntegration';
import { verifyFeatureForOrganization } from '../../../../../utils/planFeatures';
import { allowCors } from '../../../../../utils/cors';

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

  // 2. Verify plan features for blog
  const isFeatureActive = await verifyFeatureForOrganization(organizationId, 'blog');
  if (!isFeatureActive) {
    return res.status(403).json({ error: 'El plan contratado para esta clínica no incluye la funcionalidad de artículos/publicaciones.' });
  }

  const { slug } = req.query;

  // 3. Si se provee el parámetro 'slug', retornamos el artículo individual (modo detalle)
  if (slug && typeof slug === 'string') {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Consultar artículo por slug para la organización
      const { data: article, error } = await supabase
        .from('articles')
        .select(`
          id,
          organization_id,
          title,
          slug,
          description,
          content_html,
          category,
          tags,
          image_url,
          secondary_image_url,
          reading_time,
          published_at,
          created_at,
          json_ld,
          og_title,
          og_description,
          author:author_id (
            id,
            full_name,
            role_name,
            specialization,
            bio,
            logo_url
          ),
          organization:organization_id (
            id,
            name,
            logo_url
          )
        `)
        .eq('slug', slug)
        .eq('organization_id', organizationId)
        .eq('status', 'published')
        .maybeSingle();

      if (error) {
        console.error('Error fetching article by slug:', error);
        return res.status(500).json({ error: 'Error al recuperar el artículo.' });
      }

      if (!article) {
        return res.status(404).json({ error: 'Artículo no encontrado.' });
      }

      // Consultar artículos adyacentes (anterior y siguiente)
      const { data: prevData } = await supabase
        .from('articles')
        .select('title, slug, image_url, category')
        .eq('status', 'published')
        .eq('organization_id', organizationId)
        .lt('published_at', article.published_at)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: nextData } = await supabase
        .from('articles')
        .select('title, slug, image_url, category')
        .eq('status', 'published')
        .eq('organization_id', organizationId)
        .gt('published_at', article.published_at)
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      return res.status(200).json({
        success: true,
        article,
        previous: prevData || null,
        next: nextData || null,
      });
    } catch (err: any) {
      console.error('Unexpected error in article slug API integrations:', err);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 4. Query published articles for the organization
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
        secondary_image_url,
        reading_time,
        published_at,
        created_at,
        og_title,
        og_description,
        author:author_id (
          id,
          full_name,
          role_name,
          specialization,
          bio,
          logo_url
        )
      `)
      .eq('status', 'published')
      .eq('organization_id', organizationId)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      return res.status(500).json({ error: 'Error al recuperar los artículos.' });
    }

    return res.status(200).json({
      success: true,
      organization_id: organizationId,
      articles: articles || [],
    });
  } catch (error: any) {
    console.error('Error inside articles integration route:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

export default allowCors(handler);
