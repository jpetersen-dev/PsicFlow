import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import { Layout } from '../components/Layout';
import { Star, MessageSquare, Check, X, ShieldAlert, Eye, EyeOff, Calendar, User } from 'lucide-react';

export default function ResenasAdmin() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // KPI stats
  const [stats, setStats] = useState({
    total: 0,
    average: 0,
    publicActive: 0,
    pendingApproval: 0
  });

  const fetchReviews = async () => {
    setLoading(true);
    try {
      // Fetch reviews. RLS automatically filters to the user's organization!
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          patient_name,
          location,
          is_public,
          approved,
          created_at,
          specialist:specialist_id (full_name, specialization)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setReviews(data);
        
        // Calculate stats
        const total = data.length;
        const sum = data.reduce((acc, r) => acc + r.rating, 0);
        const average = total > 0 ? parseFloat((sum / total).toFixed(1)) : 0;
        const publicActive = data.filter(r => r.is_public && r.approved).length;
        const pendingApproval = data.filter(r => r.is_public && !r.approved).length;
        
        setStats({ total, average, publicActive, pendingApproval });
      }
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleToggleApproval = async (id: string, currentApprovedState: boolean) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ approved: !currentApprovedState })
        .eq('id', id);

      if (error) throw error;
      
      // Update state locally
      setReviews(prev => prev.map(r => r.id === id ? { ...r, approved: !currentApprovedState } : r));
      
      // Recalculate stats
      setStats(prev => {
        const nextApproved = !currentApprovedState;
        const updatedReviews = reviews.map(r => r.id === id ? { ...r, approved: nextApproved } : r);
        const publicActive = updatedReviews.filter(r => r.is_public && r.approved).length;
        const pendingApproval = updatedReviews.filter(r => r.is_public && !r.approved).length;
        return {
          ...prev,
          publicActive,
          pendingApproval
        };
      });
    } catch (err: any) {
      alert('Error al actualizar visibilidad: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Gestión de Reseñas - PsicFlow</title>
      </Head>

      <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-text-primary tracking-tight">
            Reseñas y Testimonios
          </h1>
          <p className="text-sm text-text-secondary">
            Modera las valoraciones de los pacientes y selecciona cuáles se mostrarán públicamente en la web de Sentido Migrante.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-card p-4 rounded-2xl border border-border-color shadow-sm flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total de Valoraciones</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary">{stats.total}</span>
              <span className="text-xs text-text-muted">reseñas</span>
            </div>
          </div>
          
          <div className="bg-bg-card p-4 rounded-2xl border border-border-color shadow-sm flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Calificación Promedio</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-text-primary">{stats.average}</span>
              <div className="flex text-yellow-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star 
                    key={s} 
                    className={`w-4 h-4 ${s <= Math.round(stats.average) ? 'fill-current' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-bg-card p-4 rounded-2xl border border-border-color shadow-sm flex flex-col gap-1.5 border-l-4 border-l-green-500">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Públicas en la Web</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600">{stats.publicActive}</span>
              <span className="text-xs text-text-muted">activas</span>
            </div>
          </div>

          <div className="bg-bg-card p-4 rounded-2xl border border-border-color shadow-sm flex flex-col gap-1.5 border-l-4 border-l-yellow-500">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Pendientes de Aprobación</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-yellow-600">{stats.pendingApproval}</span>
              <span className="text-xs text-text-muted">esperando</span>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-12 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin"></div>
            <p className="text-sm text-text-secondary">Cargando valoraciones...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-bg-card border border-border-color rounded-2xl p-12 text-center space-y-3">
            <MessageSquare className="w-12 h-12 text-text-muted mx-auto" />
            <p className="text-sm text-text-secondary font-medium">Aún no se han recibido reseñas de pacientes.</p>
            <p className="text-xs text-text-muted">Las valoraciones aparecerán aquí a medida que los pacientes las envíen desde el historial de citas.</p>
          </div>
        ) : (
          <div className="bg-bg-card border border-border-color rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-input border-b border-border-color text-xs font-bold text-text-secondary uppercase tracking-wider">
                    <th className="px-6 py-4">Paciente</th>
                    <th className="px-6 py-4">Terapeuta</th>
                    <th className="px-6 py-4">Valoración</th>
                    <th className="px-6 py-4">Comentario</th>
                    <th className="px-6 py-4">Privacidad</th>
                    <th className="px-6 py-4">Estado Web</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-sm">
                  {reviews.map((rev) => {
                    const stars = Array.from({ length: 5 }, (_, i) => i + 1);
                    return (
                      <tr key={rev.id} className="hover:bg-bg-card-hover/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-text-primary whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{rev.patient_name}</span>
                            <span className="text-[10px] text-text-muted font-normal">{rev.location || 'Desconocido'}</span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-text-secondary">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                            <span className="font-medium whitespace-nowrap">{rev.specialist?.full_name?.replace('Ps. ', '')}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex text-yellow-400">
                            {stars.map((s) => (
                              <Star 
                                key={s} 
                                className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-current' : 'text-gray-200'}`} 
                              />
                            ))}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-text-secondary max-w-xs md:max-w-md">
                          <p className="line-clamp-2 hover:line-clamp-none transition-all duration-300 font-light leading-relaxed whitespace-pre-line text-xs">
                            "{rev.comment}"
                          </p>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {rev.is_public ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 flex items-center gap-1 w-fit">
                              <Eye className="w-3 h-3 text-green-500" />
                              <span>Permite Web</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-600 border border-gray-200 flex items-center gap-1 w-fit">
                              <EyeOff className="w-3 h-3 text-gray-400" />
                              <span>Privada</span>
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          {rev.approved && rev.is_public ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500 text-white flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3" />
                              <span>Pública Activa</span>
                            </span>
                          ) : rev.is_public ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center gap-1 w-fit">
                              <ShieldAlert className="w-3 h-3 text-yellow-500" />
                              <span>En Revisión</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 flex items-center gap-1 w-fit">
                              <span>Oculta</span>
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {rev.is_public ? (
                            <button
                              onClick={() => handleToggleApproval(rev.id, rev.approved)}
                              disabled={updatingId === rev.id}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                rev.approved 
                                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                                  : 'bg-accent-primary text-white border-transparent hover:bg-accent-hover'
                              }`}
                            >
                              {updatingId === rev.id ? 'Procesando...' : rev.approved ? 'Ocultar en Web' : 'Mostrar en Web'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-text-muted italic">No publicable</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
