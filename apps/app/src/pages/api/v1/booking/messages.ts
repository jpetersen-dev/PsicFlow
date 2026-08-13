import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../../../../utils/emails';
import { allowCors } from '../../../../utils/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * /api/v1/booking/messages
 * GET: Fetch conversation thread.
 * POST: Send a message (patient -> therapist/support OR therapist -> patient).
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
    .select('id, role_name, organization_id, full_name, email')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const isTherapist = profile && (profile.role_name === 'psicologo' || profile.role_name === 'admin_clinica');
  let patient: any = null;

  if (!isTherapist) {
    // Check if patient profile exists
    const { data: patData } = await serviceSupabase
      .from('patients')
      .select('id, organization_id, full_name, email')
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
  // GET: Fetch messages
  // ==========================================
  if (req.method === 'GET') {
    let query = serviceSupabase
      .from('patient_messages')
      .select(`
        *,
        patient:patient_id (id, full_name),
        professional:professional_id (id, full_name)
      `)
      .eq('organization_id', orgId);

    if (isTherapist) {
      const { patientId } = req.query;
      if (!patientId) {
        return res.status(400).json({ error: 'Falta parámetro patientId.' });
      }
      query = query
        .eq('patient_id', patientId)
        .or(`recipient_type.eq.support,professional_id.eq.${profile.id}`);
    } else {
      // Patient fetches their own messages
      query = query.eq('patient_id', patient.id);
    }

    const { data: messages, error: fetchErr } = await query.order('created_at', { ascending: true });

    if (fetchErr) {
      console.error('[Messages API] Fetch error:', fetchErr);
      return res.status(500).json({ error: 'Error al consultar los mensajes.' });
    }

    // Mark unread messages as read if recipient is reading them
    if (messages && messages.length > 0) {
      const unreadIds = messages
        .filter(m => {
          if (isTherapist) {
            return m.sender === 'patient' && !m.read && (m.recipient_type === 'support' || m.professional_id === profile.id);
          } else {
            return m.sender === 'therapist' && !m.read;
          }
        })
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await serviceSupabase
          .from('patient_messages')
          .update({ read: true })
          .in('id', unreadIds);
      }
    }

    return res.status(200).json({ success: true, messages });
  }

  // ==========================================
  // POST: Send message
  // ==========================================
  if (req.method === 'POST') {
    const { recipientType, professionalId, patientId, subject, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'El contenido del mensaje no puede estar vacío.' });
    }

    let insertPayload: any = {
      organization_id: orgId,
      content: content.trim(),
      subject: subject ? subject.trim() : null,
      read: false
    };

    if (isTherapist) {
      // Therapist sending to patient
      if (!patientId) {
        return res.status(400).json({ error: 'Falta el parámetro patientId.' });
      }

      const { data: targetPatient } = await serviceSupabase
        .from('patients')
        .select('id, full_name, email')
        .eq('id', patientId)
        .limit(1)
        .single();

      if (!targetPatient) {
        return res.status(404).json({ error: 'Paciente destinatario no encontrado.' });
      }

      insertPayload.patient_id = patientId;
      insertPayload.sender = 'therapist';
      insertPayload.recipient_type = 'therapist';
      insertPayload.professional_id = profile.id;

      // Insert message
      const { data: newMsg, error: insertErr } = await serviceSupabase
        .from('patient_messages')
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) {
        console.error('[Messages API] Insert error:', insertErr);
        return res.status(500).json({ error: 'Error al enviar el mensaje.' });
      }

      // Send email alert to patient
      try {
        const patientEmailHtml = `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #F9F7F5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #EAEAEA;">
              <h3 style="color: #3E5C4E; margin-top: 0;">Nuevo mensaje de tu Terapeuta</h3>
              <p>Hola <strong>${targetPatient.full_name}</strong>,</p>
              <p>Tu terapeuta <strong>${profile.full_name}</strong> te ha enviado un mensaje a través del portal:</p>
              
              <div style="background-color: #F4F6F5; border-left: 4px solid #3E5C4E; padding: 15px; border-radius: 4px; margin: 20px 0; font-style: italic;">
                "${content.trim()}"
              </div>

              <p>Para responder o ver el hilo completo, ingresa a tu portal de paciente.</p>
              <p>Saludos cordiales,<br>Equipo Sentido Migrante</p>
            </div>
          </body>
          </html>
        `;
        await sendEmail({
          to: [{ name: targetPatient.full_name, email: targetPatient.email }],
          subject: `Nuevo mensaje de tu terapeuta - Sentido Migrante`,
          htmlContent: patientEmailHtml,
        });
      } catch (err) {
        console.error('[Messages API] Email dispatch to patient failed:', err);
      }

      return res.status(200).json({ success: true, message: newMsg });
    } else {
      // Patient sending to therapist or support
      if (!recipientType || !['therapist', 'support'].includes(recipientType)) {
        return res.status(400).json({ error: 'Destinatario inválido (debe ser therapist o support).' });
      }

      let therapistName = 'Soporte';
      let therapistEmail = process.env.BREVO_SENDER_EMAIL || 'contacto@sentidomigrante.com';

      insertPayload.patient_id = patient.id;
      insertPayload.sender = 'patient';
      insertPayload.recipient_type = recipientType;

      if (recipientType === 'therapist') {
        if (!professionalId) {
          return res.status(400).json({ error: 'Falta el professionalId del terapeuta.' });
        }

        const { data: profData } = await serviceSupabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', professionalId)
          .limit(1)
          .single();

        if (!profData) {
          return res.status(404).json({ error: 'Terapeuta no encontrado.' });
        }

        insertPayload.professional_id = professionalId;
        therapistName = profData.full_name;
        therapistEmail = profData.email;
      }

      const { data: newMsg, error: insertErr } = await serviceSupabase
        .from('patient_messages')
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) {
        console.error('[Messages API] Insert error:', insertErr);
        return res.status(500).json({ error: 'Error al enviar el mensaje.' });
      }

      // Send email alert to therapist or support
      try {
        const adminEmailHtml = `
          <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #F9F7F5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #EAEAEA;">
              <h3 style="color: #3E5C4E; margin-top: 0;">Nuevo mensaje en el Portal del Paciente</h3>
              <p>Hola <strong>${therapistName}</strong>,</p>
              <p>El paciente <strong>${patient.full_name}</strong> ha enviado una nueva consulta para ${recipientType === 'therapist' ? 'ti' : 'soporte'}:</p>
              
              <div style="background-color: #F4F6F5; border-left: 4px solid #3E5C4E; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0 0 5px 0;"><strong>Mensaje:</strong></p>
                <p style="margin: 0; font-style: italic;">"${content.trim()}"</p>
              </div>

              <p>Puedes responder ingresando a la ficha del paciente en tu panel clínico de PsicFlow.</p>
              <p>Saludos cordiales,<br>Ecosistema PsicFlow</p>
            </div>
          </body>
          </html>
        `;
        await sendEmail({
          to: [{ name: therapistName, email: therapistEmail }],
          subject: `[Mensaje Portal] Nueva consulta de ${patient.full_name}`,
          htmlContent: adminEmailHtml,
        });
      } catch (err) {
        console.error('[Messages API] Email dispatch failed:', err);
      }

      return res.status(200).json({ success: true, message: newMsg });
    }
  }

  return res.status(450).json({ error: 'Method not supported' });
}

export default allowCors(handler);
