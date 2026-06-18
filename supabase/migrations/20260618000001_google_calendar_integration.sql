-- =============================================================================
-- Migration: Google Calendar Integration
-- Tables: google_calendar_connections, google_calendar_selections
-- =============================================================================

-- 1. Google Calendar OAuth connections (one per profile per org)
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, organization_id)
);

-- 2. Selected calendars for FreeBusy queries
CREATE TABLE IF NOT EXISTS google_calendar_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  calendar_color TEXT,
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(connection_id, calendar_id)
);

-- 3. Enable RLS
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_selections ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for google_calendar_connections
CREATE POLICY "gcc_select" ON google_calendar_connections
  FOR SELECT USING (organization_id = public.get_current_tenant());

CREATE POLICY "gcc_insert" ON google_calendar_connections
  FOR INSERT WITH CHECK (organization_id = public.get_current_tenant());

CREATE POLICY "gcc_update" ON google_calendar_connections
  FOR UPDATE USING (organization_id = public.get_current_tenant());

CREATE POLICY "gcc_delete" ON google_calendar_connections
  FOR DELETE USING (organization_id = public.get_current_tenant());

-- 5. RLS policies for google_calendar_selections (through connection's org)
CREATE POLICY "gcs_select" ON google_calendar_selections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM google_calendar_connections gcc
      WHERE gcc.id = google_calendar_selections.connection_id
        AND gcc.organization_id = public.get_current_tenant()
    )
  );

CREATE POLICY "gcs_insert" ON google_calendar_selections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM google_calendar_connections gcc
      WHERE gcc.id = google_calendar_selections.connection_id
        AND gcc.organization_id = public.get_current_tenant()
    )
  );

CREATE POLICY "gcs_update" ON google_calendar_selections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM google_calendar_connections gcc
      WHERE gcc.id = google_calendar_selections.connection_id
        AND gcc.organization_id = public.get_current_tenant()
    )
  );

CREATE POLICY "gcs_delete" ON google_calendar_selections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM google_calendar_connections gcc
      WHERE gcc.id = google_calendar_selections.connection_id
        AND gcc.organization_id = public.get_current_tenant()
    )
  );
