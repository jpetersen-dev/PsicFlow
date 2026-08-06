-- Migration: Add multi-currency pricing support to services and sessions
-- Created at: 2026-08-06

-- 1. Alter public.services to add alternate_prices column
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS alternate_prices jsonb DEFAULT '[]'::jsonb;

-- 2. Alter public.sessions to add currency column
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CLP';

-- 3. Re-create create_booking_reservation RPC with p_currency parameter and JSONB price resolution
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
BEGIN
  -- Resolve price dynamically from services table if service_id is provided
  IF p_service_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN LOWER(currency) = LOWER(p_currency) THEN price
        ELSE COALESCE(
          (
            SELECT (val->>'price')::numeric 
            FROM jsonb_array_elements(alternate_prices) val 
            WHERE LOWER(val->>'currency') = LOWER(p_currency) 
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
    p_currency
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

-- 4. Seed default alternate EUR prices for existing Sentido Migrante services (organization_id: fa28bcff-1321-4cb4-b5ef-64ffed1662cb)
-- Adds 60.00 EUR price with Lemon Squeezy Store B credentials for all CHF services
UPDATE public.services
SET alternate_prices = '[{"price": 60.00, "currency": "EUR", "gateway_details": {"store_id": "438568", "variant_id": "1945660"}}]'::jsonb
WHERE organization_id = 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb' AND currency = 'CHF';
