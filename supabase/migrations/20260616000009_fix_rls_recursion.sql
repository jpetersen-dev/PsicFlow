-- Migration: 20260616000009_fix_rls_recursion.sql
-- Description: Corrige la recursión infinita en las políticas RLS de lectura de organizaciones
--              y perfiles. Define la función de seguridad 'is_org_member' para verificar membrecía
--              de forma segura sin llamar recursivamente a las políticas RLS.

-- 1. Crear función de utilidad con SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.organization_id = org_id AND p.user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recrear políticas de lectura
DROP POLICY IF EXISTS tenant_select_org_policy ON public.organizations;
DROP POLICY IF EXISTS tenant_select_profile_policy ON public.profiles;

CREATE POLICY tenant_select_org_policy ON public.organizations
    FOR SELECT USING (
        public.is_org_member(id, auth.uid())
    );

CREATE POLICY tenant_select_profile_policy ON public.profiles
    FOR SELECT USING (
        user_id = auth.uid() 
        OR public.is_org_member(organization_id, auth.uid())
    );
