-- Create failed access logs table
CREATE TABLE IF NOT EXISTS public.failed_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role_attempted text,
  reason text NOT NULL,
  attempted_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.failed_access_logs ENABLE ROW LEVEL SECURITY;

-- Allow insert by any user (even unauthenticated/being rejected)
CREATE POLICY insert_failed_access_logs ON public.failed_access_logs
    FOR INSERT WITH CHECK (true);

-- Allow select by clinical administrators only
CREATE POLICY select_failed_access_logs ON public.failed_access_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
              AND profiles.role_name = 'admin_clinica'
        )
    );
