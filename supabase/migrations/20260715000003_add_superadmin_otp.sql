-- Migration: Add Superadmin OTP Table and Functions for 2FA
-- Created at: 2026-07-15

CREATE TABLE IF NOT EXISTS public.superadmin_otp (
  email text PRIMARY KEY,
  otp_code text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

-- Turn on RLS just in case, but restrict everything
ALTER TABLE public.superadmin_otp ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_superadmin_otp(
  p_email text,
  p_otp_code text,
  p_expires_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow if the email matches our superadmin
  IF p_email != 'jpz.dev.solutions@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.superadmin_otp (email, otp_code, expires_at)
  VALUES (p_email, p_otp_code, p_expires_at)
  ON CONFLICT (email) DO UPDATE
  SET otp_code = p_otp_code,
      created_at = now(),
      expires_at = p_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_superadmin_otp(
  p_email text,
  p_otp_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid boolean := false;
BEGIN
  IF p_email != 'jpz.dev.solutions@gmail.com' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 
    FROM public.superadmin_otp 
    WHERE email = p_email 
      AND otp_code = p_otp_code 
      AND expires_at > now()
  ) INTO v_valid;

  -- Delete used OTP
  IF v_valid THEN
    DELETE FROM public.superadmin_otp WHERE email = p_email;
  END IF;

  RETURN v_valid;
END;
$$;
