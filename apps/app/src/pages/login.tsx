import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  Mail, 
  Lock, 
  AlertTriangle, 
  ArrowRight,
  ShieldCheck,
  Key,
  Sparkles,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteToken, setInviteToken] = useState('');

  // 2FA States
  const [show2FA, setShow2FA] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [pendingSession, setPendingSession] = useState<any>(null);
  const [otpSent, setOtpSent] = useState(false);

  const sendOTP = async (email: string) => {
    if (otpSent) return;
    setOtpSent(true);
    try {
      const res = await fetch('/api/auth/send-2fa-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar código.');
    } catch (err: any) {
      setError('No se pudo enviar el código de verificación: ' + err.message);
      setOtpSent(false);
    }
  };

  // Session verification and redirection helper
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (session.user.email === 'jpz.dev.solutions@gmail.com') {
        const isVerified = sessionStorage.getItem('superadmin-2fa-verified') === 'true';
        if (!isVerified) {
          setShow2FA(true);
          setLoading(false);
          await sendOTP(session.user.email);
          return;
        }
      }

      setLoading(true);
      setError('');
      try {
        // Fetch profiles associated with this user
        const { data: userProfiles, error: profileErr } = await supabase
          .from('profiles')
          .select('organization_id, role_name')
          .eq('user_id', session.user.id);

        if (profileErr) throw profileErr;

        const hasProfile = userProfiles && userProfiles.length > 0;

        if (!hasProfile) {
          // No profile found: check for pending invitation
          const pendingInvite = localStorage.getItem('pending-invite-token');
          if (pendingInvite) {
            router.push(`/invitacion/${pendingInvite}`);
          } else {
            setError('Acceso denegado. No tienes un perfil clínico registrado. Por favor, solicita un código de invitación.');
            // Log failed access attempt
            await supabase.from('failed_access_logs').insert({
              email: session.user.email || 'unknown',
              role_attempted: 'none',
              reason: 'No tiene perfil clínico en PsicFlow'
            });
            await supabase.auth.signOut();
          }
          return;
        }

        // Verify professional role
        const profile = userProfiles[0];
        const validRoles = ['admin_clinica', 'psicologo', 'administrativo'];
        if (!validRoles.includes(profile.role_name)) {
          setError('Acceso denegado. Esta plataforma es para uso profesional. Si eres paciente, inicia sesión en el Portal del Paciente.');
          // Log failed access attempt
          await supabase.from('failed_access_logs').insert({
            email: session.user.email || 'unknown',
            role_attempted: profile.role_name,
            reason: 'Rol no autorizado (paciente)'
          });
          await supabase.auth.signOut();
          return;
        }

        // Set active clinic tenant context
        const activeTenant = localStorage.getItem('active-tenant-id');
        const userOrgs = userProfiles.map(p => p.organization_id);
        if (!activeTenant || !userOrgs.includes(activeTenant)) {
          localStorage.setItem('active-tenant-id', profile.organization_id);
        }

        router.push('/dashboard');
      } catch (err: any) {
        setError(err.message || 'Error al validar la sesión.');
        await supabase.auth.signOut();
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas.');
      }

      if (data.user?.email === 'jpz.dev.solutions@gmail.com') {
        setPendingSession(data.session);
        setShow2FA(true);
        setLoading(false);
        await sendOTP(data.user.email);
        return;
      }

      // Store Supabase session on client
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      if (sessionErr) throw sessionErr;

      // Set active clinic tenant context
      if (data.organization_id) {
        localStorage.setItem('active-tenant-id', data.organization_id);
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || verifying2FA) return;

    setVerifying2FA(true);
    setError('');

    try {
      const email = 'jpz.dev.solutions@gmail.com';
      const res = await fetch('/api/auth/verify-2fa-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Código incorrecto.');
      }

      // Set verification flag in session storage
      sessionStorage.setItem('superadmin-2fa-verified', 'true');

      // Now apply the pending session (or existing auth session)
      if (pendingSession) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: pendingSession.access_token,
          refresh_token: pendingSession.refresh_token
        });
        if (sessionErr) throw sessionErr;
      }

      router.push('/superadmin');
    } catch (err: any) {
      setError(err.message || 'Error de verificación.');
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleCancel2FA = async () => {
    setShow2FA(false);
    setOtpCode('');
    setPendingSession(null);
    setOtpSent(false);
    await supabase.auth.signOut();
    router.reload();
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      // Clean up any lingering invite tokens before standard login
      localStorage.removeItem('pending-invite-token');
      
      const { error: googleErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/login',
        }
      });
      if (googleErr) throw googleErr;
    } catch (err: any) {
      setError(err.message || 'Error al conectar con Google.');
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      setError('Por favor ingresa un código de invitación válido.');
      return;
    }
    router.push(`/invitacion/${encodeURIComponent(inviteToken.trim())}`);
  };

  return (
    <>
      <Head>
        <title>PsicFlow - Iniciar Sesión</title>
      </Head>

      <div className="w-full max-w-md bg-bg-card border border-border-color rounded-3xl shadow-2xl p-8 space-y-6 relative">
        <div className="text-center space-y-2">
          <img src="/logo_psicflow.svg" alt="PsicFlow" className="w-16 h-16 mb-2 mx-auto" />
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">PsicFlow</h1>
          <p className="text-sm text-text-secondary">Ecosistema de blindaje y gestión clínica</p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/25 p-4 rounded-xl flex items-start gap-3 text-xs text-danger">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Usuario o Correo Electrónico</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                <Mail className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                required 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. jgarcia o garcia@clinica.cl"
                className="w-full bg-bg-input border border-border-color rounded-xl pl-10 pr-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none placeholder:text-text-muted/65"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Contraseña</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                <Lock className="w-4 h-4" />
              </span>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg-input border border-border-color rounded-xl pl-10 pr-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none placeholder:text-text-muted/65"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <span>{loading ? 'Autenticando...' : 'Iniciar Sesión'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-x-0 border-t border-border-color"></div>
          <span className="relative px-3 bg-bg-card text-xs text-text-muted">o continuar con</span>
        </div>

        <button 
          onClick={handleGoogleLogin}
          type="button"
          className="w-full bg-bg-input border border-border-color hover:bg-bg-sidebar/55 text-text-primary font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Acceder con Google</span>
        </button>

        <div className="bg-bg-sidebar/40 p-4 border border-border-color rounded-2xl flex flex-col items-center text-center text-xs">
          <div className="flex items-center gap-1.5 text-accent-primary justify-center mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span className="font-bold">Ecosistema Cerrado</span>
          </div>
          <p className="text-text-muted leading-relaxed mb-3">
            El registro está limitado a profesionales bajo código de invitación.
          </p>
          <button
            type="button"
            onClick={() => {
              setShowInviteInput(true);
              setError('');
            }}
            className="text-xs font-bold text-accent-primary hover:underline hover:text-accent-hover transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <span>Registrarse con código de invitación</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal de Ingreso Manual de Código de Invitación */}
        {showInviteInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
            <div className="bg-bg-card border border-border-color rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative flex flex-col gap-6 text-on-surface">
              <div className="flex justify-between items-center border-b border-border-color pb-3">
                <div className="flex items-center gap-2 text-accent-primary">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <h3 className="text-lg font-bold font-display text-text-primary">Registrarse</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowInviteInput(false);
                    setError('');
                  }}
                  className="p-1 rounded-full hover:bg-bg-sidebar transition-colors text-text-muted hover:text-text-primary cursor-pointer"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                Ingresa el código de invitación de tu clínica (o el código Friends & Family) para iniciar tu registro.
              </p>

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Código de Invitación</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                      <Key className="w-4 h-4" />
                    </span>
                    <input 
                      type="text" 
                      required 
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      placeholder="e.g. 68d8d4d4-7b67..."
                      className="w-full bg-bg-input border border-border-color rounded-xl pl-10 pr-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none placeholder:text-text-muted/65"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <span>Validar Código</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Verificación en Dos Pasos (2FA) */}
        {show2FA && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
            <div className="bg-bg-card border border-border-color rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative flex flex-col gap-6 text-on-surface">
              <div className="flex justify-between items-center border-b border-border-color pb-3">
                <div className="flex items-center gap-2 text-accent-primary">
                  <ShieldCheck className="w-5 h-5 animate-pulse" />
                  <h3 className="text-lg font-bold font-display text-text-primary">Verificación 2FA</h3>
                </div>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                Se ha enviado un código de verificación de 6 dígitos al correo de administración central. Introduce el código a continuación para continuar:
              </p>

              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Código de 6 dígitos</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 123456"
                    className="w-full bg-bg-input border border-border-color rounded-xl px-3 py-2.5 text-center text-lg font-bold tracking-widest text-text-primary focus:border-border-focus focus:outline-none placeholder:text-text-muted/65"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={verifying2FA || otpCode.length !== 6}
                  className="w-full bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <span>{verifying2FA ? 'Verificando...' : 'Verificar Código'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleCancel2FA}
                  className="w-full py-2 border border-border-color hover:bg-bg-input text-xs font-semibold rounded-lg text-text-secondary transition-all"
                >
                  Cancelar / Salir
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
