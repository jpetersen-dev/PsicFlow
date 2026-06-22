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
  Sparkles
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

  // Form states
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      setCheckingInvite(true);
      setInviteError('');
      try {
        // Query invitations directly (public policy permits select on active ones)
        const { data, error: fetchErr } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .eq('is_used', false)
          .gt('expires_at', new Date().toISOString())
          .limit(1)
          .single();

        if (fetchErr || !data) {
          throw new Error('El código de invitación no existe, ya fue utilizado o ha expirado.');
        }

        setInvitation(data);

        // Fetch organization name
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', data.organization_id)
          .limit(1)
          .single();

        if (orgData) {
          setClinicName(orgData.name);
        }
      } catch (err: any) {
        setInviteError(err.message || 'Error al validar invitación.');
      } finally {
        setCheckingInvite(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Pre-validations
    const cleanRutStr = rut.trim().replace(/\./g, '').replace(/ /g, '').replace(/-/g, '');
    if (!validateRut(cleanRutStr)) {
      setError('El RUT ingresado no es válido o no cumple con el formato.');
      setLoading(false);
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('El formato del correo electrónico ingresado es incorrecto.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          full_name: fullName,
          username,
          email,
          password,
          rut_professional: rut
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Ocurrió un error al registrar la cuenta.');
      }

      // Auto login client session if returned
      if (result.session) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
        });
      }

      // Set tenant context
      if (result.organization_id) {
        localStorage.setItem('active-tenant-id', result.organization_id);
      }

      alert('¡Cuenta registrada y activada exitosamente!');
      router.push('/');
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
          onClick={() => router.push('/login')}
          className="w-full py-2.5 bg-bg-input border border-border-color hover:bg-bg-sidebar/55 text-text-primary rounded-xl text-sm font-semibold transition-all cursor-pointer"
        >
          Ir a Iniciar Sesión
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>PsicFlow - Registro por Invitación</title>
      </Head>

      <div className="w-full max-w-lg bg-bg-card border border-border-color rounded-3xl shadow-2xl p-8 space-y-6 my-10">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-accent-primary/10 text-accent-primary rounded-2xl mb-1">
            <Sparkles className="w-6 h-6 fill-accent-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Invitación Aceptada</h1>
          <p className="text-xs text-text-muted">Estás registrándote como <span className="font-bold text-accent-primary capitalize">{invitation.role_name}</span> en:</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">Nombre Completo *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                  <User className="w-4 h-4" />
                </span>
                <input 
                  type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Juan García"
                  className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
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
                  type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
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
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. j.garcia@clinica.cl"
                  className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
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
                  type="text" required value={rut} onChange={(e) => setRut(e.target.value)}
                  placeholder="e.g. 12345678-9"
                  className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Contraseña *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                <Lock className="w-4 h-4" />
              </span>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-accent-primary hover:bg-accent-hover text-bg-primary font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Registrando...' : 'Completar Registro'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-text-muted border-t border-border-color pt-4 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>Acceso seguro protegido por políticas RLS y HIPAA</span>
        </div>
      </div>
    </>
  );
}
