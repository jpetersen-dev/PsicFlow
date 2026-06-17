import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { 
  FileText, 
  Users, 
  Sparkles, 
  Download, 
  CheckSquare, 
  Square,
  AlertTriangle,
  Lock,
  FolderOpen
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { usePrivacyMode } from '../components/PrivacyModeProvider';

export default function Documentos() {
  const { maskName } = usePrivacyMode();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  
  // Cascading Template Selection
  const [selectedTemplate, setSelectedTemplate] = useState<'registro_sesion' | 'ficha_integral'>('registro_sesion');
  const [patientNotes, setPatientNotes] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');

  // Section Checkboxes for Ficha Integral
  const [sectionsFilter, setSectionsFilter] = useState({
    personal: true,
    emergency: true,
    plan: true,
    diagnostics: true,
    sessions: true,
    symptoms: true,
    epicrisis: true
  });

  // AI Assistance parameters
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiBaseInfo, setAiBaseInfo] = useState({
    soap: true,
    diagnostics: true,
    history: true
  });
  const [aiSectionsToWrite, setAiSectionsToWrite] = useState({
    summary: true,
    recommendations: true,
    evaluation: true
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [reportTitle, setReportTitle] = useState('Informe Clínico de Evolución');
  const [error, setError] = useState('');

  const fetchPatients = async () => {
    try {
      const { data } = await supabase.from('patients').select('id, full_name, status');
      if (data) setPatients(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (!selectedPatientId) {
      setPatientNotes([]);
      setSelectedSessionId('');
      return;
    }

    const fetchNotes = async () => {
      try {
        const { data } = await supabase
          .from('sessions')
          .select(`
            id, date_session, time_session,
            clinical_notes (id, temas_abordados, sintomas_observados, human_validated_content, is_human_validated)
          `)
          .eq('patient_id', selectedPatientId)
          .order('date_session', { ascending: false });

        if (data) {
          const notes = data
            .map((s: any) => {
              const note = s.clinical_notes && s.clinical_notes[0];
              return {
                id: note?.id || '',
                sessionId: s.id,
                date: s.date_session,
                time: s.time_session,
                temas: note?.temas_abordados || '',
                sintomas: note?.sintomas_observados || '',
                content: note?.human_validated_content || '',
                validated: note?.is_human_validated || false
              };
            });
          
          setPatientNotes(notes);
          if (notes.length > 0) {
            setSelectedSessionId(notes[0].sessionId);
          } else {
            setSelectedSessionId('');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchNotes();
  }, [selectedPatientId]);

  const toggleSectionFilter = (key: keyof typeof sectionsFilter) => {
    setSectionsFilter(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerateReport = async () => {
    if (!selectedPatientId) {
      alert('Debe seleccionar un paciente.');
      return;
    }
    setIsGenerating(true);
    setError('');
    
    try {
      const patientData = patients.find(p => p.id === selectedPatientId);
      if (!patientData) throw new Error('Paciente no encontrado');

      // Fetch additional context from DB
      const { data: record } = await supabase
        .from('clinical_records')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .eq('is_open', true)
        .limit(1)
        .single();

      const { data: diags } = await supabase
        .from('diagnostics')
        .select('*')
        .eq('record_id', record?.id);

      const { data: symps } = await supabase
        .from('sintomatologia_records')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('created_at', { ascending: false });

      const { data: epis } = await supabase
        .from('epicrisis_records')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('closure_date', { ascending: false });

      if (selectedTemplate === 'registro_sesion') {
        if (!selectedSessionId) {
          alert('Debe seleccionar una sesión.');
          setIsGenerating(false);
          return;
        }

        const sessionObj = patientNotes.find(n => n.sessionId === selectedSessionId);
        const dateStr = sessionObj?.date || '';
        const temas = sessionObj?.temas || 'No registrado';
        const sintomas = sessionObj?.sintomas || 'No registrado';
        const content = sessionObj?.content || 'No registrado';

        if (aiEnabled) {
          // AI generation using API
          const tenantId = localStorage.getItem('active-tenant-id') || '';
          const { data: { session: authSess } } = await supabase.auth.getSession();
          const token = authSess?.access_token || '';

          const res = await fetch('/api/ai/report', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'x-tenant-id': tenantId,
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              patient_name: patientData.full_name,
              selected_notes: [{ date: dateStr, temas, sintomas, content }],
              ai_instructions: `Redacte un resumen formal de la sesión considerando: temas abordados (${aiBaseInfo.soap ? 'incluido' : 'omitido'}), sintomatología y evolución. Redacte la evaluación: ${aiSectionsToWrite.evaluation ? 'sí' : 'no'}.`
            }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Error al generar borrador con IA.');
          setGeneratedReport(result.report);
        } else {
          // Client-side local template
          const report = `REGISTRO CLÍNICO DE EVOLUCIÓN DE SESIÓN

PACIENTE: ${patientData.full_name}
FECHA DE SESIÓN: ${dateStr}

1. TEMAS ABORDADOS EN SESIÓN:
${temas}

2. SÍNTOMAS REPORTADOS / OBSERVADOS:
${sintomas}

3. EVOLUCIÓN Y NOTA DE SESIÓN:
${content}

--------------------------------------------------
Documento certificado de resguardo clínico.`;
          setGeneratedReport(report);
        }
      } else {
        // Ficha Clínica Integral
        if (aiEnabled) {
          // AI summary using API
          const tenantId = localStorage.getItem('active-tenant-id') || '';
          const { data: { session: authSess } } = await supabase.auth.getSession();
          const token = authSess?.access_token || '';

          const notesToAnalyze = patientNotes.map(n => ({
            date: n.date,
            temas: n.temas || '',
            sintomas: n.sintomas || '',
            content: n.content || '',
          }));

          const res = await fetch('/api/ai/report', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'x-tenant-id': tenantId,
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              patient_name: patientData.full_name,
              selected_notes: notesToAnalyze,
              ai_instructions: `Ficha Clínica Integral. Resuma el historial de las sesiones de manera técnica. Resuma las recomendaciones: ${aiSectionsToWrite.recommendations ? 'sí' : 'no'}.`
            }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Error al generar ficha integral con IA.');
          setGeneratedReport(result.report);
        } else {
          // Local concatenation based on checked checkboxes
          let report = `EXPEDIENTE DE FICHA CLÍNICA INTEGRAL

PACIENTE: ${patientData.full_name}
FECHA GENERACIÓN: ${new Date().toLocaleDateString('es-CL')}
ESTADO: ${patientData.status.toUpperCase()}
`;

          if (sectionsFilter.personal) {
            report += `\n==================================================
1. INFORMACIÓN PERSONAL Y DEMOGRÁFICA
==================================================
Sexo/Género: ${patientData.gender || 'No registrado'}
Estado Civil: ${patientData.marital_status || 'No registrado'}
Ocupación: ${patientData.occupation || 'No registrado'}
Sistema de Salud: ${patientData.health_system || 'No registrado'}
Escolaridad: ${patientData.education_level || ''} (${patientData.education_status || ''})
`;
          }

          if (sectionsFilter.emergency) {
            report += `\n==================================================
2. CONTACTO DE EMERGENCIA
==================================================
Nombre: ${patientData.emergency_contact_name || 'No registrado'}
Parentesco: ${patientData.emergency_contact_relationship || 'No registrado'}
Teléfono: ${patientData.emergency_contact_phone || 'No registrado'}
`;
          }

          if (sectionsFilter.plan && record) {
            report += `\n==================================================
3. PLAN TERAPÉUTICO Y CONCEPTUALIZACIÓN
==================================================
Objetivo General:
${record.objetivo_general || 'No registrado'}

Enfoque Teórico:
${record.enfoque_teorico || 'No registrado'}

Motivo de Consulta:
${record.motivo_consulta || 'No registrado'}

Antecedentes Relevantes:
${record.antecedentes_relevantes || 'No registrado'}

Conceptualización de Caso:
${record.formulacion_caso || 'No registrado'}
`;
          }

          if (sectionsFilter.diagnostics && diags) {
            report += `\n==================================================
4. DIAGNÓSTICOS CLÍNICOS (CIE-10 / DSM-5)
==================================================
`;
            if (diags.length === 0) {
              report += `No hay diagnósticos asignados.\n`;
            } else {
              diags.forEach((d) => {
                report += `[${d.code}] ${d.description} (Asignado el: ${new Date(d.created_at).toLocaleDateString('es-CL')})\n`;
              });
            }
          }

          if (sectionsFilter.sessions) {
            report += `\n==================================================
5. HISTORIAL DE SESIONES CLÍNICAS
==================================================
`;
            if (patientNotes.length === 0) {
              report += `No hay sesiones registradas.\n`;
            } else {
              patientNotes.forEach((n, i) => {
                report += `--- Sesión N° ${patientNotes.length - i} (Fecha: ${n.date}) ---
Temas abordados: ${n.temas || 'No registrado'}
Sintomatología: ${n.sintomas || 'No registrado'}
Evolución: ${n.content || 'Borrador sin firma'}
\n`;
              });
            }
          }

          if (sectionsFilter.symptoms && symps) {
            report += `\n==================================================
6. EVOLUCIÓN SINTOMATOLÓGICA REGISTRADA
==================================================
`;
            if (symps.length === 0) {
              report += `No hay registros de síntomas.\n`;
            } else {
              symps.forEach((s) => {
                report += `[${new Date(s.created_at).toLocaleDateString('es-CL')}]: ${s.content}\n`;
              });
            }
          }

          if (sectionsFilter.epicrisis && epis) {
            report += `\n==================================================
7. HISTORIAL DE EPICRISIS Y CIERRES
==================================================
`;
            if (epis.length === 0) {
              report += `No hay cierres registrados.\n`;
            } else {
              epis.forEach((e) => {
                report += `Fecha de Cierre: ${e.closure_date}
Motivo: ${e.reason}
Evaluación Final:
${e.final_evaluation}
\n`;
              });
            }
          }

          report += `\n==================================================
Fin del Expediente Documental.`;
          setGeneratedReport(report);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar el reporte.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!generatedReport) return;
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
          <title>${reportTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
            .header::after { content: ""; clear: both; display: table; }
            .title { font-size: 20px; font-weight: bold; color: #1e3a8a; margin: 0; }
            .subtitle { font-size: 11px; color: #666; margin: 2px 0 0 0; }
            .content { font-size: 11px; text-align: justify; white-space: pre-wrap; margin-bottom: 30px; }
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
              <h1 class="title">${reportTitle.toUpperCase()}</h1>
              <p class="subtitle">Ecosistema Clínico PsicoAlivio</p>
            </div>
          </div>
          
          <div class="content">${generatedReport}</div>

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
      alert('Error al descargar PDF: ' + err.message);
    }
  };

  const handleDownloadWord = async () => {
    if (!generatedReport) return;
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
          <title>${reportTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 16pt; font-weight: bold; color: #1e3a8a; }
            .content { font-size: 10pt; text-align: justify; }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <div class="title">${reportTitle.toUpperCase()}</div>
            <p style="font-size: 9pt; color: #666;">PsicoAlivio Ecosistema Clínico</p>
          </div>
          
          <div class="content">
            ${generatedReport.replace(/\n/g, '<br/>')}
          </div>

          ${sigHtml}
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportTitle.replace(/\s+/g, '_')}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error al descargar Word: ' + err.message);
    }
  };

  return (
    <>
      <Head>
        <title>PsicoAlivio - Centro de Documentación</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-text-primary">
            <FileText className="w-6 h-6 text-accent-primary" />
            <span>Centro de Documentación Inteligente</span>
          </h1>
          <p className="text-text-secondary text-sm">Genere informes evolutivos utilizando IA controlando explícitamente el contexto.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="bg-bg-card border border-border-color rounded-2xl p-6 space-y-6 flex flex-col h-fit">
            <h2 className="text-sm font-bold text-text-primary border-b border-border-color pb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-4.5 h-4.5 text-accent-primary" />
              <span>Configuración del Reporte</span>
            </h2>

            {error && (
              <div className="bg-danger/10 border border-danger/25 p-4 rounded-xl flex items-start gap-2.5 text-xs text-danger">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-semibold">Tipo / Título de Informe</label>
                <input 
                  type="text" 
                  value={reportTitle} 
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-semibold">Seleccionar Paciente *</label>
                <select 
                  value={selectedPatientId} 
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer font-medium"
                >
                  <option value="" className="bg-bg-sidebar text-text-primary font-medium">Seleccione un paciente...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id} className="bg-bg-sidebar text-text-primary font-medium">{maskName(p.full_name)} ({p.status})</option>
                  ))}
                </select>
              </div>

              {selectedPatientId && (
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5 font-semibold">Plantilla del Documento</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => {
                      setSelectedTemplate(e.target.value as any);
                      if (e.target.value === 'ficha_integral') {
                        setReportTitle('Ficha Clínica Integral');
                      } else {
                        setReportTitle('Registro de Sesión');
                      }
                    }}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="registro_sesion" className="bg-bg-sidebar text-text-primary font-medium">Registro de Sesión</option>
                    <option value="ficha_integral" className="bg-bg-sidebar text-text-primary font-medium">Ficha Clínica Integral</option>
                  </select>
                </div>
              )}

              {/* Cascading specific session dropdown */}
              {selectedPatientId && selectedTemplate === 'registro_sesion' && (
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5 font-semibold">Seleccionar Sesión Específica</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer font-mono font-medium"
                  >
                    {patientNotes.length === 0 ? (
                      <option value="" className="bg-bg-sidebar text-text-primary">No hay sesiones disponibles</option>
                    ) : (
                      patientNotes.map(n => (
                        <option key={n.sessionId} value={n.sessionId} className="bg-bg-sidebar text-text-primary font-mono">
                          {n.date} ({n.time ? n.time.slice(0, 5) : 'N/A'})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Ficha Integral Section Checkboxes */}
              {selectedPatientId && selectedTemplate === 'ficha_integral' && (
                <div className="space-y-2.5 bg-bg-input/20 border border-border-color p-3 rounded-lg">
                  <p className="text-xs font-semibold text-text-secondary border-b border-border-color pb-1">Secciones a Incluir:</p>
                  
                  {Object.entries({
                    personal: 'Información Personal',
                    emergency: 'Contacto de Emergencia',
                    plan: 'Plan Terapéutico',
                    diagnostics: 'Diagnósticos (CIE-10/DSM-5)',
                    sessions: 'Historial de Sesiones',
                    symptoms: 'Evolución Sintomatológica',
                    epicrisis: 'Epicrisis / Cierres'
                  }).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSectionFilter(key as any)}
                      className="w-full flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-all text-left"
                    >
                      <span className="text-accent-primary">
                        {sectionsFilter[key as keyof typeof sectionsFilter] ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI Assistant Parameter Switches */}
            {selectedPatientId && (
              <div className="border-t border-border-color pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-primary cursor-pointer" htmlFor="ai-toggle">
                    Habilitar Redacción IA
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      id="ai-toggle"
                      type="checkbox" 
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {aiEnabled && (
                  <div className="space-y-3 p-3 bg-accent-primary/5 border border-accent-primary/10 rounded-lg text-xs">
                    <p className="font-semibold text-accent-primary border-b border-accent-primary/10 pb-1">Configuración del Asistente IA:</p>
                    
                    {/* Base Info parameters */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Información base:</p>
                      {Object.entries({
                        soap: 'Notas SOAP validadas',
                        diagnostics: 'Diagnósticos activos',
                        history: 'Historial completo'
                      }).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={aiBaseInfo[key as keyof typeof aiBaseInfo]}
                            onChange={(e) => setAiBaseInfo({ ...aiBaseInfo, [key]: e.target.checked })}
                            className="accent-primary"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    {/* AI Sections to write */}
                    <div className="space-y-1.5 pt-2 border-t border-accent-primary/10">
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Redactar automáticamente:</p>
                      {Object.entries({
                        summary: 'Resumen clínico ejecutivo',
                        recommendations: 'Recomendaciones y tareas',
                        evaluation: 'Evaluación del pronóstico'
                      }).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={aiSectionsToWrite[key as keyof typeof aiSectionsToWrite]}
                            onChange={(e) => setAiSectionsToWrite({ ...aiSectionsToWrite, [key]: e.target.checked })}
                            className="accent-primary"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedPatientId && (
              <div className="space-y-2 border-t border-border-color pt-4">
                <button 
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full bg-accent-primary hover:bg-accent-hover text-bg-primary disabled:opacity-50 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-bg-primary" />
                  <span>{isGenerating ? 'Generando...' : 'Generar Documento'}</span>
                </button>
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted justify-center">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Deduce 1 crédito de INFORME_CLINICO</span>
                </div>
              </div>
            )}
          </div>

          {/* Generated output editor */}
          <div className="lg:col-span-2 bg-bg-card border border-border-color rounded-2xl p-6 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-border-color pb-3 mb-4">
              <h2 className="text-base font-bold text-text-primary">{reportTitle}</h2>
              {generatedReport && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleDownloadPDF}
                    className="bg-bg-input border border-border-color hover:bg-bg-card-hover px-3.5 py-2 rounded-lg text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Exportar a PDF profesional"
                  >
                    <Download className="w-3.5 h-3.5 text-danger" />
                    <span>Descargar PDF</span>
                  </button>
                  <button 
                    onClick={handleDownloadWord}
                    className="bg-bg-input border border-border-color hover:bg-bg-card-hover px-3.5 py-2 rounded-lg text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Exportar a Word editable"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-500" />
                    <span>Descargar Word</span>
                  </button>
                </div>
              )}
            </div>

            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-secondary space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-border-focus border-t-transparent animate-spin"></div>
                <p className="text-xs">Procesando y compilando el expediente clínico del paciente...</p>
              </div>
            ) : !generatedReport ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted text-sm border border-dashed border-border-color rounded-xl space-y-2 bg-bg-primary/20">
                <FileText className="w-10 h-10 text-text-muted" />
                <p className="font-medium text-text-secondary">No se ha redactado ningún documento todavía.</p>
                <p className="text-xs text-text-muted">Configure los parámetros del reporte a la izquierda y presiona Generar.</p>
              </div>
            ) : (
              <textarea 
                value={generatedReport}
                onChange={(e) => setGeneratedReport(e.target.value)}
                className="flex-1 w-full bg-bg-input border border-border-color rounded-xl p-5 text-sm text-text-primary focus:outline-none font-mono leading-relaxed whitespace-pre-wrap select-text resize-none"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
