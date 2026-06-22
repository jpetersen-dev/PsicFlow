import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const organizationId = 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb'; // Sentido Migrante Organization ID

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const dbClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  global: {
    headers: {
      'x-tenant-id': organizationId
    }
  }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, full_name, phone, birth_date, code } = req.body;

  if (!email || !password || !full_name || !code) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Verify OTP code
    const { data: verification, error: verifyErr } = await dbClient
      .from('patient_verifications')
      .select('*')
      .eq('email', cleanEmail)
      .eq('code', code.trim())
      .limit(1)
      .maybeSingle();

    if (verifyErr || !verification) {
      return res.status(400).json({ error: 'El código de verificación es incorrecto.' });
    }

    // Check expiration
    const expiry = new Date(verification.expires_at);
    if (expiry < new Date()) {
      // Delete expired OTP
      await dbClient.from('patient_verifications').delete().eq('id', verification.id);
      return res.status(400).json({ error: 'El código de verificación ha expirado. Por favor, solicita uno nuevo.' });
    }

    // 2. Sign up in Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (authErr || !authData.user) {
      return res.status(400).json({ error: authErr?.message || 'Error al registrar la cuenta en autenticación.' });
    }

    const userId = authData.user.id;

    // signUp may return session:null when Supabase has "Confirm email" enabled
    // at the dashboard level. The DB trigger confirms the email, so we can
    // immediately sign in with password to obtain a valid session.
    let session = authData.session;
    if (!session) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInErr || !signInData.session) {
        console.error('signInWithPassword after signUp failed:', signInErr?.message);
        return res.status(500).json({ error: 'Cuenta creada pero no se pudo iniciar sesión automáticamente. Intenta iniciar sesión manualmente.' });
      }
      session = signInData.session;
    }

    // 3. Find if patient already exists by email (to reconcile guest bookings)
    const { data: existingPatient } = await dbClient
      .from('patients')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    let patientId = null;

    if (existingPatient) {
      // Reconcile: update existing patient with user_id, leaving status unchanged
      const updateData: any = {
        user_id: userId,
        full_name: full_name.trim()
      };
      if (phone) updateData.phone = phone.trim();
      if (birth_date) updateData.birth_date = birth_date;

      const { error: updateErr } = await dbClient
        .from('patients')
        .update(updateData)
        .eq('id', existingPatient.id);

      if (updateErr) {
        console.error('Error updating patient during reconciliation:', updateErr);
      }
      patientId = existingPatient.id;
    } else {
      // Create new patient (starts as prospecto until they book and pay)
      const insertData: any = {
        organization_id: organizationId,
        user_id: userId,
        full_name: full_name.trim(),
        email: cleanEmail,
        birth_date: birth_date || '1900-01-01',
        status: 'prospecto'
      };
      if (phone) insertData.phone = phone.trim();

      const { data: newPatient, error: insertPatientErr } = await dbClient
        .from('patients')
        .insert(insertData)
        .select('id')
        .single();

      if (insertPatientErr) {
        console.error('Error inserting new patient:', insertPatientErr);
        return res.status(500).json({ error: 'Error al registrar la ficha del paciente.' });
      }
      patientId = newPatient.id;
    }

    // 4. Create profile with 'paciente' role
    const { error: profileErr } = await dbClient
      .from('profiles')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        rut_professional: `paciente-${userId.substring(0, 8)}`, // required column
        full_name: full_name.trim(),
        role_name: 'paciente',
        username: cleanEmail.split('@')[0],
        email: cleanEmail,
      });

    if (profileErr) {
      console.error('Error inserting patient profile:', profileErr);
    }

    // 5. Delete OTP verification code
    await dbClient.from('patient_verifications').delete().eq('id', verification.id);

    return res.status(200).json({
      success: true,
      message: 'Cuenta verificada y registrada exitosamente.',
      session,
      user: {
        id: userId,
        email: cleanEmail,
        full_name: full_name.trim(),
        role: 'paciente',
      },
    });

  } catch (err: any) {
    console.error('Unexpected error in verify API:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
