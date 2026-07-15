import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  Crown, 
  CreditCard, 
  Plus, 
  Check, 
  Sparkles, 
  Users, 
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Coins,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { NewClinicModal } from '../components/NewClinicModal';
import { PlanLevel, PLAN_FEATURES } from '../utils/planFeatures';

export default function PlanGestion() {
  const router = useRouter();
  
  // App States
  const [profile, setProfile] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [activeTenant, setActiveTenant] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Simulation/Billing States
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState(true);
  const [cancellingPlan, setCancellingPlan] = useState(false);

  // Credit balances
  const [credits, setCredits] = useState({ NOTA_IA: 0, INFORME_CLINICO: 0 });

  useEffect(() => {
    async function loadPlanData() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          router.push('/login');
          return;
        }

        const tenantId = localStorage.getItem('active-tenant-id') || '';
        setActiveTenant(tenantId);

        if (!tenantId) {
          setLoading(false);
          return;
        }

        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, role_name, organization_id')
          .eq('organization_id', tenantId)
          .eq('user_id', session.user.id)
          .limit(1)
          .single();

        setProfile(profileData);

        // Fetch organization
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id, name, current_plan, created_at')
          .eq('id', tenantId)
          .limit(1)
          .single();

        setOrganization(orgData);

        // Fetch credits
        if (tenantId === 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb') {
          // Sentido Migrante bypass
          setCredits({ NOTA_IA: 9999, INFORME_CLINICO: 9999 });
        } else {
          const { data: ledgerData } = await supabase
            .from('credit_ledger')
            .select('type_unit, amount');

          if (ledgerData) {
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
      } catch (err) {
        console.error('Error loading plan data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPlanData();
  }, [router]);

  const handleUpgradePlan = async (newPlan: PlanLevel) => {
    if (!profile || profile.role_name !== 'admin_clinica') {
      alert('Solo el Administrador Clínico puede cambiar el plan de suscripción.');
      return;
    }
    
    if (confirm(`¿Estás seguro de que deseas cambiar la suscripción de tu clínica al plan ${newPlan}?`)) {
      try {
        setUpgradeLoading(newPlan);
        const { error } = await supabase
          .from('organizations')
          .update({ current_plan: newPlan })
          .eq('id', activeTenant);

        if (error) throw error;

        // Add history or log in console, then refresh
        alert(`¡Suscripción actualizada exitosamente al plan ${newPlan}!`);
        router.reload();
      } catch (err: any) {
        alert('Error al actualizar plan: ' + err.message);
      } finally {
        setUpgradeLoading(null);
      }
    }
  };

  const handleBuyCredits = async (pkg: { name: string; notes: number; reports: number; price: string; code: string }) => {
    if (!profile || profile.role_name !== 'admin_clinica') {
      alert('Solo el Administrador Clínico puede comprar créditos para la organización.');
      return;
    }

    if (confirm(`¿Confirmas la compra simulada del paquete "${pkg.name}" por ${pkg.price}?`)) {
      try {
        setPurchaseLoading(pkg.code);
        
        // Insert credit ledger entries
        const { error: ledgerErr } = await supabase
          .from('credit_ledger')
          .insert([
            {
              organization_id: activeTenant,
              profile_id: profile.id,
              type_unit: 'NOTA_IA',
              amount: pkg.notes,
              description: `Compra simulada: Paquete ${pkg.name}`
            },
            {
              organization_id: activeTenant,
              profile_id: profile.id,
              type_unit: 'INFORME_CLINICO',
              amount: pkg.reports,
              description: `Compra simulada: Paquete ${pkg.name}`
            }
          ]);

        if (ledgerErr) throw ledgerErr;

        alert('¡Créditos comprados y cargados exitosamente a tu saldo!');
        
        // Refresh local balance display
        setCredits(prev => ({
          ...prev,
          NOTA_IA: prev.NOTA_IA + pkg.notes,
          INFORME_CLINICO: prev.INFORME_CLINICO + pkg.reports
        }));

      } catch (err: any) {
        alert('Error procesando compra: ' + err.message);
      } finally {
        setPurchaseLoading(null);
      }
    }
  };

  const handleCancelSubscription = async () => {
    if (!profile || profile.role_name !== 'admin_clinica') {
      alert('Solo el Administrador Clínico puede dar de baja la suscripción.');
      return;
    }

    if (confirm('¿Estás seguro de que deseas cancelar la auto-renovación de tu plan? Al final del periodo de facturación actual volverás al plan Starter.')) {
      try {
        setCancellingPlan(true);
        // Simulate cancellation: downgrade to Starter
        const { error } = await supabase
          .from('organizations')
          .update({ current_plan: 'Starter' })
          .eq('id', activeTenant);

        if (error) throw error;
        alert('Auto-renovación cancelada. El plan volverá a Starter en la próxima fecha de renovación.');
        router.reload();
      } catch (err: any) {
        alert('Error al cancelar: ' + err.message);
      } finally {
        setCancellingPlan(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin"></div>
        <p className="text-sm text-text-secondary">Cargando detalles de suscripción y facturación...</p>
      </div>
    );
  }

  const currentPlan = (organization?.current_plan || 'Starter') as PlanLevel;
  const isSentidoMigrante = activeTenant === 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb';
  const isAdmin = profile?.role_name === 'admin_clinica';

  // Compute a renew date: same day of the month as created_at but next month
  const creationDate = organization?.created_at ? new Date(organization.created_at) : new Date();
  const renewDate = new Date();
  renewDate.setDate(creationDate.getDate());
  if (renewDate <= new Date()) {
    renewDate.setMonth(renewDate.getMonth() + 1);
  }

  // Packages for credit purchase
  const creditPackages = [
    { code: 'p1', name: 'Pack Inicial', notes: 10, reports: 5, price: '$5.000 CLP / $5 USD', icon: Coins },
    { code: 'p2', name: 'Pack Profesional', notes: 50, reports: 25, price: '$19.000 CLP / $19 USD', icon: Sparkles },
    { code: 'p3', name: 'Pack Clínico', notes: 150, reports: 75, price: '$49.000 CLP / $49 USD', icon: Crown }
  ];

  return (
    <>
      <Head>
        <title>Suscripción y Créditos | PsicFlow</title>
      </Head>

      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-accent-primary" />
              <span>Suscripción y Créditos IA</span>
            </h1>
            <p className="text-sm text-text-secondary">
              Gestiona el plan de tu clínica, compra créditos adicionales y configura tus límites.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-accent-primary to-accent-hover hover:from-accent-hover hover:to-accent-primary text-text-primary font-semibold text-sm rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Otra Clínica</span>
            </button>
          )}
        </div>

        {/* Info Banner for non-admin */}
        {!isAdmin && (
          <div className="p-4 bg-warning/10 border border-warning/20 text-warning text-sm rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Acceso de Lectura</p>
              <p className="text-xs text-warning/80">
                Solo el Administrador Clínico de la clínica ({organization?.name}) puede cambiar planes de facturación, comprar créditos o cancelar la suscripción.
              </p>
            </div>
          </div>
        )}

        {/* Top Grid: Plan Info & Balance Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Plan Card */}
          <div className="lg:col-span-2 bg-bg-card border border-border-color rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Crown className="w-32 h-32 text-accent-primary" />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Plan Activo</span>
                {isSentidoMigrante ? (
                  <span className="px-3 py-1 bg-accent-success/15 border border-accent-success/30 text-accent-success rounded-full text-xs font-bold uppercase">
                    Ilimitado (Sentido Migrante)
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-accent-primary/15 border border-accent-primary/30 text-accent-primary rounded-full text-xs font-bold uppercase">
                    Plan {currentPlan}
                  </span>
                )}
              </div>
              
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-text-primary">
                  {isSentidoMigrante ? 'Sentido Migrante Corporate' : `Licencia ${currentPlan}`}
                </h3>
                <p className="text-sm text-text-secondary">
                  Espacio de Trabajo: <strong className="text-text-primary">{organization?.name}</strong>
                </p>
              </div>

              {!isSentidoMigrante && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-2.5 text-sm text-text-secondary">
                    <Clock className="w-4 h-4 text-accent-primary" />
                    <span>Facturación mensual, próxima renovación: <strong>{renewDate.toLocaleDateString('es-ES')}</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-text-secondary">
                    <Users className="w-4 h-4 text-accent-primary" />
                    <span>Límite de usuarios: <strong>{PLAN_FEATURES[currentPlan]?.maxUsers}</strong> terapeuta(s)</span>
                  </div>
                </div>
              )}
            </div>

            {!isSentidoMigrante && isAdmin && (
              <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-border-color">
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={autoRenew} 
                      onChange={() => setAutoRenew(!autoRenew)}
                    />
                    <div className="w-9 h-5 bg-bg-input peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-border-color after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-text-primary"></div>
                    <span className="ml-2 text-xs font-semibold text-text-secondary">Auto-renovación activa</span>
                  </label>
                </div>
                
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancellingPlan}
                  className="text-xs text-accent-danger hover:underline font-semibold cursor-pointer"
                >
                  {cancellingPlan ? 'Cancelando...' : 'Darse de baja / Cancelar suscripción'}
                </button>
              </div>
            )}
          </div>

          {/* Credits Balance Card */}
          <div className="bg-gradient-to-br from-bg-card to-accent-primary/5 border border-border-color rounded-3xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Balance de Créditos IA</span>
                <Coins className="w-5 h-5 text-accent-primary animate-pulse" />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-bg-input/60 border border-border-color p-3 rounded-2xl">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Notas Clínicas IA</p>
                    <p className="text-[10px] text-text-muted">Generadas mediante dictado</p>
                  </div>
                  <span className="text-xl font-black text-accent-primary">
                    {isSentidoMigrante ? '∞' : credits.NOTA_IA}
                  </span>
                </div>
                
                <div className="flex items-center justify-between bg-bg-input/60 border border-border-color p-3 rounded-2xl">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Informes Clínicos IA</p>
                    <p className="text-[10px] text-text-muted">Descargas de reportes PDF</p>
                  </div>
                  <span className="text-xl font-black text-accent-primary">
                    {isSentidoMigrante ? '∞' : credits.INFORME_CLINICO}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-text-muted text-center mt-4">
              Los créditos de IA se descuentan automáticamente al generar o exportar documentos clínicos.
            </div>
          </div>
        </div>

        {/* Pricing Cards (Upgrade Plans) */}
        {!isSentidoMigrante && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>Planes de Suscripción Disponibles</span>
              </h2>
              <p className="text-xs text-text-secondary">
                Cambia de plan según el tamaño de tu consulta o clínica. El cobro se ajustará a prorrata.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Starter Plan Card */}
              <div className={`bg-bg-card border rounded-3xl p-6 flex flex-col justify-between transition-all ${
                currentPlan === 'Starter' 
                  ? 'border-accent-primary ring-1 ring-accent-primary' 
                  : 'border-border-color hover:border-text-secondary/30'
              }`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-secondary">Starter</span>
                    {currentPlan === 'Starter' && (
                      <span className="px-2 py-0.5 bg-accent-primary/10 text-accent-primary text-[10px] font-bold rounded-md">Actual</span>
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-text-primary">$30.000 <span className="text-xs font-normal text-text-secondary">CLP / mes</span></p>
                    <p className="text-[10px] text-text-muted">Equivalente a $30 USD</p>
                  </div>
                  <p className="text-xs text-text-secondary">Ideal para profesionales individuales independientes.</p>
                  <ul className="space-y-2 text-xs text-text-secondary pt-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Hasta <strong>1</strong> Terapeuta</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Ficha de pacientes y CRM</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Agendamiento Web Integrado</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  {currentPlan === 'Starter' ? (
                    <span className="block text-center text-xs font-bold text-text-muted bg-bg-input py-2.5 rounded-xl border border-border-color">
                      Tu Plan Actual
                    </span>
                  ) : (
                    <button
                      onClick={() => handleUpgradePlan('Starter')}
                      disabled={!isAdmin || upgradeLoading !== null}
                      className="w-full text-center text-xs font-bold text-text-primary bg-bg-input hover:bg-bg-card border border-border-color py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      {upgradeLoading === 'Starter' ? 'Cambiando...' : 'Bajar a Starter'}
                    </button>
                  )}
                </div>
              </div>

              {/* Pro Plan Card */}
              <div className={`bg-bg-card border rounded-3xl p-6 flex flex-col justify-between transition-all ${
                currentPlan === 'Pro' 
                  ? 'border-accent-primary ring-1 ring-accent-primary' 
                  : 'border-border-color hover:border-text-secondary/30'
              }`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-secondary">Pro</span>
                    {currentPlan === 'Pro' && (
                      <span className="px-2 py-0.5 bg-accent-primary/10 text-accent-primary text-[10px] font-bold rounded-md">Actual</span>
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-text-primary">$79.000 <span className="text-xs font-normal text-text-secondary">CLP / mes</span></p>
                    <p className="text-[10px] text-text-muted">Equivalente a $79 USD</p>
                  </div>
                  <p className="text-xs text-text-secondary">Pensado para consultas grupales y centros medianos.</p>
                  <ul className="space-y-2 text-xs text-text-secondary pt-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Hasta <strong>5</strong> Terapeutas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Módulo de Reseñas de Pacientes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Historial clínico compartido</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  {currentPlan === 'Pro' ? (
                    <span className="block text-center text-xs font-bold text-text-muted bg-bg-input py-2.5 rounded-xl border border-border-color">
                      Tu Plan Actual
                    </span>
                  ) : (
                    <button
                      onClick={() => handleUpgradePlan('Pro')}
                      disabled={!isAdmin || upgradeLoading !== null}
                      className="w-full text-center text-xs font-bold text-text-primary bg-gradient-to-r from-accent-primary to-accent-hover hover:from-accent-hover hover:to-accent-primary py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
                    >
                      {upgradeLoading === 'Pro' ? 'Cambiando...' : currentPlan === 'Enterprise' ? 'Bajar a Pro' : 'Actualizar a Pro'}
                    </button>
                  )}
                </div>
              </div>

              {/* Enterprise Plan Card */}
              <div className={`bg-bg-card border rounded-3xl p-6 flex flex-col justify-between transition-all ${
                currentPlan === 'Enterprise' 
                  ? 'border-accent-primary ring-1 ring-accent-primary' 
                  : 'border-border-color hover:border-text-secondary/30'
              }`}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-secondary">Enterprise</span>
                    {currentPlan === 'Enterprise' && (
                      <span className="px-2 py-0.5 bg-accent-primary/10 text-accent-primary text-[10px] font-bold rounded-md">Actual</span>
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-text-primary">$199.000 <span className="text-xs font-normal text-text-secondary">CLP / mes</span></p>
                    <p className="text-[10px] text-text-muted">Equivalente a $199 USD</p>
                  </div>
                  <p className="text-xs text-text-secondary">Para clínicas y redes de salud complejas.</p>
                  <ul className="space-y-2 text-xs text-text-secondary pt-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Terapeutas <strong>Ilimitados</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Portal de Pacientes Avanzado</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                      <span>Blog y Publicación de Artículos</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6">
                  {currentPlan === 'Enterprise' ? (
                    <span className="block text-center text-xs font-bold text-text-muted bg-bg-input py-2.5 rounded-xl border border-border-color">
                      Tu Plan Actual
                    </span>
                  ) : (
                    <button
                      onClick={() => handleUpgradePlan('Enterprise')}
                      disabled={!isAdmin || upgradeLoading !== null}
                      className="w-full text-center text-xs font-bold text-text-primary bg-gradient-to-r from-accent-primary to-accent-hover hover:from-accent-hover hover:to-accent-primary py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
                    >
                      {upgradeLoading === 'Enterprise' ? 'Cambiando...' : 'Actualizar a Enterprise'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credits Purchase Simulator */}
        {!isSentidoMigrante && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Coins className="w-5 h-5 text-accent-primary" />
                <span>Cargar Créditos de Notas IA e Informes</span>
              </h2>
              <p className="text-xs text-text-secondary">
                ¿Te quedaste sin créditos para transcribir sesiones o generar reportes PDF? Compra paquetes prepagos adicionales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {creditPackages.map((pkg) => {
                const Icon = pkg.icon;
                return (
                  <div key={pkg.code} className="bg-bg-card border border-border-color hover:border-accent-primary/40 rounded-3xl p-6 flex flex-col justify-between transition-all">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-text-primary">{pkg.name}</span>
                        <Icon className="w-5 h-5 text-accent-primary" />
                      </div>
                      <div>
                        <p className="text-xl font-extrabold text-text-primary">{pkg.price}</p>
                      </div>
                      <div className="space-y-1 pt-2">
                        <p className="text-xs text-text-secondary flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                          <span><strong>+{pkg.notes}</strong> Notas Clínicas de IA</span>
                        </p>
                        <p className="text-xs text-text-secondary flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-accent-success shrink-0" />
                          <span><strong>+{pkg.reports}</strong> Informes Clínicos PDF</span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleBuyCredits(pkg)}
                        disabled={!isAdmin || purchaseLoading !== null}
                        className="w-full text-center text-xs font-bold text-text-primary bg-bg-input hover:bg-bg-card border border-border-color py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {purchaseLoading === pkg.code ? (
                          <span>Procesando...</span>
                        ) : (
                          <>
                            <span>Cargar Paquete</span>
                            <ArrowRight className="w-3.5 h-3.5 text-accent-primary" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <NewClinicModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(newId) => {
          localStorage.setItem('active-tenant-id', newId);
          router.reload();
        }}
      />
    </>
  );
}
PlanGestion.getLayout = function getLayout(page: React.ReactElement) {
  return page; // will render layout dynamically
};
