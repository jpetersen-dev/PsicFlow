import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Validates a request's API Key against the database.
 * Expects the value to be formatted as 'Bearer pf_live_...'
 */
export async function validateApiKey(authHeader: string | undefined): Promise<{ organization_id?: string; error?: string; status?: number }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Falta la cabecera Authorization: Bearer <API_KEY>.', status: 401 };
  }

  const token = authHeader.substring(7).trim();
  if (!token.startsWith('pf_live_')) {
    return { error: 'Formato de API Key inválido. Debe comenzar con pf_live_.', status: 400 };
  }

  try {
    // Generate SHA-256 hash of plaintext key
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    // Init anon client (RPC verify_api_key runs as SECURITY DEFINER to bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase.rpc('verify_api_key', { p_key_hash: hash });

    if (error) {
      console.error('Error invoking verify_api_key RPC:', error);
      return { error: 'Error interno de base de datos al validar la clave.', status: 500 };
    }

    if (!data || data.length === 0) {
      return { error: 'API Key inválida o revocada.', status: 401 };
    }

    // Return organization id mapping
    return { organization_id: data[0].organization_id };
  } catch (err: any) {
    console.error('Unexpected error during API Key validation:', err);
    return { error: 'Error interno en el servidor.', status: 500 };
  }
}
