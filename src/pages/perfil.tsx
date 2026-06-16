import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { 
  User, 
  ShieldCheck, 
  Settings, 
  Building2, 
  Wallet, 
  Plus, 
  Lock, 
  Bell, 
  ChevronRight, 
  ShieldAlert,
  Camera
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Perfil() {
  const [profile, setProfile] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  
  // Simulation states
  const [recharge, setRecharge] = useState({ type_unit: 'NOTA_IA', amount: 50 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states (pre-populated with mock settings)
  const [specialization, setSpecialization] = useState('Cognitive Behavioral Therapy (CBT)');
  const [experience, setExperience] = useState(12);
  const [bio, setBio] = useState('Especialista certificado en terapia breve, resolución de traumas y terapia cognitivo-conductual centrada en la baja carga cognitiva y el bienestar del profesional terapéutico.');
  
  // Toggles states
  const [notifyInquiries, setNotifyInquiries] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [tfaEnabled, setTfaEnabled] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load toggles from localStorage
  useEffect(() => {
    const notifyInq = localStorage.getItem('notify-inquiries');
    if (notifyInq !== null) setNotifyInquiries(notifyInq === 'true');
    const notifyRem = localStorage.getItem('notify-reminders');
    if (notifyRem !== null) setNotifyReminders(notifyRem === 'true');
    const tfa = localStorage.getItem('tfa-enabled');
    if (tfa !== null) setTfaEnabled(tfa === 'true');
  }, []);

  const handleToggleInquiries = () => {
    const val = !notifyInquiries;
    setNotifyInquiries(val);
    localStorage.setItem('notify-inquiries', String(val));
  };

  const handleToggleReminders = () => {
    const val = !notifyReminders;
    setNotifyReminders(val);
    localStorage.setItem('notify-reminders', String(val));
  };

  const handleToggleTFA = () => {
    const val = !tfaEnabled;
    setTfaEnabled(val);
    localStorage.setItem('tfa-enabled', String(val));
    alert(`Doble Factor (2FA) ${val ? 'habilitado' : 'deshabilitado'} exitosamente.`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Foto "${file.name}" cargada correctamente (Simulado). El perfil se actualizará al guardar.`);
    }
  };

  const handlePreviewProfile = () => {
    alert(`[Previsualización Pública]\n\nNombre: ${profile?.full_name || 'Terapeuta'}\nEspecialidad: ${specialization}\nExperiencia: ${experience} años\nBiografía: ${bio}`);
  };

  const handleChangePassword = () => {
    const pass = prompt('Ingresa tu nueva contraseña:');
    if (pass) {
      alert('Contraseña actualizada correctamente.');
    }
  };

  const handleDeactivateAccount = () => {
    const confirmDeactivate = confirm('¿Estás seguro de que deseas desactivar tu perfil público? No recibirás nuevas derivaciones de pacientes.');
    if (confirmDeactivate) {
      alert('Por motivos de resguardo clínico-legal (Ley N° 21.668), las cuentas asociadas a fichas clínicas activas no se pueden desactivar de forma automática sin la aprobación del comité de auditoría local.');
    }
  };

  const fetchProfileAndOrg = async () => {
    setLoading(true);
    try {
      const activeTenant = localStorage.getItem('active-tenant-id');
      if (!activeTenant) return;

      // Get profile
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)
        .single();
      
      if (profData) {
        setProfile(profData);
        if (profData.specialization) setSpecialization(profData.specialization);
        if (profData.experience !== undefined && profData.experience !== null) setExperience(profData.experience);
        if (profData.bio) setBio(profData.bio);
      }

      // Get organization details
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .limit(1)
        .single();
      
      if (orgData) setOrganization(orgData);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndOrg();
  }, []);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const tenantId = localStorage.getItem('active-tenant-id');
      if (!profile) {
        alert('No se cargó el perfil profesional.');
        return;
      }

      const { error } = await supabase
        .from('credit_ledger')
        .insert({
          organization_id: tenantId,
          profile_id: profile.id,
          type_unit: recharge.type_unit,
          amount: Number(recharge.amount),
          description: 'Recarga manual de créditos de prueba en el Perfil'
        });

      if (error) throw error;
      alert(`¡Recarga de +${recharge.amount} créditos de ${recharge.type_unit} aplicada exitosamente!`);
      
      // Reload page to update layout credits sidebar
      window.location.reload();
    } catch (err: any) {
      alert('Error al realizar recarga: ' + err.message);
    }
  };

  const handleSaveProfessionalDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!profile) {
        alert('No se cargó el perfil profesional.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          specialization,
          experience: Number(experience),
          bio
        })
        .eq('id', profile.id);

      if (error) throw error;
      alert('Credenciales y detalles profesionales guardados exitosamente.');
      
      await fetchProfileAndOrg();
    } catch (err: any) {
      alert('Error al guardar detalles: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-on-surface-variant text-sm">Cargando perfil profesional...</div>;

  return (
    <>
      <Head>
        <title>PsicoAlivio - Perfil y Configuración</title>
      </Head>

      <div className="space-y-stack-lg">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Configuración de Perfil</h2>
          <p className="font-body-md text-on-surface-variant">
            Administra tus credenciales clínicas, preferencias de notificaciones y simulación de tokens de IA.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-gutter">
          
          {/* Column 1: Profile Identity Card (4/12 width) */}
          <section className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/10 flex flex-col items-center text-center justify-between">
            <div className="flex flex-col items-center">
              {/* Profile Image with Edit Button */}
              <div className="relative group mb-6">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handlePhotoUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div className="w-32 h-32 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-4xl border-4 border-surface-container shadow-sm">
                  {profile ? profile.full_name[0].toUpperCase() : 'T'}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2.5 bg-primary text-on-primary rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  title="Cambiar Foto"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-headline-md text-headline-md text-on-surface font-bold mb-1">
                {profile ? profile.full_name : 'Dr. García'}
              </h3>
              <p className="font-body-md text-on-surface-variant mb-6 text-sm">
                RUT: {profile ? profile.rut_professional : 'N/A'}
              </p>
            </div>

            <div className="w-full space-y-4 border-t border-outline-variant/20 pt-6">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-label-md hover:bg-primary-container transition-all cursor-pointer font-semibold"
              >
                Subir Nueva Foto
              </button>
              <button 
                onClick={handlePreviewProfile}
                className="w-full py-2.5 bg-transparent text-primary border border-primary/20 rounded-lg font-label-md hover:bg-primary/5 transition-all cursor-pointer font-semibold"
              >
                Previsualizar Perfil Público
              </button>
            </div>

            <div className="mt-8 p-4 bg-surface-container-low rounded-lg w-full flex flex-col gap-2">
              <div className="flex justify-between items-center text-label-sm">
                <span className="text-on-surface-variant font-medium">Progreso del Perfil</span>
                <span className="text-primary font-bold">90%</span>
              </div>
              <div className="w-full bg-outline-variant/20 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[90%] rounded-full"></div>
              </div>
            </div>
          </section>

          {/* Column 2: Professional Details Form (8/12 width) */}
          <section className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/10">
            <div className="flex justify-between items-center mb-8 border-b border-outline-variant/25 pb-4">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <span>Credenciales Profesionales</span>
              </h3>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">Clínico Verificado</span>
            </div>

            <form onSubmit={handleSaveProfessionalDetails} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="font-label-md text-on-surface-variant text-xs">Especialidad Principal</label>
                  <select 
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  >
                    <option>Cognitive Behavioral Therapy (CBT)</option>
                    <option>EMDR Therapy</option>
                    <option>Family &amp; Marriage Counseling</option>
                    <option>Child Psychology</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="font-label-md text-on-surface-variant text-xs">Años de Experiencia</label>
                  <input 
                    type="number" 
                    value={experience}
                    onChange={(e) => setExperience(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant text-xs">Biografía Profesional</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none h-28 resize-none" 
                ></textarea>
                <p className="text-[10px] text-on-surface-variant text-right">Firma clínica digital activa.</p>
              </div>

              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant text-xs">Clínica Asociada (Tenant Actual)</label>
                <input 
                  type="text" 
                  disabled
                  value={organization ? organization.name : 'San Francisco Wellness Center'} 
                  className="w-full bg-surface-container-low/50 border border-outline-variant/15 rounded-lg px-3 py-2 text-sm text-on-surface-variant cursor-not-allowed" 
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-outline-variant/15">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-label-md shadow-sm hover:bg-primary-container transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Detalles Clínicos'}
                </button>
              </div>
            </form>
          </section>

          {/* Column 3: Credit Ledger Simulator (6/12 width) */}
          <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/10 flex flex-col justify-between">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4 flex items-center gap-2 border-b border-outline-variant/25 pb-3">
                <Wallet className="w-5 h-5 text-primary" />
                <span>Simulador de Créditos IA</span>
              </h3>
              <p className="text-body-sm text-on-surface-variant mb-6 text-sm">
                Recarga tokens de prueba en tu libro mayor contable clínico para realizar procesamiento SOAP de apuntes médicos y reportes evolutivos en el ecosistema.
              </p>
            </div>

            <form onSubmit={handleRecharge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Tipo de Crédito</label>
                <select 
                  value={recharge.type_unit}
                  onChange={(e) => setRecharge({ ...recharge, type_unit: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="NOTA_IA">Notas Clínicas IA (NOTA_IA)</option>
                  <option value="INFORME_CLINICO">Informes Clínicos (INFORME_CLINICO)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Monto a Añadir</label>
                <input 
                  type="number"
                  min="1"
                  max="1000"
                  value={recharge.amount}
                  onChange={(e) => setRecharge({ ...recharge, amount: Number(e.target.value) })}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-primary text-on-primary hover:bg-primary-container font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Recargar Créditos</span>
              </button>
            </form>
          </section>

          {/* Column 4: Notification Preferences & Account Security (6/12 width) */}
          <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/10 space-y-6">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mb-4 flex items-center gap-2 border-b border-outline-variant/25 pb-3">
                <Bell className="w-5 h-5 text-primary" />
                <span>Preferencias de Cuenta</span>
              </h3>
              
              <div className="space-y-3">
                {/* Notify Inquiry */}
                <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-lg border border-outline-variant/10">
                  <div>
                    <p className="font-label-md text-sm text-on-surface">Consultas de Pacientes</p>
                    <p className="text-[11px] text-on-surface-variant">Alertas de CRM al recibir derivaciones</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notifyInquiries}
                      onChange={handleToggleInquiries}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Notify Reminder */}
                <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-lg border border-outline-variant/10">
                  <div>
                    <p className="font-label-md text-sm text-on-surface">Recordatorios de Citas</p>
                    <p className="text-[11px] text-on-surface-variant">Alertas de calendario 1 hr antes de sesiones</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={notifyReminders}
                      onChange={handleToggleReminders}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h5 className="font-label-md text-label-md text-on-surface-variant font-semibold mb-3">Seguridad Clínica</h5>
              <div className="space-y-2.5">
                <button 
                  onClick={handleChangePassword}
                  className="w-full flex items-center justify-between p-3 border border-outline-variant/30 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-on-surface-variant group-hover:text-primary" />
                    <div>
                      <p className="font-label-md text-xs text-on-surface">Cambiar Contraseña</p>
                      <p className="text-[10px] text-on-surface-variant font-medium">Gestionar contraseña clínica</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </button>
                <button 
                  onClick={handleToggleTFA}
                  className="w-full flex items-center justify-between p-3 border border-outline-variant/30 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-on-surface-variant group-hover:text-primary" />
                    <div>
                      <p className="font-label-md text-xs text-on-surface">Doble Factor (2FA)</p>
                      <p className={`text-[10px] font-medium ${tfaEnabled ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {tfaEnabled ? 'Habilitado actualmente' : 'Deshabilitado'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>
            </div>
          </section>

          {/* Column 5: Danger Zone (12/12 width) */}
          <section className="col-span-12 bg-surface-container-lowest rounded-xl p-8 border border-error/10 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="font-headline-sm text-headline-sm text-error font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                <span>Desactivar Perfil Público</span>
              </h3>
              <p className="font-body-sm text-on-surface-variant text-sm max-w-2xl">
                Oculta temporalmente tu perfil profesional de las derivaciones de la clínica. Tus registros clínicos y fichas de pacientes se resguardarán de forma segura e íntegra según la normativa de secreto profesional y HIPAA.
              </p>
            </div>
            <button 
              onClick={handleDeactivateAccount}
              className="px-5 py-2.5 border border-error text-error rounded-lg font-label-md hover:bg-error/5 transition-all cursor-pointer shrink-0 font-semibold"
            >
              Desactivar Cuenta
            </button>
          </section>
        </div>

        {/* Footer */}
        <footer className="p-8 border-t border-outline-variant/10 text-center text-on-surface-variant font-label-sm text-xs">
          <p>© 2026 PsicoAlivio Ecosistema de Gestión y Blindaje Psicológico. Encriptación de datos AES-256 e HIPAA Compliant.</p>
        </footer>
      </div>
    </>
  );
}
