import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  Building2, 
  Mail, 
  Lock, 
  AlertTriangle, 
  ArrowRight,
  ShieldCheck,
  Key,
  Sparkles
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

  // If already logged in, redirect to dashboard
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push('/dashboard');
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

  const handleGoogleLogin = async () => {
    try {
      const { error: googleErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
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
        <title>PsicoAlivio - Iniciar Sesión</title>
      </Head>

      <div className="w-full max-w-md bg-bg-card border border-border-color rounded-3xl shadow-2xl p-8 space-y-6">
        {showInviteInput ? (
          <>
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-accent-primary/10 text-accent-primary rounded-2xl mb-2">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Validar Invitación</h1>
              <p className="text-sm text-text-secondary">Ingresa tu código de invitación para iniciar tu registro</p>
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/25 p-4 rounded-xl flex items-start gap-3 text-xs text-danger">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

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
                    placeholder="e.g. invite-central-2026"
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

            <div className="text-center pt-2">
              <button 
                type="button" 
                onClick={() => {
                  setShowInviteInput(false);
                  setError('');
                }}
                className="text-xs font-bold text-accent-primary hover:text-accent-hover transition-all cursor-pointer"
              >
                Volver a Iniciar Sesión
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-accent-primary/10 text-accent-primary rounded-2xl mb-2">
                <Building2 className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Acceso Clínico</h1>
              <p className="text-sm text-text-secondary">Ingresa a tu ecosistema de gestión PsicoAlivio</p>
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
          </>
        )}
      </div>
    </>
  );
}
