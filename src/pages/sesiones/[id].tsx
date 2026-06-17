import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  FileText, 
  DollarSign, 
  FileSignature, 
  Mic, 
  Upload, 
  Download, 
  Trash2, 
  AlertCircle,
  Clock,
  Sparkles,
  Camera,
  FolderOpen,
  Plus,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { usePrivacyMode } from '../../components/PrivacyModeProvider';

export default function SesionFicha() {
  const router = useRouter();
  const { id } = router.query;
  const { maskName } = usePrivacyMode();
  
  const [session, setSession] = useState<any>(null);
  const [clinicalNote, setClinicalNote] = useState<any>(null);
  const [audioAsset, setAudioAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<'soap' | 'admin' | 'archivos'>('soap');

  // Session files state
  const [sessionFiles, setSessionFiles] = useState<any[]>([]);
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false);
  const [fileDescription, setFileDescription] = useState('');
  const [fileCategory, setFileCategory] = useState('General');
  const [uploadingFileObject, setUploadingFileObject] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchSessionData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Fetch Session details
      const { data: sessData, error: sessErr } = await supabase
        .from('sessions')
        .select(`
          *,
          patient:patient_id (full_name)
        `)
        .eq('id', id)
        .single();
      
      if (sessErr || !sessData) throw new Error('No se encontró la sesión.');
      setSession(sessData);

      // 2. Fetch Clinical note SOAP
      const { data: noteData } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('session_id', id)
        .limit(1);

      let note = noteData && noteData[0];

      // If no clinical note exists yet, create an empty draft
      if (!note) {
        const tenantId = localStorage.getItem('active-tenant-id');
        const { data: newNote } = await supabase
          .from('clinical_notes')
          .insert({
            organization_id: tenantId,
            session_id: id,
            author_id: sessData.professional_id,
            temas_abordados: '',
            sintomas_observados: '',
            ai_raw_draft: '',
            human_validated_content: '',
            is_human_validated: false
          })
          .select()
          .single();
        note = newNote;
      }
      setClinicalNote(note);

      // 3. Fetch Audio Asset status
      const { data: audioData } = await supabase
        .from('audio_assets')
        .select('*')
        .eq('note_id', note.id)
        .limit(1);
      
      if (audioData && audioData[0]) {
        setAudioAsset(audioData[0]);
      }
      // 4. Fetch Session Files
      const { data: filesData } = await supabase
        .from('files_vault')
        .select('*')
        .eq('session_id', id);
      if (filesData) setSessionFiles(filesData);
    } catch (err) {
      console.error('Error fetching session data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, [id]);

  const handleSimulateAI = async () => {
    setIsProcessingAI(true);
    try {
      const tenantId = localStorage.getItem('active-tenant-id') || '';
      const transcriptText = clinicalNote?.human_validated_content || 'El paciente refiere sintomatología ansiosa asociada a carga laboral.';

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // Call backend API for SOAP generation with credit billing
      const res = await fetch('/api/ai/soap', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-tenant-id': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ session_id: id, transcript_text: transcriptText }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Error al procesar dictado clínico.');
      }

      const soap = result.soap;

      // Update clinical note in database with SOAP result
      const { data: updatedNote, error } = await supabase
        .from('clinical_notes')
        .update({
          temas_abordados: soap.temas_abordados,
          sintomas_observados: soap.sintomas_observados,
          ai_raw_draft: soap.ai_raw_draft,
          human_validated_content: soap.human_validated_content,
        })
        .eq('id', clinicalNote.id)
        .select()
        .single();

      if (error) throw error;

      // Create audio asset record for the simulated dictation
      const storagePath = `${tenantId}/${id}/dictado_${Date.now()}.mp3`;
      const { data: audio } = await supabase
        .from('audio_assets')
        .insert({
          organization_id: tenantId,
          note_id: clinicalNote.id,
          storage_path: storagePath,
          status: 'active',
        })
        .select()
        .single();

      setClinicalNote(updatedNote);
      if (audio) setAudioAsset(audio);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      alert('Error: ' + message);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleSimulateOCR = async () => {
    setIsProcessingAI(true);
    try {
      const tenantId = localStorage.getItem('active-tenant-id') || '';
      const ocrText = 'Apuntes manuscritos: Paciente refiere ansiedad por sobrecarga en oficina. Presenta taquicardia situacional. Estrategia: Respiración diafragmática.';

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // Call same SOAP endpoint with OCR-transcribed text
      const res = await fetch('/api/ai/soap', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-tenant-id': tenantId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ session_id: id, transcript_text: ocrText }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Error al procesar transcripción OCR.');
      }

      const soap = result.soap;
      const { data: updatedNote, error } = await supabase
        .from('clinical_notes')
        .update({
          temas_abordados: soap.temas_abordados,
          sintomas_observados: soap.sintomas_observados,
          ai_raw_draft: soap.ai_raw_draft,
          human_validated_content: soap.human_validated_content,
        })
        .eq('id', clinicalNote.id)
        .select()
        .single();

      if (error) throw error;
      setClinicalNote(updatedNote);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      alert('Error: ' + message);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleValidateNote = async () => {
    try {
      // 1. Sign/Validate clinical note (HITL protocol)
      const { data: updatedNote, error: noteErr } = await supabase
        .from('clinical_notes')
        .update({
          is_human_validated: true
        })
        .eq('id', clinicalNote.id)
        .select()
        .single();
      
      if (noteErr) throw noteErr;

      // 2. Destrucción permanente de audio - Hard Delete from Supabase Storage + DB
      if (audioAsset && audioAsset.status === 'active') {
        // Delete physical file from Supabase Storage bucket
        if (audioAsset.storage_path) {
          await supabase.storage
            .from('audio-notes')
            .remove([audioAsset.storage_path]);
        }

        // Mark database record as hard_deleted
        const { error: audioErr } = await supabase
          .from('audio_assets')
          .update({
            status: 'hard_deleted',
            deleted_at: new Date().toISOString()
          })
          .eq('id', audioAsset.id);
        
        if (audioErr) throw audioErr;
      }

      // 3. Mark session as complete
      await supabase
        .from('sessions')
        .update({ status_session: 'Completa' })
        .eq('id', id);

      alert('Nota clínica firmada y validada con éxito. El archivo de voz original ha sido destruido permanentemente de forma irreversible.');
      fetchSessionData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      alert('Error: ' + message);
    }
  };

  const handleUpdateAdminDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          date_session: session.date_session,
          time_session: session.time_session,
          modality: session.modality,
          status_session: session.status_session,
          value_session: Number(session.value_session),
          status_payment: session.status_payment,
          payment_type: session.payment_type,
          transaction_id: session.transaction_id,
          boleta_status: session.boleta_status,
          comentarios_internos: session.comentarios_internos
        })
        .eq('id', id);
      
      if (error) throw error;
      alert('Detalles administrativos guardados correctamente.');
      fetchSessionData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const tenantId = localStorage.getItem('active-tenant-id');
      const { data: { session: authSess } } = await supabase.auth.getSession();
      if (!authSess?.user?.id || !tenantId) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authSess.user.id)
        .eq('organization_id', tenantId)
        .limit(1)
        .single();

      const logoImg = profile?.logo_url ? `<img src="${profile.logo_url}" style="max-height: 70px; float: right; margin-bottom: 15px;" />` : '';
      const sigImg = profile?.signature_url ? `
        <div style="margin-top: 50px; text-align: right; page-break-inside: avoid;">
          <img src="${profile.signature_url}" style="max-height: 80px; display: inline-block;" />
          <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold; border-top: 1px solid #ccc; display: inline-block; padding-top: 4px; text-align: center;">
            Firma del Terapeuta<br/>${profile.full_name || ''}
          </p>
        </div>` : '';

      const printContent = `
        <html>
        <head>
          <title>Nota de Evolución - ${session.patient?.full_name}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
            .header::after { content: ""; clear: both; display: table; }
            .title { font-size: 22px; font-weight: bold; color: #1e3a8a; margin: 0; }
            .subtitle { font-size: 12px; color: #666; margin: 2px 0 0 0; }
            .meta-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .meta-item { font-size: 12px; }
            .meta-label { font-weight: bold; color: #4b5563; }
            .meta-val { color: #1f2937; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
            .section-content { font-size: 12px; text-align: justify; white-space: pre-wrap; }
            @media print {
              body { padding: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoImg}
            <div style="float: left;">
              <h1 class="title">REGISTRO CLÍNICO DE EVOLUCIÓN</h1>
              <p class="subtitle">Ecosistema Clínico PsicoAlivio</p>
            </div>
          </div>
          
          <div class="meta-section">
            <div class="meta-item"><span class="meta-label">Paciente:</span> <span class="meta-val">${session.patient?.full_name}</span></div>
            <div class="meta-item"><span class="meta-label">Fecha de Sesión:</span> <span class="meta-val">${session.date_session} (${session.time_session.slice(0,5)} hrs)</span></div>
            <div class="meta-item"><span class="meta-label">Modalidad:</span> <span class="meta-val">${session.modality}</span></div>
            <div class="meta-item"><span class="meta-label">Folio Sesión:</span> <span class="meta-val">${session.id}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Temas Abordados</div>
            <div class="section-content">${clinicalNote?.temas_abordados || 'No registrado'}</div>
          </div>

          <div class="section">
            <div class="section-title">Síntomas Observados</div>
            <div class="section-content">${clinicalNote?.sintomas_observados || 'No registrado'}</div>
          </div>

          <div class="section">
            <div class="section-title">Contenido Validado y Evolución</div>
            <div class="section-content">${clinicalNote?.human_validated_content || 'No registrado'}</div>
          </div>

          ${sigImg}

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
      } else {
        alert('Por favor habilite ventanas emergentes para la descarga del PDF.');
      }
    } catch (err: any) {
      alert('Error al exportar nota: ' + err.message);
    }
  };

  const handleDownloadWord = async () => {
    try {
      const tenantId = localStorage.getItem('active-tenant-id');
      const { data: { session: authSess } } = await supabase.auth.getSession();
      if (!authSess?.user?.id || !tenantId) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authSess.user.id)
        .eq('organization_id', tenantId)
        .limit(1)
        .single();

      const logoHtml = profile?.logo_url ? `<img src="${profile.logo_url}" width="150" height="auto" style="display:block; margin-bottom: 20px;" />` : '';
      const sigHtml = profile?.signature_url ? `
        <div style="margin-top: 50px; text-align: right;">
          <img src="${profile.signature_url}" width="150" height="auto" />
          <p style="margin:5px 0 0 0; font-size:12px; font-weight:bold; border-top:1px solid #999; display:inline-block; padding-top:4px; text-align:center;">
            Firma: ${profile.full_name || ''}
          </p>
        </div>` : '';

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>Registro de Sesión</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 18pt; font-weight: bold; color: #1e3a8a; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; background-color: #f9fafb; }
            .meta-table td { padding: 8px; border: 1px solid #e5e7eb; font-size: 10pt; }
            .section-title { font-size: 11pt; font-weight: bold; color: #2563eb; border-bottom: 1px solid #cccccc; padding-bottom: 3px; margin-top: 15px; margin-bottom: 8px; text-transform: uppercase; }
            .section-content { font-size: 10pt; text-align: justify; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <div class="title">REGISTRO CLÍNICO DE EVOLUCIÓN</div>
            <p style="font-size: 9pt; color: #666;">PsicoAlivio Ecosistema Clínico</p>
          </div>
          
          <table class="meta-table">
            <tr>
              <td><strong>Paciente:</strong> ${session.patient?.full_name}</td>
              <td><strong>Fecha de Sesión:</strong> ${session.date_session} (${session.time_session.slice(0,5)} hrs)</td>
            </tr>
            <tr>
              <td><strong>Modalidad:</strong> ${session.modality}</td>
              <td><strong>Folio Sesión:</strong> ${session.id}</td>
            </tr>
          </table>

          <div class="section-title">Temas Abordados</div>
          <div class="section-content">${(clinicalNote?.temas_abordados || 'No registrado').replace(/\n/g, '<br/>')}</div>

          <div class="section-title">Síntomas Observados</div>
          <div class="section-content">${(clinicalNote?.sintomas_observados || 'No registrado').replace(/\n/g, '<br/>')}</div>

          <div class="section-title">Contenido Validado y Evolución</div>
          <div class="section-content">${(clinicalNote?.human_validated_content || 'No registrado').replace(/\n/g, '<br/>')}</div>

          ${sigHtml}
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nota_clinica_${session.patient?.full_name.replace(/\s+/g, '_')}_${session.date_session}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error al exportar Word: ' + err.message);
    }
  };

  if (loading) return <div className="py-20 text-center text-text-muted text-sm">Cargando evolución de sesión...</div>;
  if (!session) return <div className="py-20 text-center text-text-muted text-sm">No se encontró la sesión.</div>;

  return (
    <>
      <Head>
        <title>PsicoAlivio - Sesión de {session.patient?.full_name}</title>
      </Head>

      <div className="space-y-6">
        {/* Session header */}
        <div className="bg-bg-card border border-border-color rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold flex items-center gap-2 text-text-primary">
              <FileText className="w-6 h-6 text-accent-primary" />
              <span>Evolución de Sesión - {maskName(session.patient?.full_name)}</span>
            </h1>
            <p className="text-text-secondary text-sm">Fecha: {session.date_session} ({session.time_session.slice(0, 5)} hrs) • Modalidad: {session.modality}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadPDF}
              className="bg-bg-input border border-border-color hover:bg-bg-card-hover px-3 py-2 rounded-lg text-xs font-semibold text-text-primary flex items-center gap-1 transition-all cursor-pointer"
              title="Exportar como PDF"
            >
              <Download className="w-4 h-4 text-danger" />
              <span>PDF</span>
            </button>
            <button 
              onClick={handleDownloadWord}
              className="bg-bg-input border border-border-color hover:bg-bg-card-hover px-3 py-2 rounded-lg text-xs font-semibold text-text-primary flex items-center gap-1 transition-all cursor-pointer"
              title="Exportar como Word editable"
            >
              <Download className="w-4 h-4 text-blue-500" />
              <span>Word</span>
            </button>
            <button 
              onClick={() => router.push(`/pacientes/${session.patient_id}`)}
              className="bg-bg-input border border-border-color hover:bg-bg-card-hover px-4 py-2.5 rounded-lg text-xs font-semibold text-text-primary transition-all cursor-pointer"
            >
              Ficha Paciente
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="border-b border-border-color flex gap-4">
          <button 
            onClick={() => setActiveTab('soap')}
            className={`py-3 px-1 border-b-2 text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'soap' ? 'border-border-focus text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            <span>Nota Evolución SOAP / IA</span>
          </button>
          <button 
            onClick={() => setActiveTab('admin')}
            className={`py-3 px-1 border-b-2 text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'admin' ? 'border-border-focus text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Administración y Cobros</span>
          </button>
          <button 
            onClick={() => setActiveTab('archivos')}
            className={`py-3 px-1 border-b-2 text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'archivos' ? 'border-border-focus text-accent-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Archivos de la Sesión</span>
          </button>
        </div>

        {/* Tab contents */}
        <div className="bg-bg-card border border-border-color rounded-2xl p-6">
          {activeTab === 'soap' && (
            <div className="space-y-6">
              {/* Audio Cycle & AI Capture Control Panel */}
              <div className="bg-bg-input border border-border-color p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold flex items-center gap-1.5 text-text-primary">
                    <Sparkles className="w-4 h-4 text-accent-primary" />
                    <span>Ciclo Multimodal de Captura IA</span>
                  </h4>
                  <p className="text-text-muted text-xs">Cargue el dictado de audio o una imagen de sus apuntes para generar el borrador SOAP.</p>
                </div>
                
                <div className="flex flex-wrap gap-2.5">
                  <button 
                    onClick={handleSimulateAI}
                    disabled={isProcessingAI || clinicalNote.is_human_validated}
                    className="bg-accent-primary hover:bg-accent-hover text-bg-primary disabled:opacity-50 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-all"
                  >
                    <Mic className="w-4 h-4 stroke-[3]" />
                    <span>{isProcessingAI ? 'Procesando Dictado...' : 'Simular Dictado Clínico'}</span>
                  </button>
                  <button 
                    onClick={handleSimulateOCR}
                    disabled={isProcessingAI || clinicalNote.is_human_validated}
                    className="bg-accent-primary/15 hover:bg-accent-primary/25 border border-accent-primary/30 text-accent-primary disabled:opacity-50 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Transcribir Apuntes (OCR)</span>
                  </button>
                </div>
              </div>

              {/* HITL Signing Protocol Banner */}
              {clinicalNote.temas_abordados && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                  clinicalNote.is_human_validated 
                    ? 'bg-success/10 border-success/25 text-success' 
                    : 'bg-warning/10 border-warning/25 text-warning'
                }`}>
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Protocolo HITL (Human-in-the-Loop) Activo</p>
                    <p>
                      {clinicalNote.is_human_validated 
                        ? 'La nota clínica evolutiva ha sido validada y firmada por el profesional. El secreto profesional se mantiene resguardado.' 
                        : 'El profesional de salud debe validar, modificar y firmar manualmente la nota de evolución sugerida por IA antes de guardarla. Los datos temporales de audio serán eliminados de inmediato.'}
                    </p>
                  </div>
                </div>
              )}

              {/* SOAP Form fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Temas Abordados *</label>
                    <textarea 
                      rows={3} required
                      disabled={clinicalNote.is_human_validated}
                      value={clinicalNote.temas_abordados || ''}
                      onChange={(e) => setClinicalNote({ ...clinicalNote, temas_abordados: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Síntomas Reportados / Observados *</label>
                    <textarea 
                      rows={3} required
                      disabled={clinicalNote.is_human_validated}
                      value={clinicalNote.sintomas_observados || ''}
                      onChange={(e) => setClinicalNote({ ...clinicalNote, sintomas_observados: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Contenido Clínico Firmado (Evolución de la Sesión) *</label>
                    <textarea 
                      rows={8} required
                      disabled={clinicalNote.is_human_validated}
                      placeholder="Escriba la conceptualización terapéutica de la sesión y las intervenciones aplicadas..."
                      value={clinicalNote.human_validated_content || ''}
                      onChange={(e) => setClinicalNote({ ...clinicalNote, human_validated_content: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Action save/sign triggers */}
              {!clinicalNote.is_human_validated && clinicalNote.temas_abordados && (
                <div className="flex justify-end gap-3 pt-4 border-t border-border-color">
                  <button 
                    onClick={async () => {
                      const { error } = await supabase
                        .from('clinical_notes')
                        .update({
                          temas_abordados: clinicalNote.temas_abordados,
                          sintomas_observados: clinicalNote.sintomas_observados,
                          human_validated_content: clinicalNote.human_validated_content
                        })
                        .eq('id', clinicalNote.id);
                      if (error) alert(error.message);
                      else alert('Borrador clínico actualizado.');
                    }}
                    className="px-4 py-2 border border-border-color hover:bg-bg-card-hover rounded-lg text-xs font-semibold text-text-secondary transition-all"
                  >
                    Guardar Borrador
                  </button>
                  <button 
                    onClick={handleValidateNote}
                    className="bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold px-5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all"
                  >
                    <FileSignature className="w-4 h-4" />
                    <span>Firmar y Validar Nota</span>
                  </button>
                </div>
              )}

              {/* Status of raw voice audio hard delete */}
              {audioAsset && (
                <div className="bg-bg-input/40 border border-border-color p-4 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-text-muted" />
                    <div>
                      <p className="font-semibold text-text-primary">Resguardo del Secreto Profesional (Ley N° 19.628)</p>
                      <p className="text-text-muted">
                        {audioAsset.status === 'active' 
                          ? `Audio temporal en almacenamiento. Expira en: ${new Date(audioAsset.expires_at).toLocaleTimeString()}`
                          : `Audio original destruido permanentemente de forma irreversible (${new Date(audioAsset.deleted_at).toLocaleString()})`
                        }
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                    audioAsset.status === 'active' 
                      ? 'bg-warning/10 text-warning border border-warning/20' 
                      : 'bg-danger/10 text-danger border border-danger/20'
                  }`}>
                    {audioAsset.status === 'active' ? 'AUDIO ACTIVO' : 'DESTRUIDO'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Billing & Administration Details */}
          {activeTab === 'admin' && (
            <form onSubmit={handleUpdateAdminDetails} className="max-w-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Fecha de Sesión</label>
                  <input 
                    type="date"
                    required
                    value={session.date_session || ''}
                    onChange={(e) => setSession({ ...session, date_session: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Hora de Sesión</label>
                  <input 
                    type="time"
                    required
                    value={session.time_session ? session.time_session.slice(0, 5) : ''}
                    onChange={(e) => setSession({ ...session, time_session: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Modalidad de Atención</label>
                  <select 
                    value={session.modality}
                    onChange={(e) => setSession({ ...session, modality: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="Online" className="bg-bg-sidebar text-text-primary">Online</option>
                    <option value="Presencial" className="bg-bg-sidebar text-text-primary">Presencial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Estado de Sesión</label>
                  <select 
                    value={session.status_session}
                    onChange={(e) => setSession({ ...session, status_session: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="Programada" className="bg-bg-sidebar text-text-primary">Programada</option>
                    <option value="Completa" className="bg-bg-sidebar text-text-primary">Completa</option>
                    <option value="Cancelada" className="bg-bg-sidebar text-text-primary">Cancelada</option>
                    <option value="Reprogramada" className="bg-bg-sidebar text-text-primary">Reprogramada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Valor Sesión ($)</label>
                  <input 
                    type="number"
                    value={session.value_session}
                    onChange={(e) => setSession({ ...session, value_session: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Estado de Pago</label>
                  <select 
                    value={session.status_payment}
                    onChange={(e) => setSession({ ...session, status_payment: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="Pendiente" className="bg-bg-sidebar text-text-primary">Pendiente</option>
                    <option value="Pagado" className="bg-bg-sidebar text-text-primary">Pagado</option>
                    <option value="Parcial" className="bg-bg-sidebar text-text-primary">Parcial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Medio de Pago</label>
                  <select 
                    value={session.payment_type || ''}
                    onChange={(e) => setSession({ ...session, payment_type: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-bg-sidebar text-text-primary">Seleccione...</option>
                    <option value="Transferencia electrónica" className="bg-bg-sidebar text-text-primary">Transferencia electrónica</option>
                    <option value="Efectivo" className="bg-bg-sidebar text-text-primary">Efectivo</option>
                    <option value="Tarjeta de crédito/débito" className="bg-bg-sidebar text-text-primary">Tarjeta de crédito/débito</option>
                    <option value="Otro" className="bg-bg-sidebar text-text-primary">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Identificador de Transacción</label>
                  <input 
                    type="text"
                    value={session.transaction_id || ''}
                    onChange={(e) => setSession({ ...session, transaction_id: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Estado Boleta (SII)</label>
                  <select 
                    value={session.boleta_status}
                    onChange={(e) => setSession({ ...session, boleta_status: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="Pendiente" className="bg-bg-sidebar text-text-primary">Pendiente</option>
                    <option value="Emitida" className="bg-bg-sidebar text-text-primary">Emitida</option>
                    <option value="No Aplica" className="bg-bg-sidebar text-text-primary">No Aplica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1 font-semibold">Comentarios Internos Administrativos</label>
                <textarea 
                  rows={3}
                  value={session.comentarios_internos || ''}
                  onChange={(e) => setSession({ ...session, comentarios_internos: e.target.value })}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                />
              </div>

              <button 
                type="submit"
                className="bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold px-4 py-2.5 rounded-lg text-xs transition-all cursor-pointer"
              >
                Guardar Cambios Administrativos
              </button>
            </form>
          )}

          {activeTab === 'archivos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border-color pb-3">
                <h3 className="text-sm font-semibold text-text-primary">Archivos Clínicos de la Sesión</h3>
                <div>
                  <button
                    onClick={() => {
                      const input = document.getElementById('session-file-input');
                      if (input) input.click();
                    }}
                    className="bg-bg-input border border-border-color hover:bg-bg-card-hover text-accent-primary font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Subir Archivo</span>
                  </button>
                  <input
                    id="session-file-input"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingFileObject(file);
                      setFileDescription('');
                      setFileCategory('General');
                      setIsAddFileModalOpen(true);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {sessionFiles.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs bg-bg-input/10 border border-border-color rounded-xl">
                  No hay archivos específicos cargados para esta sesión.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessionFiles.map((file) => (
                    <div key={file.id} className="bg-bg-input/40 border border-border-color p-4 rounded-xl flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-semibold text-text-primary truncate">{file.original_name}</p>
                        <p className="text-[10px] text-text-muted font-semibold">Categoría: {file.category} • Tipo: {file.mime_type}</p>
                        {file.description && <p className="text-text-secondary pt-1 font-medium">{file.description}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from('clinical-vault')
                              .createSignedUrl(file.storage_path, 60);
                            if (data?.signedUrl) {
                              window.open(data.signedUrl, '_blank');
                            } else {
                              alert('No se pudo generar el enlace de descarga.');
                            }
                          }}
                          className="text-text-muted hover:text-accent-primary p-1 cursor-pointer"
                          title="Descargar"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if (!confirm('¿Seguro que deseas eliminar este archivo?')) return;
                            if (file.storage_path) {
                              await supabase.storage.from('clinical-vault').remove([file.storage_path]);
                            }
                            const { error: delErr } = await supabase.from('files_vault').delete().eq('id', file.id);
                            if (delErr) alert(delErr.message);
                            else fetchSessionData();
                          }}
                          className="text-text-muted hover:text-danger p-1 cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* File Upload Modal */}
      {isAddFileModalOpen && uploadingFileObject && (
        <div className="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border-color w-full max-w-lg rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
              <h3 className="font-bold text-text-primary">Subir Documento a la Sesión</h3>
              <button onClick={() => {
                setIsAddFileModalOpen(false);
                setUploadingFileObject(null);
              }} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-text-muted">Archivo seleccionado: <span className="font-semibold text-text-primary">{uploadingFileObject.name}</span> ({(uploadingFileObject.size / 1024).toFixed(1)} KB)</p>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-semibold">Categoría</label>
                <select 
                  value={fileCategory}
                  onChange={(e) => setFileCategory(e.target.value)}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer"
                >
                  <option value="General">General</option>
                  <option value="Evaluación">Evaluación</option>
                  <option value="Informe">Informe</option>
                  <option value="Receta">Receta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-semibold">Descripción (Obligatorio) *</label>
                <textarea 
                  rows={3} required
                  placeholder="Describa el contenido o propósito del archivo..."
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-color bg-bg-input/40">
              <button 
                type="button"
                onClick={() => {
                  setIsAddFileModalOpen(false);
                  setUploadingFileObject(null);
                }}
                className="px-4 py-2 border border-border-color hover:bg-bg-card-hover text-xs font-bold rounded-lg text-text-secondary transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                disabled={!fileDescription.trim() || submitting}
                onClick={async () => {
                  if (!fileDescription.trim()) return;
                  setSubmitting(true);
                  try {
                    const tenantId = localStorage.getItem('active-tenant-id') || '';
                    const savedName = `vault_${Date.now()}_${uploadingFileObject.name.replace(/\s/g, '_')}`;
                    const storagePath = `${tenantId}/sessions/${id}/${savedName}`;

                    // Upload to Supabase Storage
                    const { error: uploadErr } = await supabase.storage
                      .from('clinical-vault')
                      .upload(storagePath, uploadingFileObject);

                    if (uploadErr) throw uploadErr;

                    // Register in files_vault table
                    const { error: dbErr } = await supabase
                      .from('files_vault')
                      .insert({
                        organization_id: tenantId,
                        patient_id: session.patient_id,
                        session_id: id,
                        original_name: uploadingFileObject.name,
                        saved_name: savedName,
                        storage_path: storagePath,
                        mime_type: uploadingFileObject.type || 'application/octet-stream',
                        category: fileCategory,
                        description: fileDescription.trim(),
                        size_bytes: uploadingFileObject.size
                      });

                    if (dbErr) throw dbErr;

                    alert('Archivo subido con éxito.');
                    setIsAddFileModalOpen(false);
                    setUploadingFileObject(null);
                    fetchSessionData();
                  } catch (err: any) {
                    alert('Error al subir archivo: ' + err.message);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="bg-accent-primary hover:bg-accent-hover text-bg-primary disabled:opacity-50 disabled:cursor-not-allowed font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer"
              >
                Subir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
