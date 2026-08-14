import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  XCircle, 
  Star, 
  Edit3 
} from 'lucide-react';

const getAppUrl = (path: string = '') => {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (isLocal ? 'http://localhost:3001' : 'https://app.sentidomigrante.com');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${appUrl}${cleanPath}`;
};

export default function PatientSessionsList() {
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para valoraciones / reseñas
  const [reviewedSessionIds, setReviewedSessionIds] = useState<string[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSessionForReview, setSelectedSessionForReview] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewIsPublic, setReviewIsPublic] = useState(true);
  const [reviewDisplayNameOption, setReviewDisplayNameOption] = useState<'real' | 'anonymous'>('real');
  const [reviewLocation, setReviewLocation] = useState('Suiza');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Estados para Reprogramación de citas
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [sessionToReschedule, setSessionToReschedule] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [availableRescheduleSlots, setAvailableRescheduleSlots] = useState<string[]>([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState('');
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [patientTimezone, setPatientTimezone] = useState<string>('America/Santiago');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPatientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago');
    }
  }, []);

  const getTranslatedSlot = (slot: string, specTz: string) => {
    if (!specTz || !newRescheduleDate || !patientTimezone) return slot;
    if (specTz === patientTimezone) return slot;

    try {
      const localDate = new Date(`${newRescheduleDate}T${slot}:00`);
      const tzParts = new Intl.DateTimeFormat('en-US', {
        timeZone: specTz,
        timeZoneName: 'longOffset'
      }).formatToParts(localDate);
      const offsetStr = tzParts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
      const offsetMatch = offsetStr.match(/GMT([+-]\d{2}):?(\d{2})?/);
      let isoOffset = 'Z';
      if (offsetMatch) {
        const sign = offsetMatch[1];
        const min = offsetMatch[2] || '00';
        isoOffset = `${sign}:${min}`;
      }

      const absoluteDate = new Date(`${newRescheduleDate}T${slot}:00${isoOffset}`);
      
      const targetParts = new Intl.DateTimeFormat('en-US', {
        timeZone: patientTimezone,
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(absoluteDate);
      
      const th = targetParts.find(p => p.type === 'hour')?.value || '00';
      const tm = targetParts.find(p => p.type === 'minute')?.value || '00';
      
      const datePartSpec = new Intl.DateTimeFormat('en-US', { timeZone: specTz, day: 'numeric' }).format(absoluteDate);
      const datePartPat = new Intl.DateTimeFormat('en-US', { timeZone: patientTimezone, day: 'numeric' }).format(absoluteDate);
      const dayDiff = datePartSpec !== datePartPat ? ' (+1d)' : '';

      return `${th}:${tm}${dayDiff}`;
    } catch (e) {
      return slot;
    }
  };

  const fetchSessions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      // Get patient
      const { data: patData } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(1)
        .single();

      if (patData) {
        setPatient(patData);

        // Get sessions
        const { data: sessData } = await supabase
          .from('sessions')
          .select('*, professional:professional_id (id, full_name, specialization, timezone)')
          .eq('patient_id', patData.id)
          .order('date_session', { ascending: false });

        if (sessData) {
          setSessions(sessData);
        }

        // Get reviews submitted by this patient
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('session_id')
          .eq('patient_id', patData.id);
        
        if (reviewsData) {
          const ids = reviewsData.map(r => r.session_id).filter(Boolean);
          setReviewedSessionIds(ids);
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const getLandingUrl = (path: string = '') => {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || (isLocal ? 'http://localhost:3000' : 'https://sentidomigrante.com');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${landingUrl}${cleanPath}`;
  };

  const handleSaveReview = async () => {
    if (!selectedSessionForReview || !patient || !reviewComment.trim()) return;
    setSubmittingReview(true);

    try {
      const displayName = reviewDisplayNameOption === 'real' ? patient.full_name : 'Anónimo';
      
      const { error } = await supabase
        .from('reviews')
        .insert({
          specialist_id: selectedSessionForReview.professional_id,
          patient_id: patient.id,
          session_id: selectedSessionForReview.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
          patient_name: displayName,
          location: reviewLocation,
          is_public: reviewIsPublic,
          approved: false // Requiere moderación del administrador
        });

      if (error) throw error;
      
      alert('¡Muchas gracias! Tu reseña ha sido enviada con éxito. Pasará por un breve proceso de moderación clínica antes de ser publicada.');
      setShowReviewModal(false);
      
      // Marcar como valorada localmente
      setReviewedSessionIds(prev => [...prev, selectedSessionForReview.id]);
    } catch (err: any) {
      alert('Error al guardar reseña: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Carga horarios disponibles al cambiar la fecha en reprogramación
  useEffect(() => {
    if (!sessionToReschedule || !newRescheduleDate || !patient) return;

    const fetchSlots = async () => {
      setLoadingRescheduleSlots(true);
      setAvailableRescheduleSlots([]);
      setSelectedRescheduleSlot('');

      try {
        const res = await fetch(
          getAppUrl(`/api/v1/booking/availability?organization_id=${patient.organization_id}&specialist_id=${sessionToReschedule.professional_id}&date=${newRescheduleDate}`)
        );
        const data = await res.json();

        if (res.ok && data.success) {
          setAvailableRescheduleSlots(data.available_slots || []);
        } else {
          alert(data.error || 'Error al cargar horarios disponibles.');
        }
      } catch (err) {
        console.error('Error fetching availability for reschedule:', err);
      } finally {
        setLoadingRescheduleSlots(false);
      }
    };

    fetchSlots();
  }, [sessionToReschedule, newRescheduleDate, patient]);

  const handleRescheduleSubmit = async () => {
    if (!sessionToReschedule || !newRescheduleDate || !selectedRescheduleSlot) return;
    setSubmittingReschedule(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(getAppUrl('/api/v1/booking/reschedule'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          sessionId: sessionToReschedule.id,
          newDate: newRescheduleDate,
          newTime: selectedRescheduleSlot,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert('Cita reprogramada con éxito. Se han enviado los correos de confirmación.');
        setShowRescheduleModal(false);
        setSessionToReschedule(null);
        setNewRescheduleDate('');
        setSelectedRescheduleSlot('');
        setLoading(true);
        fetchSessions();
      } else {
        alert(data.error || 'Ocurrió un error al reprogramar la cita.');
      }
    } catch (err: any) {
      alert('Error de conexión: ' + err.message);
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    const confirmCancel = window.confirm('¿Estás seguro de que deseas cancelar esta cita? Se liberará el horario de tu terapeuta y se le notificará por correo.');
    if (!confirmCancel) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(getAppUrl('/api/v1/booking/cancel'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert('Tu cita ha sido cancelada exitosamente.');
        setLoading(true);
        fetchSessions();
      } else {
        alert(data.error || 'Ocurrió un error al cancelar la cita.');
      }
    } catch (err: any) {
      alert('Error de conexión: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Cargando tus citas...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Mis Citas - Sentido Migrante</title>
      </Head>

      <div className="space-y-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Inicio</span>
          </Link>
          <button 
            onClick={() => { setLoading(true); fetchSessions(); }}
            className="p-2 border border-[#E2DCD0] hover:bg-[#F9F7F3] rounded-xl transition-all text-[#78716C] cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-[#1C1917] tracking-tight">Historial de Citas</h1>
          <p className="text-sm text-[#78716C]">Revisa el estado de tus citas programadas, reprograma, cancela o completa tus pagos pendientes.</p>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white border border-[#E2DCD0] rounded-2xl p-12 text-center space-y-4">
            <p className="text-sm text-[#78716C]">Aún no tienes citas registradas.</p>
            <Link
              href="/agendar"
              className="px-5 py-2.5 bg-[#516750] hover:bg-[#3f513e] text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
            >
              Agendar Mi Primera Consulta
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pb-12">
            {sessions.map((sess) => {
              const isPending = sess.status_payment === 'Pendiente';
              const isCancelled = sess.status_session === 'Cancelada';
              
              // Determina si es una sesión a futuro
              const now = new Date();
              const sessionDateTime = new Date(`${sess.date_session}T${sess.time_session}`);
              const isFuture = sessionDateTime > now;

              return (
                <div 
                  key={sess.id}
                  className={`bg-white border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all ${
                    isCancelled ? 'opacity-65 border-dashed border-[#E2DCD0]' : 'border-[#E2DCD0] hover:border-[#516750]/20'
                  }`}
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Session Status badge */}
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        isCancelled 
                          ? 'bg-red-50 text-red-600 border border-red-100' 
                          : sess.status_session === 'Completa' 
                          ? 'bg-gray-100 text-gray-700' 
                          : 'bg-[#DAEDDF] text-[#1A3020]'
                      }`}>
                        Sesión {sess.status_session}
                      </span>

                      {/* Payment Status badge */}
                      {!isCancelled && (
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                          sess.status_payment === 'Pagado'
                            ? 'bg-green-50 text-green-700 border border-green-200 flex items-center gap-1'
                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center gap-1'
                        }`}>
                          {sess.status_payment === 'Pagado' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              <span>Pagado</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-yellow-500 animate-pulse" />
                              <span>Pago Pendiente</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    <h2 className="font-bold text-[#1C1917] text-base">
                      Terapeuta: {sess.professional?.full_name || 'Psicólogo'}
                    </h2>

                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#78716C]">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#516750]" />
                        {sess.date_session}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#516750]" />
                        {sess.time_session.substring(0, 5)} ({sess.professional?.timezone || 'GMT-4'})
                      </span>
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex flex-col items-stretch md:items-end gap-3 shrink-0">
                    {/* Acciones para citas futuras y no canceladas */}
                    {!isCancelled && isFuture && (
                      <div className="flex flex-wrap gap-2 justify-stretch md:justify-end">
                        <button
                          onClick={() => {
                            setSessionToReschedule(sess);
                            setNewRescheduleDate('');
                            setAvailableRescheduleSlots([]);
                            setSelectedRescheduleSlot('');
                            setShowRescheduleModal(true);
                          }}
                          className="px-4 py-2 border border-[#E2DCD0] hover:bg-[#F9F7F3] text-[#516750] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Reprogramar</span>
                        </button>
                        <button
                          onClick={() => handleCancelSession(sess.id)}
                          className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancelar Cita</span>
                        </button>
                      </div>
                    )}

                    {/* Botón de dejar reseña destacado para sesiones completadas */}
                    {sess.status_session === 'Completa' && !isCancelled && (
                      reviewedSessionIds.includes(sess.id) ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold bg-green-50 px-3 py-1.5 border border-green-100 rounded-xl select-none">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Reseña Enviada</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedSessionForReview(sess);
                            setReviewLocation(patient?.country || 'Suiza');
                            setReviewRating(5);
                            setReviewComment('');
                            setReviewIsPublic(true);
                            setShowReviewModal(true);
                          }}
                          className="px-4 py-2.5 bg-[#516750] hover:bg-[#3f513e] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer border-0 hover:scale-[1.02] active:scale-[0.98] select-none text-center justify-center hover:shadow-lg"
                        >
                          <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                          <span>Dejar Reseña del Terapeuta</span>
                        </button>
                      )
                    )}

                    {/* Pagar pendiente */}
                    {!isCancelled && isPending && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left max-w-sm space-y-3">
                        <p className="text-[11px] text-yellow-800 leading-relaxed font-medium">
                          Para confirmar la cita, completa el pago seguro con PayPal:
                        </p>
                        <div className="flex items-center justify-between gap-4">
                          <a
                            href={getLandingUrl(`/agendar?reference=${sess.transaction_id}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-center px-4 py-2 bg-[#1A3020] hover:bg-[#2c4f35] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white decoration-none font-sans"
                          >
                            <CreditCard className="w-4 h-4 text-white" />
                            <span>Proceder al Pago</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {!isCancelled && sess.status_payment === 'Pagado' && !isFuture && (
                      <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold bg-green-50 px-3 py-1.5 border border-green-100 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>Pago Confirmado</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal para Dejar Reseña */}
      {showReviewModal && selectedSessionForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full border border-[#E2DCD0] shadow-2xl relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 my-8">
            <button 
              onClick={() => setShowReviewModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-[#F9F7F3] hover:bg-[#E2DCD0] rounded-full text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer border-0"
              aria-label="Cerrar"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-6 shrink-0 mb-2">
              <h3 className="text-xl font-bold font-display text-[#1C1917]">Valorar tu Sesión</h3>
              <p className="text-xs text-[#78716C]">
                Tu opinión ayuda a mantener la calidad clínica y acompaña a otros migrantes en su elección terapéutica.
              </p>
            </div>

            {/* Scrollable Form Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
              <div className="flex items-center gap-3 p-3 bg-[#F9F7F3] rounded-xl border border-[#E2DCD0]">
                <div className="w-10 h-10 rounded-full bg-[#DAEDDF] flex items-center justify-center font-bold text-[#1A3020] text-sm uppercase">
                  {selectedSessionForReview.professional?.full_name?.split(' ')[1]?.[0] || 'P'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1C1917]">{selectedSessionForReview.professional?.full_name}</h4>
                  <p className="text-xs text-[#78716C]">{selectedSessionForReview.professional?.specialization}</p>
                </div>
              </div>

              {/* Calificación por Estrellas */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#78716C] block">Calificación</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer border-0 bg-transparent"
                    >
                      <Star 
                        className={`w-8 h-8 ${
                          star <= reviewRating 
                            ? 'text-yellow-400 fill-yellow-400' 
                            : 'text-gray-300'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Comentario */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#78716C] block">Reseña o Comentario</label>
                <textarea
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  placeholder="Describe cómo te sentiste en consulta, las herramientas obtenidas..."
                  className="w-full p-3 bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl text-sm focus:outline-none focus:border-[#516750] transition-all text-[#1C1917] resize-none placeholder:text-[#78716C]"
                ></textarea>
              </div>

              {/* Ubicación */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#78716C] block">País desde el que tomas terapia</label>
                <select
                  value={reviewLocation}
                  onChange={(e) => setReviewLocation(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl text-sm focus:outline-none focus:border-[#516750] text-[#1C1917] cursor-pointer"
                >
                  <option value="Suiza">Suiza</option>
                  <option value="Alemania">Alemania</option>
                  <option value="España">España</option>
                  <option value="Francia">Francia</option>
                  <option value="Reino Unido">Reino Unido</option>
                  <option value="Otro">Otro / Fuera de Europa</option>
                </select>
              </div>

              {/* Nombre de visualización */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#78716C] block">Mostrar reseña en la web como:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-[#1C1917] cursor-pointer select-none">
                    <input
                      type="radio"
                      name="displayName"
                      checked={reviewDisplayNameOption === 'real'}
                      onChange={() => setReviewDisplayNameOption('real')}
                      className="accent-[#516750]"
                    />
                    <span>{patient?.full_name || 'Mi nombre'}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#1C1917] cursor-pointer select-none">
                    <input
                      type="radio"
                      name="displayName"
                      checked={reviewDisplayNameOption === 'anonymous'}
                      onChange={() => setReviewDisplayNameOption('anonymous')}
                      className="accent-[#516750]"
                    />
                    <span>Anónimo</span>
                  </label>
                </div>
              </div>

              {/* Consentimiento público */}
              <label className="flex items-start gap-2.5 text-xs text-[#78716C] cursor-pointer select-none bg-[#DAEDDF]/20 p-3 rounded-xl border border-[#516750]/10">
                <input
                  type="checkbox"
                  checked={reviewIsPublic}
                  onChange={(e) => setReviewIsPublic(e.target.checked)}
                  className="mt-0.5 accent-[#516750]"
                />
                <span>
                  Permitir mostrar esta reseña de forma pública en la web de Sentido Migrante (respetando la opción de anonimato anterior).
                </span>
              </label>
            </div>

            {/* Sticky Action Footer */}
            <div className="pt-3 border-t border-[#E2DCD0] bg-white shrink-0 mt-1">
              <button
                onClick={handleSaveReview}
                disabled={submittingReview || !reviewComment.trim()}
                className="w-full py-3 bg-[#516750] hover:bg-[#3f513e] disabled:opacity-50 text-white font-bold rounded-xl text-center text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                {submittingReview ? 'Enviando...' : 'Enviar Reseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Reprogramar Cita */}
      {showRescheduleModal && sessionToReschedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-[#E2DCD0] shadow-2xl relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setShowRescheduleModal(false);
                setSessionToReschedule(null);
                setNewRescheduleDate('');
                setSelectedRescheduleSlot('');
              }}
              className="absolute top-4 right-4 p-1.5 bg-[#F9F7F3] hover:bg-[#E2DCD0] rounded-full text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer border-0"
              aria-label="Cerrar"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-6 shrink-0 mb-4">
              <h3 className="text-xl font-bold font-display text-[#1C1917]">Reprogramar Cita</h3>
              <p className="text-xs text-[#78716C]">
                Selecciona una nueva fecha y hora para reprogramar tu cita con <strong>{sessionToReschedule.professional?.full_name}</strong>.
              </p>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#78716C] block">Selecciona Fecha</label>
                <input
                  type="date"
                  required
                  value={newRescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setNewRescheduleDate(e.target.value)}
                  className="w-full bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              {newRescheduleDate && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#78716C] block">Horas Disponibles (En tu zona horaria local)</label>
                  
                  {loadingRescheduleSlots ? (
                    <div className="flex justify-center items-center py-6 gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
                      <span className="text-xs text-[#78716C]">Consultando disponibilidad...</span>
                    </div>
                  ) : availableRescheduleSlots.length === 0 ? (
                    <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 font-medium">
                      No hay bloques libres en este día. Por favor selecciona otra fecha.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableRescheduleSlots.map((slot) => {
                        const isSelected = selectedRescheduleSlot === slot;
                        const translatedSlot = getTranslatedSlot(slot, sessionToReschedule.professional?.timezone);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedRescheduleSlot(slot)}
                            className={`p-2.5 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                              isSelected 
                                ? 'bg-[#516750] text-white border-[#516750]' 
                                : 'bg-[#F9F7F3] text-[#1C1917] border-[#E2DCD0] hover:bg-[#E2DCD0]/35'
                            }`}
                          >
                            {translatedSlot}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="pt-4 border-t border-[#E2DCD0] bg-white shrink-0 mt-4">
              <button
                onClick={handleRescheduleSubmit}
                disabled={submittingReschedule || !newRescheduleDate || !selectedRescheduleSlot}
                className="w-full py-3 bg-[#516750] hover:bg-[#3f513e] disabled:opacity-50 text-white font-bold rounded-xl text-center text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                {submittingReschedule ? 'Reprogramando...' : 'Confirmar Reprogramación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
