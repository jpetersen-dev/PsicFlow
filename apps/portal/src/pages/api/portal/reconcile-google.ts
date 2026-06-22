import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const organizationId = 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb'; // Sentido Migrante Organization ID

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // 1. Verify the token by passing it directly to getUser()
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado.' });
    }

    // 2. Initialize database client with x-tenant-id header for RLS bypass
    const dbClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          'x-tenant-id': organizationId
        }
      }
    });

    const userId = user.id;
    const cleanEmail = user.email!.trim().toLowerCase();

    // 3. Check if profile already exists
    const { data: existingProfile } = await dbClient
      .from('profiles')
      .select('id, full_name, role_name')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      return res.status(200).json({ success: true, message: 'El perfil ya está registrado.' });
    }

    // 4. Look up patient by email to reconcile
    const { data: existingPatient } = await dbClient
      .from('patients')
      .select('id, full_name')
      .eq('organization_id', organizationId)
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    let patientId = null;
    let fullName = user.user_metadata?.full_name || cleanEmail.split('@')[0];

    if (existingPatient) {
      // Reconcile: link user_id (leave status unchanged)
      await dbClient
        .from('patients')
        .update({
          user_id: userId
        })
        .eq('id', existingPatient.id);
      
      patientId = existingPatient.id;
      fullName = existingPatient.full_name;
    } else {
      // Create new patient (starts as prospecto until they book and pay)
      const { data: newPatient, error: insertPatientErr } = await dbClient
        .from('patients')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          full_name: fullName,
          email: cleanEmail,
          birth_date: '1900-01-01',
          status: 'prospecto'
        })
        .select('id')
        .single();

      if (insertPatientErr) {
        console.error('Error inserting new patient during Google reconciliation:', insertPatientErr);
        return res.status(500).json({ error: 'Error al registrar la ficha del paciente.' });
      }
      patientId = newPatient.id;
    }

    // 5. Create profile with 'paciente' role
    const { error: profileErr } = await dbClient
      .from('profiles')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        rut_professional: `paciente-${userId.substring(0, 8)}`,
        full_name: fullName,
        role_name: 'paciente',
        username: cleanEmail.split('@')[0],
        email: cleanEmail,
      });

    if (profileErr) {
      console.error('Error inserting patient profile during Google reconciliation:', profileErr);
    }

    return res.status(200).json({ success: true, message: 'Cuenta vinculada exitosamente.' });
  } catch (err: any) {
    console.error('Unexpected error in Google reconcile:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
