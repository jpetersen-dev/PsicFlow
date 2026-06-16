-- Create get_current_tenant function to detect tenant context from session or PostgREST headers
CREATE OR REPLACE FUNCTION public.get_current_tenant()
RETURNS uuid AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_tenant', true)::uuid,
        (current_setting('request.headers', true)::json ->> 'x-tenant-id')::uuid
    );
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS on all remaining public tables
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sintomatologia_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epicrisis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files_vault ENABLE ROW LEVEL SECURITY;

-- Drop old policies to prevent duplicates
DROP POLICY IF EXISTS tenant_isolation_policy ON public.patients;
DROP POLICY IF EXISTS tenant_isolation_credit_ledger_policy ON public.credit_ledger;
DROP POLICY IF EXISTS tenant_isolation_patients_policy ON public.patients;

-- Define multi-tenant isolation policies based on get_current_tenant()
CREATE POLICY tenant_isolation_org_policy ON public.organizations
    FOR ALL USING (id = public.get_current_tenant());

CREATE POLICY tenant_isolation_profile_policy ON public.profiles
    FOR ALL USING (organization_id = public.get_current_tenant());

CREATE POLICY tenant_isolation_patient_policy ON public.patients
    FOR ALL USING (organization_id = public.get_current_tenant());

CREATE POLICY tenant_isolation_clinical_record_policy ON public.clinical_records
    FOR ALL USING (organization_id = public.get_current_tenant());

CREATE POLICY tenant_isolation_diagnostic_policy ON public.diagnostics
    FOR ALL USING (record_id IN (
        SELECT id FROM public.clinical_records WHERE organization_id = public.get_current_tenant()
    ));

CREATE POLICY tenant_isolation_session_policy ON public.sessions
    FOR ALL USING (organization_id = public.get_current_tenant());

CREATE POLICY tenant_isolation_clinical_note_policy ON public.clinical_notes
    FOR ALL USING (organization_id = public.get_current_tenant());

CREATE POLICY tenant_isolation_audio_asset_policy ON public.audio_assets
    FOR ALL USING (organization_id = public.get_current_tenant());

CREATE POLICY tenant_isolation_sintomatologia_policy ON public.sintomatologia_records
    FOR ALL USING (patient_id IN (
        SELECT id FROM public.patients WHERE organization_id = public.get_current_tenant()
    ));

CREATE POLICY tenant_isolation_epicrisis_policy ON public.epicrisis_records
    FOR ALL USING (patient_id IN (
        SELECT id FROM public.patients WHERE organization_id = public.get_current_tenant()
    ));

CREATE POLICY tenant_isolation_file_vault_policy ON public.files_vault
    FOR ALL USING (organization_id = public.get_current_tenant());

CREATE POLICY tenant_isolation_credit_ledger_policy ON public.credit_ledger
    FOR ALL USING (organization_id = public.get_current_tenant());
