-- Migration 018: Add patient_verifications table for registration OTP codes
-- Date: 2026-06-21

CREATE TABLE IF NOT EXISTS public.patient_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '15 minutes'
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_patient_verifications_email ON public.patient_verifications(email);

-- Enable RLS (Row Level Security)
ALTER TABLE public.patient_verifications ENABLE ROW LEVEL SECURITY;

-- Allow public inserts and selects for validation
CREATE POLICY public_insert_verifications ON public.patient_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY public_select_verifications ON public.patient_verifications
  FOR SELECT USING (true);

CREATE POLICY public_delete_verifications ON public.patient_verifications
  FOR DELETE USING (true);
