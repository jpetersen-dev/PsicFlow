import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { BookOpen, Plus, Edit, Trash2, Calendar, User, Eye, FileText, CheckCircle } from 'lucide-react';

export default function Publicaciones() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          id,
          title,
          slug,
          category,
          tags,
          status,
          reading_time,
          published_at,
          created_at,
          author:author_id (full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (err: any) {
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este artículo permanentemente? Esta acción no se puede deshacer.')) return;
    setDeletingId(id);
    try {
      const article = articles.find(art => art.id === id);
      if (article) {
        // Delete images from storage bucket if they are uploaded files
        const imagesToDelete = [article.image_url, article.secondary_image_url].filter(Boolean);
        for (const url of imagesToDelete) {
          const bucketSearch = '/public/articles/';
          const index = url.indexOf(bucketSearch);
          if (index !== -1) {
            const oldPath = url.substring(index + bucketSearch.length);
            try {
              await supabase.storage.from('articles').remove([oldPath]);
            } catch (deleteErr) {
              console.warn('Error deleting article image from storage:', deleteErr);
            }
          }
        }
      }

      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setArticles(articles.filter(art => art.id !== id));
    } catch (err: any) {
      alert('Error al eliminar artículo: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No publicado';
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
        <title>Gestión de Publicaciones - PsicFlow</title>
      </Head>

      <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold font-display text-text-primary tracking-tight">
              Publicaciones e Historial Clínico
            </h1>
            <p className="text-sm text-text-secondary">
              Redacta artículos de divulgación, guías y recursos para tus pacientes en la landing page.
            </p>
          </div>
          <Link
            href="/publicaciones/editor"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-accent-hover text-white text-sm font-bold rounded-xl shadow-md transition-all border-0 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Publicación</span>
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-12 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin"></div>
            <p className="text-sm text-text-secondary">Cargando publicaciones...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="bg-bg-card border border-border-color rounded-2xl p-12 text-center space-y-3 shadow-sm">
            <BookOpen className="w-12 h-12 text-text-muted mx-auto" />
            <p className="text-sm text-text-secondary font-medium">Aún no hay publicaciones redactadas.</p>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              Comienza a compartir tus conocimientos sobre psicología y salud mental. Los artículos publicados se sincronizarán directamente con la landing page.
            </p>
            <div className="pt-2">
              <Link
                href="/publicaciones/editor"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-xs font-bold rounded-xl transition-all"
              >
                Crear mi primer artículo
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((art) => (
              <div 
                key={art.id}
                className={`bg-bg-card border rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-5 transition-all hover:shadow-md hover:border-accent-primary/20 ${
                  art.status === 'published' ? 'border-green-200 bg-green-50/5' : 'border-border-color'
                }`}
              >
                <div className="space-y-3">
                  {/* Status and Category */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 bg-accent-primary/10 text-accent-primary rounded-lg text-xs font-semibold">
                      {art.category}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      {art.status === 'published' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500 text-white flex items-center gap-0.5">
                          <CheckCircle className="w-2.5 h-2.5" />
                          <span>Publicado</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-500 flex items-center gap-0.5">
                          <span>Borrador</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title and Slug */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-text-primary text-base line-clamp-2" title={art.title}>
                      {art.title}
                    </h3>
                    <p className="text-[10px] text-text-muted font-mono leading-none truncate">
                      /{art.slug}
                    </p>
                  </div>

                  {/* Tags */}
                  {art.tags && art.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {art.tags.map((tag: string, idx: number) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 bg-bg-input border border-border-color text-text-secondary rounded-lg text-[9px]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer and Actions */}
                <div className="pt-4 border-t border-border-color flex items-center justify-between gap-3 shrink-0">
                  <div className="flex flex-col gap-1 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(art.published_at || art.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      Por {art.author?.full_name?.split(' ')[1] || 'Terapeuta'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Reading Time */}
                    <span className="text-[10px] bg-bg-input px-2 py-1 rounded-lg border border-border-color font-semibold text-text-secondary select-none">
                      {art.reading_time} min
                    </span>

                    {/* Edit Link */}
                    <Link
                      href={`/publicaciones/editor?id=${art.id}`}
                      className="p-1.5 rounded-lg border border-border-color bg-white hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition-all flex items-center justify-center"
                      title="Editar contenido"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(art.id)}
                      disabled={deletingId === art.id}
                      className="p-1.5 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 text-red-600 transition-all cursor-pointer flex items-center justify-center"
                      title="Eliminar publicación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
