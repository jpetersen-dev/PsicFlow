-- Create get_organization_user_count SECURITY DEFINER helper to bypass RLS for capacity checks
CREATE OR REPLACE FUNCTION public.get_organization_user_count(p_organization_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT count(*)::integer FROM public.profiles WHERE organization_id = p_organization_id);
END;
$$;
