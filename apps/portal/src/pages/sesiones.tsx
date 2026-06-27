import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Clock, ArrowLeft, CreditCard, CheckCircle2, AlertCircle, RefreshCw, XCircle, Star } from 'lucide-react';

export default function PatientSessionsList() {
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<string | null>(null);
  
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

        // Get reviews submitted by this patient to mark completed therapists
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('specialist_id')
          .eq('patient_id', patData.id);
        
        if (reviewsData) {
          setReviewedSessionIds(reviewsData.map(r => r.specialist_id));
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

  // Quick Action to simulate Wise Payment Webhook!
  const handleSimulatePayment = async (reference: string) => {
    if (!confirm(`¿Quieres simular el pago por transferencia de Wise para la referencia ${reference}?`)) return;
    setReconciling(reference);

    try {
      const res = await fetch('/api/webhooks/simulate-wise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('¡Simulación de transferencia procesada con éxito! La cita ahora está confirmada.');
        await fetchSessions(); // Reload
      } else {
        alert(`Error al simular pago: ${data.error || 'Intenta nuevamente'}`);
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setReconciling(null);
    }
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
      setReviewedSessionIds(prev => [...prev, selectedSessionForReview.professional_id]);
    } catch (err: any) {
      alert('Error al guardar reseña: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-12 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin"></div>
        <p className="text-sm text-text-secondary">Cargando tus citas...</p>
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
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:text-accent-hover transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Inicio</span>
          </Link>
          <button 
            onClick={() => { setLoading(true); fetchSessions(); }}
            className="p-2 border border-border-color hover:bg-bg-card-hover rounded-xl transition-all text-text-muted"
            title="Refrescar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-text-primary tracking-tight">Historial de Citas</h1>
          <p className="text-sm text-text-secondary">Revisa el estado de tus citas programadas y completa tus pagos pendientes.</p>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white border border-border-color rounded-2xl p-12 text-center space-y-4">
            <p className="text-sm text-text-secondary">Aún no tienes citas registradas.</p>
            <Link
              href="/agendar"
              className="px-5 py-2.5 bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
            >
              Agendar Mi Primera Consulta
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sessions.map((sess) => {
              const isPending = sess.status_payment === 'Pendiente';
              const isCancelled = sess.status_session === 'Cancelada';

              return (
                <div 
                  key={sess.id}
                  className={`bg-white border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all ${
                    isCancelled ? 'opacity-65 border-dashed' : 'border-border-color hover:border-accent-primary/20'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Session Status badge */}
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        isCancelled 
                          ? 'bg-red-50 text-red-600 border border-red-100' 
                          : sess.status_session === 'Completa' 
                          ? 'bg-gray-100 text-gray-700' 
                          : 'bg-accent-primary/10 text-accent-primary'
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

                    <h2 className="font-bold text-text-primary text-base">
                      Terapeuta: {sess.professional?.full_name || 'Psicólogo'}
                    </h2>

                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-accent-primary" />
                        {sess.date_session}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-accent-primary" />
                        {sess.time_session.substring(0, 5)} ({sess.professional?.timezone || 'GMT-4'})
                      </span>
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex flex-col items-stretch md:items-end gap-3 shrink-0">
                    {/* Botón de dejar reseña destacado para sesiones completadas */}
                    {sess.status_session === 'Completa' && !isCancelled && (
                      reviewedSessionIds.includes(sess.professional_id) ? (
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
                          className="px-4 py-2.5 bg-accent-primary hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer border-0 hover:scale-[1.02] active:scale-[0.98] select-none text-center justify-center hover:shadow-lg"
                        >
                          <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                          <span>Dejar Reseña del Terapeuta</span>
                        </button>
                      )
                    )}
                    {!isCancelled && isPending && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left max-w-sm space-y-3">
                        <p className="text-[11px] text-yellow-800 leading-relaxed">
                          Para confirmar la cita, realiza una transferencia en Wise ingresando el siguiente código de referencia exacto en el concepto de pago:
                        </p>
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-mono font-bold text-xs bg-white px-2 py-1 border border-yellow-300 rounded text-yellow-800">
                            {sess.transaction_id || 'SM-PENDING'}
                          </span>
                          <button
                            onClick={() => handleSimulatePayment(sess.transaction_id)}
                            disabled={reconciling !== null}
                            className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-[10px] rounded transition-all shadow-sm"
                          >
                            {reconciling === sess.transaction_id ? 'Conciliando...' : 'Simular Transferencia'}
                          </button>
                        </div>
                      </div>
                    )}

                    {!isCancelled && sess.status_payment === 'Pagado' && (
                      <div className="flex items-center gap-1.5 text-xs text-green-700 font-semibold bg-green-50 px-3 py-1.5 border border-green-100 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span>Pago Conciliado vía Wise</span>
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
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full border border-border-color shadow-2xl relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 my-8">
            <button 
              onClick={() => setShowReviewModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-bg-card-hover hover:bg-border-color rounded-full text-text-muted hover:text-text-primary transition-colors cursor-pointer border-0"
              aria-label="Cerrar"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-6 shrink-0 mb-2">
              <h3 className="text-xl font-bold font-display text-text-primary">Valorar tu Sesión</h3>
              <p className="text-xs text-text-secondary">
                Tu opinión ayuda a mantener la calidad clínica y acompaña a otros migrantes en su elección terapéutica.
              </p>
            </div>

            {/* Scrollable Form Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
              {/* Datos del Profesional */}
              <div className="flex items-center gap-3 p-3 bg-bg-card-hover rounded-xl border border-border-color">
                <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center font-bold text-accent-primary text-sm uppercase">
                  {selectedSessionForReview.professional?.full_name?.split(' ')[1]?.[0] || 'P'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-text-primary">{selectedSessionForReview.professional?.full_name}</h4>
                  <p className="text-xs text-text-muted">{selectedSessionForReview.professional?.specialization}</p>
                </div>
              </div>

              {/* Calificación por Estrellas */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary block">Calificación</label>
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
                <label className="text-xs font-bold text-text-secondary block">Reseña o Comentario</label>
                <textarea
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  placeholder="Describe cómo te sentiste en consulta, las herramientas obtenidas..."
                  className="w-full p-3 bg-bg-card-hover border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary transition-all text-text-primary resize-none placeholder:text-text-muted"
                ></textarea>
              </div>

              {/* Ubicación */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary block">País desde el que tomas terapia</label>
                <select
                  value={reviewLocation}
                  onChange={(e) => setReviewLocation(e.target.value)}
                  className="w-full p-2.5 bg-bg-card-hover border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary text-text-primary cursor-pointer"
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
                <label className="text-xs font-bold text-text-secondary block">Mostrar reseña en la web como:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer select-none">
                    <input
                      type="radio"
                      name="displayName"
                      checked={reviewDisplayNameOption === 'real'}
                      onChange={() => setReviewDisplayNameOption('real')}
                      className="accent-accent-primary"
                    />
                    <span>{patient?.full_name || 'Mi nombre'}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer select-none">
                    <input
                      type="radio"
                      name="displayName"
                      checked={reviewDisplayNameOption === 'anonymous'}
                      onChange={() => setReviewDisplayNameOption('anonymous')}
                      className="accent-accent-primary"
                    />
                    <span>Anónimo</span>
                  </label>
                </div>
              </div>

              {/* Consentimiento público */}
              <label className="flex items-start gap-2.5 text-xs text-text-secondary cursor-pointer select-none bg-accent-primary/5 p-3 rounded-xl border border-accent-primary/10">
                <input
                  type="checkbox"
                  checked={reviewIsPublic}
                  onChange={(e) => setReviewIsPublic(e.target.checked)}
                  className="mt-0.5 accent-accent-primary"
                />
                <span>
                  Permitir mostrar esta reseña de forma pública en la web de Sentido Migrante (respetando la opción de anonimato anterior).
                </span>
              </label>
            </div>

            {/* Sticky Action Footer */}
            <div className="pt-3 border-t border-border-color bg-white shrink-0 mt-1">
              <button
                onClick={handleSaveReview}
                disabled={submittingReview || !reviewComment.trim()}
                className="w-full py-3 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-white font-bold rounded-xl text-center text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                {submittingReview ? 'Enviando...' : 'Enviar Reseña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
