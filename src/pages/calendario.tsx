import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  DollarSign, 
  Plus, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { usePrivacyMode } from '../components/PrivacyModeProvider';

export default function Calendario() {
  const { maskName } = usePrivacyMode();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('sessions')
          .select(`
            id, date_session, time_session, modality, status_session, value_session, status_payment,
            patient:patient_id (full_name)
          `)
          .order('date_session', { ascending: true });

        if (data) setSessions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  return (
    <>
      <Head>
        <title>PsicoAlivio - Calendario Clínico</title>
      </Head>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="w-6 h-6 text-emerald-400" />
              <span>Calendario de Sesiones</span>
            </h1>
            <p className="text-slate-400 text-sm">Organiza tu agenda diaria, sesiones clínicas y estado de cobros.</p>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-200">Junio 2026</h2>
            <div className="flex items-center gap-2">
              <button className="bg-slate-900 border border-slate-800 hover:bg-slate-850 p-2 rounded-lg text-slate-400 hover:text-slate-200 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="bg-slate-900 border border-slate-800 hover:bg-slate-850 p-2 rounded-lg text-slate-400 hover:text-slate-200 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500 text-sm">Cargando agenda...</div>
          ) : sessions.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm border border-dashed border-slate-850 rounded-xl bg-slate-900/10 space-y-2">
              <Calendar className="w-8 h-8 text-slate-700 mx-auto" />
              <p>No tienes citas agendadas para este mes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((sess) => (
                <div key={sess.id} className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-start">
                    <span className="bg-slate-950 border border-slate-850 px-2 py-1 rounded text-[10px] font-bold text-slate-400 tracking-wider">
                      {sess.date_session}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      sess.status_session === 'Completa' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                    }`}>
                      {sess.status_session}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <User className="w-4 h-4 text-emerald-500" />
                      <span>{maskName(sess.patient?.full_name)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span>{sess.time_session.slice(0, 5)} hrs</span>
                      <span>•</span>
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <span>{sess.modality}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <DollarSign className="w-4 h-4 text-slate-500" />
                      <span>${Number(sess.value_session).toLocaleString('es-CL')}</span>
                      <span className={`ml-1 px-2 py-0.5 text-[9px] font-bold rounded-full ${
                        sess.status_payment === 'Pagado' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {sess.status_payment}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-850 flex justify-end">
                    <Link 
                      href={`/sesiones/${sess.id}`}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                    >
                      Ver Detalle SOAP
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
