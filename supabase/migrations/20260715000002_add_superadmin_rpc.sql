-- Migration: Add Superadmin RPC Functions for SaaS Management
-- Created at: 2026-07-15

-- Create is_superadmin security definer function
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(auth.jwt() ->> 'email', '') = 'jpz.dev.solutions@gmail.com';
END;
$$;

-- Create get_all_organizations security definer function
CREATE OR REPLACE FUNCTION public.get_all_organizations()
RETURNS TABLE(
  id uuid,
  name text,
  current_plan text,
  created_at timestamp with time zone,
  user_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.current_plan,
    o.created_at,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.organization_id = o.id AND p.role_name != 'paciente') AS user_count
  FROM public.organizations o
  ORDER BY o.created_at DESC;
END;
$$;

-- Create get_all_profiles_admin security definer function
CREATE OR REPLACE FUNCTION public.get_all_profiles_admin()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  role_name text,
  organization_name text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    p.role_name,
    COALESCE(o.name, 'Sin Clínica') AS organization_name,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.organizations o ON p.organization_id = o.id
  WHERE p.role_name != 'paciente'
  ORDER BY p.created_at DESC;
END;
$$;

-- Create get_all_invitations_admin security definer function
CREATE OR REPLACE FUNCTION public.get_all_invitations_admin()
RETURNS TABLE(
  id uuid,
  email text,
  token text,
  role_name text,
  is_used boolean,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  organization_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.token,
    i.role_name,
    i.is_used,
    i.expires_at,
    i.created_at,
    COALESCE(o.name, 'Sin Clínica') AS organization_name
  FROM public.invitations i
  LEFT JOIN public.organizations o ON i.organization_id = o.id
  ORDER BY i.created_at DESC;
END;
$$;

-- Create create_invitation_admin security definer function
CREATE OR REPLACE FUNCTION public.create_invitation_admin(
  p_email text,
  p_organization_id uuid,
  p_role_name text,
  p_token text,
  p_expires_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.invitations (email, token, organization_id, role_name, expires_at)
  VALUES (p_email, p_token, p_organization_id, p_role_name, p_expires_at);
END;
$$;

-- Create delete_invitation_admin security definer function
CREATE OR REPLACE FUNCTION public.delete_invitation_admin(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.invitations WHERE id = p_id;
END;
$$;

-- Create update_organization_plan_admin security definer function
CREATE OR REPLACE FUNCTION public.update_organization_plan_admin(
  p_organization_id uuid,
  p_new_plan text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.organizations
  SET current_plan = p_new_plan
  WHERE id = p_organization_id;
END;
$$;
