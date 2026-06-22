import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, User, Phone, Calendar, AlertTriangle, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { validateEmail } from '../utils/validators';

export default function PatientLogin() {
  const router = useRouter();
  
  // Tabs: 'login' | 'register' | 'otp'
  const [mode, setMode] = useState<'login' | 'register' | 'otp'>('login');
  
  // Form values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Redirect if already logged in — use onAuthStateChange to properly
  // handle OAuth callback hash tokens that may still be in the URL
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Fetch profile to see role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_name')
          .eq('user_id', session.user.id)
          .limit(1)
          .maybeSingle();
        
        if (profile?.role_name === 'paciente') {
          router.push('/');
        } else if (profile) {
          router.push('/dashboard');
        }
        // If no profile, stay on login (reconciliation will happen via Layout)
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Handle Classic Email/Password Sign In
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!validateEmail(cleanEmail)) {
        throw new Error('El formato de correo electrónico es incorrecto.');
      }

      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authErr) {
        throw new Error(authErr.message || 'Credenciales inválidas.');
      }

      // Check if the user is a patient
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('organization_id, role_name')
        .eq('user_id', authData.user?.id)
        .eq('role_name', 'paciente')
        .limit(1)
        .maybeSingle();

      if (profileErr || !profile) {
        await supabase.auth.signOut();
        throw new Error('Acceso denegado. Esta cuenta no está registrada como paciente.');
      }

      // Set active clinic tenant context
      if (profile.organization_id) {
        localStorage.setItem('active-tenant-id', profile.organization_id);
      }

      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Up request (Sends OTP)
  const handleRegisterRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!validateEmail(cleanEmail)) {
        throw new Error('El formato de correo electrónico es incorrecto.');
      }

      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }

      const res = await fetch('/api/portal/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          full_name: fullName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar.');
      }

      setSuccessMsg(`Código enviado a ${cleanEmail}`);
      setMode('otp');
    } catch (err: any) {
      setError(err.message || 'Error al registrar.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verification and Final Account Creation
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch('/api/portal/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
          birth_date: birthDate || undefined,
          code: otpCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Código incorrecto o expirado.');
      }

      // Login immediately with the returned session or fall back to password sign-in
      if (data.session?.access_token) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        if (sessionErr) throw sessionErr;
      } else {
        // Fallback: sign in with password if API didn't return a session
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInErr) throw signInErr;
      }

      // Set active clinic tenant context (Sentido Migrante)
      localStorage.setItem('active-tenant-id', 'fa28bcff-1321-4cb4-b5ef-64ffed1662cb');

      setSuccessMsg('¡Cuenta verificada con éxito! Redirigiendo...');
      // The onAuthStateChange listener will handle the redirect
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error de verificación.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth Sign In
  const handleGoogleLogin = async () => {
    try {
      setError('');
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

  return (
    <>
      <Head>
        <title>Acceso Portal Paciente - Sentido Migrante</title>
      </Head>

      <div className="min-h-screen bg-[#FCFBF9] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
        {/* Decorative Brand Header */}
        <div className="text-center mb-8 max-w-sm">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-full bg-[#DAEDDF] flex items-center justify-center text-[#1A3020]">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
          <h2 className="font-display text-2xl font-bold text-[#1C1917] tracking-tight">Sentido Migrante</h2>
          <p className="text-xs text-[#78716C] mt-1">Portal de Gestión de Horas y Recursos Clínicos</p>
        </div>

        {/* Login / Signup Card */}
        <div className="w-full max-w-md bg-white border border-[#F2EFE8] rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
          
          {/* Tabs */}
          {mode !== 'otp' && (
            <div className="flex bg-[#F9F7F3] rounded-2xl p-1">
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 text-center py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${mode === 'login' ? 'bg-white text-[#1A3020] shadow-sm' : 'text-[#78716C] hover:text-[#1C1917]'}`}
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => { setMode('register'); setError(''); }}
                className={`flex-1 text-center py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${mode === 'register' ? 'bg-white text-[#1A3020] shadow-sm' : 'text-[#78716C] hover:text-[#1C1917]'}`}
              >
                Registrar Cuenta
              </button>
            </div>
          )}

          {/* Feedback alerts */}
          {error && (
            <div className="bg-red-50 border border-red-200/50 p-4 rounded-2xl flex items-start gap-3 text-xs text-red-700">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-[#DAEDDF] border border-[#A2BC97]/40 p-4 rounded-2xl flex items-start gap-3 text-xs text-[#1A3020]">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Correo Electrónico</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#78716C]">
                    <Mail className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl pl-11 pr-3 py-3 text-sm text-[#1C1917] focus:border-[#516750] focus:ring-1 focus:ring-[#516750] focus:outline-none placeholder:text-[#A8A29E]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Contraseña</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#78716C]">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl pl-11 pr-3 py-3 text-sm text-[#1C1917] focus:border-[#516750] focus:ring-1 focus:ring-[#516750] focus:outline-none placeholder:text-[#A8A29E]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#516750] hover:bg-[#3f513e] disabled:bg-[#78716C]/50 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#516750]/10"
              >
                {loading ? 'Iniciando sesión...' : 'Ingresar al Portal'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Nombre Completo</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#78716C]">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl pl-11 pr-3 py-3 text-sm text-[#1C1917] focus:border-[#516750] focus:ring-1 focus:ring-[#516750] focus:outline-none placeholder:text-[#A8A29E]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Correo Electrónico</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#78716C]">
                    <Mail className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl pl-11 pr-3 py-3 text-sm text-[#1C1917] focus:border-[#516750] focus:ring-1 focus:ring-[#516750] focus:outline-none placeholder:text-[#A8A29E]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#44403C]">Contraseña</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#78716C]">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl pl-11 pr-3 py-3 text-sm text-[#1C1917] focus:border-[#516750] focus:ring-1 focus:ring-[#516750] focus:outline-none placeholder:text-[#A8A29E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#44403C]">Teléfono (Opcional)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#78716C]">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+56 9..."
                      className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl pl-9 pr-2 py-3 text-sm text-[#1C1917] focus:border-[#516750] focus:ring-1 focus:ring-[#516750] focus:outline-none placeholder:text-[#A8A29E]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#44403C]">Nacimiento (Opcional)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#78716C]">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-xl pl-9 pr-2 py-3 text-sm text-[#1C1917] focus:border-[#516750] focus:ring-1 focus:ring-[#516750] focus:outline-none text-[#78716C]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#516750] hover:bg-[#3f513e] disabled:bg-[#78716C]/50 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#516750]/10"
              >
                {loading ? 'Enviando código...' : 'Registrar y Enviar OTP'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE: OTP VERIFICATION */}
          {mode === 'otp' && (
            <form onSubmit={handleOtpVerify} className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="font-display text-lg font-bold text-[#1C1917]">Código de Verificación</h3>
                <p className="text-xs text-[#78716C] leading-relaxed">
                  Ingresa el código de 6 dígitos que enviamos a tu correo electrónico para activar tu cuenta.
                  <br />
                  <span className="text-[11px] text-[#A8A29E] mt-1 block">
                    ¿No lo encuentras? Recuerda revisar tu bandeja de correo no deseado o spam. El código expira en 15 minutos.
                  </span>
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-[#F9F7F3] border border-[#F2EFE8] rounded-2xl py-4 text-center font-mono text-3xl font-bold tracking-[8px] text-[#1A3020] focus:border-[#516750] focus:ring-1 focus:ring-[#516750] focus:outline-none placeholder:text-[#A8A29E]/50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full bg-[#516750] hover:bg-[#3f513e] disabled:bg-[#78716C]/50 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  {loading ? 'Verificando...' : 'Confirmar Registro'}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setMode('register'); setSuccessMsg(''); setError(''); }}
                  className="w-full text-center py-2 text-xs font-bold text-[#78716C] hover:text-[#1C1917] transition-all cursor-pointer"
                >
                  Volver al formulario
                </button>
              </div>
            </form>
          )}

          {/* GOOGLE SOCIAL AUTH BUTTON - Standard Corporate Google Colors */}
          {mode !== 'otp' && (
            <div className="space-y-4">
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#F2EFE8]"></div>
                <span className="flex-shrink mx-4 text-[10px] uppercase font-bold text-[#A8A29E] tracking-widest">o continúa con</span>
                <div className="flex-grow border-t border-[#F2EFE8]"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] active:bg-[#EEEEEE] text-[#3C4043] font-bold text-sm py-3 px-4 rounded-xl shadow-sm transition-all cursor-pointer font-sans"
              >
                {/* Official Corporate Multicolor Google G Logo */}
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4C21.68,11.8 21.56,11.4 21.35,11.1z" fill="#4285F4" />
                    <path d="M12,20.6c2.6,0 4.77,-0.86 6.36,-2.3l-3.3,-2.58c-0.9,0.6 -2.07,0.98 -3.06,0.98 -2.36,0 -4.36,-1.6 -5.07,-3.75H3.5v2.66C5.12,18.8 8.35,20.6 12,20.6z" fill="#34A853" />
                    <path d="M6.93,12.95c-0.18,-0.54 -0.28,-1.1 -0.28,-1.7s0.1,-1.16 0.28,-1.7V6.9H3.5c-0.62,1.26 -0.97,2.68 -0.97,4.2s0.35,2.94 0.97,4.2l3.43,-2.66z" fill="#FBBC05" />
                    <path d="M12,6.75c1.4,0 2.67,0.48 3.66,1.43l2.75,-2.75C16.77,3.84 14.6,3 12,3 8.35,3 5.12,4.8 3.5,8L6.93,10.66c0.71,-2.15 2.71,-3.75 5.07,-3.75z" fill="#EA4335" />
                  </g>
                </svg>
                <span>Acceder con Google</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
