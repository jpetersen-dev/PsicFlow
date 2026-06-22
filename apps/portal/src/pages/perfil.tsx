import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import { User, Phone, Calendar, MapPin, Heart, ShieldAlert, CheckCircle2, AlertTriangle, Save } from 'lucide-react';

export default function PatientProfile() {
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [comuna, setComuna] = useState('');
  const [region, setRegion] = useState('');
  
  // Emergency contact states
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyEmail, setEmergencyEmail] = useState('');

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', session.user.id)
          .limit(1)
          .single();

        if (error) throw error;

        if (data) {
          setPatient(data);
          setFullName(data.full_name || '');
          setPhone(data.phone || '');
          setBirthDate(data.birth_date || '');
          setAddress(data.address || '');
          setComuna(data.comuna || '');
          setRegion(data.region || '');
          
          setEmergencyName(data.emergency_contact_name || '');
          setEmergencyPhone(data.emergency_contact_phone || '');
          setEmergencyRelationship(data.emergency_contact_relationship || '');
          setEmergencyEmail(data.emergency_contact_email || '');
        }
      } catch (err: any) {
        console.error('Error fetching patient profile:', err);
        setError('No se pudo cargar la información de tu perfil.');
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || !patient?.id) {
        throw new Error('No tienes una sesión activa.');
      }

      const { error: updateErr } = await supabase
        .from('patients')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          birth_date: birthDate,
          address: address.trim(),
          comuna: comuna.trim(),
          region: region.trim(),
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: emergencyPhone.trim(),
          emergency_contact_relationship: emergencyRelationship.trim(),
          emergency_contact_email: emergencyEmail.trim().toLowerCase(),
        })
        .eq('id', patient.id);

      if (updateErr) throw updateErr;

      setSuccess('¡Perfil actualizado correctamente!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error('Error updating patient profile:', err);
      setError(err.message || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-12 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Cargando información del perfil...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Mi Perfil - Sentido Migrante</title>
      </Head>

      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1C1917]">Mi Perfil</h1>
          <p className="text-xs text-[#78716C] mt-1">Mantén tu información de contacto y emergencia actualizada.</p>
        </div>

        {success && (
          <div className="bg-[#DAEDDF] border border-[#A2BC97]/40 p-4 rounded-2xl flex items-center gap-3 text-xs text-[#1A3020] animate-fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200/50 p-4 rounded-2xl flex items-center gap-3 text-xs text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 pb-12">
          {/* Personal Info Card */}
          <div className="bg-white border border-[#F2EFE8] rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#F2EFE8]">
              <User className="w-5 h-5 text-[#516750]" />
              <h2 className="font-display text-base font-bold text-[#1C1917]">Datos Personales</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Correo Electrónico</label>
                <input
                  type="email"
                  disabled
                  value={patient?.email || ''}
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#78716C] cursor-not-allowed opacity-80"
                />
                <span className="text-[10px] text-[#A8A29E]">El correo no se puede cambiar por seguridad.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Teléfono de Contacto</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Address Info Card */}
          <div className="bg-white border border-[#F2EFE8] rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#F2EFE8]">
              <MapPin className="w-5 h-5 text-[#516750]" />
              <h2 className="font-display text-base font-bold text-[#1C1917]">Ubicación y Dirección</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Dirección</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, Número, Depto / Casa"
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Comuna</label>
                <input
                  type="text"
                  value={comuna}
                  onChange={(e) => setComuna(e.target.value)}
                  placeholder="Providencia"
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <label className="text-xs font-bold text-[#44403C]">Región / Provincia / Estado</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Región Metropolitana / Berlín"
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact Card */}
          <div className="bg-white border border-[#F2EFE8] rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-[#F2EFE8]">
              <Heart className="w-5 h-5 text-[#516750]" />
              <h2 className="font-display text-base font-bold text-[#1C1917]">Contacto de Emergencia</h2>
            </div>

            <div className="bg-[#F9F7F3] border border-[#F2EFE8] p-4 rounded-2xl flex gap-3 text-xs text-[#78716C] mb-2">
              <ShieldAlert className="w-5 h-5 text-[#516750] shrink-0" />
              <span>Esta información es confidencial y solo se utilizará en caso de una urgencia médica o clínica durante tus sesiones.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Nombre del Contacto</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="María Pérez"
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Relación o Vínculo</label>
                <input
                  type="text"
                  value={emergencyRelationship}
                  onChange={(e) => setEmergencyRelationship(e.target.value)}
                  placeholder="Madre / Esposo / Hermano"
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Teléfono de Emergencia</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+56 9 8765 4321"
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Correo Electrónico de Emergencia</label>
                <input
                  type="email"
                  value={emergencyEmail}
                  onChange={(e) => setEmergencyEmail(e.target.value)}
                  placeholder="contacto@correo.com"
                  className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl px-4 py-2.5 text-sm text-[#1C1917] focus:border-[#516750] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[#516750] hover:bg-[#3f513e] disabled:bg-[#78716C]/50 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#516750]/10"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
