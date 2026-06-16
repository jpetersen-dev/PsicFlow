import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Eye,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  FileSpreadsheet
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
  const [sortOrder, setSortOrder] = useState<'name_asc' | 'name_desc' | 'recent' | 'ficha'>('recent');
  const [loading, setLoading] = useState(true);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Stats computed from DB
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [continuityRate, setContinuityRate] = useState(0);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Fetch patients and their sessions to compute last/next appointment
      const { data, error } = await supabase
        .from('patients')
        .select(`
          *,
          sessions (
            id,
            date_session,
            time_session,
            status_session
          )
        `);

      if (!error && data) {
        setPatients(data);
        setTotalCount(data.length);
        
        // Compute active patients
        const active = data.filter(p => p.status === 'activo').length;
        setActiveCount(active);

        // Compute pending tasks: Past sessions that are still marked as "Programada"
        // indicating they need SOAP clinical notes or administrative updates.
        let pendingTasks = 0;
        data.forEach(p => {
          p.sessions?.forEach((s: any) => {
            if (s.date_session < todayStr && s.status_session === 'Programada') {
              pendingTasks += 1;
            }
          });
        });
        setPendingTasksCount(pendingTasks);

        // Compute Patient Continuity Rate: Active patients who have at least one upcoming session
        const activePatients = data.filter(p => p.status === 'activo');
        if (activePatients.length > 0) {
          const withUpcoming = activePatients.filter(p => 
            p.sessions?.some((s: any) => s.date_session >= todayStr && s.status_session === 'Programada')
          ).length;
          setContinuityRate(Math.round((withUpcoming / activePatients.length) * 100));
        } else {
          setContinuityRate(0);
        }
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

  // Filter, search and sort logic
  useEffect(() => {
    let result = [...patients];

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    // Filter by search (Name, RUT, or Ficha ID)
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        p => 
          (p.full_name && p.full_name.toLowerCase().includes(query)) ||
          (p.rut_patient && p.rut_patient.toLowerCase().includes(query)) ||
          (p.ficha_id_num && p.ficha_id_num.toLowerCase().includes(query))
      );
    }

    // Sort order
    if (sortOrder === 'name_asc') {
      result.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (sortOrder === 'name_desc') {
      result.sort((a, b) => b.full_name.localeCompare(a.full_name));
    } else if (sortOrder === 'ficha') {
      result.sort((a, b) => a.ficha_id_num.localeCompare(b.ficha_id_num));
    } else {
      // recent: created_at descending
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setFilteredPatients(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [search, statusFilter, sortOrder, patients]);

  const handleExportCSV = () => {
    if (filteredPatients.length === 0) return;
    
    const headers = ['Ficha ID', 'RUT', 'Nombre Completo', 'Fecha Ingreso', 'Teléfono', 'Email', 'Sistema de Salud', 'Escolaridad', 'Estado'];
    const rows = filteredPatients.map(p => [
      p.ficha_id_num,
      p.rut_patient || 'N/A',
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
    link.setAttribute("download", `psicoalivio_crm_pacientes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get current page items
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPatients.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage) || 1;

  // Process a patient's sessions to find last and next sessions
  const getSessionDates = (patientSessions: any[]) => {
    if (!patientSessions || patientSessions.length === 0) {
      return { last: 'N/A', next: 'No agendada' };
    }
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Sort sessions by date
    const past = patientSessions
      .filter((s: any) => s.date_session < todayStr)
      .sort((a, b) => b.date_session.localeCompare(a.date_session)); // Newest first

    const upcoming = patientSessions
      .filter((s: any) => s.date_session >= todayStr && s.status_session === 'Programada')
      .sort((a, b) => a.date_session.localeCompare(b.date_session)); // Oldest first (closest in future)

    const last = past.length > 0 ? `${past[0].date_session} ${past[0].time_session.slice(0, 5)}` : 'N/A';
    const next = upcoming.length > 0 ? `${upcoming[0].date_session} ${upcoming[0].time_session.slice(0, 5)}` : 'No agendada';

    return { last, next };
  };

  // Status Badge Class Resolver
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'activo':
        return 'bg-primary-container/20 text-primary';
      case 'seguimiento':
        return 'bg-secondary-container/40 text-on-secondary-container';
      case 'alta':
        return 'bg-success/10 text-success border border-success/20';
      case 'inactivo':
        return 'bg-surface-variant/40 text-on-surface-variant';
      case 'archivado':
        return 'bg-tertiary-fixed-dim/30 text-tertiary';
      default:
        return 'bg-surface-container-low text-on-surface-variant';
    }
  };

  return (
    <>
      <Head>
        <title>MindCare Portal - Gestión de Pacientes</title>
      </Head>

      <div className="space-y-stack-lg">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Gestión de Pacientes (CRM)</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Administra las fichas clínicas e historial clínico en un entorno regulado y de baja carga cognitiva.
            </p>
          </div>
          <button 
            onClick={() => setIsNewPatientOpen(true)}
            className="flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md text-label-md hover:bg-primary-container transition-all shadow-sm cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Ingresar Paciente</span>
          </button>
        </div>

        {/* Bento Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-stack-md">
          {/* Total Pacientes */}
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/30 flex flex-col justify-between">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Total Pacientes</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-md text-headline-md text-primary">{totalCount}</span>
              <span className="text-primary font-label-sm">en sistema</span>
            </div>
          </div>

          {/* Activos */}
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/30 flex flex-col justify-between">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Pacientes Activos</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-md text-headline-md text-secondary">{activeCount}</span>
              <span className="text-secondary font-label-sm">tratamiento activo</span>
            </div>
          </div>

          {/* Tareas Pendientes */}
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/30 flex flex-col justify-between">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Tareas Clínicas</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-md text-headline-md text-on-surface">{pendingTasksCount.toString().padStart(2, '0')}</span>
              <span className="text-on-surface-variant font-label-sm">SOAPs atrasados</span>
            </div>
          </div>

          {/* Continuidad */}
          <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/30 flex flex-col justify-between">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Tasa Continuidad</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-md text-headline-md text-primary">{continuityRate}%</span>
              <span className="text-primary font-label-sm">con cita futura</span>
            </div>
          </div>
        </div>

        {/* Patient Table Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/30 overflow-hidden">
          {/* Table Controls */}
          <div className="px-gutter py-4 border-b border-outline-variant/20 flex flex-col md:flex-row items-center justify-between gap-4 bg-surface-container-low/20">
            {/* Search inputs */}
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar por Nombre, RUT o Ficha ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-container-low/60 pl-10 pr-4 py-2 rounded-lg border border-outline-variant/20 focus:ring-2 focus:ring-primary/20 text-body-sm transition-all focus:outline-none"
              />
            </div>

            {/* Filter and sorting dropdowns */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              {/* Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-on-surface-variant" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface-container-low/60 border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface-variant focus:outline-none"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="activo">Activo</option>
                  <option value="seguimiento">Seguimiento</option>
                  <option value="alta">Alta</option>
                  <option value="archivado">Archivado</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>

              {/* Sort order */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-4 h-4 text-on-surface-variant" />
                <select 
                  value={sortOrder}
                  onChange={(e: any) => setSortOrder(e.target.value)}
                  className="bg-surface-container-low/60 border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface-variant focus:outline-none"
                >
                  <option value="recent">Ingreso Reciente</option>
                  <option value="name_asc">Nombre (A-Z)</option>
                  <option value="name_desc">Nombre (Z-A)</option>
                  <option value="ficha">N° de Ficha</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Content */}
          {loading ? (
            <div className="py-20 text-center text-on-surface-variant text-sm">Cargando CRM de Pacientes...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-20 text-center text-on-surface-variant/80 text-sm space-y-2">
              <p className="font-semibold text-on-surface">No se encontraron pacientes en la búsqueda.</p>
              <p className="text-xs">Prueba reajustando los términos de búsqueda o filtros.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50 text-on-surface-variant font-label-md text-label-md">
                      <th className="px-gutter py-4 uppercase tracking-wider font-semibold">Paciente</th>
                      <th className="px-gutter py-4 uppercase tracking-wider font-semibold">Estado</th>
                      <th className="px-gutter py-4 uppercase tracking-wider font-semibold text-center">Última Sesión</th>
                      <th className="px-gutter py-4 uppercase tracking-wider font-semibold text-center">Siguiente Cita</th>
                      <th className="px-gutter py-4 uppercase tracking-wider font-semibold text-right">Ficha Clínica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15 font-body-sm">
                    {currentItems.map((p) => {
                      const { last, next } = getSessionDates(p.sessions || []);
                      
                      return (
                        <tr key={p.id} className="patient-table-row hover:bg-surface-container-low/30 transition-colors cursor-pointer" onClick={() => window.location.href = `/pacientes/${p.id}`}>
                          <td className="px-gutter py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                                {getInitials(p.full_name)}
                              </div>
                              <div>
                                <p className="font-label-md text-label-md text-on-surface">{maskName(p.full_name)}</p>
                                <p className="font-mono text-xs text-on-surface-variant">{p.ficha_id_num} • {maskRut(p.rut_patient || 'N/A')}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-gutter py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${getStatusBadge(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-gutter py-4 text-center">
                            <p className="font-body-sm text-on-surface">{last.split(' ')[0]}</p>
                            <p className="text-[11px] text-on-surface-variant font-mono">{last.split(' ')[1] || ''}</p>
                          </td>
                          <td className="px-gutter py-4 text-center">
                            <p className={`font-body-sm ${next !== 'No agendada' ? 'font-semibold text-secondary' : 'text-on-surface-variant italic'}`}>
                              {next.split(' ')[0]}
                            </p>
                            <p className="text-[11px] text-on-secondary-container font-mono">{next.split(' ')[1] || ''}</p>
                          </td>
                          <td className="px-gutter py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Link 
                              href={`/pacientes/${p.id}`}
                              className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/5 border border-primary/20 hover:bg-primary hover:text-white px-3.5 py-2 rounded-lg font-bold transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ficha</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              <div className="px-gutter py-4 border-t border-outline-variant/20 flex items-center justify-between bg-surface-container-low/10">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 font-label-md text-label-md text-primary hover:text-primary-container disabled:text-outline-variant disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>
                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button 
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg font-label-md text-sm transition-all ${
                        currentPage === page
                          ? 'bg-primary text-on-primary font-bold shadow-sm'
                          : 'hover:bg-surface-container-low text-on-surface-variant'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 font-label-md text-label-md text-primary hover:text-primary-container disabled:text-outline-variant disabled:cursor-not-allowed transition-colors"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Lower Insight & Action Bento Blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-lg">
          <div className="lg:col-span-2 bg-primary-container/10 p-6 rounded-2xl border border-primary/20 flex flex-col md:flex-row gap-6 items-center">
            <div className="p-4 bg-primary/10 rounded-full shrink-0">
              <Lightbulb className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-primary font-bold">Indicador de Continuidad de Pacientes</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                El <span className="font-bold text-primary">{continuityRate}%</span> de tus pacientes activos cuenta con una cita de seguimiento agendada en la plataforma. Mantener intervalos constantes de terapia se asocia directamente con una mejoría significativa en los resultados de salud mental y reduce las tasas de abandono.
              </p>
            </div>
          </div>

          <div className="bg-secondary-container/10 p-6 rounded-2xl border border-secondary/20 flex flex-col justify-between">
            <div>
              <h4 className="font-label-md text-label-md text-secondary font-bold uppercase tracking-wider">Acción Administrativa</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                Exporta el padrón demográfico consolidado de pacientes en formato compatible para auditorías clínicas.
              </p>
            </div>
            <button 
              onClick={handleExportCSV}
              disabled={filteredPatients.length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 border border-secondary text-secondary py-2.5 rounded-lg font-label-md hover:bg-secondary/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar base CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* New Patient Modal */}
      <NewPatientModal 
        isOpen={isNewPatientOpen} 
        onClose={() => setIsNewPatientOpen(false)} 
        onSuccess={fetchPatients} 
      />
    </>
  );
}

// Simple initials generator helper
function getInitials(name: string) {
  if (!name) return 'P';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0] ? parts[0][0].toUpperCase() : 'P';
}
