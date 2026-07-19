import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'Falta el tenant activo.' });
  }

  // Create supabase client under user auth context to respect RLS
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
        'x-tenant-id': tenantId,
      },
    },
  });

  // Verify auth session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Sesión inválida.' });
  }

  // Check admin_clinica profile permissions
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role_name')
    .eq('user_id', user.id)
    .eq('organization_id', tenantId)
    .limit(1)
    .single();

  if (profileErr || !profile || profile.role_name !== 'admin_clinica') {
    return res.status(403).json({ error: 'Permisos insuficientes. Solo administradores pueden gestionar API Keys.' });
  }

  // GET: List active keys
  if (req.method === 'GET') {
    try {
      const { data: keys, error: fetchErr } = await supabase
        .from('api_keys')
        .select('id, name, key_preview, created_at, last_used_at')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      return res.status(200).json({ success: true, keys });
    } catch (err: any) {
      console.error('Error fetching API keys:', err);
      return res.status(500).json({ error: 'Error al listar las API Keys.' });
    }
  }

  // POST: Generate a new API Key
  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'El nombre identificador de la llave es requerido.' });
    }

    try {
      // Generate secure 48-char random hex string token prefixed with pf_live_
      const randomSecret = crypto.randomBytes(24).toString('hex');
      const plaintextKey = `pf_live_${randomSecret}`;

      // Hash the key for secure DB storage
      const keyHash = crypto.createHash('sha256').update(plaintextKey).digest('hex');

      // Create a masked preview string
      const keyPreview = `pf_live_***${plaintextKey.slice(-6)}`;

      const { data: newKey, error: insertErr } = await supabase
        .from('api_keys')
        .insert({
          organization_id: tenantId,
          name: name.trim(),
          key_hash: keyHash,
          key_preview: keyPreview
        })
        .select('id, name, key_preview, created_at')
        .single();

      if (insertErr) throw insertErr;

      // Return generated key to UI (plaintext key will be returned ONLY ONCE here)
      return res.status(201).json({
        success: true,
        message: 'API Key generada con éxito.',
        key: {
          ...newKey,
          plaintext_key: plaintextKey // ONLY TIME plaintext key is exposed!
        }
      });
    } catch (err: any) {
      console.error('Error generating API key:', err);
      return res.status(500).json({ error: 'Error al guardar la nueva API Key.' });
    }
  }

  // DELETE: Revoke/delete an API Key
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Falta el ID de la API Key a eliminar.' });
    }

    try {
      const { error: deleteErr } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;

      return res.status(200).json({ success: true, message: 'API Key revocada exitosamente.' });
    } catch (err: any) {
      console.error('Error deleting API key:', err);
      return res.status(500).json({ error: 'Error al revocar la API Key.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
