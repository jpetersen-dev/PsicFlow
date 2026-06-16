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
    // Dynamic getter evaluates local storage tenant on every database request
    get headers(): Record<string, string> {
      if (typeof window !== 'undefined') {
        const tenantId = localStorage.getItem('active-tenant-id');
        if (tenantId) {
          return { 'x-tenant-id': tenantId };
        }
      }
      return {};
    },
  },
});
