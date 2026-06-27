-- Migration: Add therapist landing fields to public.profiles and update get_public_specialists RPC
-- Created at: 2026-06-27

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education text[] DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quote text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;

-- Drop old RPC function first
DROP FUNCTION IF EXISTS public.get_public_specialists(uuid);

-- Recreate RPC function with new fields returned
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
    p.logo_url,
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

-- Seed / Update initial profile for Jonathan Petersen Zañartu for local testing
UPDATE public.profiles
SET 
  education = ARRAY[
    'Psicólogo Clínico - Universidad Diego Portales (Chile)',
    'Diplomado en Infancia y Adolescencia: Enfoque Clínico y Comportamental',
    'Formación en Psicoterapia Existencial e Integrativa',
    'Especialista en Mindfulness y Aceptación Psicológica'
  ],
  specialties = ARRAY[
    'Duelo Migratorio y Transiciones de Vida',
    'Ansiedad, Estrés y Crisis de Pánico',
    'Depresión y Trastornos del Ánimo',
    'Pérdida de Estatus Profesional y Adaptación Laboral',
    'Dinámicas de Pareja Biculturales'
  ],
  languages = ARRAY[
    'Español (Nativo)',
    'Inglés (C1 - Avanzado)'
  ],
  quote = 'El dolor migratorio es también el umbral para nacer a un nuevo sentido de vida y arraigo.',
  location = 'Zúrich, Suiza (Atención Online y Presencial)'
WHERE id = '68d8d4d4-7b67-406d-8c70-61020c75f4c5';
