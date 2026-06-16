-- =====================================================================
-- Migration: 20260616000005_update_rls_and_profile.sql
-- Description: Agrega columnas para el perfil profesional y reconfigura
--              las políticas de RLS para permitir la creación y consulta
--              de clínicas (organizations) y perfiles (profiles).
-- =====================================================================

-- 1. Extender la tabla profiles con columnas adicionales para detalles profesionales
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Eliminar las políticas restrictivas previas de organizaciones y perfiles
DROP POLICY IF EXISTS tenant_isolation_org_policy ON public.organizations;
DROP POLICY IF EXISTS tenant_isolation_profile_policy ON public.profiles;

-- 3. Reconfigurar RLS para la tabla public.organizations
-- Permitir lectura pública de clínicas para poblar selectores
CREATE POLICY tenant_select_org_policy ON public.organizations
    FOR SELECT USING (true);

-- Permitir inserción de nuevas clínicas en el registro/creación
CREATE POLICY tenant_insert_org_policy ON public.organizations
    FOR INSERT WITH CHECK (true);

-- Restringir actualizaciones y eliminaciones al tenant activo
CREATE POLICY tenant_update_org_policy ON public.organizations
    FOR UPDATE USING (id = public.get_current_tenant());

CREATE POLICY tenant_delete_org_policy ON public.organizations
    FOR DELETE USING (id = public.get_current_tenant());


-- 4. Reconfigurar RLS para la tabla public.profiles
-- Permitir lectura de perfiles asociados para mostrar nombres del terapeuta
CREATE POLICY tenant_select_profile_policy ON public.profiles
    FOR SELECT USING (true);

-- Permitir inserción de perfiles al registrarse en una clínica
CREATE POLICY tenant_insert_profile_policy ON public.profiles
    FOR INSERT WITH CHECK (true);

-- Restringir actualizaciones y eliminaciones del perfil al tenant activo
CREATE POLICY tenant_update_profile_policy ON public.profiles
    FOR UPDATE USING (organization_id = public.get_current_tenant());

CREATE POLICY tenant_delete_profile_policy ON public.profiles
    FOR DELETE USING (organization_id = public.get_current_tenant());
