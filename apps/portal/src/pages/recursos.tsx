import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  FolderOpen, 
  Search, 
  Filter,
  RefreshCw 
} from 'lucide-react';

export default function PatientResources() {
  const [patient, setPatient] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');

  const fetchResources = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data: patData } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(1)
        .single();

      if (patData) {
        setPatient(patData);

        // Fetch shared resources (where patient_id matches or patient_id is null)
        const { data: filesData, error } = await supabase
          .from('files_vault')
          .select('*')
          .or(`patient_id.eq.${patData.id},patient_id.is.null`)
          .order('created_at', { ascending: false });

        if (!error && filesData) {
          setFiles(filesData);
        }
      }
    } catch (err) {
      console.error('Error fetching resources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const handleDownload = async (file: any) => {
    try {
      const { data } = await supabase.storage
        .from('clinical-vault')
        .createSignedUrl(file.storage_path, 60);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        alert('No se pudo generar el enlace de descarga.');
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Filter files based on category and search term
  const filteredFiles = files.filter(f => {
    const matchesSearch = f.original_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (f.description && f.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = activeCategory === 'Todos' || f.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = ['Todos', 'General', 'Guías Clínicas', 'Plantillas', 'Material Psicoeducativo'];

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Cargando recursos...</p>
      </div>
    );
  }

  // Split into exclusive resources vs global ones
  const exclusiveResources = filteredFiles.filter(f => f.patient_id !== null);
  const globalResources = filteredFiles.filter(f => f.patient_id === null);

  return (
    <>
      <Head>
        <title>Mis Recursos - Sentido Migrante</title>
      </Head>

      <div className="space-y-6 pb-12">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Inicio</span>
          </Link>
          <button 
            onClick={() => { setLoading(true); fetchResources(); }}
            className="p-2 border border-[#E2DCD0] hover:bg-[#F9F7F3] rounded-xl transition-all text-[#78716C] cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-[#1C1917] tracking-tight">Biblioteca de Recursos</h1>
          <p className="text-sm text-[#78716C]">Guías, lecturas y plantillas psicoeducativas preparadas por el centro clínico.</p>
        </div>

        {/* Controls: Search and Filter */}
        <div className="bg-white p-4 border border-[#E2DCD0] rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78716C] w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar recurso..."
              className="w-full bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#1C1917] focus:border-[#516750] focus:outline-none"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-[#516750] text-white border-[#516750]'
                    : 'bg-[#F9F7F3] text-[#78716C] border-[#E2DCD0] hover:bg-[#E2DCD0]/35'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {files.length === 0 ? (
          <div className="bg-white border border-[#E2DCD0] rounded-2xl p-12 text-center text-text-muted text-xs">
            Aún no se han subido guías o recursos a tu biblioteca digital.
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Exclusive Resources Section */}
            {exclusiveResources.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold font-display uppercase tracking-wider text-[#78716C] border-b border-[#F2EFE8] pb-2">
                  Material Asignado para Ti
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exclusiveResources.map(file => (
                    <div 
                      key={file.id} 
                      className="bg-white border border-[#516750]/20 rounded-2xl p-5 shadow-sm flex items-start justify-between gap-4 transition-all hover:shadow-md"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-[#DAEDDF] text-[#1A3020]">
                            Personalizado
                          </span>
                          <span className="text-[9px] text-[#78716C] capitalize font-medium">
                            {file.category}
                          </span>
                        </div>
                        <h3 className="font-bold text-[#1C1917] text-sm truncate">{file.original_name}</h3>
                        {file.description && (
                          <p className="text-xs text-[#78716C] font-light line-clamp-2 leading-relaxed">
                            {file.description}
                          </p>
                        )}
                        <p className="text-[9px] text-text-muted">
                          Subido el {new Date(file.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDownload(file)}
                        className="bg-[#516750] hover:bg-[#3f513e] text-white p-2.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-sm"
                        title="Descargar archivo"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Global Resources Section */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold font-display uppercase tracking-wider text-[#78716C] border-b border-[#F2EFE8] pb-2">
                Recursos y Lecturas Generales
              </h2>
              {globalResources.length === 0 ? (
                <div className="py-8 text-center text-text-muted text-xs bg-white border border-[#E2DCD0] rounded-2xl">
                  No hay lecturas generales coincidentes.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {globalResources.map(file => (
                    <div 
                      key={file.id} 
                      className="bg-white border border-[#E2DCD0] rounded-2xl p-5 shadow-sm flex items-start justify-between gap-4 transition-all hover:border-[#516750]/20 hover:shadow-md"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-[#E2DCD0]/35 text-[#3B4E44]">
                            Biblioteca
                          </span>
                          <span className="text-[9px] text-[#78716C] capitalize font-medium">
                            {file.category}
                          </span>
                        </div>
                        <h3 className="font-bold text-[#1C1917] text-sm truncate">{file.original_name}</h3>
                        {file.description && (
                          <p className="text-xs text-[#78716C] font-light line-clamp-2 leading-relaxed">
                            {file.description}
                          </p>
                        )}
                        <p className="text-[9px] text-text-muted">
                          Subido el {new Date(file.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDownload(file)}
                        className="bg-[#516750] hover:bg-[#3f513e] text-white p-2.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-sm"
                        title="Descargar archivo"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </>
  );
}
