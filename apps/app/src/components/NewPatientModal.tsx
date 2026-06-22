import React, { useState } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { validateRut, validateEmail } from '../utils/validators';


interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewPatientModal: React.FC<NewPatientModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    full_name: '',
    rut_patient: '',
    birth_date: '',
    gender: 'Masculino',
    occupation: '',
    marital_status: 'Soltero/a',
    education_level: 'Básica',
    education_status: 'Primero Básico',
    education_institution: '',
    health_system: 'Fonasa',
    phone: '',
    email: '',
    address: '',
    comuna: '',
    region: 'Metropolitana de Santiago',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    emergency_contact_email: '',
    status: 'activo',
    nacionalidad: 'Chilena',
    pais_origen: 'Chile',
    en_observacion: false,
    observacion_comentario: '',
    observaciones_generales: ''
  });

  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const fetchAddressSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    setIsSearchingAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&countrycodes=cl&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setAddressSuggestions(data || []);
      }
    } catch (err) {
      console.error('Error fetching address suggestions:', err);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const generateFichaId = async () => {
    const dateObj = new Date();
    const yy = String(dateObj.getFullYear()).slice(-2);
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const datePrefix = `${yy}${mm}${dd}`;

    const { data, error: fetchErr } = await supabase
      .from('patients')
      .select('ficha_id_num')
      .like('ficha_id_num', `${datePrefix}%`);
    
    if (fetchErr) {
      console.error('Error generating Ficha ID, falling back to timestamp suffix:', fetchErr);
      return `${datePrefix}${String(Math.floor(Math.random() * 90) + 10)}`;
    }

    const count = data?.length || 0;
    const xx = String(count + 1).padStart(2, '0');
    return `${datePrefix}${xx}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Clear formatting to get raw alphanumeric string
    const cleanRutStr = formData.rut_patient.trim().replace(/\./g, '').replace(/ /g, '').replace(/-/g, '');

    try {
      if (!validateRut(cleanRutStr)) {
        throw new Error('El RUT ingresado no es válido o no cumple con el formato (ej: 12345678-9).');
      }

      if (formData.email && !validateEmail(formData.email.trim())) {
        throw new Error('El formato del correo electrónico ingresado es incorrecto.');
      }

      const activeTenant = localStorage.getItem('active-tenant-id');
      if (!activeTenant) {
        throw new Error('No se detectó una clínica activa. Por favor selecciona una en el header.');
      }

      const fichaId = await generateFichaId();

      // Normalize fields before save (RUT formatted as 12345678-9)
      const formattedRut = cleanRutStr.slice(0, -1) + '-' + cleanRutStr.slice(-1).toUpperCase();
      const normalizedFormData = {
        ...formData,
        rut_patient: formattedRut,
        email: formData.email ? formData.email.trim() : null
      };

      const { error: insertErr } = await supabase
        .from('patients')
        .insert({
          organization_id: activeTenant,
          ficha_id_num: fichaId,
          ...normalizedFormData
        });

      if (insertErr) {
        throw new Error(insertErr.message);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-bg-card border border-border-color w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
          <h2 className="text-lg font-bold text-text-primary">
            <span>Ingresar Nuevo Paciente</span>
          </h2>
          <button onClick={onClose} type="button" className="text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scroll Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger/20 p-4 rounded-xl flex items-center gap-3 text-sm text-danger">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Identificación Core */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-accent-primary border-b border-border-color pb-1">1. Identificación Core</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Nacionalidad</label>
                <input 
                  type="text" name="nacionalidad" value={formData.nacionalidad} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  placeholder="e.g. Chilena"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">País de Origen</label>
                <input 
                  type="text" name="pais_origen" value={formData.pais_origen} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  placeholder="e.g. Chile"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Nombre Completo *</label>
                <input 
                  type="text" required name="full_name" value={formData.full_name} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">RUT / Identificación *</label>
                <input 
                  type="text" required name="rut_patient" placeholder="e.g. 12345678-9" value={formData.rut_patient} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Fecha Nacimiento *</label>
                <input 
                  type="date" required name="birth_date" value={formData.birth_date} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Género</label>
                <select 
                  name="gender" value={formData.gender} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="No Binario">No Binario</option>
                  <option value="Otro">Otro</option>
                  <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Estado Civil</label>
                <select 
                  name="marital_status" value={formData.marital_status} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                >
                  <option value="Soltero/a">Soltero/a</option>
                  <option value="Casado/a">Casado/a</option>
                  <option value="Divorciado/a">Divorciado/a</option>
                  <option value="Viudo/a">Viudo/a</option>
                  <option value="Conviviente Civil">Conviviente Civil</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Estado Clínico</label>
                <select 
                  name="status" value={formData.status} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                >
                  <option value="activo">Activo</option>
                  <option value="seguimiento">Seguimiento</option>
                  <option value="alta">Alta</option>
                  <option value="archivado">Archivado</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Información Personal y Educacional */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-accent-primary border-b border-border-color pb-1">2. Información Personal y Educacional</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Nivel Escolaridad</label>
                <select 
                  name="education_level" value={formData.education_level} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                >
                  <option value="Pre-básica">Pre-básica</option>
                  <option value="Diferencial">Diferencial</option>
                  <option value="Básica">Básica</option>
                  <option value="Media">Media</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Superior">Superior</option>
                  <option value="Posgrado">Posgrado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Estado / Curso Escolaridad</label>
                <select 
                  name="education_status" value={formData.education_status} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                >
                  <option value="Sala Cuna">Sala Cuna</option>
                  <option value="Jardín Infantil">Jardín Infantil</option>
                  <option value="Pre-Kinder (NT1)">Pre-Kinder (NT1)</option>
                  <option value="Kinder (NT2)">Kinder (NT2)</option>
                  <option value="Primero Básico">Primero Básico</option>
                  <option value="Segundo Básico">Segundo Básico</option>
                  <option value="Tercero Básico">Tercero Básico</option>
                  <option value="Cuarto Básico">Cuarto Básico</option>
                  <option value="Quinto Básico">Quinto Básico</option>
                  <option value="Sexto Básico">Sexto Básico</option>
                  <option value="Séptimo Básico">Séptimo Básico</option>
                  <option value="Octavo Básico">Octavo Básico</option>
                  <option value="Primero Medio">Primero Medio</option>
                  <option value="Segundo Medio">Segundo Medio</option>
                  <option value="Tercero Medio">Tercero Medio</option>
                  <option value="Cuarto Medio">Cuarto Medio</option>
                  <option value="Superior En curso">Superior En curso</option>
                  <option value="Superior Incompleto">Superior Incompleto</option>
                  <option value="Superior Completo">Superior Completo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Institución Educacional</label>
                <input 
                  type="text" name="education_institution" value={formData.education_institution} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Ocupación / Profesión</label>
                <input 
                  type="text" name="occupation" value={formData.occupation} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Sistema de Salud</label>
                <select 
                  name="health_system" value={formData.health_system} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                >
                  <option value="Fonasa">Fonasa</option>
                  <option value="Isapre">Isapre</option>
                  <option value="No sabe">No sabe</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Datos de Contacto y Ubicación */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-accent-primary border-b border-border-color pb-1">3. Datos de Contacto y Ubicación</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Teléfono de Contacto</label>
                <input 
                  type="text" name="phone" placeholder="+569..." value={formData.phone} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Correo Electrónico</label>
                <input 
                  type="email" name="email" value={formData.email} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div className="relative">
                <label className="block text-xs text-text-secondary mb-1 font-medium">Dirección (Calle y N°)</label>
                <input 
                  type="text" name="address" autoComplete="off"
                  value={formData.address} 
                  onChange={(e) => {
                    handleChange(e);
                    fetchAddressSuggestions(e.target.value);
                  }}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
                {isSearchingAddress && <p className="text-[10px] text-text-muted mt-1">Buscando direcciones...</p>}
                {addressSuggestions.length > 0 && (
                  <ul className="absolute z-50 bg-bg-card border border-border-color rounded-lg mt-1 w-full max-h-40 overflow-y-auto shadow-lg text-xs divide-y divide-border-color">
                    {addressSuggestions.map((sug, i) => (
                      <li 
                        key={i} 
                        onClick={() => {
                          const road = sug.address?.road || '';
                          const num = sug.address?.house_number || '';
                          const streetAddress = `${road} ${num}`.trim() || sug.display_name.split(',')[0];
                          const comuna = sug.address?.city || sug.address?.town || sug.address?.suburb || sug.address?.village || '';
                          const region = sug.address?.state || '';
                          setFormData(prev => ({
                            ...prev,
                            address: streetAddress,
                            comuna: comuna,
                            region: region
                          }));
                          setAddressSuggestions([]);
                        }}
                        className="p-2 hover:bg-bg-input/60 cursor-pointer text-text-primary"
                      >
                        {sug.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Comuna</label>
                <input 
                  type="text" name="comuna" value={formData.comuna} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Región</label>
                <input 
                  type="text" name="region" value={formData.region} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Contacto de Emergencia */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-accent-primary border-b border-border-color pb-1">4. Contacto de Emergencia</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-text-secondary mb-1 font-medium">Nombre Contacto</label>
                <input 
                  type="text" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Parentesco</label>
                <input 
                  type="text" name="emergency_contact_relationship" placeholder="e.g. Madre, Padre, Cónyuge" value={formData.emergency_contact_relationship} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1 font-medium">Teléfono Emergencia</label>
                <input 
                  type="text" name="emergency_contact_phone" value={formData.emergency_contact_phone} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-text-secondary mb-1 font-medium">Email Emergencia</label>
                <input 
                  type="email" name="emergency_contact_email" value={formData.emergency_contact_email} onChange={handleChange}
                  className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Observaciones Generales */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-accent-primary border-b border-border-color pb-1">5. Observaciones Generales</h3>
            <div>
              <label className="block text-xs text-text-secondary mb-1 font-medium">Observaciones Generales</label>
              <textarea 
                name="observaciones_generales" 
                value={formData.observaciones_generales} 
                onChange={handleChange}
                rows={3}
                placeholder="Detalles adicionales, observaciones del paciente, notas de contacto..."
                className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none resize-y"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-color bg-bg-sidebar/50">
          <button 
            type="button" onClick={onClose} disabled={loading}
            className="px-4 py-2 border border-border-color hover:bg-bg-input text-sm font-semibold rounded-lg text-text-secondary transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            type="submit" disabled={loading}
            className="bg-accent-primary hover:bg-accent-hover text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Ingresando...' : 'Guardar Paciente'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
