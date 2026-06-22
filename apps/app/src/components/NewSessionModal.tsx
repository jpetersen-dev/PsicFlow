import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultTime?: string;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({ isOpen, onClose, onSuccess, defaultDate, defaultTime }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [activeProfile, setActiveProfile] = useState<any>(null);

  const [formData, setFormData] = useState({
    patient_id: '',
    date_session: '',
    time_session: '',
    modality: 'Online',
    value_session: 40000,
    comentarios_internos: ''
  });

  // Set default values on open
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const yy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const timeStr = today.toTimeString().split(' ')[0].slice(0, 5); // "HH:MM"

      setFormData({
        patient_id: '',
        date_session: defaultDate || `${yy}-${mm}-${dd}`,
        time_session: defaultTime || timeStr,
        modality: 'Online',
        value_session: 40000,
        comentarios_internos: ''
      });
      fetchPatientsAndProfile();
    }
  }, [isOpen, defaultDate, defaultTime]);

  const fetchPatientsAndProfile = async () => {
    setError('');
    try {
      const activeTenant = localStorage.getItem('active-tenant-id');
      if (!activeTenant) {
        throw new Error('No se detectó una clínica activa. Por favor selecciona una en el header.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('Sesión de usuario no encontrada. Inicia sesión de nuevo.');
      }

      // Fetch active profile for the professional_id
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('user_id', session.user.id)
        .eq('organization_id', activeTenant)
        .limit(1)
        .single();
      
      if (profErr || !profData) {
        throw new Error('No se encontró un perfil profesional activo para esta clínica.');
      }
      setActiveProfile(profData);

      // Fetch patients
      const { data: patientsData, error: patientsErr } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('status', 'activo')
        .order('full_name', { ascending: true });

      if (patientsErr) {
        throw new Error(patientsErr.message);
      }
      
      const loadedPatients = patientsData || [];
      setPatients(loadedPatients);

      if (loadedPatients.length > 0) {
        setFormData(prev => ({ ...prev, patient_id: loadedPatients[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Error al inicializar el formulario.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const activeTenant = localStorage.getItem('active-tenant-id');
      if (!activeTenant) {
        throw new Error('No se detectó una clínica activa.');
      }
      if (!activeProfile) {
        throw new Error('No se detectó un perfil profesional activo.');
      }
      if (!formData.patient_id) {
        throw new Error('Debes seleccionar un paciente.');
      }

      const { data: insertedData, error: insertErr } = await supabase
        .from('sessions')
        .insert({
          organization_id: activeTenant,
          patient_id: formData.patient_id,
          professional_id: activeProfile.id,
          date_session: formData.date_session,
          time_session: `${formData.time_session}:00`, // Format HH:MM:SS
          modality: formData.modality,
          value_session: Number(formData.value_session),
          status_session: 'Programada',
          status_payment: 'Pendiente',
          boleta_status: 'Pendiente',
          comentarios_internos: formData.comentarios_internos
        })
        .select('id')
        .single();

      if (insertErr) {
        throw new Error(insertErr.message);
      }

      if (insertedData?.id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          fetch('/api/google/sync-event', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'x-tenant-id': activeTenant,
            },
            body: JSON.stringify({
              type: 'session',
              id: insertedData.id,
              action: 'create'
            }),
          }).catch((syncErr) => console.error('Error triggering session sync:', syncErr));
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado al agendar la sesión.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent-primary" />
            <span>Agendar Nueva Sesión</span>
          </h2>
          <button onClick={onClose} type="button" className="text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-danger/10 border border-danger/20 p-4 rounded-xl flex items-center gap-3 text-sm text-danger">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Paciente Selector */}
          <div>
            <label className="block text-xs text-text-secondary mb-1 font-medium">Paciente *</label>
            <select
              name="patient_id"
              value={formData.patient_id}
              onChange={handleChange}
              required
              className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
            >
              {patients.length === 0 ? (
                <option value="">No hay pacientes activos disponibles. Crea uno primero.</option>
              ) : (
                patients.map(p => (
                  <option key={p.id} value={p.id} className="bg-bg-sidebar text-text-primary">
                    {p.full_name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Fecha */}
            <div>
              <label className="block text-xs text-text-secondary mb-1 font-medium">Fecha *</label>
              <input
                type="date"
                name="date_session"
                value={formData.date_session}
                onChange={handleChange}
                required
                className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
              />
            </div>
            {/* Hora */}
            <div>
              <label className="block text-xs text-text-secondary mb-1 font-medium">Hora *</label>
              <input
                type="time"
                name="time_session"
                value={formData.time_session}
                onChange={handleChange}
                required
                className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Modalidad */}
            <div>
              <label className="block text-xs text-text-secondary mb-1 font-medium">Modalidad</label>
              <select
                name="modality"
                value={formData.modality}
                onChange={handleChange}
                className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
              >
                <option value="Online" className="bg-bg-sidebar text-text-primary">Online</option>
                <option value="Presencial" className="bg-bg-sidebar text-text-primary">Presencial</option>
              </select>
            </div>
            {/* Valor Sesión */}
            <div>
              <label className="block text-xs text-text-secondary mb-1 font-medium">Valor Sesión (CLP) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">$</span>
                <input
                  type="number"
                  name="value_session"
                  value={formData.value_session}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full bg-bg-input border border-border-color rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Comentarios internos */}
          <div>
            <label className="block text-xs text-text-secondary mb-1 font-medium">Comentarios / Observaciones Internas</label>
            <textarea
              name="comentarios_internos"
              value={formData.comentarios_internos}
              onChange={handleChange}
              rows={3}
              placeholder="e.g. Primera consulta de evaluación, foco en manejo de ansiedad."
              className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-color">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-border-color hover:bg-bg-input text-sm font-semibold rounded-lg text-text-secondary transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || patients.length === 0}
              className="bg-accent-primary hover:bg-accent-hover text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Agendando...' : 'Agendar Sesión'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
