import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  User, 
  ArrowRight, 
  Video, 
  FileText, 
  Download, 
  MessageSquare, 
  Sparkles,
  Heart,
  Smile,
  Frown,
  Meh,
  Activity,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function PatientPortalHome() {
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Dashboard States
  const [recentResources, setRecentResources] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [moodText, setMoodText] = useState<string>('');
  const [moodSaving, setMoodSaving] = useState(false);
  const [moodSaved, setMoodSaved] = useState(false);

  const getLandingUrl = (path: string = '') => {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || (isLocal ? 'http://localhost:3000' : 'https://sentidomigrante.com');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${landingUrl}${cleanPath}`;
  };

  const fetchPortalData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      // Fetch patient profile
      const { data: patData, error: patErr } = await supabase
        .from('patients')
        .select('*, organizations (name)')
        .eq('user_id', session.user.id)
        .limit(1)
        .single();

      if (patErr || !patData) {
        console.error('Error fetching patient profile:', patErr);
        setLoading(false);
        return;
      }
      setPatient(patData);

      // Fetch patient sessions (upcoming ones first)
      const { data: sessData, error: sessErr } = await supabase
        .from('sessions')
        .select('*, professional:professional_id (full_name, specialization, timezone), service:service_id (id_slug, title, duration_minutes)')
        .eq('patient_id', patData.id)
        .order('date_session', { ascending: true });

      if (!sessErr && sessData) {
        setSessions(sessData);
      }

      // Fetch recent shared resources (limit 2)
      const { data: filesData } = await supabase
        .from('files_vault')
        .select('*')
        .or(`patient_id.eq.${patData.id},patient_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(2);
      if (filesData) {
        setRecentResources(filesData);
      }

      // Fetch unread message count
      const { count } = await supabase
        .from('patient_messages')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patData.id)
        .eq('sender', 'therapist')
        .eq('read', false);
      setUnreadCount(count || 0);

    } catch (err) {
      console.error('Unexpected error in patient portal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  const handleQuickMoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMood || !patient) return;
    setMoodSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/v1/booking/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          'x-tenant-id': patient.organization_id
        },
        body: JSON.stringify({
          title: `Registro Rápido: Estado de Ánimo`,
          content: moodText.trim() || `Registré mi estado de ánimo del día como: ${selectedMood}.`,
          mood: selectedMood,
          sharedWithTherapist: false
        })
      });

      if (res.ok) {
        setMoodSaved(true);
        setMoodText('');
        setSelectedMood('');
        setTimeout(() => setMoodSaved(false), 3000);
      }
    } catch (err) {
      console.error('Error saving quick mood:', err);
    } finally {
      setMoodSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Cargando tu portal personal...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <h2 className="text-xl font-bold text-[#1C1917]">No se encontró registro de paciente</h2>
        <p className="text-sm text-[#78716C]">Tu usuario no está asociado a una ficha de paciente activa. Por favor contacta al administrador de la clínica.</p>
      </div>
    );
  }

  // Filter sessions: upcoming vs past
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const upcomingSessions = sessions.filter(s => {
    return s.date_session >= todayStr && s.status_session !== 'Cancelada';
  });

  const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

  return (
    <>
      <Head>
        <title>Mi Portal - Sentido Migrante</title>
      </Head>

      <div className="space-y-8 pb-12">
        {/* Welcome Banner - Premium Forest Gradient */}
        <div className="bg-gradient-to-br from-[#1A3020] to-[#516750] text-white rounded-3xl p-8 md:p-10 shadow-lg relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12">
            <Calendar size={300} />
          </div>
          <div className="relative z-10 max-w-xl space-y-3">
            <span className="text-xs uppercase tracking-widest font-bold bg-white/20 px-3 py-1 rounded-full inline-block">
              Portal del Paciente
            </span>
            <h1 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              ¡Hola, {patient.full_name.split(' ')[0]}!
            </h1>
            <p className="text-sm text-white/90 leading-relaxed font-light">
              Bienvenido a tu espacio terapéutico en {patient.organizations?.name || 'Sentido Migrante'}. Aquí tienes acceso seguro e integral a tus citas, bitácoras y recursos clínicos.
            </p>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* 1. Proxima Cita Section (7/12) */}
          <section className="col-span-12 lg:col-span-7 bg-white rounded-3xl p-6 border border-[#F2EFE8] shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-[#1C1917] font-display flex items-center gap-2 border-b border-[#F2EFE8] pb-3 uppercase tracking-wider text-text-muted">
                <Calendar className="w-4 h-4 text-[#516750]" />
                <span>Próxima Sesión Programada</span>
              </h2>

              {nextSession ? (
                <div className="bg-[#F9F7F3] rounded-2xl p-6 border border-[#F2EFE8] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        nextSession.status_payment === 'Pagado' 
                          ? 'bg-[#DAEDDF] text-[#1A3020]' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {nextSession.status_payment === 'Pagado' 
                          ? 'Confirmada' 
                          : (nextSession.service?.id_slug === 'entrevista-orientacion-psicologica-online' || Number(nextSession.value_session) === 0)
                            ? 'Pendiente de Confirmación' 
                            : 'Pendiente de Pago'}
                      </span>
                      <span className="bg-[#DAEDDF] text-[#1A3020] px-2.5 py-0.5 rounded text-[10px] font-bold">
                        Online (Videollamada)
                      </span>
                    </div>
 
                    <h3 className="font-bold text-[#1C1917] text-base">
                      Terapeuta: {nextSession.professional?.full_name || 'Psicólogo'}
                    </h3>
                    <p className="text-xs text-[#78716C]">
                      {nextSession.professional?.specialization || 'Psicoterapeuta'}
                    </p>
 
                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#78716C] mt-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#516750]" />
                        {nextSession.date_session}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#516750]" />
                        {nextSession.time_session.substring(0, 5)} ({nextSession.professional?.timezone || 'GMT-4'})
                      </span>
                    </div>
                  </div>
 
                  <div className="w-full md:w-auto">
                    {nextSession.status_payment === 'Pagado' ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          alert('El enlace de videollamada estará activo 5 minutos antes de la sesión.');
                        }}
                        className="w-full md:w-auto px-5 py-3 bg-[#516750] hover:bg-[#3f513e] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                        <span>Entrar a Videollamada</span>
                      </a>
                    ) : (
                      (nextSession.service?.id_slug === 'entrevista-orientacion-psicologica-online' || Number(nextSession.value_session) === 0) ? (
                        <div className="text-center space-y-2">
                          <p className="text-[11px] text-[#78716C] font-medium">Confirma tu correo para asegurar tu bloque horario.</p>
                          <a
                            href={getLandingUrl(`/confirmar-cita?ref=${nextSession.transaction_id}`)}
                            className="w-full md:w-auto px-5 py-3 bg-[#1A3020] hover:bg-[#2c4f35] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirmar Cita</span>
                          </a>
                        </div>
                      ) : (
                        <div className="text-center space-y-2">
                          <p className="text-[11px] text-[#78716C] font-medium">Por favor completa el pago de tu cita para confirmar.</p>
                          <Link
                            href="/sesiones"
                            className="w-full md:w-auto px-5 py-3 bg-[#1A3020] hover:bg-[#2c4f35] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                          >
                            Pagar Sesión
                          </Link>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center bg-[#F9F7F3] rounded-2xl border border-[#F2EFE8] space-y-4">
                  <p className="text-sm text-[#78716C]">No tienes próximas sesiones programadas.</p>
                  <Link
                    href="/agendar"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#516750] hover:bg-[#3f513e] text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
                  >
                    <span>Agendar Nueva Hora</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {nextSession && (
              <div className="text-right mt-4 pt-4 border-t border-[#F2EFE8]">
                <Link href="/sesiones" className="text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors flex items-center justify-end gap-1">
                  <span>Ver todas mis citas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </section>

          {/* 2. Mood Check-in Widget (5/12) */}
          <section className="col-span-12 lg:col-span-5 bg-white rounded-3xl p-6 border border-[#F2EFE8] shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#1C1917] font-display flex items-center gap-2 border-b border-[#F2EFE8] pb-3 uppercase tracking-wider text-text-muted">
              <Heart className="w-4 h-4 text-[#516750]" />
              <span>¿Cómo te sientes hoy?</span>
            </h2>

            {moodSaved ? (
              <div className="bg-[#DAEDDF] border border-[#A2BC97]/40 p-4 rounded-2xl flex items-center gap-3 text-xs text-[#1A3020] h-[150px] justify-center flex-col text-center">
                <CheckCircle2 className="w-6 h-6 text-[#516750] shrink-0" />
                <span>¡Bitácora rápida guardada con éxito!</span>
              </div>
            ) : (
              <form onSubmit={handleQuickMoodSubmit} className="space-y-3">
                <div className="flex justify-around items-center p-2 bg-[#F9F7F3] rounded-2xl border border-[#F2EFE8]">
                  {[
                    { val: 'happy', icon: Smile, color: 'text-green-600 hover:bg-green-50' },
                    { val: 'peaceful', icon: Heart, color: 'text-purple-600 hover:bg-purple-50' },
                    { val: 'neutral', icon: Meh, color: 'text-gray-500 hover:bg-gray-50' },
                    { val: 'anxious', icon: Activity, color: 'text-yellow-600 hover:bg-yellow-50' },
                    { val: 'sad', icon: Frown, color: 'text-blue-600 hover:bg-blue-50' }
                  ].map(m => {
                    const Icon = m.icon;
                    const isSelected = selectedMood === m.val;
                    return (
                      <button
                        key={m.val}
                        type="button"
                        onClick={() => setSelectedMood(m.val)}
                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                          isSelected ? 'bg-[#DAEDDF] scale-110 shadow-sm border border-[#516750]/20' : 'opacity-70'
                        } ${m.color}`}
                        title={m.val}
                      >
                        <Icon className="w-6 h-6" />
                      </button>
                    );
                  })}
                </div>

                {selectedMood && (
                  <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <textarea
                      value={moodText}
                      onChange={(e) => setMoodText(e.target.value)}
                      placeholder="Escribe una pequeña reflexión sobre cómo te sientes..."
                      className="w-full p-3 bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl text-xs focus:outline-none focus:border-[#516750] text-[#1C1917] resize-none"
                      rows={2}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-text-muted">Se guardará en tus bitácoras personales</span>
                      <button
                        type="submit"
                        disabled={moodSaving}
                        className="px-4 py-2 bg-[#516750] hover:bg-[#3f513e] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        {moodSaving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </section>

          {/* 3. Recent Shared Resources (6/12) */}
          <section className="col-span-12 md:col-span-6 bg-white rounded-3xl p-6 border border-[#F2EFE8] shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-[#1C1917] font-display flex items-center gap-2 border-b border-[#F2EFE8] pb-3 uppercase tracking-wider text-text-muted">
                <FileText className="w-4 h-4 text-[#516750]" />
                <span>Biblioteca y Recursos</span>
              </h2>

              {recentResources.length === 0 ? (
                <div className="py-8 text-center text-text-muted text-xs bg-[#F9F7F3] rounded-2xl border border-[#F2EFE8]">
                  No se han subido guías o recursos clínicos aún.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentResources.map(file => (
                    <div key={file.id} className="p-3 bg-[#F9F7F3] rounded-xl border border-[#F2EFE8] flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#1C1917] truncate">{file.original_name}</p>
                        <p className="text-[9px] text-[#78716C] capitalize">{file.category} • {file.mime_type.split('/')[1] || 'Archivo'}</p>
                      </div>
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
                        className="p-2 hover:bg-[#DAEDDF] rounded-lg text-[#516750] transition-colors cursor-pointer"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-right mt-4 pt-4 border-t border-[#F2EFE8]">
              <Link href="/recursos" className="text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors flex items-center justify-end gap-1">
                <span>Ver todos los recursos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* 4. Support & Messaging Channel (6/12) */}
          <section className="col-span-12 md:col-span-6 bg-white rounded-3xl p-6 border border-[#F2EFE8] shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-[#1C1917] font-display flex items-center gap-2 border-b border-[#F2EFE8] pb-3 uppercase tracking-wider text-text-muted">
                <MessageSquare className="w-4 h-4 text-[#516750]" />
                <span>Mensajes con mi Terapeuta</span>
              </h2>

              <div className="p-4 bg-[#F9F7F3] rounded-2xl border border-[#F2EFE8] flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-xs text-[#1C1917]">Canal de Comunicación Directo</h3>
                  <p className="text-[10px] text-[#78716C] leading-relaxed">
                    Escribe consultas clínicas a tu psicólogo o solicita soporte administrativo y técnico al centro.
                  </p>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] shrink-0 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right mt-4 pt-4 border-t border-[#F2EFE8]">
              <Link href="/mensajes" className="text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors flex items-center justify-end gap-1">
                <span>Ir a Mensajería</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* 5. Breathing and Self Care Tool (12/12) */}
          <section className="col-span-12 bg-white rounded-3xl p-6 border border-[#F2EFE8] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3 max-w-xl">
              <h2 className="text-sm font-bold text-[#1C1917] font-display flex items-center gap-2 uppercase tracking-wider text-text-muted">
                <Sparkles className="w-4 h-4 text-[#516750]" />
                <span>Tu Espacio de Autocuidado</span>
              </h2>
              <h3 className="text-base font-bold text-[#1C1917]">Ejercicios de respiración interactivos y tests rápidos</h3>
              <p className="text-xs text-[#78716C] leading-relaxed">
                Tómate un minuto para regular tu ritmo cardíaco y calmar la mente con nuestro regulador visual de respiración (animado bajo técnicas clínicas), o realiza una evaluación rápida de tu nivel de bienestar emocional general.
              </p>
            </div>

            <Link
              href="/autocuidado"
              className="w-full md:w-auto px-5 py-3 bg-[#1A3020] hover:bg-[#2c4f35] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0"
            >
              <span>Ingresar a Autocuidado</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </section>

        </div>
      </div>
    </>
  );
}
