/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  BookOpen, 
  FolderOpen, 
  FileText, 
  Download, 
  Plus, 
  Trash2, 
  Settings, 
  X, 
  HardDrive,
  AlertTriangle,
  UploadCloud,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Users,
  User
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { hasFeature } from '../utils/planFeatures';

interface VaultFile {
  id: string;
  organization_id: string;
  patient_id: string | null;
  original_name: string;
  saved_name: string;
  storage_path: string;
  mime_type: string;
  category: string;
  description: string | null;
  size_bytes: number;
  is_shared: boolean;
  created_at: string;
  patient?: {
    id: string;
    full_name: string;
    rut_patient?: string;
  } | null;
}

interface ResourceCategory {
  id: string;
  name: string;
}

interface PatientOption {
  id: string;
  full_name: string;
  rut_patient?: string;
}

export default function Biblioteca() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'global' | 'pacientes'>('global');
  const [resources, setResources] = useState<VaultFile[]>([]);
  const [patientResources, setPatientResources] = useState<VaultFile[]>([]);
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('Starter');
  
  // Storage usage states
  const [vaultSize, setVaultSize] = useState<number>(0);
  const LIMIT_BYTES = 15 * 1024 * 1024; // 15MB limit for QA environments

  // Modals visibility states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // New category form state
  const [newCategoryName, setNewCategoryName] = useState('');

  // Upload file form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [uploading, setUploading] = useState(false);

  const canShareWithPatient = hasFeature(currentPlan, 'portal');

  const fetchOrgAndPlan = async () => {
    try {
      const tenantId = localStorage.getItem('active-tenant-id') || '';
      if (!tenantId) return;
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, current_plan')
        .eq('id', tenantId)
        .maybeSingle();
      if (orgData) {
        setOrganization(orgData);
        setCurrentPlan(orgData.current_plan || 'Starter');
      }
    } catch (err) {
      console.error('Error fetching org plan:', err);
    }
  };

  const fetchGlobalResources = async () => {
    setLoading(true);
    try {
      // Fetch files where patient_id is null (global workspace resources)
      const { data, error } = await supabase
        .from('files_vault')
        .select('*')
        .is('patient_id', null)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setResources(data as VaultFile[]);
      }
    } catch (err) {
      console.error('Error fetching global resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientResources = async () => {
    setLoadingPatients(true);
    try {
      // Fetch files where patient_id is NOT null (patient-assigned resources)
      const { data, error } = await supabase
        .from('files_vault')
        .select('*, patient:patient_id (id, full_name, rut_patient)')
        .not('patient_id', 'is', null)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPatientResources(data as VaultFile[]);
      }
    } catch (err) {
      console.error('Error fetching patient resources:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchPatientsList = async () => {
    try {
      const tenantId = localStorage.getItem('active-tenant-id') || '';
      if (!tenantId) return;
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, rut_patient')
        .eq('organization_id', tenantId)
        .order('full_name', { ascending: true });
      if (!error && data) {
        setPatients(data);
      }
    } catch (err) {
      console.error('Error fetching patients list:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from('resource_categories')
        .select('id, name')
        .order('name', { ascending: true });
      if (data) {
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching resource categories:', err);
    }
  };

  const fetchVaultSize = async () => {
    try {
      const { data } = await supabase
        .from('files_vault')
        .select('size_bytes');
      if (data) {
        const total = data.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
        setVaultSize(total);
      }
    } catch (err) {
      console.error('Error fetching vault size:', err);
    }
  };

  useEffect(() => {
    fetchOrgAndPlan();
    fetchGlobalResources();
    fetchPatientResources();
    fetchCategories();
    fetchPatientsList();
    fetchVaultSize();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const tenantId = localStorage.getItem('active-tenant-id') || '';
    
    try {
      const { error } = await supabase
        .from('resource_categories')
        .insert({
          organization_id: tenantId,
          name: newCategoryName.trim()
        });

      if (error) {
        if (error.code === '23505') {
          alert('La categoría ya existe.');
        } else {
          throw error;
        }
      } else {
        setNewCategoryName('');
        fetchCategories();
      }
    } catch (err: any) {
      alert('Error al crear categoría: ' + err.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta categoría? Nota: Los archivos existentes mantendrán su categoría asignada.')) return;
    try {
      const { error } = await supabase
        .from('resource_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchCategories();
    } catch (err: any) {
      alert('Error al eliminar categoría: ' + err.message);
    }
  };

  const handleSelectFileForUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size first before opening modal
      if (vaultSize + file.size > LIMIT_BYTES) {
        alert(`Supera la cuota límite de almacenamiento de 15 MB para entorno QA (Tamaño actual: ${(vaultSize / 1024 / 1024).toFixed(2)} MB, Intentando subir: ${(file.size / 1024 / 1024).toFixed(2)} MB). Por favor elimine otros archivos.`);
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      setUploadCategory(categories[0]?.name || 'Recurso General');
      setUploadDescription('');
      setSelectedPatientId('');
      setIsUploadModalOpen(true);
      e.target.value = '';
    }
  };

  const handleUploadFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    
    setUploading(true);
    const tenantId = localStorage.getItem('active-tenant-id') || '';
    const isPatientAssigned = Boolean(selectedPatientId && canShareWithPatient);
    const patientIdToSave = isPatientAssigned ? selectedPatientId : null;
    const savedName = isPatientAssigned
      ? `patient_${Date.now()}_${selectedFile.name.replace(/\s/g, '_')}`
      : `lib_${Date.now()}_${selectedFile.name.replace(/\s/g, '_')}`;
    const storagePath = isPatientAssigned
      ? `${tenantId}/${selectedPatientId}/${savedName}`
      : `${tenantId}/biblioteca/${savedName}`;

    try {
      // 1. Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('clinical-vault')
        .upload(storagePath, selectedFile);

      if (uploadErr) throw uploadErr;

      // 2. Register in files_vault table
      // Per R3: When patient is assigned, save patient_id and is_shared = true. Global resources are also is_shared = true.
      const { error: dbErr } = await supabase
        .from('files_vault')
        .insert({
          organization_id: tenantId,
          patient_id: patientIdToSave,
          original_name: selectedFile.name,
          saved_name: savedName,
          storage_path: storagePath,
          mime_type: selectedFile.type || 'application/octet-stream',
          category: uploadCategory,
          description: uploadDescription.trim(),
          size_bytes: selectedFile.size,
          is_shared: true
        });

      if (dbErr) throw dbErr;

      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setSelectedPatientId('');
      fetchGlobalResources();
      fetchPatientResources();
      fetchVaultSize();
      alert('Recurso subido exitosamente.');
    } catch (err: any) {
      alert('Error en la subida: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleFileShare = async (file: VaultFile) => {
    if (!canShareWithPatient) {
      router.push('/plan');
      return;
    }
    try {
      const nextShared = !file.is_shared;
      const { error: updateErr } = await supabase
        .from('files_vault')
        .update({ is_shared: nextShared })
        .eq('id', file.id);

      if (updateErr) throw updateErr;

      setPatientResources((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, is_shared: nextShared } : f))
      );
      setResources((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, is_shared: nextShared } : f))
      );
    } catch (err: any) {
      console.error('Error toggling file share:', err);
      alert('Error al actualizar visibilidad: ' + (err.message || 'Error desconocido'));
    }
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

    try {
      // Delete from storage
      if (file.storage_path) {
        await supabase.storage.from('clinical-vault').remove([file.storage_path]);
      }
      // Delete from database
      const { error } = await supabase.from('files_vault').delete().eq('id', file.id);
      if (error) throw error;
      
      fetchGlobalResources();
      fetchPatientResources();
      fetchVaultSize();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usagePercent = Math.min((vaultSize / LIMIT_BYTES) * 100, 100);

  return (
    <>
      <Head>
        <title>PsicFlow - Biblioteca de Recursos</title>
      </Head>

      <div className="space-y-6">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-text-primary">
              <BookOpen className="w-6 h-6 text-accent-primary" />
              <span>Biblioteca de Recursos</span>
            </h1>
            <p className="text-text-secondary text-sm">Repositorio global y asignaciones a pacientes con control de visibilidad en Portal.</p>
          </div>
          
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="bg-bg-card border border-border-color hover:bg-bg-card-hover text-text-primary font-bold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-text-muted" />
              <span>Categorías</span>
            </button>

            <label className="bg-bg-input border border-border-color hover:bg-bg-card-hover text-accent-primary font-bold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>Subir Recurso</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.xlsx,.pptx"
                onChange={handleSelectFileForUpload}
              />
            </label>
          </div>
        </div>

        {/* Space Utilization Meter */}
        <div className="bg-bg-card border border-border-color rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 max-w-md">
            <div className="flex justify-between items-center text-xs font-bold text-text-primary">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-4.5 h-4.5 text-accent-primary" />
                <span>Espacio de Almacenamiento (Entorno QA)</span>
              </span>
              <span>{formatBytes(vaultSize)} / 15 MB</span>
            </div>
            <div className="w-full bg-bg-primary/20 h-2 rounded-full overflow-hidden">
              <div 
                style={{ width: `${usagePercent}%` }}
                className={`h-full rounded-full ${usagePercent > 85 ? 'bg-danger' : usagePercent > 50 ? 'bg-warning' : 'bg-accent-primary'}`}
              ></div>
            </div>
          </div>
          {usagePercent > 80 && (
            <div className="flex items-center gap-2 text-danger bg-danger/10 border border-danger/20 p-2.5 rounded-xl text-xs">
              <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
              <p className="font-semibold">¡Alerta! Estás superando el 80% del límite de cuota.</p>
            </div>
          )}
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center gap-2 border-b border-border-color pb-1">
          <button
            onClick={() => setActiveTab('global')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'global'
                ? 'bg-accent-primary text-bg-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-input'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Recursos Globales ({resources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pacientes')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'pacientes'
                ? 'bg-accent-primary text-bg-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-input'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Asignados a Pacientes ({patientResources.length})</span>
          </button>
        </div>

        {/* Main List: Global Resources */}
        {activeTab === 'global' && (
          <div className="bg-bg-card border border-border-color rounded-2xl p-6">
            {loading ? (
              <div className="py-20 text-center text-text-muted text-sm">Cargando biblioteca global...</div>
            ) : resources.length === 0 ? (
              <div className="py-20 text-center text-text-muted text-sm border border-dashed border-border-color rounded-xl bg-bg-primary/20 space-y-2">
                <FolderOpen className="w-8 h-8 text-text-muted mx-auto" />
                <p className="font-semibold text-text-secondary">La biblioteca global está vacía.</p>
                <p className="text-xs text-text-muted">Presione el botón superior para subir un recurso clínico global.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map((res) => (
                  <div key={res.id} className="bg-bg-input border border-border-color p-4 rounded-xl flex items-start justify-between gap-4 hover:border-border-focus transition-colors">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-accent-primary/10 text-accent-primary border border-accent-primary/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          {res.category}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg-card text-text-muted border border-border-color">
                          <Globe className="w-3 h-3" />
                          <span>Global</span>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-primary flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-accent-primary shrink-0" />
                          <span className="truncate" title={res.original_name}>{res.original_name}</span>
                        </p>
                        {res.description && (
                          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{res.description}</p>
                        )}
                        <p className="text-[10px] text-text-muted">
                          {res.mime_type} • {formatBytes(res.size_bytes)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleDownload(res.storage_path)}
                        className="bg-bg-card hover:bg-bg-card-hover p-2 rounded-lg text-text-secondary hover:text-accent-primary border border-border-color transition-all cursor-pointer"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(res)}
                        className="bg-bg-card hover:bg-bg-card-hover p-2 rounded-lg text-text-secondary hover:text-danger border border-border-color transition-all cursor-pointer"
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
        )}

        {/* Main List: Patient Assigned Resources */}
        {activeTab === 'pacientes' && (
          <div className="bg-bg-card border border-border-color rounded-2xl p-6">
            {loadingPatients ? (
              <div className="py-20 text-center text-text-muted text-sm">Cargando archivos asignados a pacientes...</div>
            ) : patientResources.length === 0 ? (
              <div className="py-20 text-center text-text-muted text-sm border border-dashed border-border-color rounded-xl bg-bg-primary/20 space-y-2">
                <Users className="w-8 h-8 text-text-muted mx-auto" />
                <p className="font-semibold text-text-secondary">No hay archivos asignados a pacientes específicos.</p>
                <p className="text-xs text-text-muted">Al subir un recurso puedes vincularlo directamente al portal de un paciente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patientResources.map((res) => (
                  <div key={res.id} className="bg-bg-input border border-border-color p-4 rounded-xl flex items-start justify-between gap-4 hover:border-border-focus transition-colors">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-accent-primary/10 text-accent-primary border border-accent-primary/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          {res.category}
                        </span>
                        {res.patient && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-primary/15 text-accent-primary border border-accent-primary/30">
                            <User className="w-3 h-3" />
                            <span>{res.patient.full_name}</span>
                          </span>
                        )}
                        {res.is_shared ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            <Eye className="w-3 h-3" />
                            <span>Visible en Portal</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-bg-card text-text-muted border border-border-color shrink-0">
                            <EyeOff className="w-3 h-3" />
                            <span>Privado</span>
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-primary flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-accent-primary shrink-0" />
                          <span className="truncate" title={res.original_name}>{res.original_name}</span>
                        </p>
                        {res.description && (
                          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{res.description}</p>
                        )}
                        <p className="text-[10px] text-text-muted">
                          {res.mime_type} • {formatBytes(res.size_bytes)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleFileShare(res)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          res.is_shared
                            ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20'
                            : 'bg-bg-card border-border-color text-text-muted hover:text-text-primary hover:bg-bg-card-hover'
                        }`}
                        title={
                          canShareWithPatient
                            ? res.is_shared
                              ? 'Visible para el paciente en su Portal. Clic para ocultar.'
                              : 'Privado. Clic para compartir en el Portal del paciente.'
                            : 'Sincronización con Portal disponible en Plan Enterprise. Clic para ver planes.'
                        }
                      >
                        {canShareWithPatient ? (
                          res.is_shared ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                            <EyeOff className="w-3.5 h-3.5 text-text-muted" />
                          </div>
                        )}
                      </button>
                      <button 
                        onClick={() => handleDownload(res.storage_path)}
                        className="bg-bg-card hover:bg-bg-card-hover p-2 rounded-lg text-text-secondary hover:text-accent-primary border border-border-color transition-all cursor-pointer"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(res)}
                        className="bg-bg-card hover:bg-bg-card-hover p-2 rounded-lg text-text-secondary hover:text-danger border border-border-color transition-all cursor-pointer"
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
        )}

        {/* Modal: Categorías de Recursos */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bg-card rounded-2xl max-w-md w-full shadow-xl border border-border-color overflow-hidden transform transition-all duration-300">
              <div className="p-5 border-b border-border-color flex justify-between items-center bg-bg-primary/20">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Settings className="w-5 h-5 text-accent-primary" />
                  <span>Administración de Categorías</span>
                </h3>
                <button 
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="text-text-muted hover:text-text-primary p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Form to create */}
                <form onSubmit={handleCreateCategory} className="flex gap-2">
                  <input 
                    type="text" 
                    required
                    placeholder="Nueva categoría..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 bg-bg-input border border-border-color px-3 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-accent-primary focus:outline-none text-text-primary"
                  />
                  <button 
                    type="submit"
                    className="bg-accent-primary text-on-accent-primary px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-accent-primary/80 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear</span>
                  </button>
                </form>

                {/* Categories List */}
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {categories.length === 0 ? (
                    <p className="text-center text-text-muted text-xs py-4">No hay categorías personalizadas creadas.</p>
                  ) : (
                    categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-2.5 bg-bg-input rounded-lg border border-border-color text-xs">
                        <span className="font-semibold text-text-primary">{cat.name}</span>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="text-text-muted hover:text-danger p-1 hover:bg-bg-card rounded transition-colors cursor-pointer"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-border-color/30 flex justify-end">
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 border border-border-color text-text-primary hover:bg-bg-input rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Subir Archivo a Biblioteca */}
        {isUploadModalOpen && selectedFile && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bg-card rounded-2xl max-w-md w-full shadow-xl border border-border-color overflow-hidden transform transition-all duration-300">
              <div className="p-5 border-b border-border-color flex justify-between items-center bg-bg-primary/20">
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-accent-primary" />
                  <span>Subir Archivo a la Biblioteca</span>
                </h3>
                <button 
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setSelectedFile(null);
                    setSelectedPatientId('');
                  }}
                  className="text-text-muted hover:text-text-primary p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUploadFileSubmit} className="p-5 space-y-4">
                <div className="p-3 bg-bg-input/60 rounded-xl border border-border-color text-xs space-y-1">
                  <p className="font-bold text-text-primary truncate">Archivo: {selectedFile.name}</p>
                  <p className="text-text-secondary">Tamaño: {formatBytes(selectedFile.size)}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Categoría</label>
                  <select 
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full bg-bg-input border border-border-color px-3 py-2 rounded-lg text-xs focus:ring-1 focus:ring-accent-primary focus:outline-none text-text-primary cursor-pointer"
                  >
                    <option value="Recurso General">Recurso General</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Patient Selector with Enterprise Plan Gate */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-text-secondary uppercase">
                      Asignar a Paciente (Portal de Pacientes)
                    </label>
                    {!canShareWithPatient && (
                      <span 
                        onClick={() => router.push('/plan')}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full cursor-pointer hover:bg-amber-500/25 transition-colors"
                      >
                        <Lock className="w-3 h-3 text-amber-500" />
                        <span>Plan Enterprise</span>
                      </span>
                    )}
                  </div>
                  
                  {canShareWithPatient ? (
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full bg-bg-input border border-border-color px-3 py-2 rounded-lg text-xs focus:ring-1 focus:ring-accent-primary focus:outline-none text-text-primary cursor-pointer"
                    >
                      <option value="">Recurso Global (Toda la Clínica / No Asignado)</option>
                      {patients.map((pat) => (
                        <option key={pat.id} value={pat.id}>
                          {pat.full_name} {pat.rut_patient ? `(${pat.rut_patient})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      onClick={() => router.push('/plan')}
                      className="p-3 bg-amber-500/5 border border-amber-500/25 rounded-xl flex items-start gap-2.5 cursor-pointer hover:bg-amber-500/10 transition-colors group"
                      title="Requiere Plan Enterprise. Clic para ver planes."
                    >
                      <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5 flex-1">
                        <p className="font-semibold text-text-primary flex items-center justify-between">
                          <span>Asignación a Portal de Pacientes</span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold underline">Actualizar</span>
                        </p>
                        <p className="text-[10px] text-text-muted">
                          Asignar archivos directamente a pacientes individuales en su portal requiere el Plan Enterprise.
                        </p>
                      </div>
                    </div>
                  )}

                  {canShareWithPatient && selectedPatientId && (
                    <p className="text-[10px] text-accent-primary flex items-center gap-1 font-medium pt-0.5">
                      <Eye className="w-3 h-3" />
                      <span>El archivo se sincronizará automáticamente en el Portal del paciente seleccionado.</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Descripción / Observación (Opcional)</label>
                  <textarea 
                    rows={3}
                    placeholder="Escribe una breve descripción del recurso..."
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    className="w-full bg-bg-input border border-border-color p-3 rounded-lg text-xs focus:ring-1 focus:ring-accent-primary focus:outline-none text-text-primary resize-none"
                  ></textarea>
                </div>

                <div className="pt-2 border-t border-border-color/30 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setSelectedFile(null);
                      setSelectedPatientId('');
                    }}
                    className="px-4 py-2 border border-border-color text-text-primary hover:bg-bg-input rounded-lg text-xs font-bold transition-all cursor-pointer"
                    disabled={uploading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-accent-primary text-on-accent-primary rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer hover:bg-accent-primary/80 disabled:opacity-50"
                    disabled={uploading}
                  >
                    {uploading ? 'Subiendo...' : 'Iniciar Subida'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="p-4 border-t border-border-color/30 text-center text-text-muted text-[10px]">
          <p>Los archivos se almacenan de forma cifrada en Supabase Storage con aislamiento multi-tenant.</p>
        </footer>
      </div>
    </>
  );
}
