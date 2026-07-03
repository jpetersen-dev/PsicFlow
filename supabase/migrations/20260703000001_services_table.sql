-- 1. Create public.services table
CREATE TABLE IF NOT EXISTS public.services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    title text NOT NULL,
    id_slug text NOT NULL,
    duration_minutes integer NOT NULL DEFAULT 50,
    price numeric(10,2) NOT NULL DEFAULT 0.00,
    currency text NOT NULL DEFAULT 'CLP',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(organization_id, id_slug)
);

-- Index for faster query lookup
CREATE INDEX IF NOT EXISTS idx_services_organization ON public.services(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_slug ON public.services(id_slug);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow public read of active services" ON public.services;
CREATE POLICY "Allow public read of active services" ON public.services
  FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "Allow specialists to manage organization services" ON public.services;
CREATE POLICY "Allow specialists to manage organization services" ON public.services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = services.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = services.organization_id
    )
  );

-- 2. Add service_id to public.sessions
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

-- 3. Update create_booking_reservation RPC to support p_service_id and resolve price dynamically
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
  p_service_id uuid DEFAULT NULL
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
    SELECT price INTO v_value
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
    service_id
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
    p_service_id
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

-- 4. Seed initial services for Sentido Migrante (organization_id: fa28bcff-1321-4cb4-b5ef-64ffed1662cb)
INSERT INTO public.services (organization_id, title, id_slug, duration_minutes, price, currency, is_active)
VALUES 
  ('fa28bcff-1321-4cb4-b5ef-64ffed1662cb', 'Restauración de Identidad', 'identidad', 50, 60.00, 'CHF', true),
  ('fa28bcff-1321-4cb4-b5ef-64ffed1662cb', 'Tribu en el Exilio', 'tribu', 50, 60.00, 'CHF', true),
  ('fa28bcff-1321-4cb4-b5ef-64ffed1662cb', 'Soberanía Lingüística', 'soberania', 50, 60.00, 'CHF', true),
  ('fa28bcff-1321-4cb4-b5ef-64ffed1662cb', 'Duelo Migratorio', 'duelo', 50, 60.00, 'CHF', true)
ON CONFLICT (organization_id, id_slug) 
DO UPDATE SET 
  title = EXCLUDED.title,
  duration_minutes = EXCLUDED.duration_minutes,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active;
