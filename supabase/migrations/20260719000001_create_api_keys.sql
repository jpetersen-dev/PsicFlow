-- Migration: Create api_keys table and verify_api_key function
-- Date: 2026-07-19

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_preview VARCHAR(50) NOT NULL, -- e.g. "pf_live_***abcd"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Select Policy: Only admin_clinica of that organization can view
CREATE POLICY select_api_keys ON public.api_keys
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id 
      FROM public.profiles 
      WHERE organization_id = api_keys.organization_id 
        AND role_name = 'admin_clinica'
    )
  );

-- Insert Policy: Only admin_clinica of that organization can insert
CREATE POLICY insert_api_keys ON public.api_keys
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id 
      FROM public.profiles 
      WHERE organization_id = api_keys.organization_id 
        AND role_name = 'admin_clinica'
    )
  );

-- Delete Policy: Only admin_clinica of that organization can delete
CREATE POLICY delete_api_keys ON public.api_keys
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id 
      FROM public.profiles 
      WHERE organization_id = api_keys.organization_id 
        AND role_name = 'admin_clinica'
    )
  );

-- SECURITY DEFINER function to verify API key and log last usage
CREATE OR REPLACE FUNCTION public.verify_api_key(p_key_hash VARCHAR)
RETURNS TABLE(organization_id UUID)
SECURITY DEFINER
AS $$
BEGIN
  -- Update last_used_at timestamp
  UPDATE public.api_keys
  SET last_used_at = NOW()
  WHERE key_hash = p_key_hash;

  -- Return organization_id matching the key
  RETURN QUERY
  SELECT a.organization_id
  FROM public.api_keys a
  WHERE a.key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql;

-- SECURITY DEFINER function to create a new patient prospect bypassing RLS
CREATE OR REPLACE FUNCTION public.create_patient_prospect(
  p_organization_id UUID,
  p_ficha_id_num VARCHAR,
  p_full_name VARCHAR,
  p_email VARCHAR,
  p_phone VARCHAR,
  p_observaciones TEXT
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  INSERT INTO public.patients (
    organization_id,
    ficha_id_num,
    full_name,
    email,
    phone,
    observaciones_generales,
    status,
    nacionalidad,
    pais_origen,
    gender,
    marital_status,
    education_level,
    education_status,
    health_system
  ) VALUES (
    p_organization_id,
    p_ficha_id_num,
    p_full_name,
    p_email,
    p_phone,
    p_observaciones,
    'prospecto',
    'Chilena',
    'Chile',
    'Masculino',
    'Soltero/a',
    'Básica',
    'Primero Básico',
    'Fonasa'
  )
  RETURNING id INTO v_patient_id;

  RETURN v_patient_id;
END;
$$ LANGUAGE plpgsql;

