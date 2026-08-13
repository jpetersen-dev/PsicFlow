import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * /api/v1/booking/assessments
 * Handles patient self-assessments (wellness trackers).
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado: Falta token de sesión.' });
  }

  // 1. Authenticate user
  const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await clientSupabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }

  const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  // 2. Identify role: patient or therapist
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('id, role_name, organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const isTherapist = profile && (profile.role_name === 'psicologo' || profile.role_name === 'admin_clinica');
  let patient: any = null;

  if (!isTherapist) {
    const { data: patData } = await serviceSupabase
      .from('patients')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();
    patient = patData;
  }

  if (!isTherapist && !patient) {
    return res.status(404).json({ error: 'Usuario no asociado a ninguna ficha de paciente o perfil clínico.' });
  }

  const orgId = isTherapist ? profile.organization_id : patient.organization_id;

  // ==========================================
  // GET: Fetch assessments
  // ==========================================
  if (req.method === 'GET') {
    if (isTherapist) {
      const { patientId } = req.query;
      if (!patientId) {
        return res.status(400).json({ error: 'Falta el parámetro patientId.' });
      }

      const { data: assessments, error: fetchErr } = await serviceSupabase
        .from('patient_assessments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('[Assessments API] Therapist fetch error:', fetchErr);
        return res.status(500).json({ error: 'Error al consultar las evaluaciones.' });
      }

      return res.status(200).json({ success: true, assessments });
    } else {
      // Patient fetches their own history
      const { data: assessments, error: fetchErr } = await serviceSupabase
        .from('patient_assessments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('[Assessments API] Patient fetch error:', fetchErr);
        return res.status(500).json({ error: 'Error al consultar tu historial de evaluaciones.' });
      }

      return res.status(200).json({ success: true, assessments });
    }
  }

  // ==========================================
  // POST: Save assessment
  // ==========================================
  if (req.method === 'POST') {
    if (isTherapist) {
      return res.status(403).json({ error: 'Acción no permitida para profesionales.' });
    }

    const { assessmentType, score, responses } = req.body;

    if (!assessmentType || score === undefined || !responses) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos en el cuerpo (assessmentType, score, responses).' });
    }

    const { data: newAssessment, error: insertErr } = await serviceSupabase
      .from('patient_assessments')
      .insert({
        organization_id: orgId,
        patient_id: patient.id,
        assessment_type: assessmentType,
        score: Number(score),
        responses: responses
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[Assessments API] Insert error:', insertErr);
      return res.status(500).json({ error: 'Error al registrar la evaluación.' });
    }

    return res.status(200).json({ success: true, assessment: newAssessment });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default allowCors(handler);
