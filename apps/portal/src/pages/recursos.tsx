import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  FolderOpen, 
  Search, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
  BookOpen,
  FileSpreadsheet,
  Image as ImageIcon,
  FileAudio,
  File as FileGenericIcon,
  Tag,
  Clock
} from 'lucide-react';

interface VaultFile {
  id: string;
  organization_id: string;
  patient_id: string | null;
  session_id: string | null;
  original_name: string;
  saved_name: string;
  storage_path: string;
  mime_type: string;
  category: string;
  description: string | null;
  size_bytes: number;
  is_shared: boolean;
  created_at: string;
}

interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

const CATEGORIES = [
  'Todos',
  'General',
  'Guías Clínicas',
  'Plantillas',
  'Material Psicoeducativo'
];

/**
 * Format raw bytes into human readable KB / MB
 */
function formatBytes(bytes?: number | null, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format dates into Spanish locale
 */
function formatDateSpanish(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Helper to determine file icon and styling according to MIME / extension
 */
function getFileTypeDetails(mimeType: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType?.toLowerCase() || '';

  if (mime.includes('pdf') || ext === 'pdf') {
    return {
      label: 'PDF',
      Icon: FileText,
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      iconBg: 'bg-rose-100 text-rose-700'
    };
  }

  if (
    mime.includes('word') || 
    mime.includes('officedocument.wordprocessingml') || 
    ext === 'doc' || 
    ext === 'docx'
  ) {
    return {
      label: 'Word',
      Icon: FileText,
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700'
    };
  }

  if (
    mime.includes('spreadsheet') || 
    mime.includes('excel') || 
    mime.includes('csv') || 
    ext === 'xls' || 
    ext === 'xlsx' || 
    ext === 'csv'
  ) {
    return {
      label: 'Excel',
      Icon: FileSpreadsheet,
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700'
    };
  }

  if (
    mime.includes('image') || 
    ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)
  ) {
    return {
      label: 'Imagen',
      Icon: ImageIcon,
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-100 text-purple-700'
    };
  }

  if (
    mime.includes('audio') || 
    ['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)
  ) {
    return {
      label: 'Audio',
      Icon: FileAudio,
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700'
    };
  }

  return {
    label: ext.toUpperCase() || 'Documento',
    Icon: FileGenericIcon,
    badgeBg: 'bg-[#F1EDE4] text-[#3E5C4E] border-[#E2DCD0]',
    iconBg: 'bg-[#DAEDDF] text-[#1A3020]'
  };
}

export default function PatientResources() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  // Auto dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ id: Date.now(), type, message });
  };

  const fetchResources = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const { data: patData, error: patError } = await supabase
        .from('patients')
        .select('id, organization_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();

      if (patError) {
        console.error('Error fetching patient record:', patError);
        showToast('error', 'No se pudo verificar la información del paciente.');
        return;
      }

      if (patData) {
        const { data: filesData, error: filesError } = await supabase
          .from('files_vault')
          .select('*')
          .eq('is_shared', true)
          .or(`patient_id.eq.${patData.id},patient_id.is.null`)
          .order('created_at', { ascending: false });

        if (filesError) {
          console.error('Error fetching resources:', filesError);
          showToast('error', 'Ocurrió un problema al cargar los recursos de la biblioteca.');
        } else if (filesData) {
          setFiles(filesData as VaultFile[]);
          if (isManualRefresh) {
            showToast('info', 'Biblioteca de recursos actualizada.');
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching resources:', err);
      showToast('error', 'Error inesperado al conectar con el servidor.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const handleDownload = async (file: VaultFile) => {
    if (downloadingId) return;
    setDownloadingId(file.id);

    try {
      const { data, error } = await supabase.storage
        .from('clinical-vault')
        .createSignedUrl(file.storage_path, 60);

      if (error || !data?.signedUrl) {
        console.error('Signed URL generation error:', error);
        showToast('error', 'No se pudo generar el enlace seguro de descarga. Intenta nuevamente.');
        return;
      }

      // Create a temporary anchor to trigger direct download / open
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('success', `Descarga iniciada: ${file.original_name}`);
    } catch (err) {
      console.error('Download error:', err);
      showToast('error', 'Ocurrió un error inesperado al procesar la descarga.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Multi-field live search & category filter
  const filteredFiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return files.filter(f => {
      // Category check
      const matchesCategory = activeCategory === 'Todos' || f.category === activeCategory;
      if (!matchesCategory) return false;

      // If no search term, pass category match
      if (!term) return true;

      const nameMatch = f.original_name.toLowerCase().includes(term);
      const descMatch = f.description ? f.description.toLowerCase().includes(term) : false;
      const catMatch = f.category ? f.category.toLowerCase().includes(term) : false;
      const mimeMatch = f.mime_type ? f.mime_type.toLowerCase().includes(term) : false;
      const extMatch = f.original_name.split('.').pop()?.toLowerCase().includes(term) || false;

      return nameMatch || descMatch || catMatch || mimeMatch || extMatch;
    });
  }, [files, searchTerm, activeCategory]);

  const resetFilters = () => {
    setSearchTerm('');
    setActiveCategory('Todos');
  };

  // Split into exclusive (assigned to patient) vs global library resources
  const exclusiveResources = useMemo(() => {
    return filteredFiles.filter(f => f.patient_id !== null);
  }, [filteredFiles]);

  const globalResources = useMemo(() => {
    return filteredFiles.filter(f => f.patient_id === null);
  }, [filteredFiles]);

  return (
    <>
      <Head>
        <title>Biblioteca de Recursos - Sentido Migrante</title>
        <meta name="description" content="Guías, lecturas y plantillas psicoeducativas preparadas por el centro clínico." />
      </Head>

      {/* Non-blocking Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-200">
          <div 
            className={`p-4 rounded-2xl shadow-lg border flex items-start gap-3 backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                : toast.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                : 'bg-[#DAEDDF]/95 border-[#A8C4B4] text-[#1A3020]'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-[#3E5C4E] shrink-0 mt-0.5" />}
            
            <div className="flex-1 text-xs font-medium leading-relaxed">
              {toast.message}
            </div>

            <button
              onClick={() => setToast(null)}
              className="text-[#78716C] hover:text-[#1C1917] transition-colors p-0.5 rounded cursor-pointer"
              title="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 pb-16 max-w-7xl mx-auto">
        {/* Navigation Bar & Refresh Action */}
        <div className="flex items-center justify-between">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#3E5C4E] hover:text-[#1A3020] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Volver al Panel Principal</span>
          </Link>
          <button 
            onClick={() => fetchResources(true)}
            disabled={isRefreshing || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2DCD0] bg-white hover:bg-[#F9F7F3] rounded-xl transition-all text-[#78716C] text-xs font-medium cursor-pointer disabled:opacity-50 shadow-2xs"
            title="Actualizar biblioteca"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#3E5C4E]' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>

        {/* Page Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#DAEDDF] text-[#1A3020] border border-[#A8C4B4]/40">
            <BookOpen className="w-3.5 h-3.5 text-[#3E5C4E]" />
            <span>Material Clínico y Psicoeducativo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-[#1C1917] tracking-tight">
            Biblioteca de Recursos
          </h1>
          <p className="text-xs md:text-sm text-[#78716C] max-w-2xl leading-relaxed">
            Accede a guías clínicas, lecturas especializadas y plantillas prácticas compartidas por tu equipo terapéutico.
          </p>
        </div>

        {/* Search and Category Filter Toolbar */}
        <div className="bg-white p-4 md:p-5 border border-[#E2DCD0] rounded-2xl shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search input with clear button */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78716C] w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por título, contenido, formato (.pdf, docx) o categoría..."
                className="w-full bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#1C1917] placeholder:text-[#78716C]/70 focus:border-[#3E5C4E] focus:bg-white focus:outline-none transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] p-1 rounded-md transition-colors cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick stats indicator */}
            {!loading && (
              <div className="text-[11px] font-medium text-[#78716C] px-1 flex items-center gap-1.5 shrink-0 self-end md:self-center">
                <span>{filteredFiles.length} de {files.length} {files.length === 1 ? 'recurso' : 'recursos'}</span>
              </div>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 hide-scrollbar">
            <span className="text-[11px] font-semibold text-[#78716C] flex items-center gap-1 shrink-0 mr-1">
              <Tag className="w-3 h-3 text-[#3E5C4E]" />
              <span>Categoría:</span>
            </span>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#3E5C4E] text-white border-[#3E5C4E] shadow-2xs'
                      : 'bg-[#F9F7F3] text-[#78716C] border-[#E2DCD0] hover:bg-[#E2DCD0]/40 hover:text-[#1C1917]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          /* Loading Skeletons matching the 2-column clinical card grid */
          <div className="space-y-8 animate-pulse">
            <div className="space-y-4">
              <div className="h-5 bg-[#E2DCD0]/60 rounded-md w-48"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(idx => (
                  <div key={idx} className="bg-white border border-[#E2DCD0] rounded-2xl p-5 shadow-xs flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#F9F7F3] shrink-0"></div>
                    <div className="space-y-2.5 flex-1">
                      <div className="flex gap-2">
                        <div className="h-4 bg-[#F9F7F3] rounded w-16"></div>
                        <div className="h-4 bg-[#F9F7F3] rounded w-20"></div>
                      </div>
                      <div className="h-4 bg-[#E2DCD0]/60 rounded w-3/4"></div>
                      <div className="h-3 bg-[#F9F7F3] rounded w-full"></div>
                      <div className="h-3 bg-[#F9F7F3] rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : files.length === 0 ? (
          /* Global Empty State: No files uploaded yet */
          <div className="bg-white border border-[#E2DCD0] rounded-3xl p-12 text-center max-w-xl mx-auto shadow-xs space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#DAEDDF] text-[#3E5C4E] flex items-center justify-center mx-auto shadow-2xs">
              <FolderOpen className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-[#1C1917] font-display">
                Tu biblioteca digital está en preparación
              </h2>
              <p className="text-xs text-[#78716C] leading-relaxed">
                A medida que avances en tu proceso terapéutico, tu profesional y el centro clínico compartirán guías, ejercicios y lecturas en este espacio seguro.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchResources(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3E5C4E] hover:bg-[#354F43] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Comprobar nuevos recursos</span>
            </button>
          </div>
        ) : filteredFiles.length === 0 ? (
          /* Search Empty State with Reset Filters CTA */
          <div className="bg-white border border-[#E2DCD0] rounded-3xl p-10 text-center max-w-lg mx-auto shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F9F7F3] text-[#78716C] border border-[#E2DCD0] flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-[#1C1917] font-display">
                No se encontraron recursos coincidentes
              </h2>
              <p className="text-xs text-[#78716C] leading-relaxed">
                No hay materiales que coincidan con la búsqueda {searchTerm ? `"${searchTerm}"` : ''} en la categoría seleccionada ({activeCategory}).
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3E5C4E] hover:bg-[#354F43] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restablecer filtros y ver todos</span>
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Section 1: Assigned Patient Resources */}
            {exclusiveResources.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#F2EFE8] pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#3E5C4E]"></div>
                    <h2 className="text-xs font-bold font-display uppercase tracking-wider text-[#1A3020]">
                      Material Asignado para Ti
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DAEDDF] text-[#1A3020]">
                    {exclusiveResources.length} {exclusiveResources.length === 1 ? 'documento exclusivo' : 'documentos exclusivos'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exclusiveResources.map(file => {
                    const typeDetails = getFileTypeDetails(file.mime_type, file.original_name);
                    const FileIcon = typeDetails.Icon;
                    const isDownloading = downloadingId === file.id;

                    return (
                      <div 
                        key={file.id} 
                        className="group bg-white border border-[#3E5C4E]/25 hover:border-[#3E5C4E] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          {/* File Type Icon container */}
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${typeDetails.iconBg}`}>
                            <FileIcon className="w-5 h-5" />
                          </div>

                          {/* File Meta and Title */}
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#DAEDDF] text-[#1A3020]">
                                <Sparkles className="w-2.5 h-2.5 text-[#3E5C4E]" />
                                Asignado a Ti
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold border ${typeDetails.badgeBg}`}>
                                {typeDetails.label}
                              </span>
                              <span className="text-[10px] text-[#78716C] font-medium">
                                {file.category}
                              </span>
                            </div>

                            <h3 className="font-bold text-[#1C1917] text-sm group-hover:text-[#3E5C4E] transition-colors leading-snug break-words">
                              {file.original_name}
                            </h3>

                            {file.description && (
                              <p className="text-xs text-[#78716C] font-normal leading-relaxed line-clamp-2">
                                {file.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Metadata and Download CTA */}
                        <div className="pt-3 border-t border-[#F2EFE8] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 text-[10px] text-[#78716C]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#78716C]" />
                              {formatDateSpanish(file.created_at)}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-[#3B4E44]">
                              {formatBytes(file.size_bytes)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDownload(file)}
                            disabled={isDownloading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3E5C4E] hover:bg-[#354F43] disabled:bg-[#3E5C4E]/60 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-xs"
                            title="Descargar archivo de forma segura"
                          >
                            {isDownloading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-[11px]">Generando enlace...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Descargar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Global Clinic Resources */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F2EFE8] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#78716C]"></div>
                  <h2 className="text-xs font-bold font-display uppercase tracking-wider text-[#78716C]">
                    Recursos y Lecturas Generales
                  </h2>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F1EDE4] text-[#3B4E44]">
                  {globalResources.length} {globalResources.length === 1 ? 'recurso disponible' : 'recursos disponibles'}
                </span>
              </div>

              {globalResources.length === 0 ? (
                <div className="py-8 text-center text-[#78716C] text-xs bg-white border border-[#E2DCD0] rounded-2xl">
                  No hay lecturas generales coincidentes con el filtro actual.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {globalResources.map(file => {
                    const typeDetails = getFileTypeDetails(file.mime_type, file.original_name);
                    const FileIcon = typeDetails.Icon;
                    const isDownloading = downloadingId === file.id;

                    return (
                      <div 
                        key={file.id} 
                        className="group bg-white border border-[#E2DCD0] hover:border-[#3E5C4E]/40 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          {/* File Type Icon container */}
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${typeDetails.iconBg}`}>
                            <FileIcon className="w-5 h-5" />
                          </div>

                          {/* File Meta and Title */}
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-[#F1EDE4] text-[#3B4E44]">
                                <BookOpen className="w-2.5 h-2.5 text-[#3E5C4E]" />
                                Biblioteca General
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold border ${typeDetails.badgeBg}`}>
                                {typeDetails.label}
                              </span>
                              <span className="text-[10px] text-[#78716C] font-medium">
                                {file.category}
                              </span>
                            </div>

                            <h3 className="font-bold text-[#1C1917] text-sm group-hover:text-[#3E5C4E] transition-colors leading-snug break-words">
                              {file.original_name}
                            </h3>

                            {file.description && (
                              <p className="text-xs text-[#78716C] font-normal leading-relaxed line-clamp-2">
                                {file.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Metadata and Download CTA */}
                        <div className="pt-3 border-t border-[#F2EFE8] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 text-[10px] text-[#78716C]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#78716C]" />
                              {formatDateSpanish(file.created_at)}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-[#3B4E44]">
                              {formatBytes(file.size_bytes)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDownload(file)}
                            disabled={isDownloading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3E5C4E] hover:bg-[#354F43] disabled:bg-[#3E5C4E]/60 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-xs"
                            title="Descargar archivo de forma segura"
                          >
                            {isDownloading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-[11px]">Generando enlace...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Descargar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </>
  );
}
