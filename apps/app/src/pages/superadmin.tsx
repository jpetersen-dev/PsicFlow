import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { 
  Building2, 
  Users, 
  Mail, 
  Link as LinkIcon, 
  Plus, 
  Settings, 
  ShieldCheck, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { NewClinicModal } from '../components/NewClinicModal';

export default function SuperadminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  // UI / Tab states
  const [activeTab, setActiveTab] = useState<'clinics' | 'invitations' | 'users'>('clinics');
  const [isNewClinicOpen, setIsNewClinicOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Invitation Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [inviteRole, setInviteRole] = useState('psicologo');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteResultUrl, setInviteResultUrl] = useState('');
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    const checkSuperadmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email || session.user.email !== 'jpz.dev.solutions@gmail.com') {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);
        await refreshAllData();
      } catch (err) {
        console.error('Error verifying superadmin status:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkSuperadmin();
  }, []);

  const refreshAllData = async () => {
    try {
      // Fetch organizations
      const { data: orgs, error: orgsErr } = await supabase.rpc('get_all_organizations');
      if (orgsErr) throw orgsErr;
      setOrganizations(orgs || []);
      if (orgs && orgs.length > 0 && !inviteOrgId) {
        setInviteOrgId(orgs[0].id);
      }

      // Fetch invitations
      const { data: invites, error: invitesErr } = await supabase.rpc('get_all_invitations_admin');
      if (invitesErr) throw invitesErr;
      setInvitations(invites || []);

      // Fetch profiles
      const { data: profs, error: profsErr } = await supabase.rpc('get_all_profiles_admin');
      if (profsErr) throw profsErr;
      setProfiles(profs || []);
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteOrgId || inviteSubmitting) return;

    setInviteSubmitting(true);
    setInviteError('');
    setInviteResultUrl('');

    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      const { error: inviteErr } = await supabase.rpc('create_invitation_admin', {
        p_email: inviteEmail.trim().toLowerCase() || null,
        p_organization_id: inviteOrgId,
        p_role_name: inviteRole,
        p_token: token,
        p_expires_at: expiresAt
      });

      if (inviteErr) throw inviteErr;

      const host = window.location.host;
      const protocol = window.location.protocol;
      const inviteUrl = `${protocol}//${host}/invitacion/${token}`;
      setInviteResultUrl(inviteUrl);
      setInviteEmail('');

      // Refresh invitations list
      await refreshAllData();
    } catch (err: any) {
      setInviteError(err.message || 'Error al generar la invitación.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleDeleteInvitation = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas revocar/eliminar esta invitación?')) return;
    try {
      const { error } = await supabase.rpc('delete_invitation_admin', { p_id: id });
      if (error) throw error;
      alert('Invitación revocada correctamente.');
      await refreshAllData();
    } catch (err: any) {
      alert('Error al eliminar la invitación: ' + err.message);
    }
  };

  const handleUpdatePlan = async (orgId: string, newPlan: string) => {
    try {
      const { error } = await supabase.rpc('update_organization_plan_admin', {
        p_organization_id: orgId,
        p_new_plan: newPlan
      });
      if (error) throw error;
      alert(`Plan actualizado a ${newPlan} con éxito.`);
      await refreshAllData();
    } catch (err: any) {
      alert('Error al actualizar el plan: ' + err.message);
    }
  };

  const copyToClipboard = (text: string, token: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-accent-primary animate-spin" />
          <p className="text-sm text-text-secondary font-medium">Cargando panel de control...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-bg-card border border-border-color rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-error mx-auto" />
          <h2 className="text-xl font-bold text-text-primary">Acceso Denegado</h2>
          <p className="text-sm text-text-muted">
            Este panel está reservado para la administración central de la plataforma. Tu usuario no tiene privilegios de Superadmin.
          </p>
          <button
            onClick={() => router.replace('/perfil')}
            className="w-full py-2 bg-bg-input hover:bg-bg-card border border-border-color rounded-lg text-sm font-semibold text-text-secondary transition-all"
          >
            Volver a mi Perfil
          </button>
        </div>
      </div>
    );
  }

  // Calculate totals for overview
  const totalClinics = organizations.length;
  const totalProfessionals = profiles.length;
  const activeInvitationsCount = invitations.filter(i => !i.is_used && new Date(i.expires_at) > new Date()).length;

  return (
    <>
      <Head>
        <title>SaaS Superadmin — PsicFlow</title>
      </Head>

      <div className="space-y-8 animate-fade-in">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-color pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-text-primary tracking-tight font-display flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-accent-primary" />
              SaaS Panel de Control
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Supervisión de clínicas, planes de suscripción e invitaciones globales del ecosistema.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setIsNewClinicOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-hover text-on-accent text-sm font-bold rounded-lg transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Clínica</span>
            </button>
            <button
              onClick={refreshAllData}
              className="p-2 border border-border-color bg-bg-card hover:bg-bg-input text-text-secondary rounded-lg transition-all cursor-pointer"
              title="Refrescar Datos"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-bg-card border border-border-color rounded-2xl p-6 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-accent-primary/10 rounded-xl text-accent-primary">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium">Clínicas Registradas</p>
              <p className="text-2xl font-bold text-text-primary mt-0.5">{totalClinics}</p>
            </div>
          </div>
          <div className="bg-bg-card border border-border-color rounded-2xl p-6 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-xl text-success">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium">Profesionales Clínicos</p>
              <p className="text-2xl font-bold text-text-primary mt-0.5">{totalProfessionals}</p>
            </div>
          </div>
          <div className="bg-bg-card border border-border-color rounded-2xl p-6 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-xl text-warning">
              <LinkIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-text-muted font-medium">Invitaciones Activas</p>
              <p className="text-2xl font-bold text-text-primary mt-0.5">{activeInvitationsCount}</p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-border-color">
          <button
            onClick={() => setActiveTab('clinics')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'clinics'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Clínicas ({totalClinics})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'invitations'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Invitaciones Globales ({invitations.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Usuarios ({totalProfessionals})
          </button>
        </div>

        {/* Tab Panel Content */}
        <div className="bg-bg-card border border-border-color rounded-2xl p-6 shadow-sm">
          {activeTab === 'clinics' && (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-color text-xs text-text-secondary uppercase font-semibold">
                      <th className="pb-3 pr-4">Nombre de la Clínica</th>
                      <th className="pb-3 pr-4">ID de Organización</th>
                      <th className="pb-3 pr-4">Plan Actual</th>
                      <th className="pb-3 pr-4 text-center">Miembros Activos</th>
                      <th className="pb-3 text-right">Fecha Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color text-sm text-text-primary">
                    {organizations.map((org) => (
                      <tr key={org.id} className="hover:bg-bg-input/20 transition-colors">
                        <td className="py-4 pr-4 font-bold">{org.name}</td>
                        <td className="py-4 pr-4 text-xs font-mono text-text-secondary select-all">{org.id}</td>
                        <td className="py-4 pr-4">
                          <select
                            value={org.current_plan || 'Starter'}
                            onChange={(e) => handleUpdatePlan(org.id, e.target.value)}
                            className="bg-bg-input border border-border-color text-xs text-text-primary rounded px-2 py-1 focus:outline-none font-bold cursor-pointer"
                          >
                            <option value="Starter">Starter</option>
                            <option value="Pro">Pro</option>
                            <option value="Enterprise">Enterprise</option>
                          </select>
                        </td>
                        <td className="py-4 pr-4 text-center font-semibold">{org.user_count}</td>
                        <td className="py-4 text-right text-text-secondary text-xs">
                          {new Date(org.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {organizations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-text-muted">
                          No hay clínicas registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'invitations' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Form: Create Invitation */}
              <div className="lg:col-span-1 border-r border-border-color pr-0 lg:pr-8 space-y-6">
                <div>
                  <h3 className="font-bold text-text-primary text-base">Crear Invitación Global</h3>
                  <p className="text-xs text-text-muted mt-1">
                    Genera una invitación para cualquier clínica sin estar logueado en ella.
                  </p>
                </div>

                <form onSubmit={handleCreateInvitation} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Clínica de Destino *</label>
                    <select
                      value={inviteOrgId}
                      onChange={(e) => setInviteOrgId(e.target.value)}
                      required
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none cursor-pointer"
                    >
                      <option value="" disabled>Selecciona una clínica...</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.current_plan})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Email del Invitado (Opcional)</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="e.g. terapeuta@test.com"
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Rol a Asignar *</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      required
                      className="w-full bg-bg-input border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none cursor-pointer"
                    >
                      <option value="psicologo">Psicólogo</option>
                      <option value="admin_clinica">Administrador de Clínica</option>
                    </select>
                  </div>

                  {inviteError && (
                    <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-xs text-error font-medium">
                      {inviteError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={inviteSubmitting}
                    className="w-full py-2 bg-accent-primary hover:bg-accent-hover text-on-accent font-bold text-sm rounded-lg transition-all disabled:opacity-50"
                  >
                    {inviteSubmitting ? 'Generando...' : 'Generar Invitación'}
                  </button>
                </form>

                {inviteResultUrl && (
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2 animate-fade-in">
                    <p className="text-xs font-bold text-accent-primary flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      Invitación Generada
                    </p>
                    <p className="text-[10px] text-text-secondary">
                      Copia y abre este enlace en una pestaña de incógnito para registrar al nuevo usuario de prueba:
                    </p>
                    <div className="flex gap-1.5 mt-2 bg-bg-input border border-border-color rounded-lg p-2 items-center justify-between">
                      <span className="text-xs text-text-primary truncate font-mono select-all flex-1 pr-2">
                        {inviteResultUrl}
                      </span>
                      <button
                        onClick={() => copyToClipboard(inviteResultUrl, 'form-link')}
                        className="p-1 hover:bg-bg-card rounded border border-border-color text-text-secondary hover:text-text-primary"
                        title="Copiar Enlace"
                      >
                        {copiedToken === 'form-link' ? (
                          <span className="text-[10px] text-success font-bold">¡Copiado!</span>
                        ) : (
                          <Copy className="w-4.5 h-4.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Table: List of existing invitations */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-text-primary text-base">Historial de Invitaciones</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border-color text-text-secondary uppercase font-semibold">
                        <th className="pb-3 pr-4">Email / Destinatario</th>
                        <th className="pb-3 pr-4">Clínica</th>
                        <th className="pb-3 pr-4">Rol</th>
                        <th className="pb-3 pr-4 text-center">Estado</th>
                        <th className="pb-3 pr-4">Expiración</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color text-text-primary">
                      {invitations.map((invite) => {
                        const isExpired = new Date(invite.expires_at) < new Date();
                        const statusLabel = invite.is_used 
                          ? 'Usado' 
                          : isExpired 
                            ? 'Expirado' 
                            : 'Pendiente';
                        const statusColor = invite.is_used
                          ? 'bg-success/10 text-success'
                          : isExpired
                            ? 'bg-error/10 text-error'
                            : 'bg-warning/10 text-warning';

                        const inviteHost = typeof window !== 'undefined' ? window.location.host : 'app.psicflow.com';
                        const inviteProtocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
                        const fullInviteUrl = `${inviteProtocol}//${inviteHost}/invitacion/${invite.token}`;

                        return (
                          <tr key={invite.id} className="hover:bg-bg-input/20 transition-colors">
                            <td className="py-3 pr-4">
                              <p className="font-bold">{invite.email || 'Invitación Abierta'}</p>
                              {!invite.is_used && !isExpired && (
                                <button 
                                  onClick={() => copyToClipboard(fullInviteUrl, invite.token)}
                                  className="text-[10px] text-accent-primary hover:underline font-semibold mt-0.5 flex items-center gap-1"
                                >
                                  {copiedToken === invite.token ? '¡Enlace copiado!' : 'Copiar enlace de invitación'}
                                </button>
                              )}
                            </td>
                            <td className="py-3 pr-4 font-semibold">{invite.organization_name}</td>
                            <td className="py-3 pr-4 capitalize">{invite.role_name}</td>
                            <td className="py-3 pr-4 text-center">
                              <span className={`px-2 py-0.5 font-bold rounded text-[10px] ${statusColor}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-text-secondary">
                              {new Date(invite.expires_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleDeleteInvitation(invite.id)}
                                className="p-1 hover:bg-error/10 text-text-secondary hover:text-error rounded transition-all cursor-pointer"
                                title="Revocar Invitación"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {invitations.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-text-muted">
                            No se han creado invitaciones.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-xs text-text-secondary uppercase font-semibold">
                      <th className="pb-3 pr-4">Nombre Completo</th>
                      <th className="pb-3 pr-4">Email</th>
                      <th className="pb-3 pr-4">Rol en Clínica</th>
                      <th className="pb-3 pr-4">Clínica Asociada</th>
                      <th className="pb-3 text-right">Fecha Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color text-text-primary">
                    {profiles.map((profile) => (
                      <tr key={profile.id} className="hover:bg-bg-input/20 transition-colors">
                        <td className="py-4 pr-4 font-bold">{profile.full_name || 'Sin Nombre'}</td>
                        <td className="py-4 pr-4 font-mono text-xs text-text-secondary">{profile.email || 'Sin Email'}</td>
                        <td className="py-4 pr-4 capitalize text-xs text-text-secondary">{profile.role_name}</td>
                        <td className="py-4 pr-4 font-semibold text-xs">{profile.organization_name}</td>
                        <td className="py-4 text-right text-text-secondary text-xs">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {profiles.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-text-muted">
                          No hay usuarios registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <NewClinicModal
          isOpen={isNewClinicOpen}
          onClose={() => setIsNewClinicOpen(false)}
          onSuccess={() => {
            setIsNewClinicOpen(false);
            refreshAllData();
          }}
        />
      </div>
    </>
  );
}
