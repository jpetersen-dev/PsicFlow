-- Migration: Create Reviews System for Patients and Landing Page testimonials
-- Created at: 2026-06-27

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  patient_name text DEFAULT 'Anónimo',
  location text, -- e.g. "Suiza", "Alemania"
  is_public boolean DEFAULT false,
  approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read of approved public reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow patients to insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow specialists/admins to view organization reviews" ON public.reviews;

-- Create RLS Policies
CREATE POLICY "Allow public read of approved public reviews" ON public.reviews
  FOR SELECT
  TO public
  USING (is_public = true AND approved = true);

CREATE POLICY "Allow patients to insert reviews" ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Allow specialists/admins to view organization reviews" ON public.reviews
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.id = auth.uid()
        AND my_profile.organization_id = (
          SELECT p.organization_id FROM public.profiles p WHERE p.id = specialist_id
        )
    )
  );

-- Create public RPC function to fetch reviews
DROP FUNCTION IF EXISTS public.get_public_reviews(uuid);

CREATE OR REPLACE FUNCTION public.get_public_reviews(p_organization_id uuid)
RETURNS TABLE(
  id uuid,
  specialist_name text,
  specialist_role text,
  rating integer,
  comment text,
  patient_name text,
  location text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    p.full_name AS specialist_name,
    p.specialization AS specialist_role,
    r.rating,
    r.comment,
    r.patient_name,
    COALESCE(r.location, 'Europa') AS location,
    r.created_at
  FROM public.reviews r
  JOIN public.profiles p ON r.specialist_id = p.id
  WHERE p.organization_id = p_organization_id
    AND r.is_public = true
    AND r.approved = true
  ORDER BY r.created_at DESC;
END;
$$;

-- Seed initial mock reviews for Sentido Migrante (id: fa28bcff-1321-4cb4-b5ef-64ffed1662cb)
-- Therapist Jonathan Petersen Zañartu (id: 68d8d4d4-7b67-406d-8c70-61020c75f4c5)
INSERT INTO public.reviews (specialist_id, rating, comment, patient_name, location, is_public, approved)
VALUES 
  (
    '68d8d4d4-7b67-406d-8c70-61020c75f4c5', 
    5, 
    'Encontrar un psicólogo que entienda mi cultura y mi idioma ha sido fundamental para adaptarme a mi nueva vida en Zúrich.', 
    'María G.', 
    'Suiza', 
    true, 
    true
  ),
  (
    '68d8d4d4-7b67-406d-8c70-61020c75f4c5', 
    5, 
    'El proceso de terapia de pareja nos ayudó a superar la crisis del choque cultural en Frankfurt. Muy empático y profesional.', 
    'Carlos y Ana', 
    'Alemania', 
    true, 
    true
  ),
  (
    '68d8d4d4-7b67-406d-8c70-61020c75f4c5', 
    5, 
    'Me sentí escuchado desde la primera sesión. Las herramientas que me dio para manejar la ansiedad son invaluables.', 
    'Javier V.', 
    'Suiza', 
    true, 
    true
  ),
  (
    '68d8d4d4-7b67-406d-8c70-61020c75f4c5', 
    5, 
    'Su enfoque cálido pero directo me guió cuando me sentía totalmente estancada con el idioma y la cultura suiza.', 
    'Elena M.', 
    'Suiza', 
    true, 
    true
  );
