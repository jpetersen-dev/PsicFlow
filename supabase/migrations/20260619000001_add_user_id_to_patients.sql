-- =====================================================================
-- Migration: 20260619000001_add_user_id_to_patients.sql
-- Description: Vincula pacientes con auth.users, define RLS para pacientes
--              y crea funciones RPC SECURITY DEFINER para reserva headless.
-- =====================================================================

-- 1. Agregar columna user_id a la tabla patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Habilitar políticas RLS para pacientes en la tabla patients
CREATE POLICY patient_self_select ON public.patients
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY patient_self_update ON public.patients
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 3. Habilitar políticas RLS para pacientes en la tabla sessions
CREATE POLICY patient_session_select ON public.sessions
    FOR SELECT USING (
        patient_id IN (
            SELECT id FROM public.patients WHERE user_id = auth.uid()
        )
    );

-- 4. Habilitar políticas RLS para pacientes en la tabla files_vault
CREATE POLICY patient_files_select ON public.files_vault
    FOR SELECT USING (
        patient_id IN (
            SELECT id FROM public.patients WHERE user_id = auth.uid()
        )
        OR (
            patient_id IS NULL 
            AND organization_id IN (
                SELECT organization_id FROM public.patients WHERE user_id = auth.uid()
            )
        )
    );

-- =====================================================================
-- 5. RPC SECURITY DEFINER para la integración Headless
-- =====================================================================

-- RPC A: Obtener información del calendario del especialista
CREATE OR REPLACE FUNCTION public.get_specialist_calendar_info(p_organization_id UUID, p_specialist_id UUID)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  timezone TEXT,
  work_start_hour INT,
  work_end_hour INT,
  refresh_token TEXT,
  calendar_ids TEXT[]
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS profile_id,
    p.full_name,
    p.timezone,
    p.work_start_hour,
    p.work_end_hour,
    gcc.refresh_token,
    COALESCE(array_agg(gcs.calendar_id) FILTER (WHERE gcs.calendar_id IS NOT NULL), '{}'::TEXT[]) AS calendar_ids
  FROM public.profiles p
  LEFT JOIN public.google_calendar_connections gcc ON gcc.profile_id = p.id AND gcc.organization_id = p_organization_id
  LEFT JOIN public.google_calendar_selections gcs ON gcs.connection_id = gcc.id AND gcs.is_active = true
  WHERE p.organization_id = p_organization_id
    AND p.id = p_specialist_id
    AND p.role_name = 'psicologo'
  GROUP BY p.id, p.full_name, p.timezone, p.work_start_hour, p.work_end_hour, gcc.refresh_token;
END;
$$ LANGUAGE plpgsql;

-- RPC B: Obtener las sesiones del especialista para cruzar disponibilidad
CREATE OR REPLACE FUNCTION public.get_specialist_sessions(p_organization_id UUID, p_specialist_id UUID, p_date DATE)
RETURNS TABLE (
  session_id UUID,
  time_session TIME,
  status_session public.session_status,
  status_payment public.payment_status,
  patient_name TEXT
) SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS session_id,
    s.time_session,
    s.status_session,
    s.status_payment,
    pat.full_name AS patient_name
  FROM public.sessions s
  JOIN public.patients pat ON s.patient_id = pat.id
  WHERE s.organization_id = p_organization_id
    AND s.professional_id = p_specialist_id
    AND s.date_session = p_date
    AND (
      s.status_session IN ('Programada', 'Completa')
      OR (s.status_payment = 'Pendiente' AND s.created_at >= NOW() - INTERVAL '15 minutes')
    );
END;
$$ LANGUAGE plpgsql;

-- RPC C: Crear una reserva de cita preventiva atómicamente
CREATE OR REPLACE FUNCTION public.create_booking_reservation(
  p_organization_id UUID,
  p_specialist_id UUID,
  p_date DATE,
  p_time TIME,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_transaction_id TEXT,
  p_value NUMERIC DEFAULT 0.00
)
RETURNS TABLE (
  session_id UUID,
  patient_id UUID,
  transaction_id TEXT,
  status_session public.session_status,
  status_payment public.payment_status
) SECURITY DEFINER AS $$
DECLARE
  v_patient_id UUID;
  v_session_id UUID;
BEGIN
  -- 1. Buscar si el paciente ya existe por email en esta clínica
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE organization_id = p_organization_id
    AND LOWER(email) = LOWER(p_email)
  LIMIT 1;

  -- 2. Crear paciente si no existe
  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (
      organization_id,
      full_name,
      email,
      phone,
      birth_date,
      status
    ) VALUES (
      p_organization_id,
      p_full_name,
      LOWER(p_email),
      p_phone,
      '1900-01-01'::DATE,
      'activo'::public.patient_status
    )
    RETURNING id INTO v_patient_id;
  END IF;

  -- 3. Crear sesión con estado pendiente de pago
  INSERT INTO public.sessions (
    organization_id,
    patient_id,
    professional_id,
    date_session,
    time_session,
    modality,
    status_session,
    status_payment,
    transaction_id,
    value_session
  ) VALUES (
    p_organization_id,
    v_patient_id,
    p_specialist_id,
    p_date,
    p_time,
    'Online',
    'Programada'::public.session_status,
    'Pendiente'::public.payment_status,
    p_transaction_id,
    p_value
  )
  RETURNING id INTO v_session_id;

  RETURN QUERY
  SELECT 
    s.id,
    s.patient_id,
    s.transaction_id,
    s.status_session,
    s.status_payment
  FROM public.sessions s
  WHERE s.id = v_session_id;
END;
$$ LANGUAGE plpgsql;
