-- Create articles table for publications management
CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  content_html text NOT NULL,
  category text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  image_url text,
  reading_time integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for faster routing lookup
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_organization ON public.articles(organization_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- 1. Policy for SELECT (Public read for published articles)
DROP POLICY IF EXISTS "Allow public read of published articles" ON public.articles;
CREATE POLICY "Allow public read of published articles" ON public.articles
  FOR SELECT
  TO public
  USING (status = 'published');

-- 2. Policy for SELECT (Specialists can view all organization articles, drafts included)
DROP POLICY IF EXISTS "Allow specialists to read organization articles" ON public.articles;
CREATE POLICY "Allow specialists to read organization articles" ON public.articles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = articles.organization_id
    )
  );

-- 3. Policy for ALL (Insert, Update, Delete for organization specialists)
DROP POLICY IF EXISTS "Allow specialists to manage organization articles" ON public.articles;
CREATE POLICY "Allow specialists to manage organization articles" ON public.articles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = articles.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = articles.organization_id
    )
  );

-- Automatically set published_at timestamp when status becomes 'published'
CREATE OR REPLACE FUNCTION public.set_article_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    NEW.published_at = now();
  ELSIF NEW.status = 'draft' THEN
    NEW.published_at = NULL;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_set_article_published_at
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_article_published_at();
