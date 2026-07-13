-- Add original_logo_url column to profiles table to store raw uncropped profile images
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS original_logo_url TEXT;
