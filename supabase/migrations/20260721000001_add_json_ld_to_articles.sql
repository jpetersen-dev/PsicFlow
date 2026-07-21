-- Add json_ld to public.articles table
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS json_ld text;
