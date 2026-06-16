import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { BookOpen, FolderOpen, FileText, Download, Plus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Biblioteca() {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGlobalResources = async () => {
    setLoading(true);
    try {
      // Fetch files where patient_id is null (global workspace resources)
      const { data } = await supabase
        .from('files_vault')
        .select('*')
        .is('patient_id', null);

      if (data) setResources(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalResources();
  }, []);

  return (
    <>
      <Head>
        <title>PsicoAlivio - Biblioteca de Recursos</title>
      </Head>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-emerald-400" />
              <span>Biblioteca de Recursos</span>
            </h1>
            <p className="text-slate-400 text-sm">Repositorio global indexado por categorías de material de apoyo y guías clínicas.</p>
          </div>
          
          <button 
            onClick={async () => {
              const tenantId = localStorage.getItem('active-tenant-id');
              const { error } = await supabase
                .from('files_vault')
                .insert({
                  organization_id: tenantId,
                  original_name: 'Pauta_Entrevista_Semiestructurada_CIE10.docx',
                  saved_name: 'template_cie10_' + Math.floor(Math.random() * 1000) + '.docx',
                  storage_path: 'templates/cie10.docx',
                  mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  category: 'Plantillas de Informes',
                  description: 'Pauta clínica estructurada para anamnesis del CIE-10.'
                });
              if (error) alert(error.message);
              else fetchGlobalResources();
            }}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-emerald-400 font-bold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition-all self-end sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Pauta (Mock)</span>
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-sm">Cargando biblioteca...</div>
          ) : resources.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm border border-dashed border-slate-850 rounded-xl bg-slate-900/10 space-y-2">
              <FolderOpen className="w-8 h-8 text-slate-700 mx-auto" />
              <p className="font-semibold text-slate-400">La biblioteca está vacía.</p>
              <p className="text-xs text-slate-600">Presione el botón superior para agregar una pauta de prueba.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resources.map((res) => (
                <div key={res.id} className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-start justify-between gap-4 hover:border-slate-700 transition-colors">
                  <div className="space-y-2">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                      {res.category}
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-500" />
                        <span>{res.original_name}</span>
                      </p>
                      <p className="text-xs text-slate-400">{res.description}</p>
                    </div>
                  </div>

                  <button className="bg-slate-950 hover:bg-slate-900 p-2 rounded-lg text-slate-400 hover:text-slate-200 border border-slate-850 transition-all">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
