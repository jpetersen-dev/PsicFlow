import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
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
  Camera,
  CalendarSync,
  Unplug,
  RefreshCw,
  ExternalLink,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Perfil() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [userClinics, setUserClinics] = useState<any[]>([]);
  
  // Simulation states
  const [recharge, setRecharge] = useState({ type_unit: 'NOTA_IA', amount: 50 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState<number>(0);
  const [bio, setBio] = useState('');
  
  // Toggles states
  const [notifyInquiries, setNotifyInquiries] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [tfaEnabled, setTfaEnabled] = useState(true);

  // Google Calendar integration states
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleCalendars, setGoogleCalendars] = useState<any[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Check for Google callback query params
  useEffect(() => {
    if (router.query.google === 'connected') {
      setGoogleMessage({ type: 'success', text: '¡Google Calendar conectado exitosamente!' });
      fetchGoogleCalendars();
      // Clean the URL
      router.replace('/perfil', undefined, { shallow: true });
    } else if (router.query.google === 'denied') {
      setGoogleMessage({ type: 'error', text: 'Acceso a Google Calendar denegado por el usuario.' });
      router.replace('/perfil', undefined, { shallow: true });
    } else if (router.query.google === 'error') {
      setGoogleMessage({ type: 'error', text: 'Error al conectar Google Calendar. Intenta nuevamente.' });
      router.replace('/perfil', undefined, { shallow: true });
    }
  }, [router.query.google]);

  // Google Calendar functions
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const tenantId = localStorage.getItem('active-tenant-id');
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'x-tenant-id': tenantId || '',
      'Content-Type': 'application/json',
    };
  };

  const fetchGoogleCalendars = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/google/calendars', { headers });
      const data = await res.json();
      setGoogleConnected(data.connected || false);
      setGoogleEmail(data.googleEmail || '');
      setGoogleCalendars(data.calendars || []);
    } catch (err) {
      console.error('Error fetching Google calendars:', err);
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/google/connect', { headers });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setGoogleMessage({ type: 'error', text: data.error || 'Error al generar enlace de conexión.' });
        setGoogleLoading(false);
      }
    } catch (err) {
      setGoogleMessage({ type: 'error', text: 'Error de red al conectar con Google.' });
      setGoogleLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm('¿Deseas desconectar tu Google Calendar? Se eliminarán los datos de disponibilidad vinculados.')) return;
    setGoogleLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/google/disconnect', { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) {
        setGoogleConnected(false);
        setGoogleEmail('');
        setGoogleCalendars([]);
        setGoogleMessage({ type: 'success', text: 'Google Calendar desconectado correctamente.' });
      }
    } catch (err) {
      setGoogleMessage({ type: 'error', text: 'Error al desconectar Google Calendar.' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleToggleCalendar = async (calendarId: string, currentActive: boolean) => {
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/google/calendars', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ calendarId, isActive: !currentActive }),
      });
      setGoogleCalendars((prev) =>
        prev.map((cal) =>
          cal.calendar_id === calendarId ? { ...cal, is_active: !currentActive } : cal
        )
      );
    } catch (err) {
      console.error('Error toggling calendar:', err);
    }
  };

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

  const handleChangePassword = async () => {
    const pass = prompt('Ingresa tu nueva contraseña (mínimo 6 caracteres):');
    if (pass) {
      try {
        const { error } = await supabase.auth.updateUser({ password: pass });
        if (error) throw error;
        alert('Contraseña actualizada correctamente.');
      } catch (err: any) {
        alert('Error al actualizar contraseña: ' + err.message);
      }
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!activeTenant || !session?.user?.id) {
        setLoading(false);
        return;
      }

      // Get profile
      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('organization_id', activeTenant)
        .limit(1)
        .single();
      
      if (profError) {
        console.error('Error fetching profile:', profError);
      } else if (profData) {
        setProfile(profData);
        setFullName(profData.full_name || '');
        setUsername(profData.username || '');
        setEmail(profData.email || '');
        if (profData.specialization) setSpecialization(profData.specialization);
        if (profData.experience !== undefined && profData.experience !== null) setExperience(profData.experience);
        if (profData.bio) setBio(profData.bio);
      }

      // Get organization details
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', activeTenant)
        .limit(1)
        .single();
      
      if (orgError) {
        console.error('Error fetching organization:', orgError);
      } else if (orgData) {
        setOrganization(orgData);
      }

      // Get all user clinics
      await fetchUserClinics(session.user.id);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserClinics = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          role_name,
          organization_id,
          email,
          organizations (
            name,
            current_plan
          )
        `)
        .eq('user_id', userId);
        
      if (!error && data) {
        setUserClinics(data);
      }
    } catch (err) {
      console.error('Error fetching user clinics:', err);
    }
  };

  const handleDeleteClinic = async (orgId: string, orgName: string) => {
    const confirmDelete = confirm(`¿Estás seguro de que deseas ELIMINAR COMPLETAMENTE la clínica "${orgName}"?\n\nEsta acción es irreversible y eliminará todos los pacientes, fichas clínicas, sesiones y registros vinculados.`);
    if (!confirmDelete) return;

    const secondConfirm = prompt(`Por favor, escribe "ELIMINAR" en mayúsculas para confirmar la eliminación definitiva de "${orgName}":`);
    if (secondConfirm !== 'ELIMINAR') {
      alert('Confirmación incorrecta. Eliminación cancelada.');
      return;
    }

    setSubmitting(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      const supabaseTenant = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { 'x-tenant-id': orgId } },
      });

      const { error } = await supabaseTenant
        .from('organizations')
        .delete()
        .eq('id', orgId);

      if (error) throw error;

      alert(`Clínica "${orgName}" eliminada correctamente.`);

      const activeTenant = localStorage.getItem('active-tenant-id');
      if (activeTenant === orgId) {
        const remaining = userClinics.filter((c: any) => c.organization_id !== orgId);
        if (remaining.length > 0) {
          localStorage.setItem('active-tenant-id', remaining[0].organization_id);
          window.location.reload();
        } else {
          localStorage.removeItem('active-tenant-id');
          await supabase.auth.signOut();
          window.location.href = '/';
        }
      } else {
        await fetchProfileAndOrg();
      }
    } catch (err: any) {
      alert('Error al eliminar la clínica: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveClinic = async (profileId: string, orgId: string, orgName: string) => {
    const confirmLeave = confirm(`¿Deseas salir de la clínica "${orgName}"? Perderás acceso a toda la información clínica de este establecimiento.`);
    if (!confirmLeave) return;

    setSubmitting(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      const supabaseTenant = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { 'x-tenant-id': orgId } },
      });

      const { error } = await supabaseTenant
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      alert(`Has salido de la clínica "${orgName}" con éxito.`);

      const activeTenant = localStorage.getItem('active-tenant-id');
      if (activeTenant === orgId) {
        const remaining = userClinics.filter((c: any) => c.organization_id !== orgId);
        if (remaining.length > 0) {
          localStorage.setItem('active-tenant-id', remaining[0].organization_id);
          window.location.reload();
        } else {
          localStorage.removeItem('active-tenant-id');
          await supabase.auth.signOut();
          window.location.href = '/';
        }
      } else {
        await fetchProfileAndOrg();
      }
    } catch (err: any) {
      alert('Error al salir de la clínica: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchClinic = (orgId: string) => {
    localStorage.setItem('active-tenant-id', orgId);
    window.location.reload();
  };

  useEffect(() => {
    fetchProfileAndOrg();
    fetchGoogleCalendars();
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
          full_name: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          specialization,
          experience: Number(experience),
          bio
        })
        .eq('id', profile.id);

      if (error) throw error;
      alert('Datos de perfil guardados exitosamente.');
      
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
        <title>PsicFlow - Perfil y Configuración</title>
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
                {profile ? profile.full_name : 'Cargando...'}
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
              {/* Datos Personales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-outline-variant/10">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <h4 className="text-xs font-bold text-primary tracking-wide uppercase">Datos Personales</h4>
                </div>
                <div className="space-y-2">
                  <label className="font-label-md text-on-surface-variant text-xs">Nombre Completo</label>
                  <input 
                    type="text" 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jonathan Petersen"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label-md text-on-surface-variant text-xs">RUT Profesional (No editable)</label>
                  <input 
                    type="text" 
                    disabled
                    value={profile ? profile.rut_professional : 'N/A'}
                    className="w-full bg-surface-container-low/50 border border-outline-variant/15 rounded-lg px-3 py-2 text-sm text-on-surface-variant cursor-not-allowed" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label-md text-on-surface-variant text-xs">Nombre de Usuario</label>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. jpetersen"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label-md text-on-surface-variant text-xs">Correo Electrónico</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. jpetersen@clinica.cl"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" 
                  />
                </div>
              </div>

              {/* Datos Clínicos y Profesionales */}
              <div className="space-y-6 pt-2">
                <h4 className="text-xs font-bold text-primary tracking-wide uppercase">Detalles Clínicos</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-label-md text-on-surface-variant text-xs">Especialidad Principal</label>
                    <input 
                      type="text" 
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="e.g. Terapia Cognitivo-Conductual (TCC)"
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-label-md text-on-surface-variant text-xs font-semibold block">Logo de la Clínica</label>
                    <div className="flex items-center gap-4">
                      {profile?.logo_url ? (
                        <img src={profile.logo_url} alt="Logo" className="w-16 h-16 object-contain border border-outline-variant/20 rounded bg-white p-1" />
                      ) : (
                        <div className="w-16 h-16 bg-surface-container-low border border-outline-variant/20 rounded flex items-center justify-center text-[10px] text-on-surface-variant">Sin Logo</div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const ext = file.name.split('.').pop();
                            const path = `logos-signatures/${profile.id}_logo.${ext}`;
                            const { error: uploadErr } = await supabase.storage
                              .from('clinical-vault')
                              .upload(path, file, { upsert: true });
                            if (uploadErr) throw uploadErr;
                            
                            const { data } = supabase.storage.from('clinical-vault').getPublicUrl(path);
                            const url = data.publicUrl;
                            
                            const { error: updateErr } = await supabase
                              .from('profiles')
                              .update({ logo_url: url })
                              .eq('id', profile.id);
                            if (updateErr) throw updateErr;
                            
                            alert('Logo clínico subido y actualizado con éxito.');
                            await fetchProfileAndOrg();
                          } catch (err: any) {
                            alert('Error al subir logo: ' + err.message);
                          }
                        }}
                        className="text-xs text-on-surface-variant file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-label-md text-on-surface-variant text-xs font-semibold block">Firma Digital del Terapeuta</label>
                    <div className="flex items-center gap-4">
                      {profile?.signature_url ? (
                        <img src={profile.signature_url} alt="Firma" className="w-16 h-16 object-contain border border-outline-variant/20 rounded bg-white p-1" />
                      ) : (
                        <div className="w-16 h-16 bg-surface-container-low border border-outline-variant/20 rounded flex items-center justify-center text-[10px] text-on-surface-variant">Sin Firma</div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const ext = file.name.split('.').pop();
                            const path = `logos-signatures/${profile.id}_signature.${ext}`;
                            const { error: uploadErr } = await supabase.storage
                              .from('clinical-vault')
                              .upload(path, file, { upsert: true });
                            if (uploadErr) throw uploadErr;
                            
                            const { data } = supabase.storage.from('clinical-vault').getPublicUrl(path);
                            const url = data.publicUrl;
                            
                            const { error: updateErr } = await supabase
                              .from('profiles')
                              .update({ signature_url: url })
                              .eq('id', profile.id);
                            if (updateErr) throw updateErr;
                            
                            alert('Firma digital subida y actualizada con éxito.');
                            await fetchProfileAndOrg();
                          } catch (err: any) {
                            alert('Error al subir firma: ' + err.message);
                          }
                        }}
                        className="text-xs text-on-surface-variant file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-label-md text-on-surface-variant text-xs">Clínica Asociada (Tenant Actual)</label>
                  <input 
                    type="text" 
                    disabled
                    value={organization ? organization.name : 'Cargando clínica...'} 
                    className="w-full bg-surface-container-low/50 border border-outline-variant/15 rounded-lg px-3 py-2 text-sm text-on-surface-variant cursor-not-allowed" 
                  />
                </div>
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

          {/* Column 3b: Google Calendar Integration (6/12 width) */}
          <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-outline-variant/25 pb-3">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold flex items-center gap-2">
                  <CalendarSync className="w-5 h-5 text-primary" />
                  <span>Google Calendar</span>
                </h3>
                {googleConnected && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    Conectado
                  </span>
                )}
              </div>

              {/* Google status message */}
              {googleMessage && (
                <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-medium ${
                  googleMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {googleMessage.text}
                  <button 
                    onClick={() => setGoogleMessage(null)}
                    className="ml-2 text-current opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {!googleConnected ? (
                /* Disconnected state */
                <div className="space-y-4">
                  <p className="text-body-sm text-on-surface-variant text-sm">
                    Conecta tu Google Calendar para ver tu disponibilidad directamente en el calendario de PsicFlow.
                  </p>
                  <div className="bg-primary-container/10 border border-primary/10 rounded-lg p-3 text-[11px] text-on-surface-variant flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>Solo lectura — PsicFlow nunca modifica tu calendario de Google.</span>
                  </div>
                  <button
                    onClick={handleGoogleConnect}
                    disabled={googleLoading}
                    className="w-full bg-primary text-on-primary hover:bg-primary-container font-bold py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {googleLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    <span>{googleLoading ? 'Conectando...' : 'Conectar Google Calendar'}</span>
                  </button>
                </div>
              ) : (
                /* Connected state */
                <div className="space-y-4">
                  <p className="text-xs text-on-surface-variant">
                    Cuenta: <span className="font-semibold text-on-surface">{googleEmail}</span>
                  </p>

                  {/* Calendar list with toggles */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-wide">Calendarios para disponibilidad</label>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {googleCalendars.map((cal) => (
                        <div 
                          key={cal.calendar_id || cal.id}
                          className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/10 hover:border-primary/20 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <span 
                              className="w-3 h-3 rounded-full shrink-0 border" 
                              style={{ backgroundColor: cal.calendar_color || '#4285f4', borderColor: cal.calendar_color || '#4285f4' }}
                            ></span>
                            <span className="text-xs text-on-surface truncate">{cal.calendar_name}</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input 
                              type="checkbox" 
                              checked={cal.is_active}
                              onChange={() => handleToggleCalendar(cal.calendar_id, cal.is_active)}
                              className="sr-only peer" 
                            />
                            <div className="w-8 h-4.5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary"></div>
                          </label>
                        </div>
                      ))}
                      {googleCalendars.length === 0 && !googleLoading && (
                        <p className="text-xs text-on-surface-variant text-center py-3">No se encontraron calendarios.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons when connected */}
            {googleConnected && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-outline-variant/15">
                <button
                  onClick={fetchGoogleCalendars}
                  disabled={googleLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${googleLoading ? 'animate-spin' : ''}`} />
                  Refrescar
                </button>
                <button
                  onClick={handleGoogleDisconnect}
                  disabled={googleLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-error/30 text-error hover:bg-error/5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Desconectar
                </button>
              </div>
            )}
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

          {/* Column 5: Workspace Switcher and Clinic Management (12/12 width) */}
          <section className="col-span-12 bg-surface-container-lowest rounded-xl p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/10 space-y-6">
            <div className="border-b border-outline-variant/25 pb-4">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span>Mis Clínicas Asignadas (Multitenancy)</span>
              </h3>
              <p className="text-body-sm text-on-surface-variant text-sm mt-1">
                Visualiza y gestiona las clínicas asociadas a tu cuenta. Puedes alternar tu panel de control clínico o eliminar/salir de ellas según corresponda.
              </p>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-on-surface-variant text-xs uppercase font-semibold">
                    <th className="pb-3 pr-4">Clínica</th>
                    <th className="pb-3 pr-4">Plan Actual</th>
                    <th className="pb-3 pr-4">Tu Rol</th>
                    <th className="pb-3 pr-4 text-center">Estado</th>
                    <th className="pb-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {userClinics.map((clinicItem: any) => {
                    const isActive = clinicItem.organization_id === localStorage.getItem('active-tenant-id');
                    const org = clinicItem.organizations || {};
                    const isOwner = clinicItem.role_name === 'admin_clinica';
                    
                    return (
                      <tr key={clinicItem.id} className="hover:bg-surface-container-low/30 transition-colors">
                        <td className="py-4 pr-4 font-bold text-on-surface">{org.name || 'Clínica Sin Nombre'}</td>
                        <td className="py-4 pr-4">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-bold rounded">
                            {org.current_plan || 'Starter'}
                          </span>
                        </td>
                        <td className="py-4 pr-4 text-on-surface-variant capitalize text-xs">
                          {clinicItem.role_name === 'admin_clinica' ? 'Administrador' : clinicItem.role_name}
                        </td>
                        <td className="py-4 pr-4 text-center">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-success">
                              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                              Activa
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">Inactiva</span>
                          )}
                        </td>
                        <td className="py-4 text-right space-x-2">
                          {!isActive && (
                            <button
                              onClick={() => handleSwitchClinic(clinicItem.organization_id)}
                              className="px-3 py-1.5 bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold rounded-lg transition-all cursor-pointer"
                            >
                              Alternar Clínica
                            </button>
                          )}
                          {isOwner ? (
                            <button
                              onClick={() => handleDeleteClinic(clinicItem.organization_id, org.name)}
                              className="px-3 py-1.5 border border-error/30 text-error hover:bg-error/5 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                            >
                              Eliminar Clínica
                            </button>
                          ) : (
                            <button
                              onClick={() => handleLeaveClinic(clinicItem.id, clinicItem.organization_id, org.name)}
                              className="px-3 py-1.5 border border-warning/30 text-warning hover:bg-warning/5 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                            >
                              Salir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          <p>© 2026 PsicFlow Ecosistema de Gestión y Blindaje Psicológico. Encriptación de datos AES-256 e HIPAA Compliant.</p>
        </footer>
      </div>
    </>
  );
}
