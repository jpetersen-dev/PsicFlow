-- =====================================================================
-- Migration: 20260616000011_scope_email_username_uniqueness.sql
-- Description: Modifica la unicidad de email y username en profiles 
--              para que sean únicos por clínica (organización) y no globales.
--              Esto permite a un mismo profesional tener perfiles en 
--              diferentes clínicas con el mismo email/usuario.
-- =====================================================================

-- 1. Eliminar las restricciones/índices globales anteriores
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS public.profiles_email_key;
DROP INDEX IF EXISTS public.profiles_username_key;

-- 2. Crear nuevos índices únicos acotados por organización
CREATE UNIQUE INDEX profiles_email_org_idx ON public.profiles (email, organization_id);
CREATE UNIQUE INDEX profiles_username_org_idx ON public.profiles (username, organization_id);
