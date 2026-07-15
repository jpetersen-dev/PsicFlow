-- Migration: Update public.get_public_specialists RPC to return coalesce of original_logo_url and logo_url
-- Created at: 2026-07-15

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
  location text
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
    p.location
  FROM public.profiles p
  WHERE p.organization_id = p_organization_id
    AND p.role_name IN ('psicologo', 'admin_clinica');
END;
$$;
