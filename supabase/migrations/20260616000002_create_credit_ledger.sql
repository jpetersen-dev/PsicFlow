-- Create type public.unit_type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_type') THEN
        CREATE TYPE public.unit_type AS ENUM ('NOTA_IA', 'INFORME_CLINICO');
    END IF;
END$$;

-- Create table credit_ledger if not exists
CREATE TABLE IF NOT EXISTS public.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id),
    type_unit public.unit_type NOT NULL,
    amount INTEGER NOT NULL, -- Negativo para consumos, positivo para recargas
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_balance_check 
ON public.credit_ledger (organization_id, type_unit, amount);

-- Enable RLS
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- Enable RLS Policy for Tenant Isolation
DROP POLICY IF EXISTS tenant_isolation_credit_ledger_policy ON public.credit_ledger;
CREATE POLICY tenant_isolation_credit_ledger_policy ON public.credit_ledger
    FOR ALL USING (organization_id = current_setting('app.current_tenant', true)::UUID);

-- Trigger to prevent overdrafts of credits
CREATE OR REPLACE FUNCTION public.check_credit_balance()
RETURNS TRIGGER AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    -- Only check if the amount is negative (consumption)
    IF NEW.amount < 0 THEN
        SELECT COALESCE(SUM(amount), 0) INTO current_balance
        FROM public.credit_ledger
        WHERE organization_id = NEW.organization_id AND type_unit = NEW.type_unit;
        
        IF (current_balance + NEW.amount) < 0 THEN
            RAISE EXCEPTION 'Insufficient credits for unit type %', NEW.type_unit;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_credit_balance_trigger ON public.credit_ledger;
CREATE TRIGGER check_credit_balance_trigger
BEFORE INSERT ON public.credit_ledger
FOR EACH ROW
EXECUTE FUNCTION public.check_credit_balance();
