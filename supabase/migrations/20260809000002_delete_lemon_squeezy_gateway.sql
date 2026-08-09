-- Migration: Remove legacy lemonsqueezy gateway configuration
-- Since the platform has pivoted to PayPal, we clean up the unused lemonsqueezy gateway rows.

DELETE FROM public.organization_payment_gateways 
WHERE provider = 'lemonsqueezy';
