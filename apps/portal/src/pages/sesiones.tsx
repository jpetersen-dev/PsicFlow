import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Clock, ArrowLeft, CreditCard, CheckCircle2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';

export default function PatientSessionsList() {
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<string | null>(null);

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
          .select('*, professional:professional_id (full_name, specialization, timezone)')
          .eq('patient_id', patData.id)
          .order('date_session', { ascending: false });

        if (sessData) {
          setSessions(sessData);
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
    </>
  );
}
