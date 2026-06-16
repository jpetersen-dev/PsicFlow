import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  ArrowUpRight,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { usePrivacyMode } from '../components/PrivacyModeProvider';
import { NewPatientModal } from '../components/NewPatientModal';

export default function Pacientes() {
  const { maskName, maskRut } = usePrivacyMode();
  const [patients, setPatients] = useState<any[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPatients(data);
        setFilteredPatients(data);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Filter and search logic
  useEffect(() => {
    let result = patients;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    // Filter by search (Name or RUT)
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        p => 
          (p.full_name && p.full_name.toLowerCase().includes(query)) ||
          (p.rut_patient && p.rut_patient.toLowerCase().includes(query)) ||
          (p.ficha_id_num && p.ficha_id_num.toLowerCase().includes(query))
      );
    }

    setFilteredPatients(result);
  }, [search, statusFilter, patients]);

  const handleExportCSV = () => {
    if (filteredPatients.length === 0) return;
    
    const headers = ['Ficha ID', 'RUT', 'Nombre Completo', 'Fecha Ingreso', 'Teléfono', 'Email', 'Sistema de Salud', 'Escolaridad', 'Estado'];
    const rows = filteredPatients.map(p => [
      p.ficha_id_num,
      p.rut_patient,
      p.full_name,
      p.created_at.split('T')[0],
      p.phone || '',
      p.email || '',
      p.health_system || '',
      `${p.education_level || ''} (${p.education_status || ''})`,
      p.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `psicoalivio_pacientes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Head>
        <title>PsicoAlivio - CRM Pacientes</title>
      </Head>

      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-400" />
              <span>CRM de Pacientes</span>
            </h1>
            <p className="text-slate-400 text-sm">Gestiona la ficha demográfica y los estados de tus pacientes.</p>
          </div>
          
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button 
              onClick={handleExportCSV}
              disabled={filteredPatients.length === 0}
              className="bg-slate-950 border border-slate-800 hover:bg-slate-900 disabled:opacity-50 text-slate-300 font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
            <button 
              onClick={() => setIsNewPatientOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Ingresar Paciente</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar por Nombre, RUT o Ficha ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filter dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
            >
              <option value="all">Todos los Estados</option>
              <option value="activo">Activo</option>
              <option value="seguimiento">Seguimiento</option>
              <option value="alta">Alta</option>
              <option value="archivado">Archivado</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        {/* Patients Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-sm">Cargando listado de pacientes...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm space-y-2">
              <p className="font-semibold text-slate-400">No se encontraron pacientes.</p>
              <p className="text-xs text-slate-600">Prueba ajustando los filtros o registra uno nuevo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 bg-slate-950 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Ficha ID</th>
                    <th className="px-6 py-4">Nombre Paciente</th>
                    <th className="px-6 py-4">RUT</th>
                    <th className="px-6 py-4">Fecha Ingreso</th>
                    <th className="px-6 py-4">Contacto</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Ficha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-300 font-semibold">{p.ficha_id_num}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-200">
                        {maskName(p.full_name)}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-400">{maskRut(p.rut_patient || 'N/A')}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{p.created_at.split('T')[0]}</td>
                      <td className="px-6 py-4 text-xs space-y-0.5">
                        <p className="text-slate-300">{p.phone || 'Sin teléfono'}</p>
                        <p className="text-slate-500">{p.email || ''}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${
                          p.status === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          p.status === 'seguimiento' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          p.status === 'alta' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/pacientes/${p.id}`}
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Ficha</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Register Patient Modal */}
      <NewPatientModal 
        isOpen={isNewPatientOpen} 
        onClose={() => setIsNewPatientOpen(false)} 
        onSuccess={fetchPatients} 
      />
    </>
  );
}
