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

  const { organization_id, slug } = req.query;

  // 1. If slug parameter is provided, return details for a single article (detail mode)
  if (slug && typeof slug === 'string') {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Query the article by slug
      const { data: article, error } = await supabase
        .from('articles')
        .select(`
          id,
          organization_id,
          title,
          slug,
          description,
          seo_description,
          content_html,
          category,
          tags,
          image_url,
          secondary_image_url,
          reading_time,
          published_at,
          created_at,
          author:author_id (
            id,
            full_name,
            specialization,
            bio,
            logo_url,
            seo_description
          )
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (error) {
        console.error('Error fetching article by slug:', error);
        return res.status(500).json({ error: 'Error al recuperar el artículo.' });
      }

      if (!article) {
        return res.status(404).json({ error: 'Artículo no encontrado.' });
      }

      // Verify plan features (requires blog/articles feature)
      const isFeatureActive = await verifyFeatureForOrganization(article.organization_id, 'blog');
      if (!isFeatureActive) {
        return res.status(403).json({ error: 'El plan contratado para esta clínica no incluye la funcionalidad de artículos/publicaciones.' });
      }

      // Query sibling articles for next/prev navigation
      // 1. Previous: published_at < current_article.published_at order by DESC (newest first of the older articles)
      const { data: prevData } = await supabase
        .from('articles')
        .select('title, slug, image_url, category')
        .eq('status', 'published')
        .eq('organization_id', article.organization_id)
        .lt('published_at', article.published_at)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Next: published_at > current_article.published_at order by ASC (oldest first of the newer articles)
      const { data: nextData } = await supabase
        .from('articles')
        .select('title, slug, image_url, category')
        .eq('status', 'published')
        .eq('organization_id', article.organization_id)
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
      console.error('Unexpected error in article slug API:', err);
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }

  // 2. Otherwise, return the list of articles (list mode)
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
        seo_description,
        category,
        tags,
        image_url,
        secondary_image_url,
        reading_time,
        published_at,
        created_at,
        author:author_id (
          id,
          full_name,
          specialization,
          bio,
          logo_url,
          seo_description
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
