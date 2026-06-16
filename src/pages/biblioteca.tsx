import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { BookOpen, FolderOpen, FileText, Download, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface VaultFile {
  id: string;
  original_name: string;
  saved_name: string;
  storage_path: string;
  mime_type: string;
  category: string;
  description: string | null;
  created_at: string;
}

export default function Biblioteca() {
  const [resources, setResources] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGlobalResources = async () => {
    setLoading(true);
    try {
      // Fetch files where patient_id is null (global workspace resources)
      const { data } = await supabase
        .from('files_vault')
        .select('*')
        .is('patient_id', null)
        .order('created_at', { ascending: false });

      if (data) setResources(data as VaultFile[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalResources();
  }, []);

  const handleUploadFile = async (file: File) => {
    const tenantId = localStorage.getItem('active-tenant-id') || '';
    const savedName = `lib_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
    const storagePath = `${tenantId}/biblioteca/${savedName}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('clinical-vault')
      .upload(storagePath, file);

    if (uploadErr) {
      alert('Error al subir archivo: ' + uploadErr.message);
      return;
    }

    // Register in files_vault table (no patient_id = global resource)
    const { error: dbErr } = await supabase
      .from('files_vault')
      .insert({
        organization_id: tenantId,
        patient_id: null,
        original_name: file.name,
        saved_name: savedName,
        storage_path: storagePath,
        mime_type: file.type || 'application/octet-stream',
        category: 'Recurso General',
        description: '',
      });

    if (dbErr) {
      alert('Error al registrar archivo: ' + dbErr.message);
      return;
    }
    fetchGlobalResources();
  };

  const handleDownload = async (storagePath: string) => {
    const { data } = await supabase.storage
      .from('clinical-vault')
      .createSignedUrl(storagePath, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      alert('No se pudo generar el enlace de descarga.');
    }
  };

  const handleDelete = async (file: VaultFile) => {
    if (!confirm(`¿Eliminar "${file.original_name}" permanentemente?`)) return;

    // Delete from storage
    if (file.storage_path) {
      await supabase.storage.from('clinical-vault').remove([file.storage_path]);
    }
    // Delete from database
    const { error } = await supabase.from('files_vault').delete().eq('id', file.id);
    if (error) alert(error.message);
    else fetchGlobalResources();
  };

  return (
    <>
      <Head>
        <title>PsicoAlivio - Biblioteca de Recursos</title>
      </Head>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-text-primary">
              <BookOpen className="w-6 h-6 text-accent-primary" />
              <span>Biblioteca de Recursos</span>
            </h1>
            <p className="text-text-secondary text-sm">Repositorio global indexado por categorías de material de apoyo y guías clínicas.</p>
          </div>
          
          <label className="bg-bg-input border border-border-color hover:bg-bg-card-hover text-accent-primary font-bold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition-all self-end sm:self-auto cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Subir Recurso</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.xlsx,.pptx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleUploadFile(file);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </div>

        <div className="bg-bg-card border border-border-color rounded-2xl p-6">
          {loading ? (
            <div className="py-20 text-center text-text-muted text-sm">Cargando biblioteca...</div>
          ) : resources.length === 0 ? (
            <div className="py-20 text-center text-text-muted text-sm border border-dashed border-border-color rounded-xl bg-bg-primary/20 space-y-2">
              <FolderOpen className="w-8 h-8 text-text-muted mx-auto" />
              <p className="font-semibold text-text-secondary">La biblioteca está vacía.</p>
              <p className="text-xs text-text-muted">Presione el botón superior para subir un recurso clínico.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resources.map((res) => (
                <div key={res.id} className="bg-bg-input border border-border-color p-4 rounded-xl flex items-start justify-between gap-4 hover:border-border-focus transition-colors">
                  <div className="space-y-2 flex-1 min-w-0">
                    <span className="bg-accent-primary/10 text-accent-primary border border-accent-primary/20 px-2 py-0.5 rounded text-[10px] font-bold">
                      {res.category}
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-text-primary flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-accent-primary shrink-0" />
                        <span className="truncate">{res.original_name}</span>
                      </p>
                      {res.description && (
                        <p className="text-xs text-text-secondary">{res.description}</p>
                      )}
                      <p className="text-[10px] text-text-muted">{res.mime_type}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleDownload(res.storage_path)}
                      className="bg-bg-card hover:bg-bg-card-hover p-2 rounded-lg text-text-secondary hover:text-accent-primary border border-border-color transition-all"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(res)}
                      className="bg-bg-card hover:bg-bg-card-hover p-2 rounded-lg text-text-secondary hover:text-danger border border-border-color transition-all"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-border-color/30 text-center text-text-muted text-[10px]">
          <p>Los archivos se almacenan de forma cifrada en Supabase Storage con aislamiento multi-tenant.</p>
        </footer>
      </div>
    </>
  );
}
