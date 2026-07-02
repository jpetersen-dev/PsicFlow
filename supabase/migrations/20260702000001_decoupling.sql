-- Migration: Create booking settings and payment gateways tables
-- Created at: 2026-07-02

-- 1. Create booking_settings table
CREATE TABLE IF NOT EXISTS public.booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  booking_prefix text NOT NULL DEFAULT 'PF',
  currency text NOT NULL DEFAULT 'CLP',
  payment_links jsonb DEFAULT '{}'::jsonb,
  bank_transfer_details jsonb DEFAULT '{}'::jsonb,
  terms_text text,
  sandbox_mode boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read of booking settings" ON public.booking_settings;
DROP POLICY IF EXISTS "Allow specialists to manage booking settings" ON public.booking_settings;

-- Create Policies
CREATE POLICY "Allow public read of booking settings" ON public.booking_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow specialists to manage booking settings" ON public.booking_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = booking_settings.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = booking_settings.organization_id
    )
  );

-- 2. Create organization_payment_gateways table
CREATE TABLE IF NOT EXISTS public.organization_payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('wise', 'stripe', 'mercadopago', 'dlocal_go', 'webpay', 'manual')),
  is_active boolean DEFAULT false,
  credentials jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, provider)
);

-- Enable RLS
ALTER TABLE public.organization_payment_gateways ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow specialists to manage payment gateways" ON public.organization_payment_gateways;

-- Create Policies
CREATE POLICY "Allow specialists to manage payment gateways" ON public.organization_payment_gateways
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = organization_payment_gateways.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles my_profile
      WHERE my_profile.user_id = auth.uid()
        AND my_profile.organization_id = organization_payment_gateways.organization_id
    )
  );

-- 3. Seed initial settings for Sentido Migrante (id: fa28bcff-1321-4cb4-b5ef-64ffed1662cb)
INSERT INTO public.booking_settings (
  organization_id, 
  booking_prefix, 
  currency, 
  payment_links, 
  bank_transfer_details, 
  terms_text
) VALUES (
  'fa28bcff-1321-4cb4-b5ef-64ffed1662cb',
  'SM',
  'CHF',
  '{
    "CH": "https://wise.com/pay/me/sentidomigrante-chf",
    "DE": "https://wise.com/pay/me/sentidomigrante-eur"
  }'::jsonb,
  '{
    "CH": {
      "holder": "Sentido Migrante GmbH",
      "iban": "CH89 0000 0000 0000 0000 0",
      "bic": "TRWIXXXXXXX",
      "bankName": "Wise Europe SA",
      "address": "Avenue Louise 54, Room s52, Brussels, Belgium"
    },
    "DE": {
      "holder": "Sentido Migrante GmbH",
      "iban": "BE89 0000 0000 0000",
      "bic": "TRWIXXXXXXX",
      "bankName": "Wise Europe SA",
      "address": "Avenue Louise 54, Room s52, Brussels, Belgium"
    }
  }'::jsonb,
  'Comprendo y acepto el Protocolo de Crisis Transnacional (incluyendo la exención de responsabilidad civil) y el acuerdo terapéutico con sus políticas de cancelación (24 hrs de antelación).'
) ON CONFLICT (organization_id) DO UPDATE SET
  booking_prefix = EXCLUDED.booking_prefix,
  currency = EXCLUDED.currency,
  payment_links = EXCLUDED.payment_links,
  bank_transfer_details = EXCLUDED.bank_transfer_details,
  terms_text = EXCLUDED.terms_text;

-- Seed default gateway for Sentido Migrante (Wise as active gateway)
INSERT INTO public.organization_payment_gateways (
  organization_id,
  provider,
  is_active,
  credentials
) VALUES (
  'fa28bcff-1321-4cb4-b5ef-64ffed1662cb',
  'wise',
  true,
  '{}'::jsonb
) ON CONFLICT (organization_id, provider) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  credentials = EXCLUDED.credentials;

-- 4. Set Sentido Migrante to Enterprise plan
UPDATE public.organizations
SET current_plan = 'Enterprise'
WHERE id = 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb';
