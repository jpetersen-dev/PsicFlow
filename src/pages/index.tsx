import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Building2, 
  Sparkles, 
  Check, 
  ArrowRight, 
  CreditCard, 
  ShieldCheck, 
  Activity, 
  Calendar, 
  FileText, 
  Lock, 
  AlertTriangle,
  User,
  Mail,
  Loader2
} from 'lucide-react';
import { validateRut, validateEmail } from '../utils/validators';

interface Plan {
  id: string;
  name: string;
  priceCLP: string;
  priceUSD: string;
  features: string[];
  recommended?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'Starter',
    name: 'Plan Starter',
    priceCLP: '$24.990',
    priceUSD: '$27',
    features: [
      '1 Terapeuta',
      'Hasta 25 pacientes activos',
      '50 créditos de notas SOAP/IA al mes',
      'Informes clínicos básicos',
      'Soporte por correo electrónico',
    ]
  },
  {
    id: 'Pro',
    name: 'Plan Pro',
    priceCLP: '$44.990',
    priceUSD: '$49',
    features: [
      '1 Terapeuta + 1 Administrativo',
      'Pacientes activos ilimitados',
      '200 créditos de notas SOAP/IA al mes',
      'Informes clínicos avanzados (Gemini Pro)',
      'Soporte prioritario 24/7',
      'Firma clínica digital activa',
    ],
    recommended: true
  },
  {
    id: 'Enterprise',
    name: 'Plan Enterprise',
    priceCLP: '$89.990',
    priceUSD: '$99',
    features: [
      'Terapeutas ilimitados',
      'Pacientes y notas ilimitados',
      'Créditos de IA corporativos flexibles',
      'Auditoría y control de firma digital',
      'Soporte dedicado y SLAs garantizados',
      'Integraciones personalizadas API',
    ]
  }
];

export default function LandingPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'idle' | 'form' | 'processing' | 'success'>('idle');
  
  // Checkout Form States
  const [fullName, setFullName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  
  // Card mock states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setCheckoutStep('form');
    setError('');
  };

  const handleCloseCheckout = () => {
    if (checkoutStep === 'processing') return; // block during payment
    setCheckoutStep('idle');
    setSelectedPlan(null);
  };

  // Card Number Autocomplete Space Formatter
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 16);
    const parts = [];
    for (let i = 0; i < value.length; i += 4) {
      parts.push(value.substring(i, i + 4));
    }
    setCardNumber(parts.join(' '));
  };

  // Expiry Date Formatter MM/YY
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    setCardExpiry(value);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 1. Validations
    const cleanRutStr = rut.trim().replace(/\./g, '').replace(/ /g, '').replace(/-/g, '');
    if (!validateRut(cleanRutStr)) {
      setError('El RUT ingresado no es válido.');
      setLoading(false);
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('El correo electrónico no es válido.');
      setLoading(false);
      return;
    }

    if (cardNumber.replace(/\s/g, '').length < 16) {
      setError('El número de tarjeta debe tener 16 dígitos.');
      setLoading(false);
      return;
    }

    if (cardExpiry.length < 5) {
      setError('La fecha de vencimiento es inválida (formato MM/YY).');
      setLoading(false);
      return;
    }

    if (cardCvc.length < 3) {
      setError('El código CVC debe tener al menos 3 dígitos.');
      setLoading(false);
      return;
    }

    setCheckoutStep('processing');

    try {
      // Simulate Payment Delay (Stripe-like flow)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan?.id,
          full_name: fullName,
          clinic_name: clinicName,
          rut_professional: rut,
          email: email
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el alta de suscripción.');
      }

      setInviteUrl(data.inviteUrl || '');
      setCheckoutStep('success');
    } catch (err: any) {
      setError(err.message || 'Error en el servidor.');
      setCheckoutStep('form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>PsicoAlivio - Gestión Clínica Inteligente y Notas SOAP por IA</title>
        <meta name="description" content="Plataforma SaaS de evolución clínica automatizada por IA para psicólogos y terapeutas." />
      </Head>

      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col w-full relative overflow-hidden">
        
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-primary/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent-primary/3 rounded-full blur-[150px] pointer-events-none -z-10"></div>

        {/* Global Navigation Header */}
        <header className="w-full h-16 border-b border-border-color/50 bg-bg-card/70 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6 md:px-12 max-w-[1440px] mx-auto">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-accent-primary font-display">
            <Building2 className="w-6 h-6" />
            <span>PsicoAlivio</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-semibold text-text-secondary hover:text-accent-primary transition-all"
            >
              Acceso Clínico
            </Link>
            <a 
              href="#pricing"
              className="px-4 py-2 bg-accent-primary hover:bg-accent-hover text-bg-primary rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Suscribirse
            </a>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-[1440px] mx-auto w-full px-6 md:px-12 py-12 space-y-24">
          
          {/* Hero Section */}
          <section className="text-center max-w-4xl mx-auto space-y-6 pt-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-primary/10 text-accent-primary rounded-full text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Notas Clínicas Automatizadas por IA</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-text-primary leading-tight font-display">
              La plataforma de evolución clínica inteligente para terapeutas
            </h1>
            <p className="text-base md:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
              Optimiza tu consulta privada con notas SOAP redactadas por IA, transcripciones por voz, informes clínicos inmediatos y CRM de pacientes. Chilenización fiscal y legal completa en cumplimiento con la Ley N° 21.668.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
              <a 
                href="#pricing"
                className="px-8 py-3.5 bg-accent-primary hover:bg-accent-hover text-bg-primary rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <span>Ver Planes y Comenzar</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link 
                href="/login" 
                className="px-8 py-3.5 bg-bg-card border border-border-color hover:bg-bg-sidebar/40 text-text-primary rounded-xl text-sm font-semibold transition-all w-full sm:w-auto justify-center text-center"
              >
                Acceder a mi Cuenta
              </Link>
            </div>
          </section>

          {/* Features Bento Grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-bg-card border border-border-color/60 rounded-3xl p-8 space-y-4 hover:border-accent-primary/30 transition-all shadow-sm">
              <div className="p-3 bg-accent-primary/10 text-accent-primary rounded-2xl w-fit">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-text-primary font-display">Evolución Clínica SOAP</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Dicta tus notas por voz o sube apuntes en una foto (OCR) y deja que nuestra inteligencia artificial en caliente redacte notas clínicas estruturadas en formato SOAP profesional en segundos.
              </p>
            </div>

            <div className="bg-bg-card border border-border-color/60 rounded-3xl p-8 space-y-4 hover:border-accent-primary/30 transition-all shadow-sm">
              <div className="p-3 bg-accent-primary/10 text-accent-primary rounded-2xl w-fit">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-text-primary font-display">Informes Clínicos en un Clic</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Selecciona las consultas previas de un paciente y genera de forma automática informes y resúmenes de tratamiento listos para presentar, firmados digitalmente.
              </p>
            </div>

            <div className="bg-bg-card border border-border-color/60 rounded-3xl p-8 space-y-4 hover:border-accent-primary/30 transition-all shadow-sm">
              <div className="p-3 bg-accent-primary/10 text-accent-primary rounded-2xl w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-text-primary font-display">Chilenización Fiscal y Legal</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Validación estricta de RUT para profesionales y pacientes. Gestión de fichas clínicas y firma digital en estricto cumplimiento con la ley chilena de fichas médicas.
              </p>
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing" className="space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold text-text-primary font-display">Planes Diseñados para Terapeutas</h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Selecciona la suscripción que mejor se adapte al tamaño de tu práctica clínica
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
              {PLANS.map((plan) => (
                <div 
                  key={plan.id}
                  className={`bg-bg-card border rounded-3xl p-8 flex flex-col justify-between relative transition-all shadow-md hover:shadow-xl ${
                    plan.recommended 
                      ? 'border-accent-primary ring-2 ring-accent-primary/15 lg:scale-105' 
                      : 'border-border-color/60'
                  }`}
                >
                  {plan.recommended && (
                    <span className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-accent-primary text-bg-primary text-[10px] font-bold rounded-full uppercase tracking-wider">
                      Recomendado
                    </span>
                  )}
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-text-primary font-display">{plan.name}</h3>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-text-primary font-display">{plan.priceCLP}</span>
                        <span className="text-xs text-text-muted">/ mes</span>
                      </div>
                      <p className="text-xs text-text-muted">o USD {plan.priceUSD}/mes</p>
                    </div>

                    <ul className="space-y-3 border-t border-border-color/40 pt-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                          <Check className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button 
                    onClick={() => handleSelectPlan(plan)}
                    className={`mt-8 w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                      plan.recommended 
                        ? 'bg-accent-primary hover:bg-accent-hover text-bg-primary shadow-md' 
                        : 'bg-bg-sidebar border border-border-color hover:bg-bg-sidebar/70 text-text-primary'
                    }`}
                  >
                    Suscribirse
                  </button>
                </div>
              ))}
            </div>
          </section>

        </main>

        {/* Global Footer */}
        <footer className="w-full border-t border-border-color/40 bg-bg-sidebar/55 py-8 mt-24">
          <div className="max-w-[1440px] mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-1.5 font-bold text-accent-primary font-display">
              <Building2 className="w-4 h-4" />
              <span>PsicoAlivio</span>
            </div>
            <p>&copy; 2026 PsicoAlivio. Gestión clínica profesional y segura.</p>
          </div>
        </footer>

        {/* ========================================== */}
        {/* CHECKOUT MODAL - SIMULATED PAYMENT GATEWAY */}
        {/* ========================================== */}
        {checkoutStep !== 'idle' && selectedPlan && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="bg-bg-sidebar/40 border-b border-border-color/50 px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent-primary" />
                  <span className="font-bold text-sm text-text-primary">Pasarela de Pago Simulada</span>
                </div>
                {checkoutStep !== 'processing' && (
                  <button 
                    onClick={handleCloseCheckout}
                    className="text-xs text-text-muted hover:text-text-primary transition-all"
                  >
                    Cerrar
                  </button>
                )}
              </div>

              {/* Modal Body Scroll Container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* State: Form Input */}
                {checkoutStep === 'form' && (
                  <>
                    <div className="bg-accent-primary/5 p-4 border border-accent-primary/20 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="text-xs text-text-muted uppercase font-bold tracking-wider">Plan Elegido</p>
                        <p className="font-bold text-text-primary">{selectedPlan.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-accent-primary font-display">{selectedPlan.priceCLP}</p>
                        <p className="text-[10px] text-text-muted">Facturación mensual</p>
                      </div>
                    </div>

                    {error && (
                      <div className="bg-danger/10 border border-danger/25 p-4 rounded-xl flex items-start gap-2.5 text-xs text-danger">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                      
                      {/* Personal & Clinic info */}
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-accent-primary uppercase tracking-wider">Datos de Alta</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-text-secondary">Nombre del Profesional</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                                <User className="w-4 h-4" />
                              </span>
                              <input 
                                type="text"
                                required
                                placeholder="e.g. Jonathan Petersen"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:border-border-focus focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-text-secondary">RUT del Profesional</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                                <Activity className="w-4 h-4" />
                              </span>
                              <input 
                                type="text"
                                required
                                placeholder="e.g. 17.375.825-1"
                                value={rut}
                                onChange={(e) => setRut(e.target.value)}
                                className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:border-border-focus focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-text-secondary">Nombre de la Clínica</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                                <Building2 className="w-4 h-4" />
                              </span>
                              <input 
                                type="text"
                                required
                                placeholder="e.g. Clínica Petersen"
                                value={clinicName}
                                onChange={(e) => setClinicName(e.target.value)}
                                className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:border-border-focus focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-text-secondary">Email de Onboarding</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                                <Mail className="w-4 h-4" />
                              </span>
                              <input 
                                type="email"
                                required
                                placeholder="e.g. j.petersen@gmail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:border-border-focus focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card fields */}
                      <div className="space-y-3 pt-2">
                        <p className="text-xs font-bold text-accent-primary uppercase tracking-wider">Detalles de Tarjeta de Crédito (Simulada)</p>
                        
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary">Número de Tarjeta</label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-text-muted">
                              <CreditCard className="w-4 h-4" />
                            </span>
                            <input 
                              type="text"
                              required
                              placeholder="4242 4242 4242 4242"
                              value={cardNumber}
                              onChange={handleCardNumberChange}
                              className="w-full bg-bg-input border border-border-color rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary focus:border-border-focus focus:outline-none font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-text-secondary">Fecha Vence (MM/YY)</label>
                            <input 
                              type="text"
                              required
                              placeholder="12/28"
                              value={cardExpiry}
                              onChange={handleExpiryChange}
                              className="w-full bg-bg-input border border-border-color rounded-xl px-3 py-2 text-xs text-text-primary focus:border-border-focus focus:outline-none font-mono text-center"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-text-secondary">CVC</label>
                            <input 
                              type="password"
                              required
                              maxLength={3}
                              placeholder="123"
                              value={cardCvc}
                              onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                              className="w-full bg-bg-input border border-border-color rounded-xl px-3 py-2 text-xs text-text-primary focus:border-border-focus focus:outline-none font-mono text-center"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex items-center gap-3">
                        <button 
                          type="button"
                          onClick={handleCloseCheckout}
                          className="flex-1 py-3 bg-bg-sidebar border border-border-color hover:bg-bg-sidebar/55 text-text-primary rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-3 bg-accent-primary hover:bg-accent-hover text-bg-primary rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                        >
                          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Confirmar Suscripción</span>
                        </button>
                      </div>

                    </form>
                  </>
                )}

                {/* State: Processing payment */}
                {checkoutStep === 'processing' && (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
                    <div className="space-y-1">
                      <p className="font-bold text-text-primary text-base">Procesando Transacción...</p>
                      <p className="text-xs text-text-muted">Simulando verificación bancaria segura y aprovisionamiento de inquilinos...</p>
                    </div>
                  </div>
                )}

                {/* State: Success checkout */}
                {checkoutStep === 'success' && (
                  <div className="py-8 flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center">
                      <Check className="w-8 h-8 stroke-[3]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-text-primary font-display">¡Suscripción Completada!</h3>
                      <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
                        El pago se ha simulado con éxito. Se ha configurado la clínica y hemos despachado el enlace de alta a tu correo <strong>{email.trim().toLowerCase()}</strong>.
                      </p>
                    </div>

                    <div className="bg-bg-sidebar/60 p-4 border border-border-color rounded-2xl w-full text-left space-y-3">
                      <p className="text-[11px] font-bold text-accent-primary uppercase tracking-wider">Verificación de Desarrollo</p>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Puedes copiar directamente el enlace de invitación abajo para simular que abres el correo recibido:
                      </p>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={inviteUrl} 
                          className="flex-1 bg-bg-input border border-border-color rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-text-primary focus:outline-none"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(inviteUrl);
                            alert('¡Enlace de invitación copiado!');
                          }}
                          className="px-3 py-1.5 bg-accent-primary text-bg-primary rounded-lg text-[10px] font-bold hover:bg-accent-hover transition-all shrink-0 cursor-pointer"
                        >
                          Copiar Link
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 w-full flex justify-center">
                      <button 
                        onClick={() => {
                          handleCloseCheckout();
                          router.push(`/invitacion/${inviteUrl.split('/').pop()}`);
                        }}
                        className="px-6 py-2.5 bg-accent-primary hover:bg-accent-hover text-bg-primary rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Proceder al Registro</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}
