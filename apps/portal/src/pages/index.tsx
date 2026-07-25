import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Clock, BookOpen, User, ArrowRight, Video, FileText } from 'lucide-react';

export default function PatientPortalHome() {
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          .select('*, professional:professional_id (full_name, specialization, timezone)')
          .eq('patient_id', patData.id)
          .order('date_session', { ascending: true });

        if (!sessErr && sessData) {
          setSessions(sessData);
        }
      } catch (err) {
        console.error('Unexpected error in patient portal:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortalData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-12 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Cargando tu portal personal...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4">
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

      <div className="space-y-8">
        {/* Welcome Banner - Premium Forest Gradient */}
        <div className="bg-gradient-to-br from-[#1A3020] to-[#516750] text-white rounded-3xl p-8 md:p-10 shadow-lg relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12">
            <Calendar size={300} />
          </div>
          <div className="relative z-10 max-w-xl space-y-3">
            <span className="text-xs uppercase tracking-widest font-bold bg-white/20 px-3 py-1 rounded-full">
              Portal del Paciente
            </span>
            <h1 className="text-3xl md:text-4xl font-bold font-display leading-tight">
              ¡Hola, {patient.full_name.split(' ')[0]}!
            </h1>
            <p className="text-sm text-white/90 leading-relaxed font-light">
              Bienvenido a tu espacio terapéutico en {patient.organizations?.name || 'Sentido Migrante'}. Aquí puedes revisar tus citas programadas, conectarte a tus sesiones virtuales y agendar nuevos horarios.
            </p>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Proxima Cita Section (7/12) */}
          <section className="col-span-12 lg:col-span-7 bg-white rounded-3xl p-6 border border-[#F2EFE8] shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1C1917] font-display flex items-center gap-2 border-b border-[#F2EFE8] pb-3">
                <Calendar className="w-5 h-5 text-[#516750]" />
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
                        {nextSession.status_payment === 'Pagado' ? 'Confirmada' : 'Pendiente de Pago'}
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
                      <div className="text-center space-y-2">
                        <p className="text-[11px] text-[#78716C] font-medium">Por favor completa el pago de tu cita para confirmar.</p>
                        <Link
                          href="/sesiones"
                          className="w-full md:w-auto px-5 py-3 bg-[#1A3020] hover:bg-[#2c4f35] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                          Pagar Sesión
                        </Link>
                      </div>
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

          {/* Quick Actions & Info (5/12) */}
          <section className="col-span-12 lg:col-span-5 bg-white rounded-3xl p-6 border border-[#F2EFE8] shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-[#1C1917] font-display flex items-center gap-2 border-b border-[#F2EFE8] pb-3">
              <BookOpen className="w-5 h-5 text-[#516750]" />
              <span>Mi Ecosistema de Apoyo</span>
            </h2>

            <div className="grid grid-cols-1 gap-3">
              {/* Agendar */}
              <Link 
                href="/agendar" 
                className="flex items-center justify-between p-4 bg-[#F9F7F3] hover:bg-[#F2EFE8] border border-[#F2EFE8] rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#DAEDDF] text-[#1A3020] rounded-xl">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-[#1C1917] text-xs">Agendar Consulta</h3>
                    <p className="text-[10px] text-[#78716C]">Busca horarios libres con tu psicólogo</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#78716C] group-hover:text-[#516750] transition-colors" />
              </Link>

              {/* Mis sesiones */}
              <Link 
                href="/sesiones" 
                className="flex items-center justify-between p-4 bg-[#F9F7F3] hover:bg-[#F2EFE8] border border-[#F2EFE8] rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#DAEDDF] text-[#1A3020] rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-[#1C1917] text-xs">Mis Citas e Historial</h3>
                    <p className="text-[10px] text-[#78716C]">Revisa comprobantes y estados de pago</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#78716C] group-hover:text-[#516750] transition-colors" />
              </Link>
            </div>

            <div className="p-4 bg-[#F9F7F3] border border-[#F2EFE8] rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-[#1C1917] flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#516750]" />
                <span>Contacto de Emergencia</span>
              </h4>
              {patient.emergency_contact_name ? (
                <div className="text-xs space-y-1 text-[#78716C]">
                  <p><strong className="font-semibold text-[#1C1917]">Nombre:</strong> {patient.emergency_contact_name} ({patient.emergency_contact_relationship || 'Contacto'})</p>
                  <p><strong className="font-semibold text-[#1C1917]">Teléfono:</strong> {patient.emergency_contact_phone || 'N/A'}</p>
                </div>
              ) : (
                <div className="space-y-2 text-left">
                  <p className="text-[11px] text-[#78716C]">No has registrado un contacto de emergencia aún.</p>
                  <Link href="/perfil" className="text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors flex items-center gap-1">
                    <span>Configurar ahora</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
