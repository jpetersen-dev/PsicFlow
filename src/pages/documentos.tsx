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
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { usePrivacyMode } from '../components/PrivacyModeProvider';

export default function Documentos() {
  const { maskName } = usePrivacyMode();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientNotes, setPatientNotes] = useState<any[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
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
      setSelectedNoteIds([]);
      return;
    }

    const fetchNotes = async () => {
      try {
        const { data } = await supabase
          .from('sessions')
          .select(`
            id, date_session,
            clinical_notes (id, temas_abordados, sintomas_observados, human_validated_content, is_human_validated)
          `)
          .eq('patient_id', selectedPatientId)
          .order('date_session', { ascending: false });

        if (data) {
          // Flatten note entries
          const notes = data
            .map((s: any) => {
              const note = s.clinical_notes && s.clinical_notes[0];
              if (!note) return null;
              return {
                id: note.id,
                date: s.date_session,
                temas: note.temas_abordados,
                sintomas: note.sintomas_observados,
                content: note.human_validated_content,
                validated: note.is_human_validated
              };
            })
            .filter(Boolean);
          
          setPatientNotes(notes);
          // Auto-select all validated notes initially
          setSelectedNoteIds(notes.filter((n: any) => n.validated).map((n: any) => n.id));
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchNotes();
  }, [selectedPatientId]);

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev => 
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    );
  };

  const handleGenerateReport = async () => {
    if (!selectedPatientId) return;
    setIsGenerating(true);
    setError('');
    
    try {
      const tenantId = localStorage.getItem('active-tenant-id') || '';
      const patientName = patients.find(p => p.id === selectedPatientId)?.full_name || 'Paciente';
      const notesToAnalyze = patientNotes
        .filter(n => selectedNoteIds.includes(n.id))
        .map(n => ({
          date: n.date,
          temas: n.temas || '',
          sintomas: n.sintomas || '',
          content: n.content || '',
        }));

      // Call backend API for report generation with credit billing
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({
          patient_name: patientName,
          selected_notes: notesToAnalyze,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Error al generar el informe clínico.');
      }

      setGeneratedReport(result.report);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al generar informe.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedReport) return;
    const fileContent = "data:text/plain;charset=utf-8,\uFEFF" + encodeURIComponent(generatedReport);
    const link = document.createElement("a");
    link.setAttribute("href", fileContent);
    link.setAttribute("download", `informe_${selectedPatientId}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5 font-semibold">Seleccionar Paciente *</label>
                <select 
                  value={selectedPatientId} 
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                >
                  <option value="" className="bg-bg-sidebar text-text-primary">Seleccione un paciente...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id} className="bg-bg-sidebar text-text-primary">{maskName(p.full_name)} ({p.status})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Context selection checklist */}
            {selectedPatientId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border-color pb-1">
                  <label className="block text-xs text-text-secondary font-semibold">Seleccionar Notas para Contexto</label>
                  <span className="text-[10px] text-text-muted">{selectedNoteIds.length} seleccionada(s)</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {patientNotes.length === 0 ? (
                    <p className="text-xs text-text-muted italic py-2">No hay notas clínicas disponibles.</p>
                  ) : (
                    patientNotes.map((note) => (
                      <button 
                        key={note.id}
                        type="button"
                        onClick={() => toggleNoteSelection(note.id)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs flex gap-3 items-start transition-all ${
                          selectedNoteIds.includes(note.id)
                            ? 'bg-accent-primary/5 border-accent-primary/20 text-text-primary'
                            : 'bg-bg-input/40 border-border-color text-text-secondary hover:border-border-focus'
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 text-accent-primary">
                          {selectedNoteIds.includes(note.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </span>
                        <div>
                          <p className="font-semibold text-text-primary">Sesión del {note.date}</p>
                          <p className="text-[10px] text-text-muted truncate max-w-[180px]">{note.content || 'Borrador sin firma'}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {selectedPatientId && (
              <div className="space-y-2">
                <button 
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full bg-accent-primary hover:bg-accent-hover text-bg-primary disabled:opacity-50 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-4 h-4 fill-bg-primary" />
                  <span>{isGenerating ? 'Generando con Gemini...' : 'Generar Informe con IA'}</span>
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
                <button 
                  onClick={handleDownload}
                  className="bg-bg-input border border-border-color hover:bg-bg-card-hover px-3.5 py-2 rounded-lg text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar TXT/PDF</span>
                </button>
              )}
            </div>

            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-text-secondary space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-border-focus border-t-transparent animate-spin"></div>
                <p className="text-xs">Gemini 1.5 Pro está compilando y redactando el informe evolutivo...</p>
              </div>
            ) : !generatedReport ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted text-sm border border-dashed border-border-color rounded-xl space-y-2 bg-bg-primary/20">
                <FileText className="w-10 h-10 text-text-muted" />
                <p className="font-medium text-text-secondary">No se ha generado ningún informe todavía.</p>
                <p className="text-xs text-text-muted">Configura los parámetros del reporte a la izquierda y presiona Generar.</p>
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
