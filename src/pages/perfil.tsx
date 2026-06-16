import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { User, Building, Shield, Plus, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Perfil() {
  const [profile, setProfile] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [recharge, setRecharge] = useState({ type_unit: 'NOTA_IA', amount: 50 });
  const [loading, setLoading] = useState(true);

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
      
      if (profData) setProfile(profData);

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

  if (loading) return <div className="py-20 text-center text-slate-500 text-sm">Cargando perfil profesional...</div>;

  return (
    <>
      <Head>
        <title>PsicoAlivio - Mi Perfil</title>
      </Head>

      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-emerald-400" />
            <span>Mi Perfil Profesional</span>
          </h1>
          <p className="text-slate-400 text-sm">Administre sus datos personales, credenciales y saldos de créditos de IA.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Professional profile details */}
          <div className="lg:col-span-2 space-y-6">
            {profile && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-1.5 flex items-center gap-1.5">
                  <Shield className="w-4.5 h-4.5 text-emerald-400" />
                  <span>Credenciales del Clínico</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Nombre Completo</p>
                    <p className="text-slate-300 font-semibold">{profile.full_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">RUT Profesional</p>
                    <p className="text-slate-300 font-mono font-medium">{profile.rut_professional}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Rol en la Consulta</p>
                    <p className="text-slate-300 capitalize">{profile.role_name.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Fecha de Ingreso</p>
                    <p className="text-slate-300">{profile.created_at.split('T')[0]}</p>
                  </div>
                </div>
              </div>
            )}

            {organization && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-1.5 flex items-center gap-1.5">
                  <Building className="w-4.5 h-4.5 text-emerald-400" />
                  <span>Detalles de la Clínica (Tenant)</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Razón Social / Clínica</p>
                    <p className="text-slate-300 font-semibold">{organization.name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Plan de Suscripción</p>
                    <p className="text-slate-300 font-medium">{organization.current_plan}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Test credits recharge utility */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6 h-fit">
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-1.5 flex items-center gap-1.5">
                <Wallet className="w-4.5 h-4.5 text-emerald-400" />
                <span>Simulador de Recargas de Crédito</span>
              </h2>
              <p className="text-slate-500 text-xs">Añada créditos de prueba en el ledger para evitar sobregiros del disparador de base de datos.</p>
            </div>

            <form onSubmit={handleRecharge} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Tipo de Crédito</label>
                <select 
                  value={recharge.type_unit}
                  onChange={(e) => setRecharge({ ...recharge, type_unit: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none"
                >
                  <option value="NOTA_IA">Notas Clínicas IA (NOTA_IA)</option>
                  <option value="INFORME_CLINICO">Informes Clínicos (INFORME_CLINICO)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Cantidad de Créditos</label>
                <input 
                  type="number"
                  min="1"
                  max="1000"
                  value={recharge.amount}
                  onChange={(e) => setRecharge({ ...recharge, amount: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none font-mono"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Recargar Créditos</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
