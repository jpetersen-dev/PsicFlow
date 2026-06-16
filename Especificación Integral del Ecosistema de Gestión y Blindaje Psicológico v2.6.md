---
autor: Director Maestro de Proyecto SaaS
fecha: 2026-06-16
destinatario: Usuario / Director General del Enjambre (Antigravity 2.0)
asunto: Especificación Integral del Ecosistema de Gestión y Blindaje Psicológico v2.6
descripcion: Consolidación unificada de la arquitectura de la información, el CRM clínico extendido, el esquema relacional para Supabase, las integraciones MCP y las instrucciones de aprovisionamiento automatizado en Antigravity 2.0.
estado: listo-para-implementar
---

# 1. ESPECIFICACIÓN GENERAL DEL PRODUCTO (DBC v2.6)

## 1.1 Nombre del Producto y Categoría de Mercado
*   **Nombre Oficial del Producto:** **PsicoAlivio** (Alternativa secundaria: *AlivioClínico*).
*   **Categoría de Mercado:** Asistente de Inteligencia Clínica, CRM Operacional y Sistema de Blindaje Legal para Psicólogos y Centros de Salud Mental en Chile.
*   **Modelo de Distribución:** Híbrido, ofreciendo autoservicio (SaaS) para profesionales independientes y planes adaptados para la administración multi-profesional de clínicas o centros de atención especializados[cite: 6].

## 1.2 Propuesta de Valor y Experiencia de Usuario Core
*   **CRM y Ciclo de Vida del Paciente:** El sistema gestiona el flujo completo del paciente, abarcando desde su registro inicial con datos de identidad, RUT e información demográfica estructurada, hasta su ficha clínica cronológica e interactiva, el seguimiento de síntomas, el control financiero y el proceso de alta o epicrisis.
*   **El "Ciclo de Alivio" con IA:** Al finalizar la consulta, el psicólogo dicta un resumen de voz de 3 a 5 minutos[cite: 6, 11]. La IA (Google Gemini 1.5 Flash) procesa el audio y genera de manera asíncrona un borrador clínico estructurado en formato SOAP o DAP[cite: 6, 7].
*   **Protocolo HITL Obligatorio:** Cumpliendo con la ética médica y la normativa, el sistema prohíbe el guardado automático de la IA[cite: 4, 11]. El profesional debe utilizar de forma ineludible el *Editor de Validación Obligatoria* para revisar, modificar y firmar la nota clínica antes de su persistencia formal en la ficha[cite: 4, 11].
*   **Destrucción Permanente de Audio:** Una vez que el psicólogo valida y firma el registro clínico, un trigger asíncrono ejecuta el *Hard Delete* irreversible del archivo de voz original en Supabase Storage, resguardando el secreto profesional y minimizando los costos de almacenamiento[cite: 4, 7].
*   **Modo Privacidad Cosmético ($O(1)$):** Toggle en la interfaz de Next.js que activa una máscara por expresiones regulares (RegEx) en el cliente[cite: 8]. Oculta de forma instantánea nombres (`J*** C*** P***`) y RUTs (`12.***.***-9`) en entornos públicos frente a miradas casuales (*Shoulder Surfing*), sin alterar el caché en memoria de React Query ni invalidar los datos íntegros que viajan de forma segura en el backend[cite: 8, 11].

## 1.3 El Centro de Documentación Inteligente
*   **Generación de Informes por IA:** Módulo avanzado que consume los datos de la ficha y utiliza **Google Gemini 1.5 Pro** para redactar informes clínicos, evoluciones terapéuticas o epicrisis bajo demanda[cite: 5, 7, 11].
*   **Control del Contexto por Checkbox:** La interfaz del centro de documentación permite al psicólogo seleccionar mediante una lista de verificación (*checkboxes*) exactamente qué notas de sesión o antecedentes históricos de la base de datos debe leer la IA como contexto de análisis, garantizando un control granular del usuario sobre la redacción generada[cite: 11].
*   **Exportación:** Descarga limpia e inmediata de los documentos e informes clínicos generados en formatos DOCX (vía PHPWord/Next.js) y PDF foliados con validez legal[cite: 11].

---

# 2. ESQUEMA RELACIONAL COMPLETO SQL (`02_esquema_completo.sql`)

El siguiente script SQL estructurado modela la base de datos modular multi-tenant en Supabase (PostgreSQL), adaptando las tablas operacionales a la totalidad de las pantallas del CRM clínico y fijando la capa de auditoría inmutable exigida por el Decreto 41 chileno[cite: 4, 7]:

```sql
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
````

# 3. DIRECTRICES DE IMPLEMENTACIÓN Y PROTOCOLO DE PROVISIONAMIENTO

Para automatizar la construcción de este CRM y Sistema Clínico, se establece el manual de operaciones e instrucciones que el Agente Director procesará de forma autónoma en el entorno local (Windows/WSL2), interactuando con las herramientas de Model Context Protocol (MCP) de GitHub, Vercel y Supabase conectadas a la sesión[cite: 11]:

## 3.1 Estructura del Directorio de Documentación (`.agents/docs/`)

El enjambre debe crear y poblar la carpeta de conocimiento compartida en la raíz del espacio de trabajo con los siguientes archivos obligatorios:

1. `.agents/docs/01_DBC_v2.6.md`: Este documento de consolidación maestro, que incluye la arquitectura de información, lógica del empaquetado de IA por checkboxes y el Mode Privacidad[cite: 11].
    
2. `.agents/docs/02_esquema_completo.sql`: El script de base de datos extendido y particionado detallado en la sección 2.
    

## 3.2 Protocolo de Desacoplamiento y Re-vinculación en Vercel

Dado que los archivos de la carpeta `.vercel` corresponden a configuraciones de un proyecto anterior, el enjambre de desarrollo automatizado ejecutará de forma prioritaria las herramientas de consola para re-estructurar el entorno:

- **Paso 1 (Unlink):** El agente ejecutará el comando `vercel unlink` para limpiar los metadatos obsoletos de `project.json`.
    
- **Paso 2 (Link Asistido):** El agente ejecutará `vercel link` e interactuará dinámicamente en la terminal con el usuario para designar el nuevo ID de organización, capturar el nuevo ID de proyecto de Vercel para **PsicoAlivio** y generar un archivo `project.json` limpio[cite: 11].
    
- **Paso 3 (Git-Ignore):** El agente validará la inyección automática de la carpeta `.vercel/` en el archivo `.gitignore` del proyecto para prevenir la filtración de tokens organizacionales hacia repositorios públicos.
    

## 3.3 Descarga de Plugins y Reglas de Comportamiento Estrictas

El Director del enjambre clonará de forma asíncrona los repositorios de utilidades en directorios temporales de caché, extrayendo las habilidades hacia la ruta local `.agents/skills/`:

- `supabase-migration` y `saas-mvp-launcher` $\rightarrow$ `.agents/skills/supabase-migration/` y `.agents/skills/saas-mvp-launcher/`.
    
- `frontend-performance` y `qa-automation` $\rightarrow$ `.agents/skills/frontend-perf/` y `.agents/skills/qa-validation/`.
    
- Inyección de las reglas de comportamiento de Windsurf (`windsurf-antigravity-rules`) para forzar tipado estricto (TypeScript) en el renderizado de tablas Next.js y el bloqueo de logs abiertos (`console.log`) en producción.
    