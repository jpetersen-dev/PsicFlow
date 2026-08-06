-- Migration: Add marketing fields to services, create storage bucket, and disable Wise
-- Created at: 2026-08-06

-- 1. Alter public.services to add marketing columns
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS "desc" text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS clinical_approach text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS color text;

-- 2. Create the services storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'services',
  'services',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Configure RLS Policies for the services bucket on storage.objects
DROP POLICY IF EXISTS "Allow authenticated users to insert service images" ON storage.objects;
CREATE POLICY "Allow authenticated users to insert service images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'services');

DROP POLICY IF EXISTS "Allow authenticated users to update service images" ON storage.objects;
CREATE POLICY "Allow authenticated users to update service images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'services');

DROP POLICY IF EXISTS "Allow authenticated users to delete service images" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete service images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'services');

DROP POLICY IF EXISTS "Allow public read access to service images" ON storage.objects;
CREATE POLICY "Allow public read access to service images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'services');

-- 4. Disable Wise gateway for Sentido Migrante clinic
UPDATE public.organization_payment_gateways
SET is_active = false
WHERE organization_id = 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb' AND provider = 'wise';

-- 5. Clear Wise payment links and bank transfer details for Sentido Migrante
UPDATE public.booking_settings
SET payment_links = '{}'::jsonb,
    bank_transfer_details = '{}'::jsonb
WHERE organization_id = 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb';
