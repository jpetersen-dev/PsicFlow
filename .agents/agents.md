# Team Constitution - PsicFlow

This file defines the logical boundaries of the subagents to prevent amnesia during context compaction:

- **Database Engineer**: Operates strictly on `/supabase/migrations/` to update RLS policies and table structures.
- **Backend Engineer**: Operates strictly on `/supabase/functions/` (edge functions) and Next.js backend API routes (e.g., `/src/pages/api/`).
- **Frontend Engineer**: Operates strictly on `/src/components/` and Next.js Pages Router files under `/src/pages/`.
