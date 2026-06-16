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
  Wallet
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export const ORGANIZATIONS = [
  { id: 'f0120012-3bb8-4e6b-84fd-dc97e935131c', name: 'Clínica PsicoAlivio Central', plan: 'Starter' },
  { id: '10f81f46-2678-400e-a530-be3641dba9a8', name: 'Centro de Salud Mental AlivioClínico', plan: 'Pro' }
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTenant, setActiveTenant] = useState('');
  const [credits, setCredits] = useState<{ NOTA_IA: number; INFORME_CLINICO: number }>({ NOTA_IA: 0, INFORME_CLINICO: 0 });
  const [profile, setProfile] = useState<{ full_name: string; role_name: string } | null>(null);

  // Initialize tenant context
  useEffect(() => {
    let tenantId = localStorage.getItem('active-tenant-id');
    if (!tenantId || !ORGANIZATIONS.some(o => o.id === tenantId)) {
      tenantId = ORGANIZATIONS[0].id;
      localStorage.setItem('active-tenant-id', tenantId);
    }
    setActiveTenant(tenantId);
  }, []);

  // Fetch tenant profile and credits whenever activeTenant changes
  useEffect(() => {
    if (!activeTenant) return;

    const fetchTenantData = async () => {
      try {
        // Fetch active profile for this tenant
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, role_name')
          .limit(1)
          .single();
        
        if (!profileError && profileData) {
          setProfile(profileData);
        } else {
          setProfile(null);
        }

        // Fetch credits
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
      } catch (err) {
        console.error('Error fetching tenant data:', err);
      }
    };

    fetchTenantData();
  }, [activeTenant]);

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    localStorage.setItem('active-tenant-id', newId);
    setActiveTenant(newId);
    // Reload page or state to trigger header updates in child components
    router.reload();
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'CRM Pacientes', href: '/pacientes', icon: Users },
    { name: 'Calendario', href: '/calendario', icon: Calendar },
    { name: 'Reportes y Finanzas', href: '/reportes', icon: BarChart3 },
    { name: 'Biblioteca', href: '/biblioteca', icon: BookOpen },
    { name: 'Centro Documentos', href: '/documentos', icon: FileText },
    { name: 'Mi Perfil', href: '/perfil', icon: User }
  ];

  const currentOrg = ORGANIZATIONS.find(o => o.id === activeTenant) || ORGANIZATIONS[0];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside 
        className={`bg-slate-950 border-r border-slate-800 transition-all duration-300 z-30 flex flex-col fixed inset-y-0 left-0 md:static ${
          sidebarOpen ? 'w-64' : 'w-0 md:w-20 overflow-hidden'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-emerald-400">
            <Building2 className="w-6 h-6" />
            <span className={sidebarOpen ? 'block' : 'hidden md:hidden'}>PsicoAlivio</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-200">
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500' 
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={sidebarOpen ? 'block' : 'hidden md:hidden'}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer (Credits Display) */}
        {sidebarOpen && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/50 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span>Saldos de Créditos IA</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <p className="text-slate-500">Notas IA</p>
                <p className="font-bold text-emerald-400">{credits.NOTA_IA}</p>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <p className="text-slate-500">Informes</p>
                <p className="font-bold text-indigo-400">{credits.INFORME_CLINICO}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Lock className="w-3 h-3" />
              <span>Conexión Protegida RLS</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-slate-200"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Tenant Selector Dropdown */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
              <Building2 className="w-4 h-4 text-emerald-500" />
              <select 
                value={activeTenant}
                onChange={handleTenantChange}
                className="bg-transparent text-sm text-slate-200 focus:outline-none font-medium cursor-pointer"
              >
                {ORGANIZATIONS.map(org => (
                  <option key={org.id} value={org.id} className="bg-slate-950 text-slate-200">
                    {org.name} ({org.plan})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Privacy Mode Toggle */}
            <button 
              onClick={togglePrivacyMode}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isPrivacyMode 
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' 
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title={isPrivacyMode ? 'Desactivar Modo Privacidad' : 'Activar Modo Privacidad'}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
              <span>Modo Privacidad</span>
            </button>

            {/* Profile Display */}
            {profile && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/25 border border-emerald-500/35 flex items-center justify-center font-bold text-emerald-400 text-sm">
                  {profile.full_name[0]}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-200 leading-none">{profile.full_name}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{profile.role_name.replace('_', ' ')}</p>
                </div>
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
      </div>
    </div>
  );
};
