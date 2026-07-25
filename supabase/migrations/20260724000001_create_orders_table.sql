-- Migration: Create orders table and configure lemonsqueezy provider
-- Created at: 2026-07-24

-- 1. Alter organization_payment_gateways constraint to allow 'lemonsqueezy'
ALTER TABLE public.organization_payment_gateways 
DROP CONSTRAINT IF EXISTS organization_payment_gateways_provider_check;

ALTER TABLE public.organization_payment_gateways 
ADD CONSTRAINT organization_payment_gateways_provider_check 
CHECK (provider = ANY (ARRAY['wise'::text, 'stripe'::text, 'mercadopago'::text, 'dlocal_go'::text, 'webpay'::text, 'manual'::text, 'lemonsqueezy'::text]));

-- 2. Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lemon_squeezy_id text NOT NULL UNIQUE,
  patient_email text NOT NULL,
  product_name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Allow specialists to select orders" ON public.orders;
CREATE POLICY "Allow specialists to select orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = orders.organization_id
    )
  );

DROP POLICY IF EXISTS "Allow patients to select their own orders" ON public.orders;
CREATE POLICY "Allow patients to select their own orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    patient_email = auth.jwt()->>'email' OR
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.user_id = auth.uid() AND p.email = orders.patient_email
    )
  );

-- 4. Seed lemonsqueezy gateway for Sentido Migrante organization
INSERT INTO public.organization_payment_gateways (organization_id, provider, is_active, credentials)
VALUES (
  'fa28bcff-1321-4cb4-b5ef-64ffed1662cb',
  'lemonsqueezy',
  true,
  '{"storeId": "438567", "variantId": "1945659"}'::jsonb
)
ON CONFLICT (organization_id, provider) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  credentials = EXCLUDED.credentials;
