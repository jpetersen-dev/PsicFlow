-- =====================================================================
-- Migration: 20260616000012_add_new_fields_and_tables.sql
-- Description: Agrega columnas a pacientes, perfiles y files_vault,
--              y crea las tablas para categorías de recursos, tareas,
--              notas rápidas y eventos personales con sus respectivas
--              políticas de RLS para aislamiento multi-tenant.
-- =====================================================================

-- 1. Agregar columnas a public.patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nacionalidad TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pais_origen TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS en_observacion BOOLEAN DEFAULT FALSE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS observacion_comentario TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS observaciones_generales TEXT;

-- 2. Agregar columnas a public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- 3. Agregar columna size_bytes a public.files_vault
ALTER TABLE public.files_vault ADD COLUMN IF NOT EXISTS size_bytes INTEGER DEFAULT 0;

-- 4. Crear tabla public.resource_categories
CREATE TABLE IF NOT EXISTS public.resource_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hacer el nombre de la categoría único por organización
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_categories_org_name 
ON public.resource_categories (organization_id, name);

-- Habilitar RLS en public.resource_categories
ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para public.resource_categories
CREATE POLICY tenant_isolation_resource_categories ON public.resource_categories
    FOR ALL USING (organization_id = public.get_current_tenant());


-- 5. Crear tabla public.clinical_tasks
CREATE TABLE IF NOT EXISTS public.clinical_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    due_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en public.clinical_tasks
ALTER TABLE public.clinical_tasks ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para public.clinical_tasks
CREATE POLICY tenant_isolation_clinical_tasks ON public.clinical_tasks
    FOR ALL USING (organization_id = public.get_current_tenant());


-- 6. Crear tabla public.quick_notes
CREATE TABLE IF NOT EXISTS public.quick_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en public.quick_notes
ALTER TABLE public.quick_notes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para public.quick_notes
CREATE POLICY tenant_isolation_quick_notes ON public.quick_notes
    FOR ALL USING (organization_id = public.get_current_tenant());


-- 7. Crear tabla public.personal_events
CREATE TABLE IF NOT EXISTS public.personal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL, -- e.g., 'Reunión', 'Supervisión', 'Descanso', 'Personal'
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en public.personal_events
ALTER TABLE public.personal_events ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para public.personal_events
CREATE POLICY tenant_isolation_personal_events ON public.personal_events
    FOR ALL USING (organization_id = public.get_current_tenant());
