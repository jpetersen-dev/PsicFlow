import React, { useState, useEffect } from 'react';
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
  Newspaper
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-bg-sidebar border-b border-border-color flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
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
                  onClick={() => setIsNewClinicOpen(true)}
                  className="p-1.5 bg-bg-input border border-border-color hover:bg-bg-card text-accent-primary hover:text-accent-hover rounded-lg transition-all flex items-center justify-center cursor-pointer"
                  title="Crear Nueva Clínica"
                  type="button"
                >
                  <Plus className="w-4 h-4" />
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
            <button
              className="p-1.5 bg-bg-input border border-border-color hover:bg-bg-card hover:text-accent-primary text-text-secondary rounded-lg transition-all flex items-center justify-center cursor-pointer relative"
              title="Notificaciones"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent-primary rounded-full"></span>
            </button>

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
