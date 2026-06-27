import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import { Star, MessageSquare, Check, X, ShieldAlert, Eye, EyeOff, Calendar, User, Edit2, Trash2, ShieldCheck, HelpCircle } from 'lucide-react';

export default function ResenasAdmin() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedReviewForEdit, setSelectedReviewForEdit] = useState<any | null>(null);
  const [editedComment, setEditedComment] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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
        calculateStats(data);
      }
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: any[]) => {
    const total = data.length;
    const sum = data.reduce((acc, r) => acc + r.rating, 0);
    const average = total > 0 ? parseFloat((sum / total).toFixed(1)) : 0;
    const publicActive = data.filter(r => r.is_public && r.approved).length;
    const pendingApproval = data.filter(r => r.is_public && !r.approved).length;
    
    setStats({ total, average, publicActive, pendingApproval });
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
      
      const updatedReviews = reviews.map(r => r.id === id ? { ...r, approved: !currentApprovedState } : r);
      setReviews(updatedReviews);
      calculateStats(updatedReviews);
    } catch (err: any) {
      alert('Error al actualizar visibilidad: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta valoración permanentemente? Esta acción no se puede deshacer.')) return;
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      const updatedReviews = reviews.filter(r => r.id !== id);
      setReviews(updatedReviews);
      calculateStats(updatedReviews);
    } catch (err: any) {
      alert('Error al eliminar la reseña: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenEditModal = (review: any) => {
    setSelectedReviewForEdit(review);
    setEditedComment(review.comment);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedReviewForEdit || !editedComment.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ comment: editedComment.trim() })
        .eq('id', selectedReviewForEdit.id);

      if (error) throw error;
      
      const updatedReviews = reviews.map(r => r.id === selectedReviewForEdit.id ? { ...r, comment: editedComment.trim() } : r);
      setReviews(updatedReviews);
      setShowEditModal(false);
      setSelectedReviewForEdit(null);
    } catch (err: any) {
      alert('Error al guardar cambios: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <>
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

        {/* Content (Responsive Cards instead of raw tables to prevent horizontal scroll) */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {reviews.map((rev) => {
              const stars = Array.from({ length: 5 }, (_, i) => i + 1);
              return (
                <div 
                  key={rev.id} 
                  className={`bg-bg-card border rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-5 transition-all hover:shadow-md hover:border-accent-primary/20 ${
                    rev.is_public && rev.approved ? 'border-green-200 bg-green-50/5' : 'border-border-color'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Card Header (Stars + Status Flags) */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full text-xs font-bold border border-yellow-500/10">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{rev.rating.toFixed(1)}</span>
                      </div>
                      
                      {/* Privacy and Approval Badges */}
                      <div className="flex items-center gap-1.5">
                        {rev.is_public ? (
                          <span className="p-1 rounded-lg bg-green-50 text-green-600 border border-green-200" title="Permite publicación en la Web">
                            <Eye className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="p-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200" title="Reseña Privada">
                            <EyeOff className="w-3.5 h-3.5" />
                          </span>
                        )}

                        {rev.is_public && rev.approved ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500 text-white flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" />
                            <span>Web Activa</span>
                          </span>
                        ) : rev.is_public ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500 text-white flex items-center gap-0.5">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            <span>En Moderación</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-500 flex items-center gap-0.5">
                            <span>Oculta</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Patient Info */}
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-text-primary text-sm">{rev.patient_name}</h4>
                      <p className="text-xs text-text-muted font-normal">{rev.location || 'Europa'}</p>
                    </div>

                    {/* Therapist target */}
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-primary/10 text-accent-primary rounded-xl text-xs font-semibold">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span>Ps. {rev.specialist?.full_name?.replace('Ps. ', '')}</span>
                    </div>

                    {/* Comment Body */}
                    <p className="text-xs text-text-secondary leading-relaxed italic bg-bg-input p-3.5 rounded-2xl border border-border-color font-light whitespace-pre-line">
                      "{rev.comment}"
                    </p>
                  </div>

                  {/* Actions Section */}
                  <div className="pt-4 border-t border-border-color flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {/* Date */}
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(rev.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEditModal(rev)}
                        disabled={updatingId === rev.id}
                        className="p-1.5 rounded-lg border border-border-color bg-white hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition-all cursor-pointer"
                        title="Corregir redacción"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteReview(rev.id)}
                        disabled={updatingId === rev.id}
                        className="p-1.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 text-red-600 transition-all cursor-pointer"
                        title="Eliminar valoración"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Toggle Visibility (Approved flag) */}
                      {rev.is_public ? (
                        <button
                          onClick={() => handleToggleApproval(rev.id, rev.approved)}
                          disabled={updatingId === rev.id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            rev.approved 
                              ? 'bg-red-500 hover:bg-red-600 text-white border-transparent' 
                              : 'bg-green-500 hover:bg-green-600 text-white border-transparent'
                          }`}
                        >
                          {updatingId === rev.id ? '...' : rev.approved ? 'Desaprobar' : 'Aprobar'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-text-muted italic bg-gray-50 px-2 py-1 rounded border border-gray-100 select-none">
                          Privada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Review Comment Modal */}
      {showEditModal && selectedReviewForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-border-color shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <button 
              onClick={() => { setShowEditModal(false); setSelectedReviewForEdit(null); }}
              className="absolute top-4 right-4 p-1.5 bg-bg-card-hover hover:bg-border-color rounded-full text-text-muted hover:text-text-primary transition-colors cursor-pointer border-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pr-6 shrink-0">
              <h3 className="text-lg font-bold font-display text-text-primary flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-accent-primary" />
                <span>Editar Comentario</span>
              </h3>
              <p className="text-xs text-text-secondary">
                Corrige errores de redacción o dedazos. El cambio se reflejará instantáneamente en la base de datos.
              </p>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div className="flex items-center gap-2 p-2 bg-bg-card-hover rounded-xl border border-border-color text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">{selectedReviewForEdit.patient_name}</span>
                <span>•</span>
                <span>Calificación: {selectedReviewForEdit.rating}★</span>
                <span>•</span>
                <span>Para: {selectedReviewForEdit.specialist?.full_name?.replace('Ps. ', '')}</span>
              </div>

              <textarea
                required
                value={editedComment}
                onChange={(e) => setEditedComment(e.target.value)}
                rows={6}
                placeholder="Escribe la reseña corregida aquí..."
                className="w-full p-3 bg-bg-card-hover border border-border-color rounded-xl text-sm focus:outline-none focus:border-accent-primary transition-all text-text-primary resize-none"
              ></textarea>
            </div>

            <div className="pt-3 border-t border-border-color flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => { setShowEditModal(false); setSelectedReviewForEdit(null); }}
                className="px-4 py-2 border border-border-color hover:bg-bg-card-hover rounded-xl text-xs font-bold text-text-secondary transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !editedComment.trim()}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer border-0"
              >
                {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
