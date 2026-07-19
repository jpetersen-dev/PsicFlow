import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { validateApiKey } from '../../../../utils/authIntegration';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 1. Validate API Key
  const authHeader = req.headers.authorization;
  const validation = await validateApiKey(authHeader);

  if (validation.error || !validation.organization_id) {
    return res.status(validation.status || 401).json({ error: validation.error });
  }

  const organizationId = validation.organization_id;

  // 2. Parse and validate body fields
  const { name, email, phone, message } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'El campo "name" (nombre completo) es requerido.' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'El campo "email" es requerido.' });
  }

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'El formato de correo electrónico ingresado no es válido.' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 3. Check if patient with this email already exists in this organization
    const { data: existingPatient, error: searchErr } = await supabase
      .from('patients')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (searchErr) {
      console.error('Error searching existing patient:', searchErr);
      throw searchErr;
    }

    if (existingPatient) {
      return res.status(200).json({
        success: true,
        message: 'El prospecto ya está registrado en la base de datos.',
        patient_id: existingPatient.id,
        status: existingPatient.status
      });
    }

    // 4. Generate a unique 10-digit Ficha ID
    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit random
    const fichaId = `${yy}${mm}${dd}${randomSuffix}`;

    // 5. Insert new prospect via RLS-bypassed SECURITY DEFINER RPC
    const { data: newPatientId, error: insertErr } = await supabase.rpc('create_patient_prospect', {
      p_organization_id: organizationId,
      p_ficha_id_num: fichaId,
      p_full_name: name.trim(),
      p_email: email.trim().toLowerCase(),
      p_phone: phone ? String(phone).trim() : '',
      p_observaciones: message ? String(message).trim() : 'Registrado vía API de Integraciones.'
    });

    if (insertErr || !newPatientId) {
      console.error('Error inserting patient via RPC:', insertErr);
      throw new Error(insertErr?.message || 'Fallo al insertar el paciente en base de datos.');
    }

    return res.status(201).json({
      success: true,
      message: 'Prospecto creado exitosamente.',
      patient_id: newPatientId,
      ficha_id: fichaId
    });
  } catch (error: any) {
    console.error('Error inside create prospect integration route:', error);
    return res.status(500).json({ error: error.message || 'Error interno en el servidor.' });
  }
}

export default allowCors(handler);
