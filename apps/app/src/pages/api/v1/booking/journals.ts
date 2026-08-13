import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * /api/v1/booking/journals
 * CRUD API for patient bitácoras / journals.
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
  // GET: Fetch journals
  // ==========================================
  if (req.method === 'GET') {
    if (isTherapist) {
      const { patientId } = req.query;
      if (!patientId) {
        return res.status(400).json({ error: 'Falta el parámetro patientId.' });
      }

      const { data: journals, error: fetchErr } = await serviceSupabase
        .from('patient_journals')
        .select('*')
        .eq('organization_id', orgId)
        .eq('patient_id', patientId)
        .eq('shared_with_therapist', true)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('[Journals API] Therapist fetch error:', fetchErr);
        return res.status(500).json({ error: 'Error al consultar bitácoras compartidas.' });
      }

      return res.status(200).json({ success: true, journals });
    } else {
      // Patient fetches all their journals
      const { data: journals, error: fetchErr } = await serviceSupabase
        .from('patient_journals')
        .select('*')
        .eq('organization_id', orgId)
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('[Journals API] Patient fetch error:', fetchErr);
        return res.status(500).json({ error: 'Error al consultar tus bitácoras.' });
      }

      return res.status(200).json({ success: true, journals });
    }
  }

  // Only patients are allowed to modify journals (POST, PUT, DELETE)
  if (isTherapist) {
    return res.status(403).json({ error: 'Acción no permitida para profesionales clínicos.' });
  }

  // ==========================================
  // POST: Create journal entry
  // ==========================================
  if (req.method === 'POST') {
    const { title, content, mood, sharedWithTherapist } = req.body;

    if (!title || !title.trim() || !content || !content.trim()) {
      return res.status(400).json({ error: 'El título y el contenido son obligatorios.' });
    }

    const { data: newJournal, error: insertErr } = await serviceSupabase
      .from('patient_journals')
      .insert({
        organization_id: orgId,
        patient_id: patient.id,
        title: title.trim(),
        content: content.trim(),
        mood: mood || null,
        shared_with_therapist: !!sharedWithTherapist
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[Journals API] Insert error:', insertErr);
      return res.status(500).json({ error: 'Error al crear la bitácora.' });
    }

    return res.status(200).json({ success: true, journal: newJournal });
  }

  // ==========================================
  // PUT: Update journal entry
  // ==========================================
  if (req.method === 'PUT') {
    const { id, title, content, mood, sharedWithTherapist } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Falta el ID de la bitácora.' });
    }

    if (!title || !title.trim() || !content || !content.trim()) {
      return res.status(400).json({ error: 'El título y el contenido no pueden estar vacíos.' });
    }

    // Verify ownership
    const { data: existing } = await serviceSupabase
      .from('patient_journals')
      .select('id')
      .eq('id', id)
      .eq('patient_id', patient.id)
      .limit(1)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'La bitácora no existe o no eres el autor.' });
    }

    const { data: updatedJournal, error: updateErr } = await serviceSupabase
      .from('patient_journals')
      .update({
        title: title.trim(),
        content: content.trim(),
        mood: mood || null,
        shared_with_therapist: !!sharedWithTherapist,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('[Journals API] Update error:', updateErr);
      return res.status(500).json({ error: 'Error al actualizar la bitácora.' });
    }

    return res.status(200).json({ success: true, journal: updatedJournal });
  }

  // ==========================================
  // DELETE: Delete journal entry
  // ==========================================
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Falta el ID de la bitácora.' });
    }

    // Verify ownership
    const { data: existing } = await serviceSupabase
      .from('patient_journals')
      .select('id')
      .eq('id', id)
      .eq('patient_id', patient.id)
      .limit(1)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'La bitácora no existe o no eres el autor.' });
    }

    const { error: deleteErr } = await serviceSupabase
      .from('patient_journals')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      console.error('[Journals API] Delete error:', deleteErr);
      return res.status(500).json({ error: 'Error al eliminar la bitácora.' });
    }

    return res.status(200).json({ success: true, message: 'Bitácora eliminada exitosamente.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default allowCors(handler);
