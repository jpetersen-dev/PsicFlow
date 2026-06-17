-- =====================================================================
-- Migration: 20260616000010_fix_org_select_and_rut_index.sql
-- Description: 1. Añade política RLS para permitir ver el nombre de la 
--                 clínica antes del registro mediante el token de invitación.
--              2. Cambia la restricción única del RUT del profesional 
--                 para que sea única por clínica (organización) y no global.
-- =====================================================================

-- 1. Permitir consultar organizaciones que tengan invitaciones activas pendientes
CREATE POLICY select_organizations_invite ON public.organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.invitations
            WHERE invitations.organization_id = organizations.id
            AND invitations.is_used = FALSE
            AND invitations.expires_at > NOW()
        )
    );

-- 2. Modificar el índice de unicidad del RUT para restringirlo por organización
DROP INDEX IF EXISTS public.idx_unique_rut_professional_pro;

CREATE UNIQUE INDEX idx_unique_rut_professional_pro 
ON public.profiles (rut_professional, organization_id) 
WHERE (role_name = 'psicologo'::text OR role_name = 'admin_clinica'::text);
