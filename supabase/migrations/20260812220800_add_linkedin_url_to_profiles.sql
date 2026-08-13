-- Migration: Add linkedin_url to profiles table and update get_public_specialists RPC
-- Created at: 2026-08-12

-- Add columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_url text;

-- Recreate RPC function to return the new linkedin_url field
DROP FUNCTION IF EXISTS public.get_public_specialists(uuid);

CREATE OR REPLACE FUNCTION public.get_public_specialists(p_organization_id uuid)
RETURNS TABLE(
  id uuid, 
  full_name text, 
  specialization text, 
  bio text, 
  logo_url text, 
  timezone text,
  education text[],
  specialties text[],
  languages text[],
  quote text,
  location text,
  seo_description text,
  linkedin_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.specialization,
    p.bio,
    COALESCE(p.original_logo_url, p.logo_url) AS logo_url,
    p.timezone,
    p.education,
    p.specialties,
    p.languages,
    p.quote,
    p.location,
    p.seo_description,
    p.linkedin_url
  FROM public.profiles p
  WHERE p.organization_id = p_organization_id
    AND p.role_name IN ('psicologo', 'admin_clinica');
END;
$$;
