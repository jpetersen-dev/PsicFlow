-- 1. Agregar horario de trabajo a profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_start_hour INTEGER DEFAULT 8;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_end_hour INTEGER DEFAULT 20;

-- 2. Agregar columnas de mapeo de calendario a google_calendar_connections
ALTER TABLE public.google_calendar_connections ADD COLUMN IF NOT EXISTS clinical_calendar_id TEXT;
ALTER TABLE public.google_calendar_connections ADD COLUMN IF NOT EXISTS personal_calendar_id TEXT;

-- 3. Agregar google_event_id a sessions y personal_events
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE public.personal_events ADD COLUMN IF NOT EXISTS google_event_id TEXT;
