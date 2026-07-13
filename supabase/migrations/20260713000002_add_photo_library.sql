-- Add photo_library JSONB column to profiles table to store up to 5 photos (original and cropped versions)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_library JSONB DEFAULT '[]'::jsonb;
