import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Calendar,
  Plus,
  User,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const noLayoutRoutes = ['/login'];
  const isNoLayout = noLayoutRoutes.some(route => router.pathname.startsWith(route));

  const [profile, setProfile] = useState<{ full_name: string; role_name: string; status?: string } | null>(null);
  const [authChecking, setAuthChecking] = useState(!isNoLayout);

  // Auth session check & listener
  useEffect(() => {
    if (isNoLayout) {
      setAuthChecking(false);
      return;
    }

    const fetchProfile = async (userId: string) => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id, full_name, role_name')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (!profileError && profileData) {
          if (profileData.role_name !== 'paciente') {
            // Not a patient, force sign out or redirect
            await supabase.auth.signOut();
            router.push('/login');
            return;
          }
          
          // Sincronizar active-tenant-id en localStorage
          if (profileData.organization_id) {
            localStorage.setItem('active-tenant-id', profileData.organization_id);
          }

          // Fetch status from patients table
          const { data: patientData } = await supabase
            .from('patients')
            .select('status')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

          setProfile({
            ...profileData,
            status: patientData?.status || 'prospecto'
          });
        } else {
          // Check if patient record exists
          const { data: patientData, error: patientError } = await supabase
            .from('patients')
            .select('id, full_name, status, organization_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

          if (!patientError && patientData) {
            if (patientData.organization_id) {
              localStorage.setItem('active-tenant-id', patientData.organization_id);
            }
            setProfile({ full_name: patientData.full_name, role_name: 'paciente' });
          } else {
            // Patient doesn't exist by user_id yet. Try to reconcile via Google session.
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const res = await fetch('/api/portal/reconcile-google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: session.access_token })
              });
              if (res.ok) {
                // Retry fetching the profile
                const { data: reconciledProfile } = await supabase
                  .from('profiles')
                  .select('organization_id, full_name, role_name')
                  .eq('user_id', userId)
                  .limit(1)
                  .maybeSingle();

                if (reconciledProfile) {
                  if (reconciledProfile.organization_id) {
                    localStorage.setItem('active-tenant-id', reconciledProfile.organization_id);
                  }
                  setProfile(reconciledProfile);
                  return;
                }
              }
            }
            await supabase.auth.signOut();
            router.push('/login');
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setAuthChecking(false);
      }
    };

    // Use onAuthStateChange as the SINGLE source of truth for auth state.
    // The INITIAL_SESSION event fires AFTER the SDK has finished processing
    // any OAuth hash tokens in the URL, preventing the race condition where
    // getSession() returns null before URL detection completes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        fetchProfile(session.user.id);
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
        // Only redirect to login after the SDK has fully initialized (INITIAL_SESSION)
        // or after an explicit sign out. This prevents premature redirects.
        router.push('/login');
        setAuthChecking(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isNoLayout, router]);

  // Path guard for prospecto patients
  useEffect(() => {
    if (profile && profile.status === 'prospecto') {
      const restrictedPaths = ['/sesiones', '/perfil'];
      if (restrictedPaths.includes(router.pathname)) {
        router.push('/');
      }
    }
  }, [profile, router.pathname]);

  const navItems = [
    { name: 'Mi Portal', href: '/', icon: LayoutDashboard },
    { name: 'Mis Citas', href: '/sesiones', icon: Calendar, restricted: true },
    { name: 'Agendar Cita', href: '/agendar', icon: Plus },
    { name: 'Mi Perfil', href: '/perfil', icon: User, restricted: true },
  ].filter(item => !item.restricted || profile?.status !== 'prospecto');

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#FCFBF9] text-[#1C1917] flex flex-col justify-center items-center gap-4 w-full">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Verificando sesión...</p>
      </div>
    );
  }

  if (isNoLayout) {
    return (
      <div className="min-h-screen bg-[#FCFBF9] text-[#1C1917] flex font-sans w-full justify-center items-center">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFBF9] text-[#1C1917] flex flex-col md:flex-row font-sans w-full">
      {/* Desktop Sidebar (visible on md and up) */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-[#F2EFE8] flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-[#F2EFE8] gap-2">
          <div className="w-8 h-8 rounded-full bg-[#DAEDDF] flex items-center justify-center text-[#1A3020]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-sm text-[#1C1917] tracking-tight">Sentido Migrante</span>
            <span className="text-[9px] font-semibold text-[#516750]">Portal del Paciente</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#DAEDDF] text-[#1A3020] font-semibold'
                    : 'text-[#78716C] hover:bg-[#F9F7F3] hover:text-[#1C1917]'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#F2EFE8] bg-white">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#F2EFE8] hover:bg-red-50 text-[#78716C] hover:text-red-600 text-sm font-medium transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header (visible on md:hidden) */}
        <header className="md:hidden h-14 bg-white border-b border-[#F2EFE8] flex items-center justify-between px-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#DAEDDF] flex items-center justify-center text-[#1A3020]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-sm text-[#1C1917]">Sentido Migrante</span>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="p-1.5 hover:bg-red-50 text-[#78716C] hover:text-red-600 rounded-lg transition-all"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </header>

        {/* Desktop Header (visible on md and up) */}
        <header className="hidden md:flex h-16 bg-white border-b border-[#F2EFE8] items-center justify-between px-8">
          <h2 className="font-display text-lg font-bold text-[#1C1917]">
            {navItems.find(item => router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href)))?.name || 'Mi Cuenta'}
          </h2>
          {profile && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#DAEDDF] flex items-center justify-center font-bold text-[#1A3020] text-sm">
                {profile.full_name ? profile.full_name[0] : '?'}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-[#1C1917] leading-none">{profile.full_name}</p>
                <p className="text-[10px] text-[#78716C] mt-0.5">Paciente</p>
              </div>
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (visible on md:hidden) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#F2EFE8] flex items-center justify-around z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center py-1 cursor-pointer select-none"
              >
                <div className="relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-300">
                  {isActive && (
                    <div className="absolute inset-0 bg-[#DAEDDF] rounded-full -z-10" />
                  )}
                  <Icon
                    size={20}
                    className={isActive ? 'text-[#1A3020] stroke-[2.25px] transition-colors' : 'text-[#78716C] stroke-[2px] transition-colors'}
                  />
                </div>
                <span className={`text-[9px] mt-1 transition-colors ${isActive ? 'text-[#1A3020] font-bold' : 'text-[#78716C] font-medium'}`}>
                  {item.name.replace('Mi ', '').replace('Mis ', '').replace('Cita', '')}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
