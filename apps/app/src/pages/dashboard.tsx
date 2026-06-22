/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Users, 
  Calendar, 
  Clock, 
  DollarSign, 
  Plus, 
  AlertTriangle,
  Lightbulb,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { usePrivacyMode } from '../components/PrivacyModeProvider';
import { NewPatientModal } from '../components/NewPatientModal';
import { NewSessionModal } from '../components/NewSessionModal';

export default function Dashboard() {
  const { maskName } = usePrivacyMode();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    activePatients: 0,
    sessionsToday: 0,
    pendingPayments: 0,
    upcomingSessions: 0
  });
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [patientsToObserve, setPatientsToObserve] = useState<any[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<{ day: string; count: number }[]>([]);
  const [peakDayInfo, setPeakDayInfo] = useState('');
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Quick Notes States
  const [quickNotes, setQuickNotes] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  // Helper to format currency
  const formatCLP = (value: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Fetch active profile
      const { data: { session } } = await supabase.auth.getSession();
      let activeProfileId = '';
      if (session?.user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('user_id', session.user.id)
          .limit(1)
          .single();
        if (profileData) {
          setProfile(profileData);
          activeProfileId = profileData.id;
        }
      }

      // 1. Fetch active patients count
      const { count: activeCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'activo');
      
      // 2. Fetch today's sessions
      const { data: todaySessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('date_session', todayStr);

      // 3. Fetch all pending sessions
      const { data: pendingSessions } = await supabase
        .from('sessions')
        .select('value_session')
        .eq('status_payment', 'Pendiente');

      // 4. Fetch upcoming sessions count (today and future)
      const { count: upcomingCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('date_session', todayStr)
        .eq('status_session', 'Programada');

      // 5. Fetch upcoming sessions list (detailed table)
      const { data: upcomingList } = await supabase
        .from('sessions')
        .select(`
          id, 
          date_session,
          time_session, 
          modality, 
          status_session, 
          value_session,
          status_payment,
          patient:patient_id (id, full_name)
        `)
        .gte('date_session', todayStr)
        .order('date_session', { ascending: true })
        .order('time_session', { ascending: true })
        .limit(4);

      // 6. Fetch patients where en_observacion = true
      const { data: observePatients } = await supabase
        .from('patients')
        .select('id, full_name, observacion_comentario')
        .eq('en_observacion', true);

      // 7. Fetch monthly revenue (sum of Completa sessions values)
      const { data: revenueSessions } = await supabase
        .from('sessions')
        .select('value_session')
        .eq('status_session', 'Completa');

      // 8. Fetch Quick Notes
      if (activeProfileId) {
        const { data: noteData } = await supabase
          .from('quick_notes')
          .select('*')
          .eq('profile_id', activeProfileId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (noteData && noteData.length > 0) {
          setQuickNotes(noteData[0].content || '');
          setNoteId(noteData[0].id);
        }
      }

      // 9. Weekly Trends computations
      const today = new Date();
      const currentDay = today.getDay(); // 0 is Sun, 1 is Mon, etc.
      const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distanceToMon);

      const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
      const weekDates = daysOfWeek.map((_, idx) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + idx);
        return d.toISOString().split('T')[0];
      });

      const { data: weekSessions } = await supabase
        .from('sessions')
        .select('date_session')
        .gte('date_session', weekDates[0])
        .lte('date_session', weekDates[4]);

      // Aggregate sessions by day
      const trendCounts = weekDates.map((dateStr, idx) => {
        const count = weekSessions?.filter(s => s.date_session === dateStr).length || 0;
        return {
          day: daysOfWeek[idx],
          count
        };
      });
      setWeeklyTrend(trendCounts);

      // Determine peak day
      let maxDay = 'Lunes';
      let maxCount = 0;
      trendCounts.forEach(t => {
        if (t.count > maxCount) {
          maxCount = t.count;
          maxDay = t.day;
        }
      });
      if (maxCount > 0) {
        setPeakDayInfo(`Día con mayor carga: ${maxDay} (${maxCount} ${maxCount === 1 ? 'sesión' : 'sesiones'}).`);
      } else {
        setPeakDayInfo('Sin sesiones programadas para esta semana laboral.');
      }

      // Update state
      const totalPending = pendingSessions?.reduce((acc, curr) => acc + Number(curr.value_session), 0) || 0;
      const totalRevenue = revenueSessions?.reduce((acc, curr) => acc + Number(curr.value_session), 0) || 0;

      setStats({
        activePatients: activeCount || 0,
        sessionsToday: todaySessions?.length || 0,
        pendingPayments: totalPending,
        upcomingSessions: upcomingCount || 0
      });

      if (upcomingList) {
        setUpcomingSessions(upcomingList);
      }

      if (observePatients) {
        setPatientsToObserve(observePatients.map(p => ({
          id: p.id,
          name: p.full_name,
          reason: p.observacion_comentario || 'Sin comentario especificado'
        })));
      }

      setMonthlyRevenue(totalRevenue);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveObservation = async (patientId: string) => {
    try {
      const { error } = await supabase
        .from('patients')
        .update({ en_observacion: false, observacion_comentario: null })
        .eq('id', patientId);
      if (error) throw error;
      setPatientsToObserve(prev => prev.filter(p => p.id !== patientId));
    } catch (err: any) {
      alert('Error al quitar observación: ' + err.message);
    }
  };

  const handleSaveQuickNotes = async (content: string) => {
    setQuickNotes(content);
    const tenantId = localStorage.getItem('active-tenant-id');
    if (!profile?.id || !tenantId) return;
    
    try {
      setSavingNotes(true);
      if (noteId) {
        const { error } = await supabase
          .from('quick_notes')
          .update({ content })
          .eq('id', noteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('quick_notes')
          .insert({
            organization_id: tenantId,
            profile_id: profile.id,
            content
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setNoteId(data.id);
        }
      }
    } catch (err: any) {
      console.error('Error saving quick notes:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Calculate chart bar height percentage
  const maxWeeklyCount = Math.max(...weeklyTrend.map(t => t.count), 1);

  // Initials generator for avatar
  const getInitials = (name: string) => {
    if (!name) return 'P';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <>
      <Head>
        <title>MindCare Portal - Dashboard Clínico</title>
        <meta name="description" content="Dashboard terapéutico adaptado con diseño minimalista." />
      </Head>

      <div className="space-y-stack-lg">
        {/* Welcome Message */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-background">
              ¡Hola, {profile ? profile.full_name : 'Terapeuta'}!
            </h2>
            <p className="text-on-surface-variant font-body-md mt-1">
              Tienes {stats.sessionsToday} {stats.sessionsToday === 1 ? 'sesión programada' : 'sesiones programadas'} para hoy. Respira profundo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 self-start md:self-auto">
            <button 
              onClick={() => setIsNewPatientOpen(true)}
              className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md flex items-center gap-2 shadow-sm hover:bg-primary-container active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>Ingresar Paciente</span>
            </button>
            <button 
              onClick={() => setIsNewSessionOpen(true)}
              className="bg-secondary-container text-on-secondary-container px-6 py-3 rounded-lg font-label-md flex items-center gap-2 shadow-sm hover:bg-bg-card active:scale-95 transition-all cursor-pointer border border-border-color"
            >
              <Calendar className="w-5 h-5 text-accent-primary" />
              <span>Nueva Sesión</span>
            </button>
          </div>
        </div>

        {/* Bento Grid - Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {/* Active Patients */}
          <div className="bg-surface-container-lowest p-6 rounded-xl card-shadow border border-outline-variant/10 group hover:border-primary/20 transition-all flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-primary font-label-sm flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+4%</span>
              </span>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Pacientes Activos</p>
              <h3 className="font-headline-md text-headline-md mt-1 text-on-surface">{stats.activePatients}</h3>
            </div>
          </div>

          {/* Sessions Today */}
          <div className="bg-surface-container-lowest p-6 rounded-xl card-shadow border border-outline-variant/10 group hover:border-primary/20 transition-all flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-secondary-container/30 text-on-secondary-container rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-on-surface-variant font-label-sm">Hoy</span>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Sesiones Hoy</p>
              <h3 className="font-headline-md text-headline-md mt-1 text-on-surface">{stats.sessionsToday}</h3>
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-surface-container-lowest p-6 rounded-xl card-shadow border border-outline-variant/10 group hover:border-primary/20 transition-all flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-tertiary-fixed-dim/30 text-tertiary rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-on-surface-variant font-label-sm">Agenda</span>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Próximas Sesiones</p>
              <h3 className="font-headline-md text-headline-md mt-1 text-on-surface">{stats.upcomingSessions}</h3>
            </div>
          </div>

          {/* Pending Payments */}
          <div className="bg-surface-container-lowest p-6 rounded-xl card-shadow border border-outline-variant/10 group hover:border-primary/20 transition-all flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-error-container/20 text-error rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-error font-label-sm flex items-center gap-0.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Cobro</span>
              </span>
            </div>
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Pagos Pendientes</p>
              <h3 className="font-headline-md text-headline-md mt-1 text-on-surface">{formatCLP(stats.pendingPayments)}</h3>
            </div>
          </div>
        </div>

        {/* Split Grid Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          {/* Next Sessions (2/3 width) */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl card-shadow border border-outline-variant/10 overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">Sesiones Siguientes</h4>
                <Link href="/calendario" className="text-primary font-label-md hover:underline flex items-center gap-1">
                  <span>Ver Agenda Completa</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>

              {loading ? (
                <div className="py-16 text-center text-on-surface-variant text-sm">Cargando próximas citas...</div>
              ) : upcomingSessions.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant text-sm flex flex-col items-center justify-center space-y-2">
                  <Calendar className="w-10 h-10 text-outline-variant/60" />
                  <p className="font-semibold">Sin próximas sesiones programadas.</p>
                  <p className="text-xs">Usa el calendario para planificar nuevas citas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low/40 text-on-surface-variant font-label-sm text-label-sm">
                      <tr>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Paciente</th>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Fecha / Hora</th>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Modalidad</th>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 font-body-sm text-body-sm">
                      {upcomingSessions.map((sess) => {
                        const patientInfo = Array.isArray(sess.patient) ? sess.patient[0] : sess.patient;
                        const pName = patientInfo?.full_name || 'Paciente Sin Nombre';
                        const pInitials = getInitials(pName);
                        
                        return (
                          <tr key={sess.id} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[12px] mr-3">
                                  {pInitials}
                                </div>
                                <span className="font-medium text-on-surface">{maskName(pName)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-on-surface-variant font-mono">
                              <div>{sess.date_session}</div>
                              <div className="text-xs text-outline">{sess.time_session.slice(0, 5)} hrs</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
                                sess.modality === 'Online'
                                  ? 'bg-secondary-container/40 text-on-secondary-container'
                                  : 'bg-primary-fixed/40 text-on-primary-fixed-variant'
                              }`}>
                                {sess.modality}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <Link 
                                href={`/sesiones/${sess.id}`}
                                className="text-primary hover:text-primary-container transition-colors font-bold text-sm"
                              >
                                Ficha SOAP
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low/30 border-t border-outline-variant/10 flex justify-between items-center text-xs text-on-surface-variant">
              <span>Ingresos acumulados del mes facturados:</span>
              <span className="font-bold text-primary text-sm">{formatCLP(monthlyRevenue)}</span>
            </div>
          </div>

          {/* Activity Trends & Patients to Observe (1/3 width) */}
          <div className="space-y-gutter">
            {/* Session Trends Chart */}
            <div className="bg-surface-container-lowest rounded-xl card-shadow border border-outline-variant/10 p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">Tendencias Semanal</h4>
                <div className="text-on-surface-variant flex items-center gap-1 text-label-sm bg-surface-container-low px-2 py-1 rounded">
                  Lunes - Viernes
                </div>
              </div>
              
              <div className="flex items-end justify-between gap-3 h-40 pt-4 px-2">
                {weeklyTrend.map((t, idx) => {
                  const pct = Math.max((t.count / maxWeeklyCount) * 100, 8); // Minimum height of 8% for visibility
                  const isToday = new Date().getDay() === (idx + 1); // 1 = Mon, 2 = Tue, etc.
                  
                  return (
                    <div key={t.day} className="flex-1 flex flex-col items-center group cursor-pointer">
                      <div className="w-full bg-surface-container h-32 rounded-t-lg relative overflow-hidden group">
                        <div 
                          style={{ height: `${pct}%` }}
                          className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 ${
                            isToday 
                              ? 'bg-primary' 
                              : 'bg-primary/40 group-hover:bg-primary/80'
                          }`}
                        ></div>
                      </div>
                      <span className={`font-label-sm text-label-sm mt-2 whitespace-nowrap scale-90 ${
                        isToday ? 'text-primary font-bold' : 'text-on-surface-variant'
                      }`}>
                        {t.day.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/10 flex gap-3 items-start">
                <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-label-sm text-label-sm text-primary font-bold">Observación Clínica</p>
                  <p className="text-body-sm text-on-surface-variant leading-relaxed">
                    {peakDayInfo} Mantén intervalos consistentes de descanso clínico para optimizar la empatía.
                  </p>
                </div>
              </div>
            </div>

            {/* Patients to Observe */}
            <div className="bg-surface-container-lowest rounded-xl card-shadow border border-outline-variant/10 p-6 flex flex-col">
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Pacientes a Observar</span>
              </h4>

              {loading ? (
                <div className="py-6 text-center text-on-surface-variant text-sm">Cargando alertas clínicas...</div>
              ) : patientsToObserve.length === 0 ? (
                <div className="py-8 text-center text-outline-variant/60 text-xs border border-dashed border-outline-variant/20 rounded-xl bg-surface-container-low/20 space-y-1">
                  <AlertTriangle className="w-6 h-6 mx-auto text-outline-variant/60" />
                  <p className="font-semibold text-on-surface-variant">Sin alertas activas.</p>
                  <p>Las observaciones clínicas destacadas aparecerán aquí.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patientsToObserve.map((obs) => (
                    <div key={obs.id} className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/20 space-y-1 group">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>Observación General</span>
                        </p>
                        <button
                          onClick={() => handleRemoveObservation(obs.id)}
                          className="text-[10px] text-primary hover:underline font-bold transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Quitar de observación"
                        >
                          Quitar
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-on-surface">{maskName(obs.name)}</p>
                      <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                        {obs.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Notes Widget */}
            <div className="bg-surface-container-lowest rounded-xl card-shadow border border-outline-variant/10 p-6 flex flex-col">
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4 flex justify-between items-center">
                <span>Notas Rápidas</span>
                {savingNotes ? (
                  <span className="text-[10px] text-primary animate-pulse font-normal">Guardando...</span>
                ) : (
                  <span className="text-[10px] text-on-surface-variant font-normal">Auto-guardado al salir</span>
                )}
              </h4>
              <textarea
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                onBlur={(e) => handleSaveQuickNotes(e.target.value)}
                className="w-full h-32 p-3 bg-surface-container-low border border-outline-variant/20 rounded-xl font-body-sm text-body-sm focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-on-surface-variant/40 shadow-sm focus:outline-none text-on-surface"
                placeholder="Apunta algo rápido para recordar..."
              />
            </div>
          </div>
        </div>

        {/* Focus Module / Quote (Lower Section) */}
        <div className="relative overflow-hidden bg-primary p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between text-on-primary shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="z-10 mb-6 md:mb-0 space-y-1">
            <p className="font-label-md text-label-md opacity-85 uppercase tracking-widest mb-1">Enfoque Diario</p>
            <h3 className="font-headline-md text-headline-md max-w-xl font-bold italic leading-tight">
              &quot;El autocuidado no es egoísta. No puedes servir desde una vasija vacía.&quot;
            </h3>
            <p className="pt-2 font-body-sm opacity-90 text-sm">
              Recuerda tomar al menos 10 minutos de respiración consciente entre sesiones clínicas para reducir el desgaste.
            </p>
          </div>
          <div className="z-10 flex gap-3 shrink-0">
            <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-lg font-label-md transition-all flex items-center gap-2 border border-white/10 cursor-pointer">
              <Lightbulb className="w-4 h-4" />
              <span>Consejo</span>
            </button>
            <button className="bg-white text-primary hover:bg-white-dim px-5 py-2.5 rounded-lg font-label-md transition-all shadow-sm cursor-pointer">
              Entendido
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Crear Paciente */}
      <NewPatientModal 
        isOpen={isNewPatientOpen} 
        onClose={() => setIsNewPatientOpen(false)} 
        onSuccess={fetchDashboardData} 
      />

      {/* Modal para Agendar Sesión */}
      <NewSessionModal
        isOpen={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        onSuccess={fetchDashboardData}
      />
    </>
  );
}
