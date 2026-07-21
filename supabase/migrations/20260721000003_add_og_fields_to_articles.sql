-- Add og_title and og_description to public.articles table
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS og_title text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS og_description text;
