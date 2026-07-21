-- Add logo_url to public.organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;
