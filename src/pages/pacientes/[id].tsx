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

const COMMON_DIAGNOSTICS = [
  { code: 'F32.9', description: 'Trastorno depresivo no especificado' },
  { code: 'F32.1', description: 'Trastorno depresivo moderado' },
  { code: 'F41.1', description: 'Trastorno de ansiedad generalizada' },
  { code: 'F41.0', description: 'Trastorno de pánico' },
  { code: 'F43.1', description: 'Trastorno de estrés postraumático' },
  { code: 'F43.2', description: 'Trastorno de adaptación' },
  { code: 'F90.0', description: 'Trastorno de la actividad y de la atención (TDAH)' },
  { code: 'Z63.0', description: 'Problemas de relación con la pareja' },
  { code: 'F33.1', description: 'Trastorno depresivo recurrente moderado' },
  { code: 'F10.2', description: 'Síndrome de dependencia del alcohol' }
];

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
  const [epicrisisList, setEpicrisisList] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editPatient, setEditPatient] = useState<any>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Modals / Form inputs
  const [newDiag, setNewDiag] = useState({ code: '', description: '' });
  const [newSymptom, setNewSymptom] = useState({ id: '', content: '', created_at: '' });
  const [isSymptomModalOpen, setIsSymptomModalOpen] = useState(false);
  const [newEpicrisis, setNewEpicrisis] = useState({ id: '', closure_date: '', reason: 'Alta por cumplimiento de objetivos', final_evaluation: '' });
  const [isEditingEpicrisis, setIsEditingEpicrisis] = useState(false);
  const [isEpicrisisModalOpen, setIsEpicrisisModalOpen] = useState(false);

  // File Upload states
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false);
  const [fileDescription, setFileDescription] = useState('');
  const [fileCategory, setFileCategory] = useState('General');
  const [uploadingFileObject, setUploadingFileObject] = useState<File | null>(null);

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
      setEditPatient(patData);

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

      // 5. Fetch Epicrisis closures (all processes)
      const { data: epiData } = await supabase
        .from('epicrisis_records')
        .select('*')
        .eq('patient_id', id)
        .order('closure_date', { ascending: false });
      
      if (epiData) {
        setEpicrisisList(epiData);
        if (epiData[0]) {
          setEpicrisis(epiData[0]);
          setNewEpicrisis({
            id: epiData[0].id,
            closure_date: epiData[0].closure_date,
            reason: epiData[0].reason,
            final_evaluation: epiData[0].final_evaluation
          });
        } else {
          setEpicrisis(null);
          setNewEpicrisis({
            id: '',
            closure_date: '',
            reason: 'Alta por cumplimiento de objetivos',
            final_evaluation: ''
          });
        }
      } else {
        setEpicrisisList([]);
        setEpicrisis(null);
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

  const fetchAddressSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    setIsSearchingAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&countrycodes=cl&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setAddressSuggestions(data || []);
      }
    } catch (err) {
      console.error('Error fetching address suggestions:', err);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSaveAll();
  };

  const handleSaveAll = async () => {
    setSubmitting(true);
    try {
      const cleanRutStr = editPatient.rut_patient?.trim().replace(/\./g, '').replace(/ /g, '').replace(/-/g, '') || '';
      const formattedRut = cleanRutStr.length > 1 ? (cleanRutStr.slice(0, -1) + '-' + cleanRutStr.slice(-1).toUpperCase()) : editPatient.rut_patient;

      const { error: updErr } = await supabase
        .from('patients')
        .update({
          full_name: editPatient.full_name,
          birth_date: editPatient.birth_date,
          rut_patient: formattedRut,
          gender: editPatient.gender,
          marital_status: editPatient.marital_status,
          occupation: editPatient.occupation,
          health_system: editPatient.health_system,
          education_level: editPatient.education_level,
          education_status: editPatient.education_status,
          education_institution: editPatient.education_institution,
          nacionalidad: editPatient.nacionalidad,
          pais_origen: editPatient.pais_origen,
          phone: editPatient.phone,
          email: editPatient.email,
          address: editPatient.address,
          comuna: editPatient.comuna,
          region: editPatient.region,
          emergency_contact_name: editPatient.emergency_contact_name,
          emergency_contact_relationship: editPatient.emergency_contact_relationship,
          emergency_contact_phone: editPatient.emergency_contact_phone,
          emergency_contact_email: editPatient.emergency_contact_email,
          en_observacion: editPatient.en_observacion,
          observacion_comentario: editPatient.observacion_comentario,
          observaciones_generales: editPatient.observaciones_generales
        })
        .eq('id', id);
      
      if (updErr) throw updErr;

      if (clinicalRecord) {
        const { error: recErr } = await supabase
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

        if (recErr) throw recErr;
      }

      alert('Cambios guardados con éxito.');
      setIsEditing(false);
      fetchFichaData();
    } catch (err: any) {
      alert('Error al guardar cambios: ' + err.message);
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
      const formattedDate = newSymptom.created_at ? new Date(newSymptom.created_at).toISOString() : new Date().toISOString();
      if (newSymptom.id) {
        // Edit mode
        const { error: err } = await supabase
          .from('sintomatologia_records')
          .update({ 
            content: newSymptom.content,
            created_at: formattedDate
          })
          .eq('id', newSymptom.id);
        if (err) throw err;
      } else {
        // Create mode
        const { error: err } = await supabase
          .from('sintomatologia_records')
          .insert({
            patient_id: id,
            content: newSymptom.content,
            created_at: formattedDate
          });
        if (err) throw err;
      }
      setIsSymptomModalOpen(false);
      setNewSymptom({ id: '', content: '', created_at: '' });
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
      setIsEpicrisisModalOpen(false);
      fetchFichaData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteEpicrisis = async (epicrisisId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro de epicrisis?')) return;
    try {
      const { error: err } = await supabase
        .from('epicrisis_records')
        .delete()
        .eq('id', epicrisisId);
      if (err) throw err;
      alert('Epicrisis eliminada con éxito.');
      fetchFichaData();
    } catch (err: any) {
      alert('Error al eliminar epicrisis: ' + err.message);
    }
  };

  const handleReopenProcess = async (epicrisisId: string) => {
    if (!confirm('¿Estás seguro de que deseas reabrir el proceso clínico de este paciente? Esto cambiará su estado a Activo.')) return;
    try {
      const { error: updErr } = await supabase
        .from('patients')
        .update({ status: 'activo' })
        .eq('id', id);
      if (updErr) throw updErr;

      alert('Proceso clínico reabierto con éxito. El paciente vuelve a estar Activo.');
      fetchFichaData();
    } catch (err: any) {
      alert('Error al reabrir proceso: ' + err.message);
    }
  };

  if (loading) return <div className="py-20 text-center text-text-muted text-sm">Cargando Ficha Clínica...</div>;
  if (error) return <div className="py-12 bg-danger/10 border border-danger/20 text-danger p-6 rounded-xl text-center">{error}</div>;

  return (
    <>
      <Head>
        <title>PsicFlow - Ficha de {patient?.full_name}</title>
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
          <div className="flex gap-2">
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)} 
                className="px-4 py-2 bg-accent-primary hover:bg-accent-hover text-bg-primary rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Editar Ficha
              </button>
            ) : (
              <>
                <button 
                  onClick={handleSaveAll} 
                  disabled={submitting}
                  className="px-4 py-2 bg-success text-white hover:bg-success/90 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  {submitting ? 'Guardando...' : 'Guardar Todo'}
                </button>
                <button 
                  onClick={() => {
                    setEditPatient(patient);
                    setIsEditing(false);
                  }} 
                  className="px-4 py-2 border border-border-color hover:bg-bg-card-hover rounded-lg text-xs font-semibold text-text-primary transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </>
            )}
            <button 
              onClick={() => router.push('/pacientes')} 
              className="px-4 py-2 border border-border-color hover:bg-bg-card-hover rounded-lg text-xs font-semibold text-text-primary transition-all cursor-pointer"
            >
              Volver a CRM
            </button>
          </div>
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
            isEditing ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Datos Personales */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border-color pb-1.5 flex items-center gap-2">
                      <User className="w-4 h-4 text-accent-primary" />
                      <span>Editar Información Personal</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Sexo/Género</label>
                        <select 
                          value={editPatient.gender || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, gender: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        >
                          <option value="">No especificado</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Masculino">Masculino</option>
                          <option value="No binario">No binario</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Estado Civil</label>
                        <select 
                          value={editPatient.marital_status || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, marital_status: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        >
                          <option value="">No especificado</option>
                          <option value="Soltero/a">Soltero/a</option>
                          <option value="Casado/a">Casado/a</option>
                          <option value="Divorciado/a">Divorciado/a</option>
                          <option value="Viudo/a">Viudo/a</option>
                          <option value="Conviviente Civil">Conviviente Civil</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Ocupación</label>
                        <input 
                          type="text"
                          value={editPatient.occupation || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, occupation: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Sistema de Salud</label>
                        <select 
                          value={editPatient.health_system || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, health_system: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        >
                          <option value="">No especificado</option>
                          <option value="Fonasa">Fonasa</option>
                          <option value="Isapre">Isapre</option>
                          <option value="Particular">Particular</option>
                          <option value="Dipreca/Capredena">Dipreca/Capredena</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Nivel Educacional</label>
                        <select 
                          value={editPatient.education_level || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, education_level: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        >
                          <option value="Pre-básica">Pre-básica</option>
                          <option value="Diferencial">Diferencial</option>
                          <option value="Básica">Básica</option>
                          <option value="Media">Media</option>
                          <option value="Técnico">Técnico</option>
                          <option value="Superior">Superior</option>
                          <option value="Posgrado">Posgrado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Curso / Estado Educacional</label>
                        <select 
                          value={editPatient.education_status || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, education_status: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        >
                          <option value="Sala Cuna">Sala Cuna</option>
                          <option value="Jardín Infantil">Jardín Infantil</option>
                          <option value="Pre-Kinder (NT1)">Pre-Kinder (NT1)</option>
                          <option value="Kinder (NT2)">Kinder (NT2)</option>
                          <option value="Primero Básico">Primero Básico</option>
                          <option value="Segundo Básico">Segundo Básico</option>
                          <option value="Tercero Básico">Tercero Básico</option>
                          <option value="Cuarto Básico">Cuarto Básico</option>
                          <option value="Quinto Básico">Quinto Básico</option>
                          <option value="Sexto Básico">Sexto Básico</option>
                          <option value="Séptimo Básico">Séptimo Básico</option>
                          <option value="Octavo Básico">Octavo Básico</option>
                          <option value="Primero Medio">Primero Medio</option>
                          <option value="Segundo Medio">Segundo Medio</option>
                          <option value="Tercero Medio">Tercero Medio</option>
                          <option value="Cuarto Medio">Cuarto Medio</option>
                          <option value="Superior En curso">Superior En curso</option>
                          <option value="Superior Incompleto">Superior Incompleto</option>
                          <option value="Superior Completo">Superior Completo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Nacionalidad</label>
                        <input 
                          type="text"
                          value={editPatient.nacionalidad || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, nacionalidad: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">País de Origen</label>
                        <input 
                          type="text"
                          value={editPatient.pais_origen || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, pais_origen: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="relative inline-flex items-center cursor-pointer gap-2">
                        <input 
                          type="checkbox" 
                          checked={editPatient.en_observacion || false}
                          onChange={(e) => setEditPatient({ ...editPatient, en_observacion: e.target.checked })}
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-warning"></div>
                        <span className="text-xs font-semibold text-text-primary cursor-pointer">Paciente en Observación Especial</span>
                      </label>
                    </div>

                    {editPatient.en_observacion && (
                      <div className="space-y-1 mt-2">
                        <label className="block text-xs text-text-secondary mb-1 font-semibold text-warning">Motivo / Comentario de Observación *</label>
                        <input 
                          type="text" required
                          value={editPatient.observacion_comentario || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, observacion_comentario: e.target.value })}
                          placeholder="Indique el motivo de la observación..."
                          className="w-full bg-bg-input border border-warning/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Ubicación y Contacto */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border-color pb-1.5 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-accent-primary" />
                      <span>Editar Ubicación y Contacto</span>
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Teléfono Celular</label>
                        <input 
                          type="text"
                          value={editPatient.phone || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, phone: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Correo Electrónico</label>
                        <input 
                          type="email"
                          value={editPatient.email || ''}
                          onChange={(e) => setEditPatient({ ...editPatient, email: e.target.value })}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                        />
                      </div>
                      <div className="relative">
                        <label className="block text-xs text-text-secondary mb-1 font-semibold">Dirección (Calle y Número)</label>
                        <input 
                          type="text"
                          value={editPatient.address || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditPatient({ ...editPatient, address: val });
                            fetchAddressSuggestions(val);
                          }}
                          className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                          placeholder="Ej. Providencia 1234"
                        />
                        {isSearchingAddress && <p className="text-[10px] text-text-muted mt-1">Buscando dirección...</p>}
                        {addressSuggestions.length > 0 && (
                          <div className="absolute z-10 bg-bg-card border border-border-color rounded-lg mt-1 w-full max-h-40 overflow-y-auto shadow-lg text-xs">
                            {addressSuggestions.map((sug: any, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  const addressStr = sug.address?.road ? 
                                    `${sug.address.road}${sug.address.house_number ? ' ' + sug.address.house_number : ''}` : sug.display_name.split(',')[0];
                                  const comuna = sug.address?.city || sug.address?.town || sug.address?.suburb || sug.address?.municipality || '';
                                  const region = sug.address?.state || sug.address?.region || '';
                                  setEditPatient({
                                    ...editPatient,
                                    address: addressStr,
                                    comuna: comuna,
                                    region: region
                                  });
                                  setAddressSuggestions([]);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-bg-card-hover text-text-primary border-b last:border-0 border-border-color cursor-pointer"
                              >
                                {sug.display_name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-text-secondary mb-1 font-semibold">Comuna</label>
                          <input 
                            type="text"
                            value={editPatient.comuna || ''}
                            onChange={(e) => setEditPatient({ ...editPatient, comuna: e.target.value })}
                            className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-secondary mb-1 font-semibold">Región</label>
                          <input 
                            type="text"
                            value={editPatient.region || ''}
                            onChange={(e) => setEditPatient({ ...editPatient, region: e.target.value })}
                            className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contacto de Emergencia */}
                <div className="border-t border-border-color pt-6">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
                    <AlertOctagon className="w-4 h-4 text-danger" />
                    <span>Contacto de Emergencia</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1 font-semibold">Nombre Completo</label>
                      <input 
                        type="text"
                        value={editPatient.emergency_contact_name || ''}
                        onChange={(e) => setEditPatient({ ...editPatient, emergency_contact_name: e.target.value })}
                        className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1 font-semibold">Relación / Parentesco</label>
                      <input 
                        type="text"
                        value={editPatient.emergency_contact_relationship || ''}
                        onChange={(e) => setEditPatient({ ...editPatient, emergency_contact_relationship: e.target.value })}
                        className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1 font-semibold">Teléfono Celular</label>
                      <input 
                        type="text"
                        value={editPatient.emergency_contact_phone || ''}
                        onChange={(e) => setEditPatient({ ...editPatient, emergency_contact_phone: e.target.value })}
                        className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1 font-semibold">Correo Electrónico</label>
                      <input 
                        type="email"
                        value={editPatient.emergency_contact_email || ''}
                        onChange={(e) => setEditPatient({ ...editPatient, emergency_contact_email: e.target.value })}
                        className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Observaciones generales */}
                <div className="border-t border-border-color pt-6">
                  <label className="block text-xs text-text-secondary mb-1 font-semibold">Observaciones Generales (Datos Demográficos)</label>
                  <textarea 
                    rows={3}
                    value={editPatient.observaciones_generales || ''}
                    onChange={(e) => setEditPatient({ ...editPatient, observaciones_generales: e.target.value })}
                    placeholder="Ingrese observaciones generales..."
                    className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none resize-y"
                  />
                </div>
              </div>
            ) : (
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
                      <div>
                        <p className="text-text-muted text-xs">Nacionalidad</p>
                        <p className="text-text-secondary font-medium">{patient.nacionalidad || 'Chilena'}</p>
                      </div>
                      <div>
                        <p className="text-text-muted text-xs">País de origen</p>
                        <p className="text-text-secondary font-medium">{patient.pais_origen || 'Chile'}</p>
                      </div>
                    </div>

                    {patient.en_observacion && (
                      <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs">
                        <p className="font-bold text-warning flex items-center gap-1.5">
                          <AlertOctagon className="w-4 h-4 animate-pulse" />
                          <span>Paciente en Observación</span>
                        </p>
                        <p className="text-text-secondary mt-1 font-medium">{patient.observacion_comentario || 'Sin comentario detallado'}</p>
                      </div>
                    )}
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
                  <div className="bg-bg-input/40 border border-border-color p-4 rounded-xl space-y-3 text-sm mb-6">
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

                  {patient.observaciones_generales && (
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary border-b border-border-color pb-1.5 mb-3">
                        <span>Observaciones Generales</span>
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed bg-bg-input/30 p-3 rounded-lg border border-border-color whitespace-pre-wrap">{patient.observaciones_generales}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* Tab 2: Plan Terapéutico & Diagnostics */}
          {activeTab === 'plan' && clinicalRecord && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {isEditing ? (
                <form onSubmit={handleUpdateRecord} className="lg:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Objetivo General del Proceso</label>
                    <textarea 
                      rows={3} name="objetivo_general" 
                      value={clinicalRecord.objetivo_general || ''} 
                      onChange={(e) => setClinicalRecord({ ...clinicalRecord, objetivo_general: e.target.value })}
                      placeholder="Ingrese los objetivos terapéuticos..."
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none resize-y"
                    />
                  </div>

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
                  </div>

                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Motivo de Consulta</label>
                    <textarea 
                      rows={3} name="motivo_consulta" 
                      value={clinicalRecord.motivo_consulta || ''} 
                      onChange={(e) => setClinicalRecord({ ...clinicalRecord, motivo_consulta: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none resize-y"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Antecedentes Relevantes</label>
                    <textarea 
                      rows={3} name="antecedentes_relevantes" 
                      value={clinicalRecord.antecedentes_relevantes || ''} 
                      onChange={(e) => setClinicalRecord({ ...clinicalRecord, antecedentes_relevantes: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none resize-y"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Conceptualización / Formulación del Caso</label>
                    <textarea 
                      rows={4} name="formulacion_caso" 
                      value={clinicalRecord.formulacion_caso || ''} 
                      onChange={(e) => setClinicalRecord({ ...clinicalRecord, formulacion_caso: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none resize-y"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-secondary mb-1 font-semibold">Observaciones Generales</label>
                    <textarea 
                      rows={2} name="observaciones_generales" 
                      value={clinicalRecord.observaciones_generales || ''} 
                      onChange={(e) => setClinicalRecord({ ...clinicalRecord, observaciones_generales: e.target.value })}
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none resize-y"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="submit" disabled={submitting}
                      className="bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-bg-primary font-bold px-4 py-2.5 rounded-lg text-xs transition-all cursor-pointer"
                    >
                      {submitting ? 'Guardando...' : 'Guardar Plan Clínico'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="lg:col-span-2 space-y-6 text-sm">
                  <div>
                    <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Objetivo General del Proceso</p>
                    <p className="text-text-primary font-medium mt-1 whitespace-pre-wrap bg-bg-input/20 p-3 rounded-lg border border-border-color">
                      {clinicalRecord.objetivo_general || 'No registrado'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-text-muted text-xs font-semibold">Enfoque Teórico</p>
                      <p className="text-text-secondary font-medium mt-0.5">{clinicalRecord.enfoque_teorico || 'No registrado'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-text-muted text-xs font-semibold">Motivo de Consulta</p>
                    <p className="text-text-secondary mt-1 whitespace-pre-wrap bg-bg-input/10 p-3 rounded-lg border border-border-color">
                      {clinicalRecord.motivo_consulta || 'No registrado'}
                    </p>
                  </div>

                  <div>
                    <p className="text-text-muted text-xs font-semibold">Antecedentes Relevantes</p>
                    <p className="text-text-secondary mt-1 whitespace-pre-wrap bg-bg-input/10 p-3 rounded-lg border border-border-color">
                      {clinicalRecord.antecedentes_relevantes || 'No registrado'}
                    </p>
                  </div>

                  <div>
                    <p className="text-text-muted text-xs font-semibold">Conceptualización / Formulación del Caso</p>
                    <p className="text-text-secondary mt-1 whitespace-pre-wrap bg-bg-input/10 p-3 rounded-lg border border-border-color">
                      {clinicalRecord.formulacion_caso || 'No registrado'}
                    </p>
                  </div>

                  <div>
                    <p className="text-text-muted text-xs font-semibold">Observaciones Generales</p>
                    <p className="text-text-secondary mt-1 whitespace-pre-wrap bg-bg-input/10 p-3 rounded-lg border border-border-color">
                      {clinicalRecord.observaciones_generales || 'No registrado'}
                    </p>
                  </div>
                </div>
              )}

              {/* Table of CIE-10/DSM-5 Diagnostics */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary border-b border-border-color pb-1.5">Diagnósticos Clínicos (CIE-10 / DSM-5)</h3>
                
                {/* Add Diagnosis inline form */}
                {isEditing && (
                  <div className="bg-bg-input/40 p-4 rounded-xl border border-border-color space-y-3">
                    <div>
                      <label className="block text-xs text-text-secondary mb-1 font-semibold">Seleccionar Diagnóstico Frecuente</label>
                      <select
                        onChange={(e) => {
                          const selected = COMMON_DIAGNOSTICS.find(d => d.code === e.target.value);
                          if (selected) {
                            setNewDiag({ code: selected.code, description: selected.description });
                          } else {
                            setNewDiag({ code: '', description: '' });
                          }
                        }}
                        value={newDiag.code}
                        className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Seleccionar Diagnóstico --</option>
                        {COMMON_DIAGNOSTICS.map(diag => (
                          <option key={diag.code} value={diag.code}>
                            {diag.code} - {diag.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    {newDiag.code && (
                      <div className="grid grid-cols-3 gap-2">
                        <input 
                          type="text" readOnly
                          value={newDiag.code} 
                          className="bg-bg-input border border-border-color rounded px-2 py-1.5 text-xs text-text-muted focus:outline-none cursor-not-allowed"
                        />
                        <input 
                          type="text" readOnly
                          value={newDiag.description} 
                          className="col-span-2 bg-bg-input border border-border-color rounded px-2 py-1.5 text-xs text-text-muted focus:outline-none cursor-not-allowed"
                        />
                      </div>
                    )}
                    <button 
                      type="button" onClick={handleAddDiagnostic}
                      disabled={!newDiag.code}
                      className="w-full bg-bg-input hover:bg-bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-primary border border-border-color font-bold py-1.5 rounded text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar Diagnóstico</span>
                    </button>
                  </div>
                )}

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
                          <p className="text-[10px] text-text-muted pt-1">
                            Fecha de asignación: {diag.created_at ? new Date(diag.created_at).toLocaleDateString('es-CL') : 'N/A'}
                          </p>
                        </div>
                        {isEditing && (
                          <button 
                            onClick={() => handleDeleteDiagnostic(diag.id)}
                            className="text-text-muted hover:text-danger p-1 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.user?.id) {
                      alert('No se detectó una sesión activa.');
                      return;
                    }
                    const { data: profs } = await supabase
                      .from('profiles')
                      .select('id')
                      .eq('user_id', session.user.id)
                      .eq('organization_id', tenantId)
                      .limit(1);
                    if (!profs || profs.length === 0) {
                      alert('No se encontró un perfil profesional para asociar a esta clínica.');
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
                    setNewSymptom({ id: '', content: '', created_at: new Date().toISOString().split('T')[0] });
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
                              setNewSymptom({ id: symp.id, content: symp.content, created_at: new Date(symp.created_at).toISOString().split('T')[0] });
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
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-border-color pb-3">
                <h3 className="text-sm font-semibold text-text-primary">Historial de Epicrisis y Cierres</h3>
                {patient.status !== 'alta' && (
                  <button
                    onClick={() => {
                      setNewEpicrisis({ id: '', closure_date: new Date().toISOString().split('T')[0], reason: 'Alta por cumplimiento de objetivos', final_evaluation: '' });
                      setIsEditingEpicrisis(false);
                      setIsEpicrisisModalOpen(true);
                    }}
                    className="bg-bg-input border border-border-color hover:bg-bg-card-hover text-accent-primary font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registrar Alta / Cierre</span>
                  </button>
                )}
              </div>

              {epicrisisList.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-xs bg-bg-input/10 border border-border-color rounded-xl">
                  No hay cierres o epicrisis registradas para este paciente. El proceso clínico está activo.
                </div>
              ) : (
                <div className="space-y-4">
                  {epicrisisList.map((epi) => (
                    <div key={epi.id} className="bg-bg-card-hover/20 border border-border-color p-5 rounded-xl space-y-4 relative">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-border-color pb-2 text-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-text-primary">
                            Fecha de Término: <span className="font-mono text-accent-primary">{epi.closure_date}</span>
                          </p>
                          <p className="text-text-secondary font-medium">
                            Motivo: <span className="text-text-primary">{epi.reason}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setNewEpicrisis({
                                id: epi.id,
                                closure_date: epi.closure_date,
                                reason: epi.reason,
                                final_evaluation: epi.final_evaluation
                              });
                              setIsEditingEpicrisis(true);
                              setIsEpicrisisModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-bg-input border border-border-color text-text-primary hover:bg-bg-card-hover rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                          
                          {patient.status === 'alta' && epicrisisList[0]?.id === epi.id && (
                            <button
                              onClick={() => handleReopenProcess(epi.id)}
                              className="px-2.5 py-1.5 bg-success/15 border border-success/30 text-success hover:bg-success/25 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <span>Reabrir Proceso</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteEpicrisis(epi.id)}
                            className="p-1.5 bg-danger/10 border border-danger/20 hover:bg-danger/25 text-danger rounded-lg transition-all cursor-pointer"
                            title="Eliminar Epicrisis"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-text-secondary leading-relaxed space-y-1">
                        <p className="font-semibold text-text-primary">Evaluación Final:</p>
                        <p className="bg-bg-input/20 border border-border-color p-3 rounded-lg whitespace-pre-wrap font-medium">
                          {epi.final_evaluation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 6: Files */}
          {activeTab === 'archivos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border-color pb-3">
                <h3 className="text-sm font-semibold text-text-primary">Expediente Documental Privado</h3>
                <div>
                  <button
                    onClick={() => {
                      const input = document.getElementById('patient-file-input');
                      if (input) input.click();
                    }}
                    className="bg-bg-input border border-border-color hover:bg-bg-card-hover text-accent-primary font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Subir Archivo</span>
                  </button>
                  <input
                    id="patient-file-input"
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
                <label className="block text-xs text-text-secondary mb-1 font-semibold">Fecha del Registro (Editable para Retroactivos) *</label>
                <input 
                  type="date" required
                  value={newSymptom.created_at || ''}
                  onChange={(e) => setNewSymptom({ ...newSymptom, created_at: e.target.value })}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none"
                />
              </div>
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

      {/* File Upload Modal */}
      {isAddFileModalOpen && uploadingFileObject && (
        <div className="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border-color w-full max-w-lg rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
              <h3 className="font-bold text-text-primary">Subir Documento al Expediente</h3>
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
                  <option value="Consentimiento">Consentimiento</option>
                  <option value="Evaluación">Evaluación</option>
                  <option value="Derivación">Derivación</option>
                  <option value="Informe">Informe</option>
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
                    const storagePath = `${tenantId}/${id}/${savedName}`;

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
                        patient_id: id,
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
                    fetchFichaData();
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

      {/* Epicrisis Modal Form */}
      {isEpicrisisModalOpen && (
        <div className="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border-color w-full max-w-lg rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
              <h3 className="font-bold text-text-primary">
                {isEditingEpicrisis ? 'Editar Registro de Epicrisis' : 'Registrar Alta / Epicrisis'}
              </h3>
              <button onClick={() => setIsEpicrisisModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEpicrisis}>
              <div className="p-6 space-y-4">
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
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none cursor-pointer"
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
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-color bg-bg-input/40">
                <button 
                  type="button"
                  onClick={() => setIsEpicrisisModalOpen(false)}
                  className="px-4 py-2 border border-border-color hover:bg-bg-card-hover text-xs font-bold rounded-lg text-text-secondary transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer"
                >
                  Guardar Epicrisis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
