---
autor: Director Maestro de Proyecto SaaS
fecha: 2026-06-16
destinatario: Usuario / Engineering Manager AI (Antigravity 2.0)
asunto: Especificación Maestra de Producción y Diseño de Software Integral - PsicoAlivio MVP
descripcion: Unificación definitiva de los sistemas heredados, alcance funcional expandido de pantallas, esquema de base de datos relacional y prompt de instrucción para la automatización en Antigravity 2.0.
estado: consolidado-final-v3.0
---

# 1. ARQUITECTURA DE INFORMACIÓN Y ALCANCE DE INTERFAZ (UI/UX)

La plataforma **PsicoAlivio** (o *AlivioClínico*) se define técnicamente como un entorno web responsivo de alta gama para la gestión del ciclo de vida completo del paciente, el control administrativo-financiero de la consulta y el procesamiento clínico asistido por Inteligencia Artificial. La interfaz adopta el **SaaS Sidebar Pattern** con un diseño clínico, vanguardista y minimalista, optimizado para baja carga cognitiva.

```text
[PsicoAlivio Workspace]
├── Dashboard Principal (Métricas, Alertas SII, Acciones Rápidas)
├── CRM de Pacientes (Buscador, Filtros de Estado, Exportación, Ficha Integral)
├── Calendario Interactivo (Sesiones Clínicas, Eventos Personales, Google Calendar Sync)
├── Reportes y Estadísticas (Rendimiento Financiero, Evolución, Exportación PDF)
├── Biblioteca de Recursos (Repositorio Global Indexado por Categorías)
├── Centro de Documentación (Generador de Informes Asistido con Checkboxes de IA)
└── Mi Perfil (Configuración de Seguridad y Credenciales del Terapeuta)
````

## 1.1 Módulos Específicos por Pantalla

### A. Layout Global (Estructura Base)

- **Sidebar Lateral:** Navegación colapsable entre las vistas del Dashboard, Pacientes, Calendario, Reportes, Biblioteca, Documentación y Perfil. Incluye el _Selector de Contexto Multi-tenant_ para alternar la sesión entre consultas o clínicas independientes[cite: 2].
    
- **Header Superior:** Incorpora un saludo personalizado al terapeuta, un banner moderno y profesional, campana de notificaciones del sistema, engranaje de configuración y el interruptor global del _Modo Privacidad_.
    

### B. Dashboard Principal (Comando Central)

- **Tarjetas de Métricas Dinámicas (KPIs):**
    
    - _Pacientes Activos:_ Conteo en tiempo real y enlace directo al CRM.
        
    - _Sesiones de Hoy:_ Agenda diaria consolidada.
        
    - _Pagos Pendientes:_ Alertas financieras con montos exactos acumulados.
        
    - _Próximas Sesiones:_ Contador de citas agendadas en la semana.
        
- **Paneles de Control:** Listado cronológico de próximas sesiones, resumen financiero de ingresos del mes y sesiones facturadas, y el panel clínico de _"Pacientes a Observar"_.
    
- **Acción Rápida Core:** Botón flotante destacado para abrir el modal de creación de un nuevo paciente.
    

### C. CRM de Pacientes y Modal de Ingreso Estructurado

La vista de pacientes implementa una tabla transaccional con buscador por Nombre/RUT, filtros por estado clínico e interoperabilidad mediante exportación en formatos XLS/CSV. El modal de ingreso segmenta los datos según los sistemas heredados:

- **Identificación Core:** Nombre completo, RUT/Identificación, Fecha de Nacimiento, Fecha de Ingreso, Género, Nacionalidad, País de Origen y Estado Clínico parametrizado (`activo`, `seguimiento`, `alta`, `archivado`, `inactivo`).
    
- **Información Personal y Educacional:**
    
    - _Nivel de Escolaridad:_ Seleccionable estricto (`Pre-básica`, `Diferencial`, `Básica`, `Media`, `Técnico`, `Superior`, `Posgrado`).
        
    - _Curso / Estado Escolaridad:_ Seleccionable según ciclo (`NT1`, `NT2`, de `1ro a 8vo básico`, de `1ro a 4to medio`, `En curso (Técnico/Superior/Posgrado)`, `Incompleto (Técnico/Superior/Posgrado)`, `Completo (Técnico/Superior/Posgrado)`).
        
    - _Campos Adicionales:_ Institución educacional, Ocupación, Estado Civil y Sistema de Salud (`Fonasa`, `Isapre`, `No sabe`, `Otro`).
        
- **Datos de Contacto y Emergencia:** Dirección (calle y número), Región, Provincia, Comuna, Teléfono y Email del paciente. Nombre, Parentesco, Teléfono y Email del contacto de emergencia.
    

### D. Ficha Clínica Cronológica de Paciente (Multi-Pestaña)

Al ingresar al perfil de un paciente, la interfaz despliega su identificador numérico de ficha único (Regla: `YYMMDDXX`, donde `YYMMDD` representan el año, mes y día de ingreso, y `XX` corresponde al correlativo incremental diario). La información se organiza en las siguientes pestañas:

1. **Resumen y Contacto:** Datos demográficos, personales y de emergencia con diseño de acordeones limpios.
    
2. **Conceptualización y Plan Terapéutico:** Campos de edición profunda para el Motivo de consulta, Antecedentes relevantes, Observaciones generales, Enfoque teórico, Formulación del caso y el Objetivo general del proceso. Incluye la sub-tabla de _Hipótesis Diagnóstica_ con Fecha de registro, Código (CIE-10 o DSM-5) y Descripción comprensiva.
    
3. **Historial de Sesiones:** Timeline de consultas con visualización del estado de pago, boleta emitida y acceso directo a la vista específica de sesión.
    
4. **Registro de Sintomatología:** Historial de evolución de síntomas modificable mediante un modal que captura la Fecha y el Contenido del registro. Todo registro es editable y eliminable.
    
5. **Alta / Cierre (Epicrisis):** Formulario para dar de alta al paciente registrando la Fecha de cierre, el Motivo de término (`Alta por cumplimiento de objetivos`, `Derivación a otro profesional`, `Abandono del tratamiento por parte del paciente`, `Decisión de mutuo acuerdo`, `Otro`) y la Evaluación final del proceso.
    
6. **Archivos del Paciente:** Repositorio documental privado para subir archivos con descripción libre.
    

### E. Vista de Detalle de Sesión y Ciclo Multimodal de IA

Módulo especializado que implementa el **"Ciclo de Alivio"** mediante tres pestañas de control:

1. **Notas Clínicas (Evolución SOAP/DAP):** Interfaz dividida en tres campos independientes obligatorios: _Temas abordados_, _Síntomas reportados/observados_ y _Contenido y proceso de la sesión_.
    
2. **Detalles Administrativos:** Registro de la Fecha, Hora, Modalidad (`Online`, `Presencial`), Estado de sesión (`Programada`, `Completa`, `Reprogramada`, `Cancelada`), Valor de la sesión, Estado de pago (`Pagado`, `Pendiente`, `Parcial`), Tipo de pago (`Transferencia electrónica`, `Efectivo`, `Tarjeta de crédito/débito`, `Otro`), Identificador de transacción, Estado de boleta (`No Aplica`, `Pendiente`, `Emitida`) y Comentarios internos.
    
3. **Archivos de la Sesión:** Capa de almacenamiento vinculada exclusivamente a la cita.
    

> **Protocolo Multimodal de Captura:** El sistema permite importar el contenido de la sesión a través de tres vías: **Dictado de voz directo o carga de audio** (procesado mediante Gemini 1.5 Flash para estructuración SOAP post-sesión, incluyendo el motor interactivo de preguntas de IA ante omisiones clínicas), **carga de imagen** o **toma de fotografía instantánea** utilizando tecnologías de reconocimiento óptico de caracteres (OCR) para digitalizar apuntes físicos manuscritos en tiempo real. Incluye botón de descarga independiente de la sesión en PDF.

### F. Centro de Documentación y Generador de Informes

- Módulo para compilar Fichas Clínicas Integrales o Registros de Sesión con descarga en DOCX y PDF.
    
- **Foco Controlado de IA:** Implementa una lista de selección (_checkboxes_) para que el psicólogo indique explícitamente en qué notas anteriores o antecedentes históricos de la base de datos debe basar la IA (Gemini 1.5 Pro) el análisis evolutivo del informe, evitando alucinaciones del modelo[cite: 11].
    

# 2. MODELO DE DATOS AVANZADO (SUPABASE / POSTGRESQL)

Para dar soporte a la totalidad de las vistas, el esquema relacional en Supabase PostgreSQL implementa llaves primarias UUID v4, particionamiento temporal nativo para el Decreto 41 y RLS multi-tenant asilado por `organization_id`:

SQL

```
-- =====================================================================
-- CONFIGURACIÓN DE INFRAESTRUCTURA RELACIONAL EXTENDIDA
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE public.plan_level AS ENUM ('Starter', 'Pro', 'Enterprise');
CREATE TYPE public.patient_status AS ENUM ('activo', 'seguimiento', 'alta', 'archivado', 'inactivo');
CREATE TYPE public.session_status AS ENUM ('Programada', 'Completa', 'Cancelada', 'Reprogramada');
CREATE TYPE public.payment_status AS ENUM ('Pagado', 'Pendiente', 'Parcial');
CREATE TYPE public.audio_status AS ENUM ('active', 'processing', 'deleted_pending', 'hard_deleted');
CREATE TYPE public.unit_type AS ENUM ('NOTA_IA', 'INFORME_CLINICO');

-- ORGANIZACIONES (TENANTS)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    current_plan public.plan_level NOT NULL DEFAULT 'Starter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PERFILES PROFESIONALES
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rut_professional TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_name TEXT NOT NULL CHECK (role_name IN ('admin_clinica', 'psicologo', 'administrativo')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONTROL ANTI-MULTICUENTA
CREATE UNIQUE INDEX idx_unique_rut_professional_pro 
ON public.profiles (rut_professional) 
WHERE (role_name = 'psicologo' OR role_name = 'admin_clinica');

-- CRM: FICHA DEMOGRÁFICA COMPLETA DE PACIENTES
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    ficha_id_num TEXT NOT NULL UNIQUE, -- Código autogenerado YYMMDDXX
    rut_patient TEXT,
    full_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    gender TEXT,
    occupation TEXT,
    marital_status TEXT,
    education_level TEXT, -- Pre-básica, Diferencial, Básica, Media, Técnico, Superior, Posgrado
    education_status TEXT, -- NT1, NT2, 1-8 Basico, 1-4 Medio, En curso, Incompleto, Completo
    education_institution TEXT,
    health_system TEXT, -- Fonasa, Isapre, No sabe, Otro
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

-- HISTORIAS CLÍNICAS Y CONCEPTUALIZACIÓN
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

-- TABLA DE DIAGNÓSTICOS (CIE-10 / DSM-5)
CREATE TABLE public.diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.clinical_records(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CALENDARIO Y GESTIÓN FINANCIERA DE SESIONES
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
    payment_type TEXT, -- Transferencia electrónica, Efectivo, Tarjeta de crédito/débito, Otro
    transaction_id TEXT,
    payment_date DATE,
    boleta_status TEXT DEFAULT 'Pendiente', -- No Aplica, Pendiente, Emitida
    comentarios_internos TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EVOLUCIONES CLÍNICAS (SOAP/DAP) CON PROTOCOLO HITL
CREATE TABLE public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    temas_abordados TEXT,
    sintomas_observados TEXT,
    ai_raw_draft TEXT NOT NULL, -- Borrador puro de Gemini
    human_validated_content TEXT, -- Texto editado y firmado por el clínico
    is_human_validated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONTROL DEL CICLO DE AUDIO (HARD DELETE)
CREATE TABLE public.audio_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    status public.audio_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    deleted_at TIMESTAMPTZ
);

-- REGISTRO DE SINTOMATOLOGÍA
CREATE TABLE public.sintomatologia_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EPICRISIS (ALTA Y CIERRE)
CREATE TABLE public.epicrisis_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    closure_date DATE NOT NULL,
    reason TEXT NOT NULL, -- Alta cumplimiento, Derivacion, Abandono, Mutuo acuerdo, Otro
    final_evaluation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- VAULT MUTANTE DE ARCHIVOS (BIBLIOTECA Y PACIENTES)
CREATE TABLE public.files_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE, -- NULL si es recurso global de biblioteca
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE, -- NULL si es de ficha general
    original_name TEXT NOT NULL,
    saved_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    category TEXT DEFAULT 'General', -- Guías Clínicas, Plantillas de Informes, Material Psicoeducativo
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LIBRO MAYOR FINANCIERO DE CRÉDITOS IA (APPEND-ONLY LEDGER)
CREATE TABLE public.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id),
    type_unit public.unit_type NOT NULL,
    amount INTEGER NOT NULL, -- Negativo consume, positivo recarga
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ESQUEMA DE AUDITORÍA INMUTABLE DE ACCESOS (DECRETO 41)
CREATE SCHEMA audit;
CREATE TABLE audit.access_logs (
    id BIGSERIAL,
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action_name TEXT NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
    target_table TEXT NOT NULL,
    resource_id UUID NOT NULL,
    metadata JSONB NOT NULL, -- Captura IP, User-Agent y estado de "privacy_mode_active"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- RESTRICCIÓN ABSOLUTA DE BASE DE DATOS
REVOKE UPDATE, DELETE, TRUNCATE ON audit.access_logs FROM public;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.access_logs FROM authenticated;

-- ACTIVACIÓN DE SEGURIDAD MULTI-TENANT
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON public.patients
    FOR ALL USING (organization_id = current_setting('app.current_tenant', true)::UUID);
```
