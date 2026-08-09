-- Migration: Add PayPal support to organization_payment_gateways and orders
-- Created at: 2026-08-08

-- 1. Alter organization_payment_gateways constraint to allow 'paypal'
ALTER TABLE public.organization_payment_gateways 
DROP CONSTRAINT IF EXISTS organization_payment_gateways_provider_check;

ALTER TABLE public.organization_payment_gateways 
ADD CONSTRAINT organization_payment_gateways_provider_check 
CHECK (provider = ANY (ARRAY['wise'::text, 'stripe'::text, 'mercadopago'::text, 'dlocal_go'::text, 'webpay'::text, 'manual'::text, 'lemonsqueezy'::text, 'paypal'::text]));

-- 2. Alter orders table to allow NULL in lemon_squeezy_id and add paypal_order_id
ALTER TABLE public.orders 
ALTER COLUMN lemon_squeezy_id DROP NOT NULL;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS paypal_order_id text UNIQUE;

-- 3. Seed/Update PayPal gateway as active for Sentido Migrante (id: fa28bcff-1321-4cb4-b5ef-64ffed1662cb)
INSERT INTO public.organization_payment_gateways (organization_id, provider, is_active, credentials)
VALUES (
  'fa28bcff-1321-4cb4-b5ef-64ffed1662cb',
  'paypal',
  true,
  '{}'::jsonb
)
ON CONFLICT (organization_id, provider) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  credentials = EXCLUDED.credentials;
