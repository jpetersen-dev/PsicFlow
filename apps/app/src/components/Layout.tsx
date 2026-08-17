import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { usePrivacyMode } from './PrivacyModeProvider';
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  BookOpen,
  FileText,
  User,
  Eye,
  EyeOff,
  Building2,
  Menu,
  X,
  Lock,
  Plus,
  Wallet,
  LogOut,
  Bell,
  Settings,
  ShieldCheck,
  Star,
  Newspaper,
  Crown,
  CreditCard
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { NewClinicModal } from './NewClinicModal';
import { hasFeature } from '../utils/planFeatures';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const noLayoutRoutes = ['/login', '/invitacion'];
  const isNoLayout = noLayoutRoutes.some(route => router.pathname.startsWith(route)) || router.pathname === '/';

  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTenant, setActiveTenant] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const activeOrg = organizations.find(o => o.id === activeTenant);
  const activePlan = activeOrg?.current_plan || 'Starter';
  const [isNewClinicOpen, setIsNewClinicOpen] = useState(false);
  const [credits, setCredits] = useState<{ NOTA_IA: number; INFORME_CLINICO: number }>({ NOTA_IA: 0, INFORME_CLINICO: 0 });
  const [profile, setProfile] = useState<{ full_name: string; role_name: string } | null>(null);
  const [authChecking, setAuthChecking] = useState(!isNoLayout);
  const [isPatient, setIsPatient] = useState(false);
 
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  
  const [assigningSessionId, setAssigningSessionId] = useState<string | null>(null);
  const [selectedProId, setSelectedProId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
 
  const fetchTeamMembers = async () => {
    try {
      const activeTenantId = localStorage.getItem('active-tenant-id');
      if (!activeTenantId) return;
 
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', activeTenantId);
 
      if (!error && data) {
        setTeamMembers(data);
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
    }
  };
 
  const handleAssignTherapist = async (sessionId: string, proId: string) => {
    if (!proId) return;
    setIsAssigning(true);
    try {
      const activeTenantId = localStorage.getItem('active-tenant-id');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
 
      if (!token || !activeTenantId) {
        alert('Sesión inválida o faltan credenciales');
        return;
      }
 
      const res = await fetch('/api/v1/booking/assign-therapist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': activeTenantId,
        },
        body: JSON.stringify({ sessionId, professionalId: proId }),
      });
 
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Terapeuta asignado correctamente: ${data.professionalName}`);
        setAssigningSessionId(null);
        setSelectedProId('');
        fetchNotifications();
      } else {
        alert(`Error al asignar terapeuta: ${data.error}`);
      }
    } catch (err) {
      console.error('Error assigning therapist:', err);
      alert('Error de red al asignar terapeuta.');
    } finally {
      setIsAssigning(false);
    }
  };
 
  const fetchNotifications = async () => {
    try {
      const activeTenantId = localStorage.getItem('active-tenant-id');
      if (!activeTenantId) return;
 
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
 
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          date_session,
          time_session,
          status_payment,
          transaction_id,
          comentarios_internos,
          professional_id,
          patient:patient_id (full_name),
          service:service_id (id_slug, title)
        `)
        .eq('organization_id', activeTenantId)
        .or(`status_payment.eq.Pendiente,and(status_payment.eq.Pagado,date_session.gte.${twoDaysAgoStr})`)
        .order('date_session', { ascending: false })
        .order('time_session', { ascending: false });
 
      if (error) {
        console.error('Error fetching orientation notifications:', error);
      } else if (data) {
        const orientationNotifs = data.filter((s: any) => 
          s.service?.id_slug === 'entrevista-orientacion-psicologica-online'
        );
        setNotifications(orientationNotifs);
      }
    } catch (err) {
      console.error('Error in fetchNotifications:', err);
    }
  };
 
  useEffect(() => {
    if (isNoLayout || isPatient) return;
    fetchNotifications();
 
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [isNoLayout, isPatient, activeTenant]);
 
  useEffect(() => {
    function handleClickOutsideNotif(event: MouseEvent) {
      if (
        showNotifications &&
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutsideNotif);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutsideNotif);
    };
  }, [showNotifications]);
  
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close sidebar when clicking outside on both desktop and mobile
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [sidebarOpen]);

  // Auth session check & listener
  useEffect(() => {
    if (isNoLayout) {
      setAuthChecking(false);
      return;
    }

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setAuthChecking(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !isNoLayout) {
        router.push('/login');
      } else if (session) {
        setAuthChecking(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isNoLayout, router]);

  // Initialize tenant context and fetch clinics dynamically
  useEffect(() => {
    if (isNoLayout) return;

    const fetchOrganizations = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        // Fetch organizations via user profiles to prevent listing RLS-visible invitation clinics
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select(`
            organization_id,
            organizations (
              id,
              name,
              current_plan
            )
          `)
          .eq('user_id', session.user.id);
        
        if (!profilesError && profilesData && profilesData.length > 0) {
          // Extract unique organizations from profiles
          const orgMap = new Map();
          profilesData.forEach((p: any) => {
            if (p.organizations) {
              orgMap.set(p.organizations.id, p.organizations);
            }
          });
          const uniqueOrgs = Array.from(orgMap.values());
          setOrganizations(uniqueOrgs);
          
          let tenantId = localStorage.getItem('active-tenant-id') || '';
          if (!tenantId || !uniqueOrgs.some(o => o.id === tenantId)) {
            if (uniqueOrgs.length > 0) {
              const firstId = uniqueOrgs[0].id;
              localStorage.setItem('active-tenant-id', firstId);
              tenantId = firstId;
            } else {
              tenantId = '';
            }
          }
          setActiveTenant(tenantId);
        } else {
          // Try to fetch patient organization
          const { data: patientData, error: patientError } = await supabase
            .from('patients')
            .select(`
              organization_id,
              organizations (
                id,
                name,
                current_plan
              )
            `)
            .eq('user_id', session.user.id)
            .limit(1)
            .single();

          if (!patientError && patientData && patientData.organizations) {
            const org = patientData.organizations as any;
            setOrganizations([org]);
            setActiveTenant(org.id);
            localStorage.setItem('active-tenant-id', org.id);
          }
        }
      } catch (err) {
        console.error('Error fetching organizations:', err);
      }
    };

    fetchOrganizations();
  }, [isNoLayout]);

  // Fetch tenant profile and credits whenever activeTenant changes
  useEffect(() => {
    if (isNoLayout || !activeTenant) return;

    const fetchTenantData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        // Fetch active profile for this tenant and user
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, role_name')
          .eq('organization_id', activeTenant)
          .eq('user_id', session.user.id)
          .limit(1)
          .single();

        let currentProfile = null;
        let userIsPatient = false;

        if (!profileError && profileData) {
          currentProfile = profileData;
          setProfile(profileData);
          setIsPatient(false);
          userIsPatient = false;
        } else {
          // Try to fetch patient details
          const { data: patientData, error: patientError } = await supabase
            .from('patients')
            .select('id, full_name, organization_id')
            .eq('user_id', session.user.id)
            .limit(1)
            .single();

          if (!patientError && patientData) {
            const mockProfile = { full_name: patientData.full_name, role_name: 'paciente' };
            currentProfile = mockProfile;
            setProfile(mockProfile);
            setIsPatient(true);
            userIsPatient = true;
          } else {
            setProfile(null);
            setIsPatient(false);
          }
        }

        // Fetch credits (only for clinicians and non-bypass tenants)
        if (!userIsPatient && currentProfile) {
          if (activeTenant === 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb') {
            // Bypass credits for Sentido Migrante
            setCredits({ NOTA_IA: 9999, INFORME_CLINICO: 9999 });
          } else {
            const { data: ledgerData, error: ledgerError } = await supabase
              .from('credit_ledger')
              .select('type_unit, amount');

            if (!ledgerError && ledgerData) {
              const totals = ledgerData.reduce(
                (acc, curr) => {
                  if (curr.type_unit === 'NOTA_IA') acc.NOTA_IA += curr.amount;
                  if (curr.type_unit === 'INFORME_CLINICO') acc.INFORME_CLINICO += curr.amount;
                  return acc;
                },
                { NOTA_IA: 0, INFORME_CLINICO: 0 }
              );
              setCredits(totals);
            }
          }
        } else {
          setCredits({ NOTA_IA: 0, INFORME_CLINICO: 0 });
        }
      } catch (err) {
        console.error('Error fetching tenant data:', err);
      }
    };

    fetchTenantData();
  }, [activeTenant, isNoLayout]);

  // Route protection by role and plan features
  useEffect(() => {
    if (isNoLayout || !profile) return;
    const isPatientUser = profile.role_name === 'paciente';
    const isPortalRoute = router.pathname.startsWith('/portal');

    if (isPatientUser && !isPortalRoute) {
      router.push('/portal');
    } else if (!isPatientUser && isPortalRoute) {
      router.push('/dashboard');
    } else if (!isPatientUser) {
      // Feature Gating Guard
      if (router.pathname.startsWith('/resenas') && !hasFeature(activePlan, 'reviews')) {
        router.push('/dashboard');
      } else if (router.pathname.startsWith('/publicaciones') && !hasFeature(activePlan, 'blog')) {
        router.push('/dashboard');
      }
    }
  }, [profile, router.pathname, isNoLayout, router, activePlan]);

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    localStorage.setItem('active-tenant-id', newId);
    setActiveTenant(newId);
    router.reload();
  };

  const navItems = isPatient ? [
    { name: 'Mi Portal', href: '/portal', icon: LayoutDashboard },
    { name: 'Mis Citas', href: '/portal/sesiones', icon: Calendar },
    { name: 'Agendar Cita', href: '/portal/agendar', icon: Plus },
    { name: 'Mi Perfil', href: '/portal/perfil', icon: User },
  ] : [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'CRM Pacientes', href: '/pacientes', icon: Users },
    { name: 'Calendario', href: '/calendario', icon: Calendar },
    { name: 'Reportes y Finanzas', href: '/reportes', icon: BarChart3 },
    { name: 'Biblioteca', href: '/biblioteca', icon: BookOpen },
    { name: 'Centro Documentos', href: '/documentos', icon: FileText },
    ...(hasFeature(activePlan, 'reviews') ? [{ name: 'Reseñas Pacientes', href: '/resenas', icon: Star }] : []),
    ...(hasFeature(activePlan, 'blog') ? [{ name: 'Publicaciones', href: '/publicaciones', icon: Newspaper }] : []),
    { name: 'Plan & Suscripción', href: '/plan', icon: CreditCard },
    { name: 'Mi Perfil', href: '/perfil', icon: User }
  ];

  if (authChecking) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col justify-center items-center gap-4 w-full">
        <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin"></div>
        <p className="text-sm text-text-secondary">Verificando sesión clínica...</p>
      </div>
    );
  }

  if (isNoLayout) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex font-sans w-full justify-center items-center">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex font-sans">
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`bg-bg-sidebar border-r border-border-color transition-all duration-300 z-30 flex flex-col fixed inset-y-0 left-0 md:static ${sidebarOpen ? 'w-64' : 'w-0 md:w-20 overflow-hidden'
          }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border-color bg-bg-sidebar">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-accent-primary">
            <img src="/logo_psicflow.svg" alt="PsicFlow" className="w-7 h-7" />
            <span className={sidebarOpen ? 'block' : 'hidden md:hidden'}>PsicFlow</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                    ? 'bg-accent-primary/15 text-accent-primary border-l-2 border-accent-primary'
                    : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                  }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={sidebarOpen ? 'block' : 'hidden md:hidden'}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (Credits Display) */}
        {sidebarOpen && !isPatient && (
          <div className="p-4 border-t border-border-color bg-bg-sidebar/50 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
              <Wallet className="w-4 h-4 text-accent-primary" />
              <span>Saldos de Créditos IA</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-bg-input p-2 rounded border border-border-color">
                <p className="text-text-muted">Notas IA</p>
                <p className="font-bold text-accent-primary">{credits.NOTA_IA}</p>
              </div>
              <div className="bg-bg-input p-2 rounded border border-border-color">
                <p className="text-text-muted">Informes</p>
                <p className="font-bold text-accent-primary">{credits.INFORME_CLINICO}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <Lock className="w-3 h-3" />
              <span>Conexión Protegida RLS</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col min-w-0"
        onClick={(e) => {
          if (sidebarOpen && menuButtonRef.current && !menuButtonRef.current.contains(e.target as Node)) {
            setSidebarOpen(false);
          }
        }}
      >
        {/* Header */}
        <header className="h-16 bg-bg-sidebar border-b border-border-color flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              ref={menuButtonRef}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-text-secondary hover:text-text-primary"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Tenant Selector Dropdown */}
            {!isPatient && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-bg-input border border-border-color rounded-lg px-3 py-1.5">
                  <Building2 className="w-4 h-4 text-accent-primary" />
                  <select
                    value={activeTenant}
                    onChange={handleTenantChange}
                    className="bg-transparent text-sm text-text-primary focus:outline-none font-medium cursor-pointer"
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id} className="bg-bg-sidebar text-text-primary">
                        {org.name} ({org.current_plan})
                      </option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={() => router.push('/plan')}
                  className="p-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-400 rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                  title="Gestionar Plan y Suscripción (Premium)"
                  type="button"
                >
                  <Crown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            {/* Privacy Mode Toggle */}
            {!isPatient && (
              <button
                onClick={togglePrivacyMode}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isPrivacyMode
                    ? 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-bg-input text-text-secondary border-border-color hover:text-text-primary'
                  }`}
                title={isPrivacyMode ? 'Desactivar Modo Privacidad' : 'Activar Modo Privacidad'}
              >
                {isPrivacyMode ? <EyeOff className="w-4 h-4 text-warning" /> : <Eye className="w-4 h-4" />}
                <span>Modo Privacidad</span>
              </button>
            )}

            {/* Notifications Bell */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    fetchNotifications();
                    fetchTeamMembers();
                  }
                }}
                className="p-1.5 bg-bg-input border border-border-color hover:bg-bg-card hover:text-accent-primary text-text-secondary rounded-lg transition-all flex items-center justify-center cursor-pointer relative"
                title="Notificaciones"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => n.status_payment === 'Pendiente') && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-accent-primary rounded-full animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-bg-card border border-border-color rounded-xl shadow-xl z-50 overflow-hidden text-sm">
                  <div className="px-4 py-3 border-b border-border-color bg-bg-sidebar font-bold text-text-primary flex justify-between items-center">
                    <span>Notificaciones</span>
                    <span className="text-[10px] bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded-full">
                      Orientación
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-border-color">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-text-muted text-xs">
                        No hay notificaciones pendientes.
                      </div>
                    ) : (
                      notifications.map(notif => {
                        const pat = notif.patient as any;
                        const isPending = notif.status_payment === 'Pendiente';
                        const isUnassigned = notif.comentarios_internos?.includes('[PENDIENTE_ASIGNACION]');
                        return (
                          <div key={notif.id} className="p-3 hover:bg-bg-input transition-colors">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <div className="flex gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isPending ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'
                                }`}>
                                  {isPending ? 'Pendiente Confirmación' : 'Confirmado'}
                                </span>
                                {isUnassigned && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-error/15 text-error">
                                    Sin Asignar
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-text-muted font-mono">{notif.date_session}</span>
                            </div>
                            <p className="text-xs text-text-primary leading-relaxed">
                              {isPending ? (
                                <>
                                  Nueva entrevista de orientación solicitada por <strong>{pat?.full_name}</strong> para las {notif.time_session?.slice(0, 5)} hrs.
                                </>
                              ) : (
                                <>
                                  Entrevista con <strong>{pat?.full_name}</strong> confirmada para las {notif.time_session?.slice(0, 5)} hrs.
                                  {!isUnassigned && ' Agendada en calendario.'}
                                </>
                              )}
                            </p>
                            
                            {isUnassigned && (
                              <div className="mt-2 pt-2 border-t border-border-color/50">
                                {assigningSessionId === notif.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={selectedProId}
                                      onChange={(e) => setSelectedProId(e.target.value)}
                                      className="flex-1 bg-bg-card border border-border-color rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-primary"
                                    >
                                      <option value="">Seleccionar...</option>
                                      {teamMembers.map(m => (
                                        <option key={m.id} value={m.id}>{m.full_name}</option>
                                      ))}
                                    </select>
                                    <button
                                      disabled={!selectedProId || isAssigning}
                                      onClick={() => handleAssignTherapist(notif.id, selectedProId)}
                                      className="bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-white font-semibold text-[10px] px-2 py-1.5 rounded transition-all cursor-pointer"
                                    >
                                      {isAssigning ? '...' : 'Asignar'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAssigningSessionId(null);
                                        setSelectedProId('');
                                      }}
                                      className="bg-bg-input border border-border-color text-text-secondary hover:bg-bg-card text-[10px] px-2 py-1.5 rounded transition-all cursor-pointer"
                                    >
                                      X
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setAssigningSessionId(notif.id);
                                      setSelectedProId(notif.professional_id || '');
                                    }}
                                    className="text-[10px] font-semibold text-accent-primary hover:text-accent-primary-hover flex items-center gap-1 bg-accent-primary/10 hover:bg-accent-primary/20 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                                  >
                                    Asignar Terapeuta
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile/Config Settings Gear */}
            {!isPatient && (
              <button
                onClick={() => router.push('/perfil')}
                className="p-1.5 bg-bg-input border border-border-color hover:bg-bg-card hover:text-accent-primary text-text-secondary rounded-lg transition-all flex items-center justify-center cursor-pointer"
                title="Configuración de Perfil"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Profile Display */}
            {profile && (
              <div className="flex items-center gap-3 border-l border-border-color pl-4 ml-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-primary/25 border border-accent-primary/35 flex items-center justify-center font-bold text-accent-primary text-sm">
                    {profile.full_name ? profile.full_name[0] : '?'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-text-primary leading-none">{profile.full_name}</p>
                    <p className="text-[10px] text-text-muted capitalize">{profile.role_name.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.push('/login');
                  }}
                  className="p-1.5 bg-bg-input border border-border-color hover:bg-bg-card text-text-secondary hover:text-error rounded-lg transition-all flex items-center justify-center cursor-pointer"
                  title="Cerrar Sesión"
                  type="button"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
        <NewClinicModal
          isOpen={isNewClinicOpen}
          onClose={() => setIsNewClinicOpen(false)}
          onSuccess={(newId) => {
            localStorage.setItem('active-tenant-id', newId);
            router.reload();
          }}
        />
      </div>
    </div>
  );
};
