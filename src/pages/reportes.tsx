import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  Receipt,
  CalendarCheck
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface SessionRow {
  id: string;
  date_session: string;
  time_session: string;
  status_session: string;
  value_session: number;
  status_payment: string;
  payment_type: string | null;
  boleta_status: string;
  patient: { full_name: string } | null;
}

interface LedgerRow {
  id: string;
  type_unit: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function Reportes() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Computed metrics
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingBilling, setPendingBilling] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch sessions with patient names
      const { data: sessData } = await supabase
        .from('sessions')
        .select(`
          id, date_session, time_session, status_session,
          value_session, status_payment, payment_type, boleta_status,
          patient:patient_id (full_name)
        `)
        .order('date_session', { ascending: false });

      if (sessData) {
        const typed = sessData as unknown as SessionRow[];
        setSessions(typed);
        setTotalSessions(typed.length);

        // Financial metrics
        const paid = typed.filter(s => s.status_payment === 'Pagado');
        const pending = typed.filter(s => s.status_payment === 'Pendiente');
        setTotalRevenue(paid.reduce((sum, s) => sum + Number(s.value_session || 0), 0));
        setPendingBilling(pending.reduce((sum, s) => sum + Number(s.value_session || 0), 0));

        // Clinical KPIs
        setCompletedCount(typed.filter(s => s.status_session === 'Completa').length);
        setCancelledCount(typed.filter(s => s.status_session === 'Cancelada').length);
        setScheduledCount(typed.filter(s => s.status_session === 'Programada').length);
      }

      // Fetch credit ledger
      const { data: ledgerData } = await supabase
        .from('credit_ledger')
        .select('id, type_unit, amount, description, created_at')
        .order('created_at', { ascending: false });

      if (ledgerData) {
        setLedger(ledgerData as LedgerRow[]);
      }
    } catch (err) {
      console.error('Error fetching reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const attendanceRate = totalSessions > 0
    ? Math.round((completedCount / totalSessions) * 100)
    : 0;

  if (loading) {
    return <div className="py-20 text-center text-text-muted text-sm">Cargando reportes financieros...</div>;
  }

  return (
    <>
      <Head>
        <title>PsicoAlivio - Reportes y Finanzas</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-text-primary">
            <BarChart3 className="w-6 h-6 text-accent-primary" />
            <span>Reportes y Finanzas</span>
          </h1>
          <p className="text-text-secondary text-sm">
            Dashboard financiero y operacional del ecosistema clínico.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <div className="bg-bg-card border border-border-color rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Ingresos Recibidos</span>
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <p className="text-2xl font-bold text-text-primary">
              ${totalRevenue.toLocaleString('es-CL')}
            </p>
            <p className="text-[10px] text-text-muted">Sesiones con pago confirmado</p>
          </div>

          {/* Pending Billing */}
          <div className="bg-bg-card border border-border-color rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Facturación Pendiente</span>
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <p className="text-2xl font-bold text-warning">
              ${pendingBilling.toLocaleString('es-CL')}
            </p>
            <p className="text-[10px] text-text-muted">Sesiones sin cobro confirmado</p>
          </div>

          {/* Attendance Rate */}
          <div className="bg-bg-card border border-border-color rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Tasa de Asistencia</span>
              <TrendingUp className="w-5 h-5 text-accent-primary" />
            </div>
            <p className="text-2xl font-bold text-text-primary">{attendanceRate}%</p>
            <p className="text-[10px] text-text-muted">
              {completedCount} completas de {totalSessions} totales
            </p>
          </div>

          {/* Cancellations */}
          <div className="bg-bg-card border border-border-color rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Cancelaciones</span>
              <TrendingDown className="w-5 h-5 text-danger" />
            </div>
            <p className="text-2xl font-bold text-danger">{cancelledCount}</p>
            <p className="text-[10px] text-text-muted">
              {scheduledCount} aún programadas
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions Table */}
          <div className="bg-bg-card border border-border-color rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border-color pb-2">
              <CalendarCheck className="w-4.5 h-4.5 text-accent-primary" />
              <span>Historial de Sesiones</span>
            </h2>

            {sessions.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-xs">
                No hay sesiones registradas.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-color text-text-muted text-left">
                      <th className="pb-2 pr-3 font-semibold">Fecha</th>
                      <th className="pb-2 pr-3 font-semibold">Paciente</th>
                      <th className="pb-2 pr-3 font-semibold">Estado</th>
                      <th className="pb-2 pr-3 font-semibold text-right">Valor</th>
                      <th className="pb-2 pr-3 font-semibold">Pago</th>
                      <th className="pb-2 font-semibold">Boleta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color/50">
                    {sessions.map(sess => (
                      <tr key={sess.id} className="hover:bg-bg-card-hover/30 transition-colors">
                        <td className="py-2.5 pr-3 text-text-secondary font-mono">
                          {sess.date_session} {sess.time_session?.slice(0, 5)}
                        </td>
                        <td className="py-2.5 pr-3 text-text-primary font-medium">
                          {sess.patient?.full_name || 'N/A'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            sess.status_session === 'Completa' ? 'bg-success/10 text-success' :
                            sess.status_session === 'Programada' ? 'bg-accent-primary/10 text-accent-primary' :
                            sess.status_session === 'Cancelada' ? 'bg-danger/10 text-danger' :
                            'bg-bg-secondary text-text-secondary'
                          }`}>
                            {sess.status_session === 'Completa' && <CheckCircle className="w-3 h-3" />}
                            {sess.status_session === 'Cancelada' && <XCircle className="w-3 h-3" />}
                            {sess.status_session}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right text-text-primary font-mono font-semibold">
                          ${Number(sess.value_session || 0).toLocaleString('es-CL')}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            sess.status_payment === 'Pagado' ? 'bg-success/10 text-success' :
                            sess.status_payment === 'Pendiente' ? 'bg-warning/10 text-warning' :
                            'bg-accent-primary/10 text-accent-primary'
                          }`}>
                            {sess.status_payment}
                          </span>
                        </td>
                        <td className="py-2.5 text-text-muted">{sess.boleta_status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Credit Ledger */}
          <div className="bg-bg-card border border-border-color rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 border-b border-border-color pb-2">
              <Wallet className="w-4.5 h-4.5 text-accent-primary" />
              <span>Libro Mayor de Créditos IA</span>
            </h2>

            {ledger.length === 0 ? (
              <div className="py-12 text-center text-text-muted text-xs">
                No hay transacciones de créditos registradas.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {ledger.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-bg-input/40 border border-border-color rounded-lg text-xs">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          entry.type_unit === 'NOTA_IA'
                            ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                            : 'bg-warning/10 text-warning border border-warning/20'
                        }`}>
                          {entry.type_unit}
                        </span>
                        <span className={`font-bold font-mono ${
                          entry.amount > 0 ? 'text-success' : 'text-danger'
                        }`}>
                          {entry.amount > 0 ? '+' : ''}{entry.amount}
                        </span>
                      </div>
                      <p className="text-text-muted truncate">{entry.description || 'Sin descripción'}</p>
                    </div>
                    <div className="text-text-muted text-[10px] shrink-0 ml-3 text-right">
                      <Receipt className="w-3 h-3 inline mr-1" />
                      {new Date(entry.created_at).toLocaleString('es-CL', { 
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="p-6 border-t border-border-color/30 text-center text-text-muted text-[10px]">
          <p>Los datos financieros se calculan en tiempo real desde la base de datos relacional. Todos los montos están expresados en CLP.</p>
        </footer>
      </div>
    </>
  );
}
