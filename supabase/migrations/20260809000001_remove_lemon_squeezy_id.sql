-- Migration: Remove lemon_squeezy_id column from orders table
-- Since we migrated to PayPal Business, this column is no longer used.

ALTER TABLE public.orders 
DROP COLUMN IF EXISTS lemon_squeezy_id;
