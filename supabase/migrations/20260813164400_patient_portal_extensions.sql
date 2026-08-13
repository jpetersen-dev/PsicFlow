-- =====================================================================
-- Migration: 20260813164400_patient_portal_extensions.sql
-- Description: Crea tablas para el portal del paciente (bitácoras, mensajería, cuestionarios)
--              y configura sus políticas de RLS e índices de optimización.
-- =====================================================================

-- 1. Crear tabla public.patient_journals (Bitácoras personales)
CREATE TABLE IF NOT EXISTS public.patient_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    mood TEXT, -- 'happy', 'sad', 'anxious', 'neutral', 'angry', 'peaceful'
    shared_with_therapist BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en public.patient_journals
ALTER TABLE public.patient_journals ENABLE ROW LEVEL SECURITY;

-- 2. Crear tabla public.patient_messages (Mensajería y Soporte)
CREATE TABLE IF NOT EXISTS public.patient_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    recipient_type TEXT NOT NULL, -- 'therapist' | 'support'
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL si es para Soporte General
    sender TEXT NOT NULL, -- 'patient' | 'therapist' | 'system'
    subject TEXT,
    content TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en public.patient_messages
ALTER TABLE public.patient_messages ENABLE ROW LEVEL SECURITY;

-- 3. Crear tabla public.patient_assessments (Monitoreo de Bienestar / Lead Magnets)
CREATE TABLE IF NOT EXISTS public.patient_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    assessment_type TEXT NOT NULL, -- e.g., 'wellness_tracker'
    score INTEGER NOT NULL,
    responses JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en public.patient_assessments
ALTER TABLE public.patient_assessments ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 4. Políticas RLS para Aislamiento de Inquilino y Autorización
-- =====================================================================

-- Políticas para patient_journals
CREATE POLICY patient_journals_policy ON public.patient_journals
    FOR ALL USING (
        organization_id = public.get_current_tenant()
        AND (
            -- El usuario es el propio paciente
            EXISTS (
                SELECT 1 FROM public.patients 
                WHERE user_id = auth.uid() 
                  AND id = patient_id
            )
            -- O el usuario es terapeuta/admin y la bitácora ha sido compartida
            OR (
                shared_with_therapist = TRUE
                AND EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE user_id = auth.uid() 
                      AND organization_id = public.get_current_tenant()
                      AND role_name IN ('psicologo', 'admin_clinica')
                )
            )
        )
    );

-- Políticas para patient_messages
CREATE POLICY patient_messages_policy ON public.patient_messages
    FOR ALL USING (
        organization_id = public.get_current_tenant()
        AND (
            -- El usuario es el propio paciente dueño del hilo
            EXISTS (
                SELECT 1 FROM public.patients 
                WHERE user_id = auth.uid() 
                  AND id = patient_id
            )
            -- O el usuario es un profesional de la misma clínica
            OR EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE user_id = auth.uid() 
                  AND organization_id = public.get_current_tenant()
                  AND role_name IN ('psicologo', 'admin_clinica')
            )
        )
    );

-- Políticas para patient_assessments
CREATE POLICY patient_assessments_policy ON public.patient_assessments
    FOR ALL USING (
        organization_id = public.get_current_tenant()
        AND (
            -- El usuario es el propio paciente
            EXISTS (
                SELECT 1 FROM public.patients 
                WHERE user_id = auth.uid() 
                  AND id = patient_id
            )
            -- O el usuario es terapeuta/admin de la misma organización
            OR EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE user_id = auth.uid() 
                  AND organization_id = public.get_current_tenant()
                  AND role_name IN ('psicologo', 'admin_clinica')
            )
        )
    );

-- =====================================================================
-- 5. Triggers e Índices de Optimización
-- =====================================================================

-- Trigger de updated_at para patient_journals
CREATE OR REPLACE TRIGGER tr_patient_journals_updated_at
    BEFORE UPDATE ON public.patient_journals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_update_timestamp();

-- Índices de búsqueda para optimizar las consultas del portal y ficha clínica
CREATE INDEX IF NOT EXISTS idx_patient_journals_patient_id ON public.patient_journals(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_patient_id ON public.patient_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_messages_professional_id ON public.patient_messages(professional_id);
CREATE INDEX IF NOT EXISTS idx_patient_assessments_patient_id ON public.patient_assessments(patient_id);
