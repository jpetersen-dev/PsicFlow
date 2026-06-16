-- =====================================================================
-- Migration 004: Add ficha_id_num to patients + Setup Storage Buckets
-- =====================================================================

-- 1. Add ficha_id_num column to patients table
-- Since there are currently 0 rows, we can safely add NOT NULL with a default
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS ficha_id_num TEXT;

-- Make it unique per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_org_ficha
  ON public.patients (organization_id, ficha_id_num);

-- 2. Create private storage buckets for audio and clinical files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audio-notes', 'audio-notes', false, 52428800, ARRAY['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4']),
  ('clinical-vault', 'clinical-vault', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies for multi-tenant isolation
-- Drop existing policies to prevent duplicates on re-run
DROP POLICY IF EXISTS "Tenant isolation audio-notes SELECT" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolation audio-notes INSERT" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolation audio-notes DELETE" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolation clinical-vault SELECT" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolation clinical-vault INSERT" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolation clinical-vault DELETE" ON storage.objects;

-- Audio-notes bucket: tenant-scoped read
CREATE POLICY "Tenant isolation audio-notes SELECT" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'audio-notes'
    AND (storage.foldername(name))[1]::uuid = public.get_current_tenant()
  );

-- Audio-notes bucket: tenant-scoped insert
CREATE POLICY "Tenant isolation audio-notes INSERT" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'audio-notes'
    AND (storage.foldername(name))[1]::uuid = public.get_current_tenant()
  );

-- Audio-notes bucket: tenant-scoped delete (for hard delete of audio after validation)
CREATE POLICY "Tenant isolation audio-notes DELETE" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'audio-notes'
    AND (storage.foldername(name))[1]::uuid = public.get_current_tenant()
  );

-- Clinical-vault bucket: tenant-scoped read
CREATE POLICY "Tenant isolation clinical-vault SELECT" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'clinical-vault'
    AND (storage.foldername(name))[1]::uuid = public.get_current_tenant()
  );

-- Clinical-vault bucket: tenant-scoped insert
CREATE POLICY "Tenant isolation clinical-vault INSERT" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'clinical-vault'
    AND (storage.foldername(name))[1]::uuid = public.get_current_tenant()
  );

-- Clinical-vault bucket: tenant-scoped delete
CREATE POLICY "Tenant isolation clinical-vault DELETE" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'clinical-vault'
    AND (storage.foldername(name))[1]::uuid = public.get_current_tenant()
  );
