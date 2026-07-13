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
  Check,
  Globe,
  Info,
  CreditCard,
  Eye,
  EyeOff,
  Link,
  Clock,
  DollarSign,
  Edit,
  Trash2,
  MapPin,
  X,
  Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { hasFeature } from '../utils/planFeatures';

export default function Perfil() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  
  // Booking Settings States
  const [bookingPrefix, setBookingPrefix] = useState('PF');
  const [bookingCurrency, setBookingCurrency] = useState('CLP');
  const [termsText, setTermsText] = useState('');
  const [sandboxMode, setSandboxMode] = useState(false);
  
  // Wise details
  const [wiseChfLink, setWiseChfLink] = useState('');
  const [wiseChfIban, setWiseChfIban] = useState('');
  const [wiseChfBic, setWiseChfBic] = useState('');
  const [wiseChfHolder, setWiseChfHolder] = useState('');
  const [wiseChfBank, setWiseChfBank] = useState('');
  const [wiseChfAddress, setWiseChfAddress] = useState('');

  const [wiseEurLink, setWiseEurLink] = useState('');
  const [wiseEurIban, setWiseEurIban] = useState('');
  const [wiseEurBic, setWiseEurBic] = useState('');
  const [wiseEurHolder, setWiseEurHolder] = useState('');
  const [wiseEurBank, setWiseEurBank] = useState('');
  const [wiseEurAddress, setWiseEurAddress] = useState('');

  // Gateway Toggles & Credentials
  const [wiseActive, setWiseActive] = useState(false);
  
  const [stripeActive, setStripeActive] = useState(false);
  const [stripePublicKey, setStripePublicKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');

  const [mpActive, setMpActive] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpSecretKey, setMpSecretKey] = useState('');
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
  const [timezone, setTimezone] = useState('America/Santiago');
  const [workStartHour, setWorkStartHour] = useState(8);
  const [workEndHour, setWorkEndHour] = useState(20);
  
  // Nuevos campos para la Landing Page
  const [educationText, setEducationText] = useState('');
  const [specialtiesText, setSpecialtiesText] = useState('');
  const [languagesText, setLanguagesText] = useState('');
  const [quote, setQuote] = useState('');
  const [location, setLocation] = useState('');
  
  // Toggles states
  const [notifyInquiries, setNotifyInquiries] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [tfaEnabled, setTfaEnabled] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Google Calendar integration states
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleCalendars, setGoogleCalendars] = useState<any[]>([]);
  const [clinicalCalendarId, setClinicalCalendarId] = useState<string | null>(null);
  const [personalCalendarId, setPersonalCalendarId] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tab & UI configuration states
  const [activeMainTab, setActiveMainTab] = useState<'profile' | 'booking' | 'integrations' | 'security' | 'clinics'>('profile');
  const [activeBookingTab, setActiveBookingTab] = useState<'general' | 'gateways' | 'services'>('general');
  const [activeWiseTab, setActiveWiseTab] = useState<'chf' | 'eur'>('chf');
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showMpSecret, setShowMpSecret] = useState(false);

  // Services states
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceSlug, setServiceSlug] = useState('');
  const [serviceDuration, setServiceDuration] = useState(50);
  const [servicePrice, setServicePrice] = useState(0.00);
  const [serviceCurrency, setServiceCurrency] = useState('CLP');
  const [serviceActiveStatus, setServiceActiveStatus] = useState(true);
  const [isSavingService, setIsSavingService] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showBookingTab = hasFeature(organization?.current_plan, 'booking') && profile?.role_name === 'admin_clinica';

  useEffect(() => {
    if (activeMainTab === 'booking' && !showBookingTab && organization && profile) {
      setActiveMainTab('profile');
    }
  }, [organization, profile, activeMainTab, showBookingTab]);

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
      setClinicalCalendarId(data.clinicalCalendarId || null);
      setPersonalCalendarId(data.personalCalendarId || null);
    } catch (err) {
      console.error('Error fetching Google calendars:', err);
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  const handleSaveCalendarMapping = async (clinicalId: string | null, personalId: string | null) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/google/calendars', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          clinicalCalendarId: clinicalId,
          personalCalendarId: personalId,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al actualizar el mapeo de calendarios');
      }
    } catch (err: any) {
      console.error('Error saving mapping:', err);
      alert('Error al guardar el mapeo de calendarios: ' + err.message);
    }
  };

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
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
      
      alert('Foto de perfil subida y actualizada con éxito.');
      await fetchProfileAndOrg();
    } catch (err: any) {
      alert('Error al subir la foto de perfil: ' + err.message);
    }
  };

  const handlePreviewProfile = () => {
    setIsPreviewOpen(true);
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
        // Si no tiene foto de perfil, pero inició con Google y tiene avatar de Google, lo usamos por defecto
        let finalLogoUrl = profData.logo_url;
        const googleAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
        if (!finalLogoUrl && googleAvatar) {
          finalLogoUrl = googleAvatar;
          profData.logo_url = googleAvatar;
          
          // Guardar el avatar de Google en el perfil en segundo plano
          await supabase
            .from('profiles')
            .update({ logo_url: googleAvatar })
            .eq('id', profData.id);
        }

        setProfile(profData);
        setFullName(profData.full_name || '');
        setUsername(profData.username || '');
        setEmail(profData.email || '');
        if (profData.specialization) setSpecialization(profData.specialization);
        if (profData.experience !== undefined && profData.experience !== null) setExperience(profData.experience);
        if (profData.bio) setBio(profData.bio);
         if (profData.timezone) setTimezone(profData.timezone);
        if (profData.work_start_hour !== undefined && profData.work_start_hour !== null) setWorkStartHour(profData.work_start_hour);
        if (profData.work_end_hour !== undefined && profData.work_end_hour !== null) setWorkEndHour(profData.work_end_hour);
        
        // Inicializar nuevos campos
        if (profData.education) setEducationText(profData.education.join('\n'));
        if (profData.specialties) setSpecialtiesText(profData.specialties.join('\n'));
        if (profData.languages) setLanguagesText(profData.languages.join('\n'));
        if (profData.quote) setQuote(profData.quote);
        if (profData.location) setLocation(profData.location);
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

      // Get booking settings
      const { data: bookData, error: bookError } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('organization_id', activeTenant)
        .maybeSingle();

      if (!bookError && bookData) {
        setBookingPrefix(bookData.booking_prefix || 'PF');
        setBookingCurrency(bookData.currency || 'CLP');
        setTermsText(bookData.terms_text || '');
        setSandboxMode(bookData.sandbox_mode || false);
        
        const links = bookData.payment_links || {};
        setWiseChfLink(links.CH || '');
        setWiseEurLink(links.DE || '');
        
        const bank = bookData.bank_transfer_details || {};
        const chBank = bank.CH || {};
        setWiseChfIban(chBank.iban || '');
        setWiseChfBic(chBank.bic || '');
        setWiseChfHolder(chBank.holder || '');
        setWiseChfBank(chBank.bankName || '');
        setWiseChfAddress(chBank.address || '');

        const deBank = bank.DE || {};
        setWiseEurIban(deBank.iban || '');
        setWiseEurBic(deBank.bic || '');
        setWiseEurHolder(deBank.holder || '');
        setWiseEurBank(deBank.bankName || '');
        setWiseEurAddress(deBank.address || '');
      }

      // Get payment gateways
      const { data: gatewaysData, error: gatewaysError } = await supabase
        .from('organization_payment_gateways')
        .select('*')
        .eq('organization_id', activeTenant);

      if (!gatewaysError && gatewaysData) {
        // Reset states
        setWiseActive(false);
        setStripeActive(false);
        setStripePublicKey('');
        setStripeSecretKey('');
        setMpActive(false);
        setMpPublicKey('');
        setMpSecretKey('');

        gatewaysData.forEach((g: any) => {
          if (g.provider === 'wise') {
            setWiseActive(g.is_active);
          } else if (g.provider === 'stripe') {
            setStripeActive(g.is_active);
            setStripePublicKey(g.credentials?.publicKey || '');
            setStripeSecretKey(g.credentials?.secretKey || '');
          } else if (g.provider === 'mercadopago') {
            setMpActive(g.is_active);
            setMpPublicKey(g.credentials?.publicKey || '');
            setMpSecretKey(g.credentials?.secretKey || '');
          }
        });
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

  const handleSaveBookingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const activeTenant = localStorage.getItem('active-tenant-id');
      if (!activeTenant) return;

      const paymentLinks = {
        CH: wiseChfLink,
        DE: wiseEurLink
      };

      const bankTransferDetails = {
        CH: {
          iban: wiseChfIban,
          bic: wiseChfBic,
          holder: wiseChfHolder,
          bankName: wiseChfBank,
          address: wiseChfAddress
        },
        DE: {
          iban: wiseEurIban,
          bic: wiseEurBic,
          holder: wiseEurHolder,
          bankName: wiseEurBank,
          address: wiseEurAddress
        }
      };

      const { error: bookErr } = await supabase
        .from('booking_settings')
        .upsert({
          organization_id: activeTenant,
          booking_prefix: bookingPrefix,
          currency: bookingCurrency,
          payment_links: paymentLinks,
          bank_transfer_details: bankTransferDetails,
          terms_text: termsText,
          sandbox_mode: sandboxMode
        }, { onConflict: 'organization_id' });

      if (bookErr) throw bookErr;

      const gateways = [
        {
          provider: 'wise',
          is_active: wiseActive,
          credentials: {}
        },
        {
          provider: 'stripe',
          is_active: stripeActive,
          credentials: {
            publicKey: stripePublicKey,
            secretKey: stripeSecretKey
          }
        },
        {
          provider: 'mercadopago',
          is_active: mpActive,
          credentials: {
            publicKey: mpPublicKey,
            secretKey: mpSecretKey
          }
        }
      ];

      for (const g of gateways) {
        const { error: gateErr } = await supabase
          .from('organization_payment_gateways')
          .upsert({
            organization_id: activeTenant,
            provider: g.provider,
            is_active: g.is_active,
            credentials: g.credentials
          }, { onConflict: 'organization_id,provider' });

        if (gateErr) throw gateErr;
      }

      alert('Configuración de reservas y pagos guardada exitosamente.');
      await fetchProfileAndOrg();
    } catch (err: any) {
      console.error(err);
      alert('Error al guardar configuración: ' + err.message);
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

  const fetchServices = useCallback(async () => {
    const activeTenant = localStorage.getItem('active-tenant-id');
    if (!activeTenant) return;
    setLoadingServices(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', activeTenant)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setServices(data || []);
    } catch (err: any) {
      console.error('Error fetching services:', err);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTenant = localStorage.getItem('active-tenant-id');
    if (!activeTenant) return;
    if (!serviceTitle || !serviceSlug) {
      alert('Por favor completa el título y el slug.');
      return;
    }

    setIsSavingService(true);
    try {
      const payload: any = {
        organization_id: activeTenant,
        title: serviceTitle.trim(),
        id_slug: serviceSlug.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-'),
        duration_minutes: Number(serviceDuration),
        price: Number(servicePrice),
        currency: serviceCurrency,
        is_active: serviceActiveStatus
      };

      if (editingService && editingService.id) {
        // Update
        const { error } = await supabase
          .from('services')
          .update(payload)
          .eq('id', editingService.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('services')
          .insert(payload);
        if (error) throw error;
      }

      alert('Servicio guardado correctamente.');
      setEditingService(null);
      // Reset form
      setServiceTitle('');
      setServiceSlug('');
      setServiceDuration(50);
      setServicePrice(0);
      setServiceActiveStatus(true);

      await fetchServices();
    } catch (err: any) {
      alert('Error al guardar servicio: ' + err.message);
    } finally {
      setIsSavingService(false);
    }
  };

  const handleEditServiceClick = (srv: any) => {
    setEditingService(srv);
    setServiceTitle(srv.title);
    setServiceSlug(srv.id_slug);
    setServiceDuration(srv.duration_minutes);
    setServicePrice(srv.price);
    setServiceCurrency(srv.currency);
    setServiceActiveStatus(srv.is_active);
  };

  const handleNewServiceClick = () => {
    setEditingService({ id: '' }); // Mark as new
    setServiceTitle('');
    setServiceSlug('');
    setServiceDuration(50);
    setServicePrice(0);
    setServiceCurrency(bookingCurrency || 'CLP');
    setServiceActiveStatus(true);
  };

  const handleDeleteService = async (srvId: string, srvTitle: string) => {
    const confirmDel = confirm(`¿Estás seguro de eliminar el servicio "${srvTitle}"?`);
    if (!confirmDel) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', srvId);
      if (error) throw error;
      alert('Servicio eliminado.');
      await fetchServices();
    } catch (err: any) {
      alert('Error al eliminar servicio: ' + err.message);
    }
  };

  const handleSwitchClinic = (orgId: string) => {
    localStorage.setItem('active-tenant-id', orgId);
    window.location.reload();
  };

  useEffect(() => {
    fetchProfileAndOrg();
    fetchGoogleCalendars();
    fetchServices();
  }, [fetchServices]);

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
           bio,
          timezone,
          work_start_hour: Number(workStartHour),
          work_end_hour: Number(workEndHour),
          education: educationText.split('\n').map(line => line.trim()).filter(Boolean),
          specialties: specialtiesText.split('\n').map(line => line.trim()).filter(Boolean),
          languages: languagesText.split('\n').map(line => line.trim()).filter(Boolean),
          quote: quote.trim(),
          location: location.trim()
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

        {/* Main Tab Navigation */}
        <div className="border-b border-outline-variant/20 pb-px mb-6 overflow-x-auto no-scrollbar">
          <nav className="flex gap-2 py-1" aria-label="Tabs">
            <button
              onClick={() => setActiveMainTab('profile')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeMainTab === 'profile'
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <User className="w-4 h-4" />
              <span>Mi Perfil Clínico</span>
            </button>

            {showBookingTab && (
              <button
                onClick={() => setActiveMainTab('booking')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  activeMainTab === 'booking'
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`}
                type="button"
              >
                <CreditCard className="w-4 h-4" />
                <span>Reserva y Pagos</span>
              </button>
            )}

            <button
              onClick={() => setActiveMainTab('integrations')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeMainTab === 'integrations'
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <Link className="w-4 h-4" />
              <span>Integraciones y Créditos</span>
            </button>

            <button
              onClick={() => setActiveMainTab('security')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeMainTab === 'security'
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <Lock className="w-4 h-4" />
              <span>Seguridad y Cuentas</span>
            </button>

            <button
              onClick={() => setActiveMainTab('clinics')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeMainTab === 'clinics'
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
              type="button"
            >
              <Building2 className="w-4 h-4" />
              <span>Clínicas Asignadas</span>
            </button>
          </nav>
        </div>

        {/* Tab Content Panels */}
        {activeMainTab === 'profile' && (
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
                  <div className="w-32 h-32 rounded-full border-4 border-surface-container shadow-sm overflow-hidden flex items-center justify-center bg-primary/10 text-primary">
                    {profile?.logo_url ? (
                      <img src={profile.logo_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-4xl">
                        {profile ? profile.full_name[0].toUpperCase() : 'T'}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-primary text-on-primary rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    title="Cambiar Foto"
                    type="button"
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
                {profile?.logo_url && profile.logo_url.includes('googleusercontent.com') ? (
                  <p className="text-[10px] text-amber-500 font-medium leading-relaxed max-w-xs mb-4">
                    ⚠️ Usando foto de tu cuenta de Google por defecto. Haz clic en la cámara para subir una fotografía oficial.
                  </p>
                ) : (
                  <p className="text-[10px] text-on-surface-variant/75 leading-relaxed max-w-xs mb-4">
                    Se recomienda una fotografía oficial (con fondo neutro y buena iluminación) para el portal público.
                  </p>
                )}
              </div>

              <div className="w-full space-y-4 border-t border-outline-variant/20 pt-6">
                <button 
                  onClick={handlePreviewProfile}
                  className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-label-md hover:bg-primary-container transition-all cursor-pointer font-semibold shadow-sm"
                  type="button"
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="font-label-md text-on-surface-variant text-xs">Inicio de Jornada Laboral</label>
                      <select
                        value={workStartHour}
                        onChange={(e) => setWorkStartHour(Number(e.target.value))}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, '0')}:00 hrs</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="font-label-md text-on-surface-variant text-xs">Fin de Jornada Laboral</label>
                      <select
                        value={workEndHour}
                        onChange={(e) => setWorkEndHour(Number(e.target.value))}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, '0')}:00 hrs</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-label-md text-on-surface-variant text-xs font-semibold">Ubicación y Cobertura (se muestra en la Landing Page)</label>
                    <input 
                      type="text" 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Zúrich, Suiza (Atención Online y Presencial)"
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-label-md text-on-surface-variant text-xs font-semibold">Cita o Frase Clínico-Filosófica (se muestra en la Landing Page)</label>
                    <input 
                      type="text" 
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      placeholder="e.g. El dolor es el umbral para nacer a un nuevo sentido de vida."
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="font-label-md text-on-surface-variant text-xs font-semibold">Formación (un ítem por línea)</label>
                      <textarea 
                        value={educationText}
                        onChange={(e) => setEducationText(e.target.value)}
                        placeholder="e.g. Psicólogo Clínico - Univ. de Chile&#10;Diplomado en Terapia Familiar"
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none h-32"
                      ></textarea>
                    </div>
                    <div className="space-y-2">
                      <label className="font-label-md text-on-surface-variant text-xs font-semibold">Especialidades (un ítem por línea)</label>
                      <textarea 
                        value={specialtiesText}
                        onChange={(e) => setSpecialtiesText(e.target.value)}
                        placeholder="e.g. Duelo Migratorio&#10;Estrés Transcultural&#10;Ansiedad"
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none h-32"
                      ></textarea>
                    </div>
                    <div className="space-y-2">
                      <label className="font-label-md text-on-surface-variant text-xs font-semibold">Idiomas de Atención (un ítem por línea)</label>
                      <textarea 
                        value={languagesText}
                        onChange={(e) => setLanguagesText(e.target.value)}
                        placeholder="e.g. Español (Nativo)&#10;Inglés (B2)"
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none h-32"
                      ></textarea>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-label-md shadow-sm hover:bg-primary-container transition-all cursor-pointer disabled:opacity-50 font-semibold"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Detalles Clínicos'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {activeMainTab === 'booking' && showBookingTab && (
          <div className="grid grid-cols-12 gap-gutter">
            {/* Booking & Payments Config Section */}
            <section className="col-span-12 bg-surface-container-lowest rounded-xl p-8 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/10 space-y-6">
              <div className="border-b border-outline-variant/25 pb-4">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <span>Configuración de Reservas y Pagos</span>
                </h3>
                <p className="text-body-sm text-on-surface-variant text-sm mt-1">
                  Administra la integración pública del calendario de agendamiento y configura los procesadores de pago para la clínica.
                </p>
              </div>

              <form onSubmit={handleSaveBookingSettings} className="space-y-6">
                {/* Section Navigation Tabs */}
                <div className="flex border-b border-outline-variant/20 mb-6">
                  <button
                    type="button"
                    onClick={() => setActiveBookingTab('general')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                      activeBookingTab === 'general'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Ajustes Generales</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBookingTab('gateways')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                      activeBookingTab === 'gateways'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pasarelas y Métodos de Pago</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBookingTab('services')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                      activeBookingTab === 'services'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Servicios y Tarifas</span>
                  </button>
                </div>

                {/* Tab Content: General Settings */}
                {activeBookingTab === 'general' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="flex items-center gap-1.5 font-label-md text-on-surface font-semibold text-xs">
                          <span>Prefijo de Transacción</span>
                          <div className="group relative cursor-pointer">
                            <Info className="w-3.5 h-3.5 text-on-surface-variant/70 hover:text-primary" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-900 text-white text-[11px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed normal-case font-normal">
                              Identificador único para los códigos de tus citas y cobros clínicos. Máximo 5 caracteres.
                            </div>
                          </div>
                        </label>
                        <input 
                          type="text" 
                          required
                          value={bookingPrefix}
                          onChange={(e) => setBookingPrefix(e.target.value.toUpperCase().slice(0, 5))}
                          placeholder="e.g. SM"
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-1.5 font-label-md text-on-surface font-semibold text-xs">
                          <span>Moneda Principal</span>
                          <div className="group relative cursor-pointer">
                            <Info className="w-3.5 h-3.5 text-on-surface-variant/70 hover:text-primary" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-950 text-white text-[11px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed normal-case font-normal">
                              Divisa predeterminada para el cálculo de honorarios e integraciones de pago.
                            </div>
                          </div>
                        </label>
                        <div className="relative">
                          <select
                            value={bookingCurrency}
                            onChange={(e) => setBookingCurrency(e.target.value)}
                            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none cursor-pointer appearance-none"
                          >
                            <option value="CLP">CLP (Peso Chileno)</option>
                            <option value="CHF">CHF (Franco Suizo)</option>
                            <option value="EUR">EUR (Euro)</option>
                            <option value="USD">USD (Dólar Americano)</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
                            <ChevronRight className="w-4 h-4 transform rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border transition-all ${
                      sandboxMode 
                        ? 'bg-amber-500/5 border-amber-500/30' 
                        : 'bg-surface-container-low border-outline-variant/10'
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className={`w-4 h-4 ${sandboxMode ? 'text-amber-500' : 'text-on-surface-variant'}`} />
                            <h4 className="font-label-md text-sm text-on-surface font-bold">Modo Sandbox (Pruebas)</h4>
                          </div>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            Se usarán las credenciales de prueba de las pasarelas y se mostrará un banner informativo a tus pacientes durante el proceso de agendamiento.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                          <input 
                            type="checkbox" 
                            checked={sandboxMode}
                            onChange={(e) => setSandboxMode(e.target.checked)}
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 font-label-md text-on-surface font-semibold text-xs">
                        <span>Términos, Consentimiento y Protocolo de Crisis (Se muestra al reservar)</span>
                        <div className="group relative cursor-pointer">
                          <Info className="w-3.5 h-3.5 text-on-surface-variant/70 hover:text-primary" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-950 text-white text-[11px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed normal-case font-normal">
                            El paciente debe aceptar este texto antes de confirmar el agendamiento y proceder con el pago.
                          </div>
                        </div>
                      </label>
                      <textarea 
                        value={termsText}
                        onChange={(e) => setTermsText(e.target.value)}
                        placeholder="Ej: Comprendo y acepto el Protocolo de Crisis Transnacional y las políticas de cancelación de citas..."
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none h-32 resize-y" 
                      ></textarea>
                    </div>
                  </div>
                )}

                {/* Tab Content: Payment Gateways */}
                {activeBookingTab === 'gateways' && (
                  <div className="space-y-6">
                    
                    {/* Wise & Manual Transfers Card */}
                    <div className="p-5 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-5">
                      <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 text-primary rounded-lg">
                            <Globe className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-label-md text-sm text-on-surface font-bold">Wise & Transferencia Bancaria Manual</h4>
                            <p className="text-[11px] text-on-surface-variant">Muestra instrucciones y datos bancarios para transferencias directas en Suiza (CHF) y Alemania/Europa (EUR).</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            checked={wiseActive}
                            onChange={(e) => setWiseActive(e.target.checked)}
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      {wiseActive && (
                        <div className="space-y-4">
                          {/* Sub-tabs for Wise Currencies */}
                          <div className="flex gap-1 p-1 bg-surface-container-lowest rounded-lg border border-outline-variant/15 max-w-sm">
                            <button
                              type="button"
                              onClick={() => setActiveWiseTab('chf')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                activeWiseTab === 'chf'
                                  ? 'bg-primary text-on-primary shadow-sm'
                                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                              }`}
                            >
                              <span>🇨🇭 Suiza (CHF)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveWiseTab('eur')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                activeWiseTab === 'eur'
                                  ? 'bg-primary text-on-primary shadow-sm'
                                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                              }`}
                            >
                              <span>🇪🇺 Alemania / Europa (EUR)</span>
                            </button>
                          </div>

                          {/* Wise CHF Switzerland */}
                          {activeWiseTab === 'chf' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                              <div className="md:col-span-2 flex items-center gap-1.5 text-xs font-bold text-primary pb-2 border-b border-outline-variant/10">
                                <Globe className="w-3.5 h-3.5" />
                                <span>Configuración Suiza (CHF)</span>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Wise Link CHF</label>
                                <input 
                                  type="text" 
                                  placeholder="Wise Link CHF (https://wise.com/pay/me/...)"
                                  value={wiseChfLink}
                                  onChange={(e) => setWiseChfLink(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Titular de la Cuenta</label>
                                <input 
                                  type="text" 
                                  placeholder="Titular de la Cuenta"
                                  value={wiseChfHolder}
                                  onChange={(e) => setWiseChfHolder(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">IBAN CHF</label>
                                <input 
                                  type="text" 
                                  placeholder="IBAN CHF"
                                  value={wiseChfIban}
                                  onChange={(e) => setWiseChfIban(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">BIC / SWIFT</label>
                                <input 
                                  type="text" 
                                  placeholder="BIC / SWIFT"
                                  value={wiseChfBic}
                                  onChange={(e) => setWiseChfBic(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Nombre del Banco</label>
                                <input 
                                  type="text" 
                                  placeholder="Nombre del Banco"
                                  value={wiseChfBank}
                                  onChange={(e) => setWiseChfBank(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Dirección del Banco</label>
                                <textarea 
                                  placeholder="Dirección del Banco"
                                  value={wiseChfAddress}
                                  onChange={(e) => setWiseChfAddress(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface h-[38px] resize-none"
                                />
                              </div>
                            </div>
                          )}

                          {/* Wise EUR Germany */}
                          {activeWiseTab === 'eur' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                              <div className="md:col-span-2 flex items-center gap-1.5 text-xs font-bold text-primary pb-2 border-b border-outline-variant/10">
                                <Globe className="w-3.5 h-3.5" />
                                <span>Configuración Alemania/Europa (EUR)</span>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Wise Link EUR</label>
                                <input 
                                  type="text" 
                                  placeholder="Wise Link EUR (https://wise.com/pay/me/...)"
                                  value={wiseEurLink}
                                  onChange={(e) => setWiseEurLink(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Titular de la Cuenta</label>
                                <input 
                                  type="text" 
                                  placeholder="Titular de la Cuenta"
                                  value={wiseEurHolder}
                                  onChange={(e) => setWiseEurHolder(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">IBAN EUR</label>
                                <input 
                                  type="text" 
                                  placeholder="IBAN EUR"
                                  value={wiseEurIban}
                                  onChange={(e) => setWiseEurIban(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">BIC / SWIFT</label>
                                <input 
                                  type="text" 
                                  placeholder="BIC / SWIFT"
                                  value={wiseEurBic}
                                  onChange={(e) => setWiseEurBic(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-mono"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Nombre del Banco</label>
                                <input 
                                  type="text" 
                                  placeholder="Nombre del Banco"
                                  value={wiseEurBank}
                                  onChange={(e) => setWiseEurBank(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase">Dirección del Banco</label>
                                <textarea 
                                  placeholder="Dirección del Banco"
                                  value={wiseEurAddress}
                                  onChange={(e) => setWiseEurAddress(e.target.value)}
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface h-[38px] resize-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Stripe Integration Card */}
                    <div className="p-5 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-5">
                      <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 text-primary rounded-lg">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-label-md text-sm text-on-surface font-bold">Pasarela Stripe</h4>
                            <p className="text-[11px] text-on-surface-variant">Cobros en línea automatizados con tarjetas internacionales y wallets.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            checked={stripeActive}
                            onChange={(e) => setStripeActive(e.target.checked)}
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      {stripeActive && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase">
                              <span>Stripe Public Key</span>
                              <div className="group relative cursor-pointer">
                                <Info className="w-3 h-3 text-on-surface-variant/70 hover:text-primary" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-900 text-white text-[11px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed normal-case font-normal">
                                  Tu clave pública de Stripe (pk_live_... o pk_test_...).
                                </div>
                              </div>
                            </label>
                            <input 
                              type="text" 
                              value={stripePublicKey}
                              onChange={(e) => setStripePublicKey(e.target.value)}
                              placeholder="pk_test_..."
                              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase">
                              <span>Stripe Secret Key</span>
                              <div className="group relative cursor-pointer">
                                <Info className="w-3 h-3 text-on-surface-variant/70 hover:text-primary" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-900 text-white text-[11px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed normal-case font-normal">
                                  Tu clave secreta de Stripe. Nunca la compartas.
                                </div>
                              </div>
                            </label>
                            <div className="relative flex items-center">
                              <input 
                                type={showStripeSecret ? 'text' : 'password'}
                                value={stripeSecretKey}
                                onChange={(e) => setStripeSecretKey(e.target.value)}
                                placeholder="sk_test_..."
                                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg pl-3 pr-10 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowStripeSecret(!showStripeSecret)}
                                className="absolute right-3 text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
                              >
                                {showStripeSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* MercadoPago Integration Card */}
                    <div className="p-5 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-5">
                      <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 text-primary rounded-lg">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-label-md text-sm text-on-surface font-bold">Pasarela MercadoPago (Chile)</h4>
                            <p className="text-[11px] text-on-surface-variant">Cobros locales automatizados en Chile a través de Webpay o Khipu.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            checked={mpActive}
                            onChange={(e) => setMpActive(e.target.checked)}
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-outline-variant/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      {mpActive && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase">
                              <span>MercadoPago Public Key</span>
                              <div className="group relative cursor-pointer">
                                <Info className="w-3 h-3 text-on-surface-variant/70 hover:text-primary" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-900 text-white text-[11px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed normal-case font-normal">
                                  Clave pública de integración de MercadoPago.
                                </div>
                              </div>
                            </label>
                            <input 
                              type="text" 
                              value={mpPublicKey}
                              onChange={(e) => setMpPublicKey(e.target.value)}
                              placeholder="APP_USR-..."
                              className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase">
                              <span>MercadoPago Access Token</span>
                              <div className="group relative cursor-pointer">
                                <Info className="w-3 h-3 text-on-surface-variant/70 hover:text-primary" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-900 text-white text-[11px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed normal-case font-normal">
                                  Token de acceso privado de MercadoPago.
                                </div>
                              </div>
                            </label>
                            <div className="relative flex items-center">
                              <input 
                                type={showMpSecret ? 'text' : 'password'}
                                value={mpSecretKey}
                                onChange={(e) => setMpSecretKey(e.target.value)}
                                placeholder="APP_USR-..."
                                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg pl-3 pr-10 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowMpSecret(!showMpSecret)}
                                className="absolute right-3 text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
                              >
                                {showMpSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeBookingTab === 'services' && (
                  <div className="space-y-6">
                    {/* Add service button */}
                    {!editingService && (
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-on-surface">Servicios Registrados ({services.length})</h4>
                        <button
                          type="button"
                          onClick={handleNewServiceClick}
                          className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar Servicio</span>
                        </button>
                      </div>
                    )}

                    {/* Editing Form */}
                    {editingService && (
                      <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-outline-variant/25 pb-3">
                          <h4 className="text-sm font-bold text-primary">
                            {editingService.id ? 'Editar Servicio' : 'Nuevo Servicio Clínico'}
                          </h4>
                          <button
                            type="button"
                            onClick={() => setEditingService(null)}
                            className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Título del Servicio</label>
                            <input
                              type="text"
                              value={serviceTitle}
                              onChange={(e) => {
                                setServiceTitle(e.target.value);
                                if (!editingService.id) {
                                  // Auto-generate slug for new services
                                  setServiceSlug(e.target.value.toLowerCase().trim()
                                    .replace(/[^a-z0-9\s-]/g, '')
                                    .replace(/\s+/g, '-'));
                                }
                              }}
                              placeholder="Ej. Psicoterapia Individual"
                              className="w-full text-sm bg-surface-container-lowest border border-outline-variant/35 rounded-lg px-3.5 py-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Slug de Enlace (ID)</label>
                            <input
                              type="text"
                              value={serviceSlug}
                              onChange={(e) => setServiceSlug(e.target.value)}
                              placeholder="ej. psicoterapia-individual"
                              className="w-full text-sm bg-surface-container-lowest border border-outline-variant/35 rounded-lg px-3.5 py-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Duración (minutos)</label>
                            <input
                              type="number"
                              value={serviceDuration}
                              onChange={(e) => setServiceDuration(Number(e.target.value))}
                              className="w-full text-sm bg-surface-container-lowest border border-outline-variant/35 rounded-lg px-3.5 py-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2 space-y-1.5">
                              <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Precio</label>
                              <input
                                type="number"
                                step="0.01"
                                value={servicePrice}
                                onChange={(e) => setServicePrice(Number(e.target.value))}
                                className="w-full text-sm bg-surface-container-lowest border border-outline-variant/35 rounded-lg px-3.5 py-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Moneda</label>
                              <select
                                value={serviceCurrency}
                                onChange={(e) => setServiceCurrency(e.target.value)}
                                className="w-full text-sm bg-surface-container-lowest border border-outline-variant/35 rounded-lg px-2 py-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                              >
                                <option value="CLP">CLP</option>
                                <option value="CHF">CHF</option>
                                <option value="EUR">EUR</option>
                                <option value="USD">USD</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-2">
                            <input
                              type="checkbox"
                              id="serviceActive"
                              checked={serviceActiveStatus}
                              onChange={(e) => setServiceActiveStatus(e.target.checked)}
                              className="w-4 h-4 text-primary bg-surface-container-lowest border-outline-variant/40 rounded focus:ring-primary focus:ring-2"
                            />
                            <label htmlFor="serviceActive" className="text-xs font-semibold text-on-surface cursor-pointer">
                              Servicio Activo para Reservas Públicas
                            </label>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-outline-variant/15 pt-3 mt-4">
                          <button
                            type="button"
                            onClick={() => setEditingService(null)}
                            className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-on-surface-variant hover:text-on-surface text-xs font-semibold rounded-lg cursor-pointer transition-all"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveService}
                            disabled={isSavingService}
                            className="px-5 py-2 bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold rounded-lg cursor-pointer transition-all disabled:opacity-50"
                          >
                            {isSavingService ? 'Guardando...' : 'Guardar Servicio'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Services list */}
                    {loadingServices ? (
                      <div className="text-center py-6 text-xs text-on-surface-variant">Cargando catálogo de servicios...</div>
                    ) : services.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-outline-variant/30 rounded-xl space-y-2">
                        <p className="text-sm font-semibold text-on-surface-variant">No tienes servicios creados.</p>
                        <p className="text-xs text-on-surface-variant/75">Crea tus servicios para que tus pacientes los seleccionen al agendar.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {services.map((srv) => (
                          <div 
                            key={srv.id} 
                            className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
                              srv.is_active 
                                ? 'bg-surface-container-lowest border-outline-variant/20 hover:border-outline' 
                                : 'bg-surface-container-low/40 border-outline-variant/15 opacity-60'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="font-bold text-sm text-on-surface leading-tight">{srv.title}</h5>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  srv.is_active 
                                    ? 'bg-success/10 text-success' 
                                    : 'bg-neutral-500/10 text-on-surface-variant'
                                }`}>
                                  {srv.is_active ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                              <p className="text-[11px] text-on-surface-variant font-mono mt-1">Slug: {srv.id_slug}</p>
                              
                              <div className="flex items-center gap-4 mt-3 text-xs text-on-surface-variant font-semibold">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{srv.duration_minutes} min</span>
                                </div>
                                <div className="flex items-center gap-1 text-primary">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>{srv.price} {srv.currency}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-outline-variant/10 pt-3 mt-4">
                              <button
                                type="button"
                                onClick={() => handleEditServiceClick(srv)}
                                className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteService(srv.id, srv.title)}
                                className="p-1.5 hover:bg-error/10 rounded text-on-surface-variant hover:text-error transition-colors cursor-pointer"
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

                {activeBookingTab !== 'services' && (
                  <div className="flex justify-end pt-4 border-t border-outline-variant/15">
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-label-md shadow-sm hover:bg-primary-container transition-all cursor-pointer disabled:opacity-50 font-semibold"
                    >
                      {submitting ? 'Guardando...' : 'Guardar Configuración de Pagos'}
                    </button>
                  </div>
                )}
              </form>
            </section>
          </div>
        )}

        {activeMainTab === 'integrations' && (
          <div className="grid grid-cols-12 gap-gutter">
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
                      type="button"
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
                      type="button"
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

                    {/* Mapeo de Calendarios */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-outline-variant/15">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wide">Calendario para Citas Clínicas</label>
                        <select
                          value={clinicalCalendarId || ''}
                          onChange={async (e) => {
                            const val = e.target.value || null;
                            setClinicalCalendarId(val);
                            await handleSaveCalendarMapping(val, personalCalendarId);
                          }}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none cursor-pointer"
                        >
                          <option value="">No guardar en Google</option>
                          {googleCalendars.map((cal) => (
                            <option key={cal.calendar_id || cal.id} value={cal.calendar_id}>
                              {cal.calendar_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wide">Calendario para Eventos Personales</label>
                        <select
                          value={personalCalendarId || ''}
                          onChange={async (e) => {
                            const val = e.target.value || null;
                            setPersonalCalendarId(val);
                            await handleSaveCalendarMapping(clinicalCalendarId, val);
                          }}
                          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none cursor-pointer"
                        >
                          <option value="">No guardar en Google</option>
                          {googleCalendars.map((cal) => (
                            <option key={cal.calendar_id || cal.id} value={cal.calendar_id}>
                              {cal.calendar_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Timezone selector */}
                    <div className="space-y-1 mt-3 pt-3 border-t border-outline-variant/15">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-wide flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Zona Horaria
                      </label>
                      <select
                        value={timezone}
                        onChange={async (e) => {
                          const tz = e.target.value;
                          setTimezone(tz);
                          if (profile) {
                            await supabase.from('profiles').update({ timezone: tz }).eq('id', profile.id);
                          }
                        }}
                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none transition-colors cursor-pointer"
                      >
                        <optgroup label="América">
                          <option value="America/Santiago">🇨🇱 Chile (Santiago) UTC-4</option>
                          <option value="America/Punta_Arenas">🇨🇱 Chile (Magallanes) UTC-3</option>
                          <option value="America/Argentina/Buenos_Aires">🇦🇷 Argentina UTC-3</option>
                          <option value="America/Bogota">🇨🇴 Colombia UTC-5</option>
                          <option value="America/Lima">🇵🇪 Perú UTC-5</option>
                          <option value="America/Mexico_City">🇲🇽 México (CDMX) UTC-6</option>
                          <option value="America/New_York">🇺🇸 Este (NY) UTC-5</option>
                          <option value="America/Los_Angeles">🇺🇸 Pacífico (LA) UTC-8</option>
                          <option value="America/Sao_Paulo">🇧🇷 Brasil (São Paulo) UTC-3</option>
                          <option value="America/Montevideo">🇺🇾 Uruguay UTC-3</option>
                        </optgroup>
                        <optgroup label="Europa">
                          <option value="Europe/Madrid">🇪🇸 España UTC+1</option>
                          <option value="Europe/London">🇬🇧 Londres UTC+0</option>
                          <option value="Europe/Berlin">🇩🇪 Alemania UTC+1</option>
                        </optgroup>
                      </select>
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
                    type="button"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${googleLoading ? 'animate-spin' : ''}`} />
                    Refrescar
                  </button>
                  <button
                    onClick={handleGoogleDisconnect}
                    disabled={googleLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-error/30 text-error hover:bg-error/5 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    type="button"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    Desconectar
                  </button>
                </div>
              )}
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
          </div>
        )}

        {activeMainTab === 'security' && (
          <div className="grid grid-cols-12 gap-gutter">
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
                    type="button"
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
                    type="button"
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
                type="button"
              >
                Desactivar Cuenta
              </button>
            </section>
          </div>
        )}

        {activeMainTab === 'clinics' && (
          <div className="grid grid-cols-12 gap-gutter">
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
                                type="button"
                              >
                                Alternar Clínica
                              </button>
                            )}
                            {isOwner ? (
                              <button
                                onClick={() => handleDeleteClinic(clinicItem.organization_id, org.name)}
                                className="px-3 py-1.5 border border-error/30 text-error hover:bg-error/5 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                                type="button"
                              >
                                Eliminar Clínica
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLeaveClinic(clinicItem.id, clinicItem.organization_id, org.name)}
                                className="px-3 py-1.5 border border-warning/30 text-warning hover:bg-warning/5 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                                type="button"
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
          </div>
        )}
        {/* Footer */}
        <footer className="p-8 border-t border-outline-variant/10 text-center text-on-surface-variant font-label-sm text-xs">
          <p>© 2026 PsicFlow Ecosistema de Gestión y Blindaje Psicológico. Encriptación de datos AES-256 e HIPAA Compliant.</p>
        </footer>
      </div>

      {/* Modal de Previsualización de Perfil */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto text-on-surface flex flex-col gap-6 transition-all duration-300">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="text-xl font-bold font-display text-on-surface">Vista Previa de tu Perfil Público</h3>
              </div>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer"
                type="button"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Card Preview Container (Sentido Migrante style card) */}
            <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              
              {/* Photo */}
              <div className="w-28 h-28 rounded-2xl bg-primary/10 overflow-hidden shrink-0 border border-outline-variant/20 shadow-inner flex items-center justify-center">
                {profile?.logo_url ? (
                  <img src={profile.logo_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-4xl text-primary">{fullName[0]?.toUpperCase() || 'T'}</span>
                )}
              </div>
              
              {/* Details */}
              <div className="flex flex-col text-center sm:text-left justify-center min-w-0 flex-1">
                <h4 className="font-bold text-xl text-on-surface font-display">{fullName || 'Terapeuta'}</h4>
                <p className="text-xs text-primary font-bold uppercase tracking-wider mt-1">{specialization || 'Psicólogo Clínico y Psicoterapeuta'}</p>
                
                {experience > 0 && (
                  <p className="text-xs text-on-surface-variant font-medium mt-1">
                    {experience} {experience === 1 ? 'año' : 'años'} de experiencia clínica
                  </p>
                )}

                {location && (
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-[11px] text-on-surface-variant mt-2 font-medium">
                    <MapPin size={12} className="text-primary" />
                    <span className="truncate">{location}</span>
                  </div>
                )}

                {bio && (
                  <p className="text-xs text-on-surface-variant font-light mt-3 leading-relaxed border-t border-outline-variant/10 pt-3">
                    {bio}
                  </p>
                )}
              </div>
            </div>

            {/* Expanded details grid (Quote, specialties, education, languages) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {quote && (
                <div className="col-span-2 p-4 bg-primary/5 border border-primary/10 rounded-xl italic text-on-surface-variant text-center leading-relaxed">
                  "{quote}"
                </div>
              )}

              {/* Specialties */}
              <div className="space-y-1.5 bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                <h5 className="font-bold text-primary">Especialidades:</h5>
                {specialtiesText ? (
                  <ul className="list-disc list-inside space-y-0.5 text-on-surface-variant pl-1">
                    {specialtiesText.split('\n').filter(Boolean).map((spec, idx) => (
                      <li key={idx} className="leading-snug">{spec.trim()}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-on-surface-variant/65 italic">Sin especialidades configuradas</p>
                )}
              </div>

              {/* Education */}
              <div className="space-y-1.5 bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                <h5 className="font-bold text-primary">Educación y Formación:</h5>
                {educationText ? (
                  <ul className="list-disc list-inside space-y-0.5 text-on-surface-variant pl-1">
                    {educationText.split('\n').filter(Boolean).map((edu, idx) => (
                      <li key={idx} className="leading-snug">{edu.trim()}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-on-surface-variant/65 italic">Sin educación registrada</p>
                )}
              </div>

              {/* Languages */}
              {languagesText && (
                <div className="col-span-2 space-y-1 bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                  <span className="font-bold text-primary">Idiomas de Atención: </span>
                  <span className="text-on-surface-variant">{languagesText.split('\n').filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-outline-variant/10 pt-4 mt-2">
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="px-5 py-2 bg-primary text-on-primary hover:bg-primary-container text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                type="button"
              >
                Cerrar Vista Previa
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
