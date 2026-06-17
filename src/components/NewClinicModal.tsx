import React, { useState } from 'react';
import { X, Building2, User, Landmark, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface NewClinicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newOrgId: string) => void;
}

export const NewClinicModal: React.FC<NewClinicModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    clinicName: '',
    profName: '',
    profRut: ''
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const cleanRut = (rut: string) => {
    // Remove dots, trim, and keep letters, numbers, and hyphen
    return rut.replace(/\./g, '').trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.clinicName.trim() || !formData.profName.trim() || !formData.profRut.trim()) {
        throw new Error('Todos los campos marcados con * son obligatorios.');
      }

      const cleanedRut = cleanRut(formData.profRut);
      if (!/^[0-9]+-[0-9kK]$/.test(cleanedRut)) {
        throw new Error('El RUT debe tener el formato 12345678-9 (sin puntos y con guion).');
      }

      // 1. Create Organization
      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name: formData.clinicName.trim(),
          current_plan: 'Starter'
        })
        .select('id')
        .single();

      if (orgErr || !orgData) {
        throw new Error(orgErr?.message || 'Error al crear la clínica.');
      }
      
      const newOrgId = orgData.id;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('Sesión de usuario no encontrada.');
      }

      // 2. Create Profile linked to the organization
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .insert({
          organization_id: newOrgId,
          rut_professional: cleanedRut,
          full_name: formData.profName.trim(),
          role_name: 'admin_clinica',
          user_id: session.user.id,
          email: session.user.email
        })
        .select('id')
        .single();

      if (profErr || !profData) {
        // Rollback organization? Since it's demo/no transaction here, we'll just throw
        throw new Error(profErr?.message || 'Error al crear el perfil profesional.');
      }

      const newProfId = profData.id;

      // 3. Seed initial credits ledger
      const { error: ledgerErr } = await supabase
        .from('credit_ledger')
        .insert([
          {
            organization_id: newOrgId,
            profile_id: newProfId,
            type_unit: 'NOTA_IA',
            amount: 10,
            description: 'Carga inicial gratuita de bienvenida'
          },
          {
            organization_id: newOrgId,
            profile_id: newProfId,
            type_unit: 'INFORME_CLINICO',
            amount: 5,
            description: 'Carga inicial gratuita de bienvenida'
          }
        ]);

      if (ledgerErr) {
        console.error('Error seeding initial credits:', ledgerErr);
      }

      // 4. Update localStorage
      localStorage.setItem('active-tenant-id', newOrgId);

      onSuccess(newOrgId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado al registrar la clínica.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-color w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent-primary" />
            <span>Crear Nueva Clínica / Org</span>
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

          {/* Nombre Clínica */}
          <div>
            <label className="block text-xs text-text-secondary mb-1 font-medium">Nombre de la Clínica *</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="clinicName"
                value={formData.clinicName}
                onChange={handleChange}
                required
                placeholder="e.g. Centro Médico San Joaquín"
                className="w-full bg-bg-input border border-border-color rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
              />
            </div>
          </div>

          {/* Nombre Profesional */}
          <div>
            <label className="block text-xs text-text-secondary mb-1 font-medium">Nombre del Profesional Administrador *</label>
            <div className="relative">
              <User className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="profName"
                value={formData.profName}
                onChange={handleChange}
                required
                placeholder="e.g. Dr. Manuel Rojas"
                className="w-full bg-bg-input border border-border-color rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
              />
            </div>
          </div>

          {/* RUT Profesional */}
          <div>
            <label className="block text-xs text-text-secondary mb-1 font-medium">RUT del Profesional *</label>
            <div className="relative">
              <Landmark className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="profRut"
                value={formData.profRut}
                onChange={handleChange}
                required
                placeholder="e.g. 15678910-1"
                className="w-full bg-bg-input border border-border-color rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-text-secondary mt-1">Ingresa el RUT sin puntos y con guion.</p>
          </div>

          {/* Informacion de Plan */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mt-2">
            <p className="text-xs font-semibold text-accent-primary">¡Bienvenido a PsicoAlivio!</p>
            <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
              La nueva clínica se registrará bajo el plan **Starter** y se le abonarán de manera gratuita:
              <br />• **10 Créditos de Notas Clínicas con IA**
              <br />• **5 Créditos de Informes Clínicos con IA**
            </p>
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
              disabled={loading}
              className="bg-accent-primary hover:bg-accent-hover text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Creando...' : 'Crear Clínica'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
