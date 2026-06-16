import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  Clock, 
  Plus, 
  ArrowUpRight, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { usePrivacyMode } from '../components/PrivacyModeProvider';
import { NewPatientModal } from '../components/NewPatientModal';

export default function Dashboard() {
  const { maskName } = usePrivacyMode();
  const [stats, setStats] = useState({
    activePatients: 0,
    sessionsToday: 0,
    pendingPayments: 0,
    upcomingSessions: 0
  });
  const [agenda, setAgenda] = useState<any[]>([]);
  const [patientsToObserve, setPatientsToObserve] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Fetch active patients count
      const { count: activeCount, error: activeErr } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'activo');
      
      // 2. Fetch today's sessions
      const { data: todaySessions, error: todayErr } = await supabase
        .from('sessions')
        .select(`
          id, 
          time_session, 
          modality, 
          status_session, 
          value_session,
          status_payment,
          patient:patient_id (id, full_name, rut_patient)
        `)
        .eq('date_session', todayStr);

      // 3. Fetch all pending sessions
      const { data: pendingSessions, error: pendingErr } = await supabase
        .from('sessions')
        .select('value_session')
        .eq('status_payment', 'Pendiente');

      // 4. Fetch upcoming sessions count
      const { count: upcomingCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('date_session', todayStr)
        .eq('status_session', 'Programada');

      // 5. Fetch clinical records to find "patients to observe"
      const { data: clinicalRecords } = await supabase
        .from('clinical_records')
        .select(`
          observaciones_generales,
          patient:patient_id (id, full_name)
        `)
        .limit(5);

      // 6. Fetch monthly revenue (sum of Completa sessions values)
      const { data: revenueSessions } = await supabase
        .from('sessions')
        .select('value_session')
        .eq('status_session', 'Completa');

      // Update state
      const totalPending = pendingSessions?.reduce((acc, curr) => acc + Number(curr.value_session), 0) || 0;
      const totalRevenue = revenueSessions?.reduce((acc, curr) => acc + Number(curr.value_session), 0) || 0;

      setStats({
        activePatients: activeCount || 0,
        sessionsToday: todaySessions?.length || 0,
        pendingPayments: totalPending,
        upcomingSessions: upcomingCount || 0
      });

      if (todaySessions) {
        setAgenda(todaySessions);
      }

      if (clinicalRecords) {
        const toObserve = clinicalRecords
          .filter(r => r.observaciones_generales && r.observaciones_generales.length > 5)
          .map(r => {
            const pat: any = Array.isArray(r.patient) ? r.patient[0] : r.patient;
            return {
              id: pat?.id,
              name: pat?.full_name || 'Paciente Sin Nombre',
              reason: r.observaciones_generales
            };
          });
        setPatientsToObserve(toObserve);
      }

      setMonthlyRevenue(totalRevenue);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <>
      <Head>
        <title>PsicoAlivio - Dashboard</title>
        <meta name="description" content="Dashboard clínico principal de PsicoAlivio" />
      </Head>

      <div className="space-y-6">
        {/* Banner de Bienvenida */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Bienvenido de vuelta, Terapeuta</h1>
            <p className="text-slate-400 text-sm">Aquí tienes un resumen de la actividad clínica de tu consulta hoy.</p>
          </div>
          <button 
            onClick={() => setIsNewPatientOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Ingresar Paciente</span>
          </button>
        </div>

        {/* Metricas KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pacientes Activos</span>
              <div className="p-2 bg-emerald-500/15 rounded-lg">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-bold">{stats.activePatients}</h3>
              <p className="text-slate-500 text-xs flex items-center gap-1">
                <span>Registrados en el CRM</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Sesiones de Hoy</span>
              <div className="p-2 bg-indigo-500/15 rounded-lg">
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-bold">{stats.sessionsToday}</h3>
              <p className="text-slate-500 text-xs">Agenda clínica diaria</p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pagos Pendientes</span>
              <div className="p-2 bg-rose-500/15 rounded-lg">
                <DollarSign className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-bold">${stats.pendingPayments.toLocaleString('es-CL')}</h3>
              <p className="text-slate-500 text-xs">Montos por cobrar acumulados</p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Próximas Sesiones</span>
              <div className="p-2 bg-amber-500/15 rounded-lg">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-bold">{stats.upcomingSessions}</h3>
              <p className="text-slate-500 text-xs">Agendadas esta semana</p>
            </div>
          </div>
        </div>

        {/* Paneles de Control */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agenda de hoy */}
          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Agenda de Hoy</h2>
              <Link href="/calendario" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium">
                <span>Ver Calendario</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-500 text-sm">Cargando agenda...</div>
            ) : agenda.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500 text-sm bg-slate-900/20 rounded-xl border border-dashed border-slate-800 space-y-2">
                <Calendar className="w-8 h-8 text-slate-700" />
                <p>No hay sesiones programadas para hoy.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850 space-y-3">
                {agenda.map((sess) => (
                  <div key={sess.id} className="pt-3 first:pt-0 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-200">
                        {maskName(sess.patient?.full_name || 'Paciente')}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{sess.time_session.slice(0, 5)} hrs</span>
                        <span>•</span>
                        <span>{sess.modality}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        sess.status_payment === 'Pagado' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {sess.status_payment}
                      </span>
                      <Link 
                        href={`/sesiones/${sess.id}`} 
                        className="bg-slate-900 border border-slate-800 p-1.5 rounded hover:bg-slate-850 hover:text-emerald-400 text-slate-400 transition-all"
                        title="Ir a la sesión"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel Clínico: Pacientes a observar */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col space-y-4">
            <h2 className="text-lg font-bold">Pacientes a Observar</h2>
            
            {loading ? (
              <div className="flex-grow flex items-center justify-center text-slate-500 text-sm">Cargando alertas...</div>
            ) : patientsToObserve.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center py-12 text-slate-500 text-sm bg-slate-900/20 rounded-xl border border-dashed border-slate-800 space-y-2 text-center px-4">
                <AlertTriangle className="w-8 h-8 text-slate-700" />
                <p>No hay alertas clínicas registradas actualmente.</p>
              </div>
            ) : (
              <div className="space-y-4 flex-grow overflow-auto max-h-72">
                {patientsToObserve.map((obs) => (
                  <div key={obs.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Alerta de Evolución</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-200">{maskName(obs.name)}</p>
                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{obs.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resumen Financiero Rápido */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold">Ingresos del Mes</h2>
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-3xl font-extrabold text-slate-100">${monthlyRevenue.toLocaleString('es-CL')}</p>
              <p className="text-slate-500 text-xs">Monto total facturado por sesiones completas</p>
            </div>
            <Link href="/reportes" className="bg-slate-900 border border-slate-800 hover:bg-slate-850 px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 transition-all">
              Ver Detalle Financiero
            </Link>
          </div>
        </div>
      </div>

      {/* Modal para Crear Paciente */}
      <NewPatientModal 
        isOpen={isNewPatientOpen} 
        onClose={() => setIsNewPatientOpen(false)} 
        onSuccess={fetchDashboardData} 
      />
    </>
  );
}
