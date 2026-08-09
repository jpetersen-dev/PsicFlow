-- Migration: Add SEO title, JSON-LD schema, and custom session topics to services
-- Created at: 2026-08-07

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS json_ld jsonb;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS what_we_work jsonb DEFAULT '[]'::jsonb;
