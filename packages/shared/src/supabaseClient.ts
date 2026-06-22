import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing from environment variables.');
}

const customCookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null;
    const name = key + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return;
    const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
    const domainAttr = domain ? `; domain=${domain}` : '';
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const expires = new Date();
    expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000));
    document.cookie = `${key}=${value}; expires=${expires.toUTCString()}; path=/${domainAttr}; SameSite=Lax${secure}`;
  },
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
    const domainAttr = domain ? `; domain=${domain}` : '';
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainAttr}; SameSite=Lax${secure}`;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customCookieStorage
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
