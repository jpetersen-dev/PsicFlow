import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, 
  BookOpen, 
  Heart, 
  Smile, 
  Frown, 
  Meh, 
  Activity, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

export default function PatientJournals() {
  const [patient, setPatient] = useState<any>(null);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('neutral');
  const [sharedWithTherapist, setSharedWithTherapist] = useState(false);

  const fetchJournals = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data: patData } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(1)
        .single();

      if (patData) {
        setPatient(patData);

        const res = await fetch(`/api/v1/booking/journals`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'x-tenant-id': patData.organization_id
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setJournals(data.journals || []);
        }
      }
    } catch (err) {
      console.error('Error fetching journals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setMood('neutral');
    setSharedWithTherapist(false);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (journal: any) => {
    setEditingId(journal.id);
    setTitle(journal.title);
    setContent(journal.content);
    setMood(journal.mood || 'neutral');
    setSharedWithTherapist(journal.shared_with_therapist);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !patient) return;
    setSaving(true);
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const method = editingId ? 'PUT' : 'POST';
      
      const payload: any = {
        title: title.trim(),
        content: content.trim(),
        mood,
        sharedWithTherapist
      };

      if (editingId) {
        payload.id = editingId;
      }

      const res = await fetch('/api/v1/booking/journals', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          'x-tenant-id': patient.organization_id
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(editingId ? '¡Bitácora actualizada!' : '¡Nueva bitácora guardada!');
        setIsFormOpen(false);
        setEditingId(null);
        setTitle('');
        setContent('');
        setMood('neutral');
        setSharedWithTherapist(false);
        fetchJournals();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        alert(data.error || 'Ocurrió un error al guardar.');
      }
    } catch (err: any) {
      alert('Error de conexión: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDel = window.confirm('¿Estás seguro de que deseas eliminar esta bitácora? Esta acción no se puede deshacer.');
    if (!confirmDel) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/v1/booking/journals?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'x-tenant-id': patient.organization_id
        }
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess('Bitácora eliminada.');
        fetchJournals();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        alert(data.error || 'Error al eliminar.');
      }
    } catch (err: any) {
      alert('Error de conexión: ' + err.message);
    }
  };

  // Get mood details
  const getMoodConfig = (val: string) => {
    switch (val) {
      case 'happy':
        return { icon: Smile, text: 'Felicidad', color: 'text-green-600 bg-green-50 border-green-200' };
      case 'peaceful':
        return { icon: Heart, text: 'Calma / Paz', color: 'text-purple-600 bg-purple-50 border-purple-200' };
      case 'neutral':
        return { icon: Meh, text: 'Neutral', color: 'text-gray-500 bg-gray-50 border-gray-200' };
      case 'anxious':
        return { icon: Activity, text: 'Ansiedad', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
      case 'sad':
        return { icon: Frown, text: 'Tristeza', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      default:
        return { icon: Meh, text: 'Neutral', color: 'text-gray-500 bg-gray-50 border-gray-200' };
    }
  };

  // Mood statistics calculation
  const moodCounts = journals.reduce((acc: Record<string, number>, j) => {
    if (j.mood) {
      acc[j.mood] = (acc[j.mood] || 0) + 1;
    }
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Cargando bitácoras...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Mis Bitácoras - Sentido Migrante</title>
      </Head>

      <div className="space-y-6 pb-12">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Inicio</span>
          </Link>
          <button 
            onClick={() => { setLoading(true); fetchJournals(); }}
            className="p-2 border border-[#E2DCD0] hover:bg-[#F9F7F3] rounded-xl transition-all text-[#78716C] cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold font-display text-[#1C1917] tracking-tight">Mis Bitácoras Personales</h1>
            <p className="text-sm text-[#78716C]">Un diario íntimo para registrar emociones y opcionalmente compartirlas con tu terapeuta.</p>
          </div>
          {!isFormOpen && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 bg-[#516750] hover:bg-[#3f513e] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Escribir Entrada</span>
            </button>
          )}
        </div>

        {success && (
          <div className="bg-[#DAEDDF] border border-[#A2BC97]/40 p-4 rounded-2xl flex items-center gap-3 text-xs text-[#1A3020] animate-fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Mood Analysis Section */}
        {journals.length > 0 && !isFormOpen && (
          <section className="bg-white border border-[#E2DCD0] rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">Monitoreo de mis Estados de Ánimo</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {['happy', 'peaceful', 'neutral', 'anxious', 'sad'].map(m => {
                const conf = getMoodConfig(m);
                const MoodIcon = conf.icon;
                const count = moodCounts[m] || 0;
                return (
                  <div key={m} className="p-3 bg-[#F9F7F3] border border-[#E2DCD0] rounded-2xl text-center space-y-1">
                    <MoodIcon className="w-5 h-5 mx-auto text-[#516750]" />
                    <p className="text-[10px] font-bold text-[#1C1917] truncate">{conf.text}</p>
                    <p className="text-sm font-bold text-[#516750]">{count} {count === 1 ? 'entrada' : 'entradas'}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Form panel */}
        {isFormOpen && (
          <form onSubmit={handleSubmit} className="bg-white border border-[#E2DCD0] rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-[#F2EFE8] pb-3">
              <h3 className="text-sm font-bold text-[#1C1917]">{editingId ? 'Editar Entrada' : 'Nueva Entrada'}</h3>
              <button 
                type="button" 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-[#F9F7F3] rounded-lg text-[#78716C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#78716C]">Título de la Bitácora</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Reflexión después de mi sesión, Tarea del día..."
                  className="w-full bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl px-4 py-2.5 text-xs text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              {/* Mood Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#78716C] block">¿Cuál es tu estado de ánimo asociado?</label>
                <div className="grid grid-cols-5 gap-2 bg-[#F9F7F3] p-1.5 border border-[#E2DCD0] rounded-2xl">
                  {['happy', 'peaceful', 'neutral', 'anxious', 'sad'].map(m => {
                    const conf = getMoodConfig(m);
                    const MoodIcon = conf.icon;
                    const isSelected = mood === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMood(m)}
                        className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-1 transition-all cursor-pointer border ${
                          isSelected ? 'bg-white text-[#1A3020] border-[#E2DCD0] shadow-sm' : 'opacity-60 border-transparent'
                        }`}
                      >
                        <MoodIcon className="w-4 h-4 text-[#516750]" />
                        <span className="text-[8px] font-bold capitalize">{conf.text.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#78716C]">Escribe tu bitácora</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Puedes escribir tus pensamientos libres, sentimientos, tareas o lo acordado con tu terapeuta..."
                  className="w-full p-4 bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl text-xs focus:outline-none focus:border-[#516750] text-[#1C1917] resize-none"
                  rows={8}
                />
              </div>

              {/* Share Toggle */}
              <div className="flex items-center justify-between p-4 bg-[#F9F7F3] border border-[#E2DCD0] rounded-2xl">
                <div className="space-y-0.5 pr-4">
                  <h4 className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
                    {sharedWithTherapist ? <Eye className="w-4 h-4 text-[#516750]" /> : <EyeOff className="w-4 h-4 text-[#78716C]" />}
                    <span>Compartir con mi Terapeuta</span>
                  </h4>
                  <p className="text-[10px] text-[#78716C]">
                    Si lo activas, tu psicólogo asignado podrá ver esta bitácora en su panel clínico de PsicFlow. Si lo apagas, será 100% privado solo para ti.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sharedWithTherapist}
                    onChange={(e) => setSharedWithTherapist(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#E2DCD0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#516750]"></div>
                </label>
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F2EFE8]">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-[#E2DCD0] hover:bg-[#F9F7F3] text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#516750] hover:bg-[#3f513e] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Guardando...' : 'Guardar Entrada'}</span>
              </button>
            </div>
          </form>
        )}

        {/* List of journals */}
        {!isFormOpen && (
          <div className="space-y-4">
            {journals.length === 0 ? (
              <div className="bg-white border border-[#E2DCD0] rounded-2xl p-12 text-center text-text-muted text-xs space-y-4">
                <p>Aún no has registrado ninguna bitácora.</p>
                <button
                  onClick={handleOpenCreate}
                  className="px-4 py-2.5 bg-[#516750] hover:bg-[#3f513e] text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Mi Primer Registro</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {journals.map(journal => {
                  const mConf = getMoodConfig(journal.mood);
                  const MoodIcon = mConf.icon;

                  return (
                    <div 
                      key={journal.id} 
                      className="bg-white border border-[#E2DCD0] rounded-2xl p-5 shadow-sm space-y-3 transition-all hover:border-[#516750]/20"
                    >
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <h3 className="font-bold text-[#1C1917] text-sm">{journal.title}</h3>
                          <p className="text-[9px] text-[#78716C]">
                            Escrito el {new Date(journal.created_at).toLocaleDateString('es-ES', {
                              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {journal.mood && (
                            <span className={`px-2 py-0.5 border rounded-lg text-[9px] font-bold capitalize flex items-center gap-1 ${mConf.color}`}>
                              <MoodIcon className="w-3.5 h-3.5" />
                              <span>{mConf.text}</span>
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                            journal.shared_with_therapist 
                              ? 'bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-0.5' 
                              : 'bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-0.5'
                          }`}>
                            {journal.shared_with_therapist ? 'Compartido' : 'Privado'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#78716C] whitespace-pre-wrap leading-relaxed font-light font-sans">
                        {journal.content}
                      </p>

                      <div className="flex justify-end gap-2 pt-2 border-t border-[#F2EFE8]">
                        <button
                          onClick={() => handleOpenEdit(journal)}
                          className="p-2 border border-[#E2DCD0] hover:bg-[#F9F7F3] text-[#516750] rounded-xl transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(journal.id)}
                          className="p-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl transition-all cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
