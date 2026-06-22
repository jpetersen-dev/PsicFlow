import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing from environment variables.');
}

/**
 * Portal-specific Supabase client.
 *
 * Uses localStorage (the browser default) instead of the shared cookie-based
 * storage.  Google OAuth sessions include user_metadata (avatar, provider,
 * identities…) that easily exceed the 4 KB cookie size limit. When that
 * happens the browser silently drops the cookie and the session is lost,
 * causing the login-redirect loop the user sees.
 *
 * localStorage has no practical size limit (~5-10 MB) and works perfectly for
 * the portal, which is fully client-rendered behind auth.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Omit `storage` → defaults to localStorage in browser environments
  },
  global: {
    fetch: (url, options = {}) => {
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('active-tenant-id') : null;
      if (tenantId) {
        const headers = new Headers(options.headers);
        headers.set('x-tenant-id', tenantId);
        options.headers = headers;
      }
      return fetch(url, options);
    },
  },
});
