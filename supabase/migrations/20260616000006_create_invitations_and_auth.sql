-- =====================================================================
-- Migration: 20260616000006_create_invitations_and_auth.sql
-- Description: Crea la tabla de invitaciones y añade columnas de auth
--              a profiles para vinculación de usuarios.
-- =====================================================================

-- 1. Crear tabla de invitaciones
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT, -- Opcional: email específico invitado
    token TEXT NOT NULL UNIQUE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL CHECK (role_name IN ('admin_clinica', 'psicologo', 'administrativo')),
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Habilitar RLS en invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 2. Políticas RLS para invitations
-- Permitir select público por token para validar la invitación al registrarse
CREATE POLICY select_invitations_public ON public.invitations
    FOR SELECT USING (is_used = FALSE AND expires_at > NOW());

-- Permitir a los profesionales de la organización ver, crear y actualizar invitaciones de su tenant
CREATE POLICY select_invitations_tenant ON public.invitations
    FOR SELECT USING (organization_id = public.get_current_tenant());

CREATE POLICY insert_invitations_tenant ON public.invitations
    FOR INSERT WITH CHECK (organization_id = public.get_current_tenant());

CREATE POLICY update_invitations_tenant ON public.invitations
    FOR UPDATE USING (organization_id = public.get_current_tenant());

-- 3. Modificar la tabla de perfiles (profiles) para añadir vinculación de Auth y credenciales
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Actualizar las políticas de profiles para permitir la búsqueda por email o username al loguearse
-- (Es público para resolver la autenticación del endpoint API en Next.js)
CREATE POLICY select_profiles_login ON public.profiles
    FOR SELECT USING (true);
