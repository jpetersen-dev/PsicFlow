-- Add secondary_image_url to public.articles table
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS secondary_image_url text;
