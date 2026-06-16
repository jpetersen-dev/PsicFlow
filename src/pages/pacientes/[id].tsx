import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  AlertOctagon, 
  BookOpen, 
  FileSpreadsheet, 
  TrendingUp, 
  FileCheck,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  DollarSign,
  AlertTriangle,
  FolderOpen,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { usePrivacyMode } from '../../components/PrivacyModeProvider';

type TabType = 'resumen' | 'plan' | 'sesiones' | 'sintomas' | 'epicrisis' | 'archivos';

export default function PacienteFicha() {
  const router = useRouter();
  const { id } = router.query;
  const { maskName, maskRut } = usePrivacyMode();
  
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const [patient, setPatient] = useState<any>(null);
  const [clinicalRecord, setClinicalRecord] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [epicrisis, setEpicrisis] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Modals / Form inputs
  const [newDiag, setNewDiag] = useState({ code: '', description: '' });
  const [newSymptom, setNewSymptom] = useState({ id: '', content: '' });
  const [isSymptomModalOpen, setIsSymptomModalOpen] = useState(false);
  const [newEpicrisis, setNewEpicrisis] = useState({ closure_date: '', reason: 'Alta por cumplimiento de objetivos', final_evaluation: '' });

  const fetchFichaData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Fetch Patient demography
      const { data: patData, error: patErr } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();
      
      if (patErr || !patData) {
        throw new Error('No se pudo encontrar al paciente o no tienes acceso.');
      }
      setPatient(patData);

      // 2. Fetch Clinical Record (Conceptualization)
      const { data: recData } = await supabase
        .from('clinical_records')
        .select('*')
        .eq('patient_id', id)
        .eq('is_open', true)
        .limit(1);

      let record = recData && recData[0];
      
      // If no clinical record exists yet, create an empty one for the patient
      if (!record) {
        const tenantId = localStorage.getItem('active-tenant-id');
        const { data: newRec } = await supabase
          .from('clinical_records')
          .insert({
            organization_id: tenantId,
            patient_id: id,
            motivo_consulta: '',
            antecedentes_relevantes: '',
            observaciones_generales: '',
            enfoque_teorico: '',
            formulacion_caso: '',
            objetivo_general: '',
            is_open: true
          })
          .select()
          .single();
        record = newRec;
      }
      setClinicalRecord(record);

      if (record) {
        // Fetch CIE-10 Diagnostics
        const { data: diagData } = await supabase
          .from('diagnostics')
          .select('*')
          .eq('record_id', record.id);
        if (diagData) setDiagnostics(diagData);
      }

      // 3. Fetch Sessions
      const { data: sessData } = await supabase
        .from('sessions')
        .select(`
          id, date_session, time_session, modality, status_session, 
          value_session, status_payment, payment_type, transaction_id, boleta_status, comentarios_internos,
          professional:professional_id (full_name)
        `)
        .eq('patient_id', id)
        .order('date_session', { ascending: false });
      if (sessData) setSessions(sessData);

      // 4. Fetch Symptomatology Evolutions
      const { data: sympData } = await supabase
        .from('sintomatologia_records')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false });
      if (sympData) setSymptoms(sympData);

      // 5. Fetch Epicrisis closure
      const { data: epiData } = await supabase
        .from('epicrisis_records')
        .select('*')
        .eq('patient_id', id)
        .limit(1);
      if (epiData && epiData[0]) {
        setEpicrisis(epiData[0]);
        setNewEpicrisis({
          closure_date: epiData[0].closure_date,
          reason: epiData[0].reason,
          final_evaluation: epiData[0].final_evaluation
        });
      }

      // 6. Fetch files
      const { data: filesData } = await supabase
        .from('files_vault')
        .select('*')
        .eq('patient_id', id);
      if (filesData) setFiles(filesData);

    } catch (err: any) {
      setError(err.message || 'Error cargando datos de la ficha.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFichaData();
  }, [id]);

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error: updErr } = await supabase
        .from('clinical_records')
        .update({
          motivo_consulta: clinicalRecord.motivo_consulta,
          antecedentes_relevantes: clinicalRecord.antecedentes_relevantes,
          observaciones_generales: clinicalRecord.observaciones_generales,
          enfoque_teorico: clinicalRecord.enfoque_teorico,
          formulacion_caso: clinicalRecord.formulacion_caso,
          objetivo_general: clinicalRecord.objetivo_general
        })
        .eq('id', clinicalRecord.id);
      
      if (updErr) throw updErr;
      alert('Plan terapéutico guardado exitosamente.');
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDiagnostic = async () => {
    if (!newDiag.code || !newDiag.description) return;
    try {
      const { data: createdDiag, error: err } = await supabase
        .from('diagnostics')
        .insert({
          record_id: clinicalRecord.id,
          code: newDiag.code,
          description: newDiag.description
        })
        .select()
        .single();
      
      if (err) throw err;
      setDiagnostics(prev => [...prev, createdDiag]);
      setNewDiag({ code: '', description: '' });
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteDiagnostic = async (diagId: string) => {
    try {
      const { error: err } = await supabase
        .from('diagnostics')
        .delete()
        .eq('id', diagId);
      if (err) throw err;
      setDiagnostics(prev => prev.filter(d => d.id !== diagId));
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveSymptom = async () => {
    if (!newSymptom.content) return;
    try {
      if (newSymptom.id) {
        // Edit mode
        const { error: err } = await supabase
          .from('sintomatologia_records')
          .update({ content: newSymptom.content })
          .eq('id', newSymptom.id);
        if (err) throw err;
      } else {
        // Create mode
        const { error: err } = await supabase
          .from('sintomatologia_records')
          .insert({
            patient_id: id,
            content: newSymptom.content
          });
        if (err) throw err;
      }
      setIsSymptomModalOpen(false);
      setNewSymptom({ id: '', content: '' });
      fetchFichaData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteSymptom = async (sId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
    try {
      const { error: err } = await supabase
        .from('sintomatologia_records')
        .delete()
        .eq('id', sId);
      if (err) throw err;
      setSymptoms(prev => prev.filter(s => s.id !== sId));
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveEpicrisis = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (epicrisis) {
        // Update Epicrisis
        const { error: err } = await supabase
          .from('epicrisis_records')
          .update({
            closure_date: newEpicrisis.closure_date,
            reason: newEpicrisis.reason,
            final_evaluation: newEpicrisis.final_evaluation
          })
          .eq('id', epicrisis.id);
        if (err) throw err;
      } else {
        // Create Epicrisis and set patient status to "alta"
        const { error: err } = await supabase
          .from('epicrisis_records')
          .insert({
            patient_id: id,
            closure_date: newEpicrisis.closure_date,
            reason: newEpicrisis.reason,
            final_evaluation: newEpicrisis.final_evaluation
          });
        if (err) throw err;

        await supabase
          .from('patients')
          .update({ status: 'alta' })
          .eq('id', id);
      }
      alert('Epicrisis guardada exitosamente. El estado del paciente se ha actualizado.');
      fetchFichaData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) return <div className="py-20 text-center text-text-muted text-sm">Cargando Ficha Clínica...</div>;
  if (error) return <div className="py-12 bg-danger/10 border border-danger/20 text-danger p-6 rounded-xl text-center">{error}</div>;

  return (
    <>
      <Head>
        <title>PsicoAlivio - Ficha de {patient?.full_name}</title>
      </Head>

      <div className="space-y-6">
        {/* Ficha Header */}
        <div className="bg-bg-card border border-border-color rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-primary">{maskName(patient.full_name)}</h1>
              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                patient.status === 'activo' ? 'bg-success/10 text-success border border-success/20' :
                patient.status === 'seguimiento' ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20' :
                patient.status === 'alta' ? 'bg-warning/10 text-warning border border-warning/20' :
                'bg-bg-secondary text-text-secondary border border-border-color'
              }`}>
                {patient.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
              <span className="font-mono">Ficha N° {patient.ficha_id_num}</span>
              <span>•</span>
              <span className="font-mono">RUT: {maskRut(patient.rut_patient)}</span>
              <span>•</span>
              <span>F. Nacimiento: {patient.birth_date}</span>
            </div>
          </div>
          <button 
            onClick={() => router.push('/pacientes')} 
            className="px-4 py-2 border border-border-color hover:bg-bg-card-hover rounded-lg text-xs font-semibold text-text-primary transition-all"
          >
            Volver a CRM
          </button>
        </div>

        {/* Tab Controls */}
        <div className="border-b border-border-color flex overflow-x-auto gap-4">
          {[
            { id: 'resumen', label: 'Resumen y Datos', icon: User },
            { id: 'plan', label: 'Plan Terapéutico', icon: BookOpen },
            { id: 'sesiones', label: 'Historial Sesiones', icon: Calendar },
            { id: 'sintomas', label: 'Sintomatología', icon: TrendingUp },
            { id: 'epicrisis', label: 'Epicrisis / Cierre', icon: FileCheck },
            { id: 'archivos', label: 'Archivos', icon: FolderOpen }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-3 px-1 border-b-2 text-sm font-semibold transition-all shrink-0 flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? 'border-border-focus text-accent-primary' 
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="bg-bg-card border border-border-color rounded-2xl p-6">
          {/* Tab 1: Resumen y Contacto */}
          {activeTab === 'resumen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary border-b border-border-color pb-1.5 flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-accent-primary" />
                    <span>Información Personal</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-text-muted text-xs">Sexo/Género</p>
                      <p className="text-text-secondary font-medium">{patient.gender || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Estado Civil</p>
                      <p className="text-text-secondary font-medium">{patient.marital_status || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Ocupación</p>
                      <p className="text-text-secondary font-medium">{patient.occupation || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Sistema de Salud</p>
                      <p className="text-text-secondary font-medium">{patient.health_system || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Nivel Educacional</p>
                      <p className="text-text-secondary font-medium">{patient.education_level || 'No registrado'}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Estado Educacional</p>
                      <p className="text-text-secondary font-medium">{patient.education_status || 'No registrado'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-text-primary border-b border-border-color pb-1.5 flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-accent-primary" />
                    <span>Ubicación y Contacto</span>
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-text-muted" />
                      <span className="text-text-secondary">{patient.phone || 'Sin teléfono'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-text-muted" />
                      <span className="text-text-secondary">{patient.email || 'Sin correo electrónico'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                      <span className="text-text-secondary">
                        {patient.address ? `${patient.address}, ` : ''} 
                        {patient.comuna ? `${patient.comuna}, ` : ''} 
                        {patient.region || ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text-primary border-b border-border-color pb-1.5 flex items-center gap-2 mb-3">
                  <AlertOctagon className="w-4 h-4 text-danger" />
                  <span>Contacto de Emergencia</span>
                </h3>
                <div className="bg-bg-input/40 border border-border-color p-4 rounded-xl space-y-3 text-sm">
                  <div>
                    <p className="text-text-muted text-xs">Nombre Contacto</p>
                    <p className="text-text-primary font-semibold">{patient.emergency_contact_name || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Relación / Parentesco</p>
                    <p className="text-text-secondary">{patient.emergency_contact_relationship || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Teléfono</p>
                    <p className="text-text-secondary font-semibold">{patient.emergency_contact_phone || 'No registrado'}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-xs">Email</p>
                    <p className="text-text-secondary">{patient.emergency_contact_email || 'No registrado'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Plan Terapéutico & Diagnostics */}
          {activeTab === 'plan' && clinicalRecord && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <form onSubmit={handleUpdateRecord} className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Enfoque Teórico</label>
                    <input 
                      type="text" name="enfoque_teorico" 
                      value={clinicalRecord.enfoque_teorico || ''} 
                      onChange={(e) => setClinicalRecord({ ...clinicalRecord, enfoque_teorico: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Objetivo General del Proceso</label>
                    <input 
                      type="text" name="objetivo_general" 
                      value={clinicalRecord.objetivo_general || ''} 
                      onChange={(e) => setClinicalRecord({ ...clinicalRecord, objetivo_general: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Motivo de Consulta</label>
                  <textarea 
                    rows={3} name="motivo_consulta" 
                    value={clinicalRecord.motivo_consulta || ''} 
                    onChange={(e) => setClinicalRecord({ ...clinicalRecord, motivo_consulta: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Antecedentes Relevantes</label>
                  <textarea 
                    rows={3} name="antecedentes_relevantes" 
                    value={clinicalRecord.antecedentes_relevantes || ''} 
                    onChange={(e) => setClinicalRecord({ ...clinicalRecord, antecedentes_relevantes: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Conceptualización / Formulación del Caso</label>
                  <textarea 
                    rows={4} name="formulacion_caso" 
                    value={clinicalRecord.formulacion_caso || ''} 
                    onChange={(e) => setClinicalRecord({ ...clinicalRecord, formulacion_caso: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Observaciones Generales</label>
                  <textarea 
                    rows={2} name="observaciones_generales" 
                    value={clinicalRecord.observaciones_generales || ''} 
                    onChange={(e) => setClinicalRecord({ ...clinicalRecord, observaciones_generales: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button 
                    type="submit" disabled={submitting}
                    className="bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-bg-primary font-bold px-4 py-2.5 rounded-lg text-xs transition-all"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Plan Clínico'}
                  </button>
                </div>
              </form>

              {/* Table of CIE-10/DSM-5 Diagnostics */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary border-b border-border-color pb-1.5">Diagnósticos Clínicos (CIE-10 / DSM-5)</h3>
                
                {/* Add Diagnosis inline form */}
                <div className="bg-bg-input/40 p-4 rounded-xl border border-border-color space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <input 
                      type="text" placeholder="Código" 
                      value={newDiag.code} 
                      onChange={(e) => setNewDiag({ ...newDiag, code: e.target.value })}
                      className="bg-bg-card border border-border-color rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                    />
                    <input 
                      type="text" placeholder="Descripción" 
                      value={newDiag.description} 
                      onChange={(e) => setNewDiag({ ...newDiag, description: e.target.value })}
                      className="col-span-2 bg-bg-card border border-border-color rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                    />
                  </div>
                  <button 
                    type="button" onClick={handleAddDiagnostic}
                    className="w-full bg-bg-input hover:bg-bg-card-hover text-accent-primary border border-border-color font-bold py-1.5 rounded text-xs flex items-center justify-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Diagnóstico</span>
                  </button>
                </div>

                {/* Diagnostics List */}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {diagnostics.length === 0 ? (
                    <p className="text-xs text-text-muted italic py-4 text-center">No hay hipótesis diagnósticas registradas.</p>
                  ) : (
                    diagnostics.map((diag) => (
                      <div key={diag.id} className="flex items-start justify-between bg-bg-primary/20 border border-border-color p-3 rounded-lg text-xs gap-3">
                        <div className="space-y-1">
                          <span className="font-mono font-bold bg-bg-input text-accent-primary px-1.5 py-0.5 rounded border border-border-color">
                            {diag.code}
                          </span>
                          <p className="text-text-secondary font-medium pt-1">{diag.description}</p>
                        </div>
                        <button 
                          onClick={() => handleDeleteDiagnostic(diag.id)}
                          className="text-text-muted hover:text-danger p-1 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: History of Sessions */}
          {activeTab === 'sesiones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-secondary border-b border-border-color pb-1.5 flex-1">Historial Clínico de Sesiones</h3>
                <button 
                  onClick={async () => {
                    const tenantId = localStorage.getItem('active-tenant-id');
                    const { data: profs } = await supabase.from('profiles').select('id').limit(1);
                    if (!profs || profs.length === 0) {
                      alert('No se encontró un perfil profesional para asociar.');
                      return;
                    }
                    const { error } = await supabase
                      .from('sessions')
                      .insert({
                        organization_id: tenantId,
                        patient_id: id,
                        professional_id: profs[0].id,
                        date_session: new Date().toISOString().split('T')[0],
                        time_session: new Date().toLocaleTimeString('es-CL', { hour12: false }),
                        modality: 'Online',
                        status_session: 'Programada',
                        value_session: 40000,
                        status_payment: 'Pendiente'
                      });
                    if (error) alert(error.message);
                    else fetchFichaData();
                  }}
                  className="bg-bg-input border border-border-color hover:bg-bg-card-hover text-accent-primary font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Programar Cita</span>
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">No hay sesiones registradas para este paciente.</div>
              ) : (
                <div className="divide-y divide-border-color space-y-4">
                  {sessions.map((sess) => (
                    <div key={sess.id} className="pt-4 first:pt-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-text-primary">{sess.date_session} ({sess.time_session.slice(0, 5)})</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                            sess.status_session === 'Completa' ? 'bg-success/10 text-success border border-success/20' :
                            sess.status_session === 'Programada' ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20' :
                            sess.status_session === 'Cancelada' ? 'bg-danger/10 text-danger border border-danger/20' :
                            'bg-bg-secondary text-text-secondary border border-border-color'
                          }`}>
                            {sess.status_session}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted">Terapeuta: {sess.professional?.full_name || 'N/A'} • Modalidad: {sess.modality}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div className="flex items-center gap-1 text-text-secondary">
                          <DollarSign className="w-3.5 h-3.5 text-text-muted" />
                          <span>${Number(sess.value_session).toLocaleString('es-CL')}</span>
                          <span className={`ml-1.5 px-2 py-0.5 text-[9px] font-bold rounded-full ${
                            sess.status_payment === 'Pagado' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                          }`}>
                            {sess.status_payment}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted">Boleta: {sess.boleta_status}</span>
                          <Link 
                            href={`/sesiones/${sess.id}`}
                            className="bg-bg-input border border-border-color px-3 py-1.5 hover:bg-bg-card-hover text-text-primary font-bold rounded-lg transition-all"
                          >
                            Detalle SOAP & IA
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Symptomatology Evolutions */}
          {activeTab === 'sintomas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-secondary border-b border-border-color pb-1.5 flex-1">Registro de Sintomatología</h3>
                <button 
                  onClick={() => {
                    setNewSymptom({ id: '', content: '' });
                    setIsSymptomModalOpen(true);
                  }}
                  className="bg-bg-input border border-border-color hover:bg-bg-card-hover text-accent-primary font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Registro</span>
                </button>
              </div>

              {symptoms.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">No hay registros de sintomatología.</div>
              ) : (
                <div className="space-y-4">
                  {symptoms.map((symp) => (
                    <div key={symp.id} className="bg-bg-card-hover/30 border border-border-color p-4 rounded-xl space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted font-mono">Registrado el: {new Date(symp.created_at).toLocaleString('es-CL')}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setNewSymptom({ id: symp.id, content: symp.content });
                              setIsSymptomModalOpen(true);
                            }}
                            className="text-text-muted hover:text-accent-primary p-1"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSymptom(symp.id)}
                            className="text-text-muted hover:text-danger p-1"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{symp.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Epicrisis / Alta */}
          {activeTab === 'epicrisis' && (
            <form onSubmit={handleSaveEpicrisis} className="max-w-xl space-y-5">
              <div className="flex items-center gap-3 bg-warning/10 border border-warning/25 p-4 rounded-xl text-xs text-warning">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Registrar la epicrisis formalizará el término del proceso clínico y modificará el estado del paciente a <strong>Alta</strong>.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Fecha de Término / Cierre *</label>
                  <input 
                    type="date" required 
                    value={newEpicrisis.closure_date}
                    onChange={(e) => setNewEpicrisis({ ...newEpicrisis, closure_date: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Motivo de Término</label>
                  <select 
                    value={newEpicrisis.reason}
                    onChange={(e) => setNewEpicrisis({ ...newEpicrisis, reason: e.target.value })}
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                  >
                    <option value="Alta por cumplimiento de objetivos" className="bg-bg-sidebar text-text-primary">Alta por cumplimiento de objetivos</option>
                    <option value="Derivación a otro profesional" className="bg-bg-sidebar text-text-primary">Derivación a otro profesional</option>
                    <option value="Abandono del tratamiento por parte del paciente" className="bg-bg-sidebar text-text-primary">Abandono del tratamiento por parte del paciente</option>
                    <option value="Decisión de mutuo acuerdo" className="bg-bg-sidebar text-text-primary">Decisión de mutuo acuerdo</option>
                    <option value="Otro" className="bg-bg-sidebar text-text-primary">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1 font-semibold">Evaluación Final del Proceso *</label>
                <textarea 
                  rows={6} required 
                  placeholder="Resuma la evolución del paciente, logros terapéuticos y recomendaciones post-cierre..."
                  value={newEpicrisis.final_evaluation}
                  onChange={(e) => setNewEpicrisis({ ...newEpicrisis, final_evaluation: e.target.value })}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                />
              </div>

              <button 
                type="submit"
                className="bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold px-4 py-2.5 rounded-lg text-xs transition-all"
              >
                {epicrisis ? 'Actualizar Epicrisis' : 'Registrar Alta / Cierre'}
              </button>
            </form>
          )}

          {/* Tab 6: Files */}
          {activeTab === 'archivos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border-color pb-3">
                <h3 className="text-sm font-semibold text-text-primary">Expediente Documental Privado</h3>
                <label className="bg-bg-input border border-border-color hover:bg-bg-card-hover text-accent-primary font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span>Subir Archivo</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const tenantId = localStorage.getItem('active-tenant-id') || '';
                      const savedName = `vault_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
                      const storagePath = `${tenantId}/${id}/${savedName}`;

                      // Upload to Supabase Storage
                      const { error: uploadErr } = await supabase.storage
                        .from('clinical-vault')
                        .upload(storagePath, file);

                      if (uploadErr) {
                        alert('Error al subir archivo: ' + uploadErr.message);
                        return;
                      }

                      // Register in files_vault table
                      const { error: dbErr } = await supabase
                        .from('files_vault')
                        .insert({
                          organization_id: tenantId,
                          patient_id: id,
                          original_name: file.name,
                          saved_name: savedName,
                          storage_path: storagePath,
                          mime_type: file.type || 'application/octet-stream',
                          category: 'General',
                          description: '',
                        });

                      if (dbErr) {
                        alert('Error al registrar archivo: ' + dbErr.message);
                        return;
                      }
                      e.target.value = '';
                      fetchFichaData();
                    }}
                  />
                </label>
              </div>

              {files.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs">No hay archivos guardados para este paciente.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {files.map((file) => (
                    <div key={file.id} className="bg-bg-input/40 border border-border-color p-4 rounded-xl flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-semibold text-text-primary truncate">{file.original_name}</p>
                        <p className="text-[10px] text-text-muted">Categoría: {file.category} • Tipo: {file.mime_type}</p>
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
                          className="text-text-muted hover:text-accent-primary p-1"
                          title="Descargar"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            // Delete from storage
                            if (file.storage_path) {
                              await supabase.storage.from('clinical-vault').remove([file.storage_path]);
                            }
                            // Delete from database
                            const { error: delErr } = await supabase.from('files_vault').delete().eq('id', file.id);
                            if (delErr) alert(delErr.message);
                            else fetchFichaData();
                          }}
                          className="text-text-muted hover:text-danger p-1"
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

      {/* Symptomatology Modal Form */}
      {isSymptomModalOpen && (
        <div className="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border-color w-full max-w-lg rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
              <h3 className="font-bold text-text-primary">
                {newSymptom.id ? 'Editar Registro de Síntoma' : 'Agregar Evolución de Síntoma'}
              </h3>
              <button onClick={() => setIsSymptomModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-semibold">Descripción del Estado de Síntomas *</label>
                <textarea 
                  rows={5} required
                  placeholder="Detalle cambios observados en conducta, estado de ánimo, niveles de estrés, etc..."
                  value={newSymptom.content}
                  onChange={(e) => setNewSymptom({ ...newSymptom, content: e.target.value })}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-color bg-bg-input/40">
              <button 
                onClick={() => setIsSymptomModalOpen(false)}
                className="px-4 py-2 border border-border-color hover:bg-bg-card-hover text-xs font-bold rounded-lg text-text-secondary transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveSymptom}
                className="bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold px-4 py-2 rounded-lg text-xs transition-all"
              >
                Guardar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
