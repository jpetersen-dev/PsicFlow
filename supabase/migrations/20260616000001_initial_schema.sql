-- =====================================================================
-- 1. EXTENSIONES, ENUMERACIONES Y CONFIGURACIÓN INICIAL
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE public.plan_level AS ENUM ('Starter', 'Pro', 'Enterprise');
CREATE TYPE public.patient_status AS ENUM ('activo', 'seguimiento', 'alta', 'archivado', 'inactivo');
CREATE TYPE public.session_status AS ENUM ('Programada', 'Completa', 'Cancelada', 'Reprogramada');
CREATE TYPE public.payment_status AS ENUM ('Pagado', 'Pendiente', 'Parcial');
CREATE TYPE public.audio_status AS ENUM ('active', 'processing', 'deleted_pending', 'hard_deleted');
CREATE TYPE public.unit_type AS ENUM ('NOTA_IA', 'INFORME_CLINICO');

-- =====================================================================
-- 2. ESQUEMA PÚBLICO - ESTRUCTURA OPERACIONAL MULTI-TENANT
-- =====================================================================

CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    current_plan public.plan_level NOT NULL DEFAULT 'Starter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rut_professional TEXT NOT NULL, -- Formato limpio sin puntos, con guion
    full_name TEXT NOT NULL,
    role_name TEXT NOT NULL CHECK (role_name IN ('admin_clinica', 'psicologo', 'administrativo')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FILTRO ANTI-MULTICUENTA: Evita la creación de organizaciones espejo Pro con un mismo RUT
CREATE UNIQUE INDEX idx_unique_rut_professional_pro 
ON public.profiles (rut_professional) 
WHERE (role_name = 'psicologo' OR role_name = 'admin_clinica');

-- CRM Y FICHA INTEGRAL DE PACIENTES (Ley N° 19.628 de Datos Sensibles)
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rut_patient TEXT,
    full_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    gender TEXT,
    occupation TEXT,
    marital_status TEXT,
    education_level TEXT,
    education_status TEXT,
    education_institution TEXT,
    health_system TEXT, -- Fonasa / Isapre / Particular
    phone TEXT,
    email TEXT,
    address TEXT,
    comuna TEXT,
    region TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    emergency_contact_email TEXT,
    status public.patient_status NOT NULL DEFAULT 'activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONCEPTUALIZACIÓN Y PLAN CLÍNICO (Historias Clínicas)
CREATE TABLE public.clinical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    motivo_consulta TEXT,
    antecedentes_relevantes TEXT,
    observaciones_generales TEXT,
    enfoque_teorico TEXT,
    formulacion_caso TEXT,
    objetivo_general TEXT,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DIAGNÓSTICOS ASOCIADOS (CIE-10 / DSM-5)
CREATE TABLE public.diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.clinical_records(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- Ej: F32.1
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CALENDARIO Y GESTIÓN ADMINISTRATIVO-FINANCIERA
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(id),
    date_session DATE NOT NULL,
    time_session TIME NOT NULL,
    modality TEXT CHECK (modality IN ('Online', 'Presencial')),
    status_session public.session_status NOT NULL DEFAULT 'Programada',
    value_session NUMERIC(10,2) DEFAULT 0.00,
    status_payment public.payment_status NOT NULL DEFAULT 'Pendiente',
    payment_type TEXT, -- Transferencia, Efectivo, Tarjeta, etc.
    transaction_id TEXT,
    payment_date DATE,
    boleta_status TEXT DEFAULT 'Pendiente', -- Pendiente, Emitida, No Aplica
    comentarios_internos TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EVOLUCIONES CLÍNICAS (IA + HITL VALIDADO)
CREATE TABLE public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    temas_abordados TEXT,
    sintomas_observados TEXT,
    ai_raw_draft TEXT NOT NULL, -- Borrador puro entregado por Google Gemini
    human_validated_content TEXT, -- Contenido verificado y firmado por el profesional
    is_human_validated BOOLEAN NOT NULL DEFAULT FALSE, -- Flujo HITL obligatorio
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONTROL DEL CICLO DE VIDA DE ARCHIVOS DE AUDIO
CREATE TABLE public.audio_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    status public.audio_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    deleted_at TIMESTAMPTZ
);

-- REGISTRO DE SINTOMATOLOGÍA CRONOLÓGICA
CREATE TABLE public.sintomatologia_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EPICRISIS / CIERRE TERAPÉUTICO Y ALTA
CREATE TABLE public.epicrisis_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    closure_date DATE NOT NULL,
    reason TEXT NOT NULL,
    final_evaluation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REPOSITORIO DE ARCHIVOS ADJUNTOS GENERALES Y DE BIBLIOTECA
CREATE TABLE public.files_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE, -- NULL si es un recurso global de biblioteca
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE, -- NULL si no está asociado a una sesión
    original_name TEXT NOT NULL,
    saved_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    category TEXT DEFAULT 'General', -- Guías Clínicas, Plantillas, Material Psicoeducativo
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. LIBRO MAYOR PARA UNIDADES DE VALOR DE IA (APPEND-ONLY LEDGER)
-- =====================================================================
CREATE TABLE public.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id),
    type_unit public.unit_type NOT NULL,
    amount INTEGER NOT NULL, -- Negativo para consumos, positivo para recargas
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_balance_check 
ON public.credit_ledger (organization_id, type_unit, amount);

-- =====================================================================
-- 4. ESQUEMA DE AUDITORÍA DE HIERRO (DECRETO 41 - INMUTABLE)
-- =====================================================================
CREATE SCHEMA audit;

CREATE TABLE audit.access_logs (
    id BIGSERIAL,
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action_name TEXT NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE'
    target_table TEXT NOT NULL,
    resource_id UUID NOT NULL,
    metadata JSONB NOT NULL, -- Registra client_ip, user_agent y "privacy_mode_active"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Bloqueo de mutaciones destructivas a nivel de motor SQL
REVOKE UPDATE, DELETE, TRUNCATE ON audit.access_logs FROM public;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.access_logs FROM authenticated;

-- =====================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_patients_policy ON public.patients
    FOR ALL USING (organization_id = current_setting('app.current_tenant', true)::UUID);
