-- Migration 017: CRM improvements, prospecto patient status, and automatic ficha_id_num generation trigger
-- Date: 2026-06-21

-- 1. Add 'prospecto' status to patient_status enum if not already present
-- (ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block)
-- Running this manually or in this migration:
ALTER TYPE public.patient_status ADD VALUE IF NOT EXISTS 'prospecto';

-- 2. Create trigger function to automatically assign patient chart numbers when status changes from 'prospecto' to active
CREATE OR REPLACE FUNCTION public.tr_auto_assign_ficha_number()
RETURNS TRIGGER AS $$
DECLARE
  v_date_prefix TEXT;
  v_count INT;
BEGIN
  -- If status is NOT 'prospecto' and ficha_id_num is null
  IF NEW.status != 'prospecto'::public.patient_status AND NEW.ficha_id_num IS NULL THEN
    v_date_prefix := to_char(CURRENT_DATE, 'YYMMDD');
    
    SELECT COUNT(*) INTO v_count
    FROM public.patients
    WHERE organization_id = NEW.organization_id
      AND ficha_id_num LIKE v_date_prefix || '%';
      
    NEW.ficha_id_num := v_date_prefix || lpad((v_count + 1)::TEXT, 2, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind function to tr_patients_auto_ficha trigger
DROP TRIGGER IF EXISTS tr_patients_auto_ficha ON public.patients;
CREATE TRIGGER tr_patients_auto_ficha
  BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_auto_assign_ficha_number();

-- 4. Update confirm_session_payment RPC to promote prospecto patients on payment
DROP FUNCTION IF EXISTS public.confirm_session_payment(TEXT);

CREATE OR REPLACE FUNCTION public.confirm_session_payment(p_transaction_id TEXT)
RETURNS TABLE (
  session_id UUID,
  date_session DATE,
  time_session TIME,
  modality TEXT,
  patient_name TEXT,
  patient_email TEXT,
  specialist_name TEXT,
  specialist_email TEXT,
  specialist_timezone TEXT,
  google_refresh_token TEXT,
  clinical_calendar_id TEXT,
  google_event_id TEXT
) SECURITY DEFINER AS $$
DECLARE
  v_session_id UUID;
  v_patient_id UUID;
BEGIN
  -- 1. Find the session
  SELECT id, patient_id INTO v_session_id, v_patient_id
  FROM public.sessions
  WHERE transaction_id = p_transaction_id
    AND status_payment = 'Pendiente'
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Update the session
  UPDATE public.sessions
  SET 
    status_payment = 'Pagado'::public.payment_status,
    payment_date = NOW()::DATE,
    payment_type = 'Transferencia'
  WHERE id = v_session_id;

  -- 3. If patient is prospecto, promote to active (this triggers automatic ficha_id_num generation)
  UPDATE public.patients
  SET status = 'activo'::public.patient_status
  WHERE id = v_patient_id AND status = 'prospecto'::public.patient_status;

  -- 4. Return the merged session & specialist details
  RETURN QUERY
  SELECT 
    s.id AS session_id,
    s.date_session,
    s.time_session,
    s.modality,
    pat.full_name AS patient_name,
    pat.email AS patient_email,
    p.full_name AS specialist_name,
    p.email AS specialist_email,
    p.timezone AS specialist_timezone,
    gcc.refresh_token AS google_refresh_token,
    gcc.clinical_calendar_id,
    s.google_event_id
  FROM public.sessions s
  JOIN public.patients pat ON s.patient_id = pat.id
  JOIN public.profiles p ON s.professional_id = p.id
  LEFT JOIN public.google_calendar_connections gcc ON gcc.profile_id = p.id AND gcc.organization_id = s.organization_id
  WHERE s.id = v_session_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Update create_booking_reservation RPC to insert patients with status = 'prospecto'
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

  -- 2. Crear paciente si no existe con estado 'prospecto'
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
      'prospecto'::public.patient_status
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
