import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  Building2, 
  User, 
  Mail, 
  Lock, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight,
  Sparkles,
  LogOut
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { validateRut, validateEmail } from '../../utils/validators';

export default function InvitacionRegistro() {
  const router = useRouter();
  const { token } = router.query;

  const [checkingInvite, setCheckingInvite] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [clinicName, setClinicName] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Authentication status states
  const [session, setSession] = useState<any>(null);
  const [isGoogle, setIsGoogle] = useState(false);
  const [isExistingUserLink, setIsExistingUserLink] = useState(false);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clinicNameInput, setClinicNameInput] = useState('');

  const verifyTokenAndSession = async () => {
    if (!token) return;
    setCheckingInvite(true);
    setInviteError('');
    try {
      // 1. Query invitation
      const { data: inviteData, error: fetchErr } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();

      if (fetchErr || !inviteData) {
        throw new Error('El código de invitación no existe, ya fue utilizado o ha expirado.');
      }

      setInvitation(inviteData);

      // Fetch organization name
      if (inviteData.organization_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', inviteData.organization_id)
          .limit(1)
          .single();

        if (orgData) {
          setClinicName(orgData.name);
        }
      } else {
        setClinicName(inviteData.target_plan ? `Alta de Nueva Clínica (${inviteData.target_plan})` : 'Alta de Nueva Clínica');
      }

      // 2. Check current session status
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession?.user) {
        // Query profiles of this user
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', currentSession.user.id);

        const profiles = userProfiles || [];
        const belongsToTargetOrg = inviteData.organization_id 
          ? profiles.some(p => p.organization_id === inviteData.organization_id) 
          : false;

        if (belongsToTargetOrg) {
          setIsAlreadyMember(true);
        } else if (profiles.length > 0) {
          // Has profile elsewhere: existing PsicFlow therapist joining a secondary clinic
          setIsExistingUserLink(true);
          setEmail(currentSession.user.email || '');
          setFullName(currentSession.user.user_metadata?.full_name || '');
        } else {
          // Logged in via Google but no profiles: complete onboarding
          setIsGoogle(true);
          setEmail(currentSession.user.email || '');
          setFullName(currentSession.user.user_metadata?.full_name || '');
        }
      }
    } catch (err: any) {
      setInviteError(err.message || 'Error al validar invitación.');
    } finally {
      setCheckingInvite(false);
    }
  };

  useEffect(() => {
    verifyTokenAndSession();
  }, [token]);

  useEffect(() => {
    if (isAlreadyMember) {
      localStorage.setItem('active-tenant-id', invitation.organization_id);
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAlreadyMember, invitation, router]);

  const handleGoogleSignup = async () => {
    if (!token) return;
    try {
      localStorage.setItem('pending-invite-token', String(token));
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href, // Redirect right back here!
        }
      });
      if (err) throw err;
    } catch (err: any) {
      setError(err.message || 'Error al conectar con Google.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('pending-invite-token');
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Pre-validations if not linking existing
    if (!isExistingUserLink) {
      const cleanRutStr = rut.trim().replace(/\./g, '').replace(/ /g, '').replace(/-/g, '');
      if (!validateRut(cleanRutStr)) {
        setError('El RUT ingresado no es válido.');
        setLoading(false);
        return;
      }

      if (!validateEmail(email.trim())) {
        setError('El formato del correo electrónico es incorrecto.');
        setLoading(false);
        return;
      }
    }

    try {
      const payload: any = {
        token,
        is_google: isGoogle,
        is_link_existing: isExistingUserLink,
      };

      if (isExistingUserLink) {
        // Link existing doesn't need form details (copies from database)
      } else {
        payload.full_name = fullName;
        payload.username = username;
        payload.rut_professional = rut;
        if (!isGoogle) {
          payload.email = email;
          payload.password = password;
        }
        if (!invitation.organization_id) {
          payload.clinic_name = clinicNameInput;
        }
      }

      const headers: any = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Ocurrió un error al registrar la cuenta.');
      }

      // Clean pending invite token
      localStorage.removeItem('pending-invite-token');

      // Set active clinic tenant context
      if (result.organization_id) {
        localStorage.setItem('active-tenant-id', result.organization_id);
      }

      alert('¡Cuenta registrada y vinculada exitosamente!');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al registrar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingInvite) {
    return (
      <div className="w-full max-w-md bg-bg-card border border-border-color rounded-3xl p-8 text-center space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin mx-auto"></div>
        <p className="text-sm text-text-secondary">Validando código de invitación...</p>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="w-full max-w-md bg-bg-card border border-border-color rounded-3xl p-8 text-center space-y-5">
        <div className="inline-flex p-3 bg-danger/10 text-danger rounded-2xl">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">Invitación Inválida</h2>
        <p className="text-sm text-text-secondary leading-relaxed">{inviteError}</p>
        <button 
          onClick={() => {
            localStorage.removeItem('pending-invite-token');
            router.push('/login');
          }}
          className="w-full py-2.5 bg-bg-input border border-border-color hover:bg-bg-sidebar/55 text-text-primary rounded-xl text-sm font-semibold transition-all cursor-pointer"
        >
          Ir a Iniciar Sesión
        </button>
      </div>
    );
  }

  if (isAlreadyMember) {
    return (
      <div className="w-full max-w-md bg-bg-card border border-border-color rounded-3xl p-8 text-center space-y-4">
        <div className="inline-flex p-3 bg-accent-primary/10 text-accent-primary rounded-2xl mb-1">
          <ShieldCheck className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">Miembro Activo</h2>
        <p className="text-sm text-text-secondary">Ya eres miembro de la clínica <strong>{clinicName}</strong>.</p>
        <p className="text-xs text-text-muted">Redirigiéndote al panel de control...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>PsicFlow - Registro por Invitación</title>
      </Head>

      <div className="w-full max-w-lg bg-bg-card border border-border-color rounded-3xl shadow-2xl p-8 space-y-6 my-10 relative">
        {session && (
          <button
            onClick={handleLogout}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-bg-sidebar text-text-muted hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
            title="Cerrar sesión de Google actual"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Usar otra cuenta</span>
          </button>
        )}

        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-accent-primary/10 text-accent-primary rounded-2xl mb-1">
            <Sparkles className="w-6 h-6 fill-accent-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Invitación Aceptada</h1>
          <p className="text-xs text-text-muted">Estás uniéndote como <span className="font-bold text-accent-primary capitalize">{invitation.role_name === 'psicologo' ? 'Psicólogo' : invitation.role_name}</span> en:</p>
          <div className="inline-flex px-3 py-1 bg-bg-sidebar border border-border-color rounded-lg text-xs font-bold text-text-primary mt-1">
            {clinicName || 'Clínica Asociada'}
          </div>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/25 p-4 rounded-xl flex items-start gap-3 text-xs text-danger">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isExistingUserLink ? (
          /* Tarjeta de vinculación directa para terapeutas existentes en PsicFlow */
          <div className="space-y-6 p-6 border border-border-color rounded-2xl bg-bg-sidebar/35 text-center">
            <div className="space-y-2">
              <p className="text-sm text-text-secondary leading-relaxed">
                ¡Hola! Detectamos que estás autenticado con la cuenta <strong className="text-text-primary">{email}</strong>.
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                Ya cuentas con un perfil activo en PsicFlow. Al presionar el botón inferior, vincularemos tu cuenta existente a la clínica <strong>{clinicName}</strong> como <strong>{invitation.role_name === 'psicologo' ? 'Psicólogo/Terapeuta' : invitation.role_name}</strong>. Podrás alternar entre clínicas de manera inmediata.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="pt-2">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <span>{loading ? 'Vinculando...' : 'Aceptar Invitación y Unirse'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* Formulario de registro (Nuevo usuario o Registro con Google) */
          <form onSubmit={handleSubmit} className="space-y-4">
            {isGoogle && (
              <div className="p-4 bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs rounded-xl flex items-center gap-2 mb-2 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Sesión de Google iniciada como {email}. Completa tus credenciales de PsicFlow para finalizar.</span>
              </div>
            )}

            {!invitation.organization_id && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Nombre de tu Clínica / Consulta *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    required 
                    value={clinicNameInput} 
                    onChange={(e) => setClinicNameInput(e.target.value)}
                    placeholder="e.g. Centro de Terapia Providencia"
                    className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Nombre Completo *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                    <User className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    required 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isGoogle}
                    placeholder="e.g. Juan García"
                    className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Nombre de Usuario *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                    <span className="text-xs font-bold font-mono">@</span>
                  </span>
                  <input 
                    type="text" 
                    required 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. jgarcia"
                    className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Correo Electrónico *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isGoogle}
                    placeholder="e.g. j.garcia@clinica.cl"
                    className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">RUT Profesional *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    required 
                    value={rut} 
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="e.g. 12345678-9"
                    className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {!isGoogle && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Contraseña *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Procesando...' : isGoogle ? 'Activar Perfil de Google' : 'Completar Registro'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {!isGoogle && (
              <>
                <div className="relative flex items-center justify-center my-4">
                  <div className="absolute inset-x-0 border-t border-border-color"></div>
                  <span className="relative px-3 bg-bg-card text-xs text-text-muted">o continuar con</span>
                </div>

                <button 
                  onClick={handleGoogleSignup}
                  type="button"
                  className="w-full bg-bg-input border border-border-color hover:bg-bg-sidebar/55 text-text-primary font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Registrarse con Google</span>
                </button>
              </>
            )}
          </form>
        )}

        <div className="text-center text-xs text-text-muted border-t border-border-color pt-4 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>Acceso seguro protegido por políticas RLS y HIPAA</span>
        </div>
      </div>
    </>
  );
}
