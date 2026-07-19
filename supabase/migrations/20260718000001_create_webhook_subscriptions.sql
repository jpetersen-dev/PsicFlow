-- Migration: 20260718000001_create_webhook_subscriptions.sql
-- Description: Create webhook_subscriptions table, enable RLS, and create helper functions for outgoing webhooks.

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance on searches
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org_active ON public.webhook_subscriptions(organization_id, is_active);

-- Enable RLS
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS tenant_isolation_webhook_policy ON public.webhook_subscriptions;

-- Policy for tenant isolation
CREATE POLICY tenant_isolation_webhook_policy ON public.webhook_subscriptions
    FOR ALL USING (organization_id = public.get_current_tenant());

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_webhook_subscriptions_updated_at
    BEFORE UPDATE ON public.webhook_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_update_timestamp();

-- SECURITY DEFINER function to retrieve active webhooks by event and organization
-- This is used by the backend API routes which may execute under anonymous client context
CREATE OR REPLACE FUNCTION public.get_active_webhooks(
    p_organization_id UUID,
    p_event TEXT
)
RETURNS TABLE (
    id UUID,
    url TEXT,
    secret TEXT
) 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT ws.id, ws.url, ws.secret
    FROM public.webhook_subscriptions ws
    WHERE ws.organization_id = p_organization_id
      AND ws.is_active = true
      AND p_event = ANY(ws.events);
END;
$$ LANGUAGE plpgsql;
