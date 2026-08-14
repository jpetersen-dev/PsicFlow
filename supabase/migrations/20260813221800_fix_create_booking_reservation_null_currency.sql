-- Migration: Fix create_booking_reservation to fallback to 'CLP' when p_currency is null or empty
-- Created at: 2026-08-13

CREATE OR REPLACE FUNCTION public.create_booking_reservation(
  p_organization_id uuid,
  p_specialist_id uuid,
  p_date date,
  p_time time,
  p_full_name text,
  p_email text,
  p_phone text,
  p_transaction_id text,
  p_value numeric DEFAULT 0.00,
  p_service_id uuid DEFAULT NULL,
  p_currency text DEFAULT 'CLP'
)
RETURNS TABLE (
  session_id uuid,
  patient_id uuid,
  transaction_id text,
  status_session public.session_status,
  status_payment public.payment_status
) SECURITY DEFINER AS $$
DECLARE
  v_patient_id uuid;
  v_session_id uuid;
  v_value numeric;
  v_currency text;
BEGIN
  -- Fallback to 'CLP' if p_currency is null or empty
  v_currency := COALESCE(NULLIF(TRIM(p_currency), ''), 'CLP');

  -- Resolve price dynamically from services table if service_id is provided
  IF p_service_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN LOWER(currency) = LOWER(v_currency) THEN price
        ELSE COALESCE(
          (
            SELECT (val->>'price')::numeric 
            FROM jsonb_array_elements(alternate_prices) val 
            WHERE LOWER(val->>'currency') = LOWER(v_currency) 
            LIMIT 1
          ), 
          price
        )
      END INTO v_value
    FROM public.services
    WHERE id = p_service_id AND organization_id = p_organization_id;
  END IF;

  -- Fall back to p_value if v_value is still null
  IF v_value IS NULL THEN
    v_value := p_value;
  END IF;

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
      '1900-01-01'::date,
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
    value_session,
    service_id,
    currency
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
    v_value,
    p_service_id,
    v_currency
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
