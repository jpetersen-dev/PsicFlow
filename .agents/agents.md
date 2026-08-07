# Team Constitution - PsicFlow

This file defines the logical boundaries of the subagents to prevent amnesia during context compaction:

- **Database Engineer**: Operates strictly on `/supabase/migrations/` to update RLS policies and table structures.
- **Backend Engineer**: Operates strictly on `/supabase/functions/` (edge functions) and Next.js backend API routes (e.g., `/src/pages/api/`).
- **Frontend Engineer**: Operates strictly on `/src/components/` and Next.js Pages Router files under `/src/pages/`.

## 🌐 Ecosystem Architecture

PsicFlow is a multi-tenant SaaS clinical management platform. The ecosystem comprises:
1. **Landing & Booking Page (`Sentido_Migrante`)**:
   - Repository: `jpetersen-dev/sentido-migrante`
   - Role: Public landing page and booking flow for Jonathan's primary clinic. Interacts with PsicFlow APIs.
   - Port: `3000` (Local)
   - Public URL: `sentidomigrante.com`
   - **CMS Architecture**: PsicFlow is the primary Headless CMS for this landing page. Content such as services, articles, reviews, and clinical specialists are served dynamically via the PsicFlow Integration APIs. Strapi CMS has been completely deprecated and removed. DO NOT write or expect Strapi integrations.
2. **Clinician SaaS App (`psic-flow-app`)**:
   - Repository: `jpetersen-dev/PsicFlow` (inside `apps/app`)
   - Role: Main SaaS interface for therapists, clinic admins, and reports.
   - Port: `3001` (Local)
   - Public URL: `app.sentidomigrante.com` (To be updated later to a dedicated domain)
3. **Patient Portal (`psic-flow-portal`)**:
   - Repository: `jpetersen-dev/PsicFlow` (inside `apps/portal`)
   - Role: Portal for patients to view appointments, SOAP notes shared, and reschedule.
   - Port: `3002` (Local)
   - Public URL: `portal.sentidomigrante.com`
4. **Admin Console (`psicflow-admin-console`)**:
   - Repository: `jpetersen-dev/psicflow-admin-console`
   - Role: Super-admin workspace to manage SaaS subscriptions, active MRR, generate plan invitations, and view global logs.
   - Port: `3003` (Local)
   - Public URL: `admin.sentidomigrante.com`

---

## 🗄️ Database & Authentication Conventions (Supabase)

- **Supabase Project**: `ijfabmsyylkfxolurrrn` (`supabase-jpz-dev-solutions`).
- **RLS & RETURNING bypass**: Unauthenticated operations inserting new tenants (like signup onboarding) cannot `select` the newly created tenant under tenant RLS select policies. You MUST use a `SECURITY DEFINER` RPC (like `create_organization_onboarding`) to execute inserts safely.
- **Supabase User Enumeration Protection**: Calling `auth.signUp` for an existing email returns a fake user object with a random UUID instead of throwing a duplicate error. To prevent foreign key constraint violations on `profiles(user_id)`, always query user existence via the `check_auth_user_exists` RPC before calling auth actions.

---

## 📅 Timezone & Calendar Guidelines

- **Robust Time Formatting**: Never parse dates/hours using `toLocaleTimeString` and `.split(':')`. The separator character varies dynamically by OS locale and Node environment (e.g. dot vs. colon).
  - *Rule*: ALWAYS use `Intl.DateTimeFormat('en-US', { ... }).formatToParts()` to safely extract individual `hour` and `minute` tokens:
    ```typescript
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    ```
- **FreeBusy Time Range Extension**: When querying Google Calendar availability, extend the `timeMax` range by 12 to 24 hours into the next day (e.g., `timeMax = ${nextDate}T12:00:00Z`). This prevents timezone offsets from truncating late evening events.
- **Client-Side Translations**: Display time slots to patients in their detected local timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), but always submit the booking to the backend in the original specialist's local timezone.

---

## 💻 Git & Development Workflow

- **Branch Naming**: Dev work is committed to feature branches (e.g. `feature/saas-multitenant`).
- **Merging & Sync**: Merge features to `master`/`main` (development) and then to `sm/production` (production branch triggering Vercel build).
- **TypeScript & Static Validation**: Before committing or pushing code, you **MUST** run `npm run build` locally in the workspace to verify that TypeScript checks and Next.js static page generations pass without errors.

