-- =====================================================================
-- Migration: 20260818030000_add_is_shared_to_files_vault.sql
-- Description: Agrega la columna is_shared a public.files_vault con valor
--              por defecto false, actualiza recursos globales a is_shared = true,
--              ajusta la política RLS patient_files_select e índices.
-- =====================================================================

-- 1. Agregar columna is_shared a files_vault
ALTER TABLE public.files_vault 
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Actualizar archivos globales existentes (patient_id IS NULL) a is_shared = true
UPDATE public.files_vault 
SET is_shared = TRUE 
WHERE patient_id IS NULL;

-- 3. Actualizar política de lectura RLS para pacientes en files_vault
DROP POLICY IF EXISTS patient_files_select ON public.files_vault;
CREATE POLICY patient_files_select ON public.files_vault
    FOR SELECT USING (
        is_shared = TRUE AND (
            patient_id IN (
                SELECT id FROM public.patients WHERE user_id = auth.uid()
            )
            OR (
                patient_id IS NULL 
                AND organization_id IN (
                    SELECT organization_id FROM public.patients WHERE user_id = auth.uid()
                )
            )
        )
    );

-- 4. Crear índices de búsqueda y rendimiento
CREATE INDEX IF NOT EXISTS idx_files_vault_is_shared ON public.files_vault(is_shared);
CREATE INDEX IF NOT EXISTS idx_files_vault_patient_shared ON public.files_vault(patient_id, is_shared);
