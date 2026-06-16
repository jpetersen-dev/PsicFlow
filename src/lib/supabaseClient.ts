import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
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
