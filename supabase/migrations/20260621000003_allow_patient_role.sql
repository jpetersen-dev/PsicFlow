-- Migration 019: Allow 'paciente' role in profiles.role_name check constraint
-- Date: 2026-06-21

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_name_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_name_check CHECK (role_name IN ('admin_clinica', 'psicologo', 'administrativo', 'paciente'));
