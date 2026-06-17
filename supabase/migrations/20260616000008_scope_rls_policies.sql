-- Migration: 20260616000008_scope_rls_policies.sql
-- Description: Restringe las políticas de lectura de organizaciones (clinics) y perfiles (profiles)
--              para que los usuarios solo puedan ver sus propios recursos y evitar fugas de información
--              de otros tenants/usuarios.

-- 1. Eliminar políticas abiertas previas
DROP POLICY IF EXISTS tenant_select_org_policy ON public.organizations;
DROP POLICY IF EXISTS tenant_select_profile_policy ON public.profiles;

-- 2. Crear políticas seguras y acotadas para organizaciones
CREATE POLICY tenant_select_org_policy ON public.organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.organization_id = organizations.id
        )
    );

-- 3. Crear políticas seguras y acotadas para perfiles
CREATE POLICY tenant_select_profile_policy ON public.profiles
    FOR SELECT USING (
        user_id = auth.uid() 
        OR organization_id IN (
            SELECT p.organization_id FROM public.profiles p 
            WHERE p.user_id = auth.uid()
        )
    );
