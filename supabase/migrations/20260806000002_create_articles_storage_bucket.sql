-- Migration: Create storage bucket for articles and configure RLS
-- Created at: 2026-08-06

-- 1. Create the articles storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'articles',
  'articles',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Configure RLS Policies for the articles bucket on storage.objects
DROP POLICY IF EXISTS "Allow authenticated users to insert article images" ON storage.objects;
CREATE POLICY "Allow authenticated users to insert article images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'articles');

DROP POLICY IF EXISTS "Allow authenticated users to update article images" ON storage.objects;
CREATE POLICY "Allow authenticated users to update article images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'articles');

DROP POLICY IF EXISTS "Allow authenticated users to delete article images" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete article images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'articles');

DROP POLICY IF EXISTS "Allow public read access to article images" ON storage.objects;
CREATE POLICY "Allow public read access to article images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'articles');
