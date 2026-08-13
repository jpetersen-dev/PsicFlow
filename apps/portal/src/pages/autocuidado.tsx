import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, 
  Sparkles, 
  Play, 
  Square, 
  FileText, 
  History, 
  TrendingUp, 
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function PatientSelfCare() {
  const [patient, setPatient] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingAssessment, setSubmittingAssessment] = useState(false);
  const [success, setSuccess] = useState('');

  // 1. Estados de la Respiración 4-7-8
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'idle' | 'inhalar' | 'retener' | 'exhalar'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [completedCycles, setCompletedCycles] = useState(0);

  // 2. Estados del Test GAD-7
  const [showTest, setShowTest] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [testResult, setTestResult] = useState<any | null>(null);

  const gad7Questions = [
    '¿Te has sentido nervioso/a, ansioso/a o con los nervios de punta?',
    '¿No has sido capaz de parar o controlar tu preocupación?',
    '¿Te has preocupado demasiado por diferentes cosas?',
    '¿Has tenido dificultad para relajarte?',
    '¿Te has sentido tan inquieto/a que te ha sido difícil permanecer sentado/a?',
    '¿Te has sentido fácilmente irritable o enfadado/a?',
    '¿Te has sentido con temor, como si algo terrible pudiera suceder?'
  ];

  const gad7Options = [
    { label: 'Nunca', value: 0 },
    { label: 'Varios días', value: 1 },
    { label: 'Más de la mitad de los días', value: 2 },
    { label: 'Casi todos los días', value: 3 }
  ];

  const fetchSelfCareData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data: patData } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(1)
        .single();

      if (patData) {
        setPatient(patData);

        // Fetch past assessments from API
        const res = await fetch(`/api/v1/booking/assessments`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'x-tenant-id': patData.organization_id
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setAssessments(data.assessments || []);
        }
      }
    } catch (err) {
      console.error('Error fetching self-care assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelfCareData();
  }, []);

  // Lógica del Temporizador de Respiración
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (breathingActive) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            // Cambio de fase
            if (breathingPhase === 'idle' || breathingPhase === 'exhalar') {
              setBreathingPhase('inhalar');
              return 4; // Inhala por 4s
            } else if (breathingPhase === 'inhalar') {
              setBreathingPhase('retener');
              return 7; // Retén por 7s
            } else if (breathingPhase === 'retener') {
              setBreathingPhase('exhalar');
              setCompletedCycles(c => c + 1);
              return 8; // Exhala por 8s
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setBreathingPhase('idle');
      setSecondsLeft(0);
      setCompletedCycles(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [breathingActive, breathingPhase]);

  const handleStartBreathing = () => {
    setBreathingActive(true);
    setBreathingPhase('inhalar');
    setSecondsLeft(4);
    setCompletedCycles(0);
  };

  const handleStopBreathing = () => {
    setBreathingActive(false);
  };

  // Lógica de respuesta del test GAD-7
  const handleAnswerSelect = (scoreValue: number) => {
    const updatedAnswers = [...answers, scoreValue];
    setAnswers(updatedAnswers);

    if (currentQuestionIndex < gad7Questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Test finalizado: Calcular resultado
      const totalScore = updatedAnswers.reduce((a, b) => a + b, 0);
      
      let severity = 'Mínima';
      let recommendation = 'Tus respuestas indican un nivel mínimo de ansiedad. Continúa practicando hábitos saludables y ejercicios de respiración regulada.';
      
      if (totalScore >= 5 && totalScore <= 9) {
        severity = 'Leve';
        recommendation = 'Ansiedad de nivel leve. Te recomendamos incorporar rutinas diarias de autocuidado y pausas de respiración 4-7-8.';
      } else if (totalScore >= 10 && totalScore <= 14) {
        severity = 'Moderada';
        recommendation = 'Ansiedad de nivel moderado. Sugerimos descargar estas respuestas o comentarle este resultado a tu terapeuta en la próxima sesión.';
      } else if (totalScore >= 15) {
        severity = 'Severa';
        recommendation = 'Ansiedad severa detectada. Te recomendamos encarecidamente conversar con tu psicólogo/a en tu próxima sesión programada para abordar estos síntomas.';
      }

      setTestResult({
        score: totalScore,
        severity,
        recommendation
      });
      setShowTest(false);

      // Guardar en base de datos
      saveAssessmentScore(totalScore, updatedAnswers);
    }
  };

  const saveAssessmentScore = async (score: number, rawResponses: number[]) => {
    if (!patient) return;
    setSubmittingAssessment(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/v1/booking/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          'x-tenant-id': patient.organization_id
        },
        body: JSON.stringify({
          assessmentType: 'GAD-7',
          score,
          responses: {
            questions: gad7Questions,
            answers: rawResponses
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('¡Evaluación guardada exitosamente en tu expediente!');
        fetchSelfCareData();
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      console.error('Error saving self-assessment score:', err);
    } finally {
      setSubmittingAssessment(false);
    }
  };

  const resetTest = () => {
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setTestResult(null);
    setShowTest(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Cargando herramientas de autocuidado...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Autocuidado - Sentido Migrante</title>
      </Head>

      <div className="space-y-6 pb-12">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Inicio</span>
          </Link>
          <button 
            onClick={() => { setLoading(true); fetchSelfCareData(); }}
            className="p-2 border border-[#E2DCD0] hover:bg-[#F9F7F3] rounded-xl transition-all text-[#78716C] cursor-pointer"
            title="Refrescar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-[#1C1917] tracking-tight">Espacio de Autocuidado</h1>
          <p className="text-sm text-[#78716C]">Herramientas interactivas de regulación biológica y cuestionarios clínicos para monitorear tu salud mental.</p>
        </div>

        {success && (
          <div className="bg-[#DAEDDF] border border-[#A2BC97]/40 p-4 rounded-2xl flex items-center gap-3 text-xs text-[#1A3020] animate-fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Breathing Guide Section (7/12) */}
          <section className="col-span-12 lg:col-span-7 bg-white border border-[#E2DCD0] rounded-3xl p-6 shadow-sm space-y-6 text-center">
            <div className="text-left space-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#78716C] border-b border-[#F2EFE8] pb-2">
                Respiración Guiada 4-7-8
              </h2>
              <p className="text-xs text-[#78716C] font-light leading-relaxed">
                Técnica de relajación visual que reduce la frecuencia cardíaca y activa el sistema parasimpático para regular estados de estrés y pánico.
              </p>
            </div>

            {/* Breathing Animation container */}
            <div className="py-8 flex flex-col items-center justify-center min-h-[300px] bg-[#FCFBF9] rounded-2xl border border-[#F2EFE8] relative overflow-hidden">
              
              {/* Outer pulsing ring */}
              <div 
                className={`rounded-full flex items-center justify-center transition-all duration-1000 ${
                  breathingPhase === 'inhalar' ? 'w-48 h-48 bg-[#DAEDDF]/50 scale-110 shadow-lg' :
                  breathingPhase === 'retener' ? 'w-48 h-48 bg-[#BCE0C3] scale-120 shadow-2xl border-4 border-[#516750]/30 animate-pulse' :
                  breathingPhase === 'exhalar' ? 'w-36 h-36 bg-[#F3EAD8]/55 scale-90 shadow-sm' :
                  'w-36 h-36 bg-gray-100'
                }`}
              >
                {/* Inner circle */}
                <div 
                  className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-1000 text-white font-bold font-display ${
                    breathingPhase === 'inhalar' ? 'bg-[#516750] scale-105' :
                    breathingPhase === 'retener' ? 'bg-[#3E5C4E] scale-110' :
                    breathingPhase === 'exhalar' ? 'bg-[#8FA68F] scale-95' :
                    'bg-[#78716C]'
                  }`}
                >
                  <span className="text-sm capitalize tracking-wider">
                    {breathingPhase === 'idle' ? 'Listo' : breathingPhase}
                  </span>
                  {secondsLeft > 0 && (
                    <span className="text-2xl mt-1 font-mono">{secondsLeft}s</span>
                  )}
                </div>
              </div>

              {/* Status information */}
              {breathingActive ? (
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-semibold text-[#1C1917]">
                    {breathingPhase === 'inhalar' && 'Inhala profunda y silenciosamente por la nariz...'}
                    {breathingPhase === 'retener' && 'Mantén el aire en tus pulmones...'}
                    {breathingPhase === 'exhalar' && 'Exhala todo el aire sonoramente por la boca...'}
                  </p>
                  <p className="text-[10px] text-[#78716C]">
                    Ciclos completados en esta sesión: <strong>{completedCycles}</strong>
                  </p>
                </div>
              ) : (
                <p className="mt-6 text-xs text-[#78716C]">Haz clic en "Iniciar" para comenzar la técnica de relajación.</p>
              )}
            </div>

            {/* Breathing controls */}
            <div className="flex justify-center gap-3">
              {!breathingActive ? (
                <button
                  onClick={handleStartBreathing}
                  className="px-5 py-3 bg-[#516750] hover:bg-[#3f513e] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer border-0"
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>Iniciar Respiración</span>
                </button>
              ) : (
                <button
                  onClick={handleStopBreathing}
                  className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer border-0"
                >
                  <Square className="w-4 h-4 fill-white text-white" />
                  <span>Detener</span>
                </button>
              )}
            </div>
          </section>

          {/* Test de Ansiedad GAD-7 (5/12) */}
          <section className="col-span-12 lg:col-span-5 bg-white border border-[#E2DCD0] rounded-3xl p-6 shadow-sm space-y-6">
            <div className="space-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#78716C] border-b border-[#F2EFE8] pb-2">
                Escala de Ansiedad GAD-7
              </h2>
              <p className="text-xs text-[#78716C] font-light leading-relaxed">
                Herramienta clínica estandarizada de autoevaluación para medir niveles de ansiedad generalizada en las últimas dos semanas.
              </p>
            </div>

            {/* Test State Machine */}
            {!showTest && !testResult && (
              <div className="py-6 text-center space-y-4 bg-[#F9F7F3] rounded-2xl border border-[#F2EFE8]">
                <HelpCircle className="w-8 h-8 text-[#516750] mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#1C1917]">Cuestionario de Auto-Monitoreo</p>
                  <p className="text-[10px] text-[#78716C] max-w-xs mx-auto px-4">
                    Toma 2 minutos. Consta de 7 preguntas sencillas basadas en la escala clínica oficial.
                  </p>
                </div>
                <button
                  onClick={resetTest}
                  className="px-4 py-2 bg-[#516750] hover:bg-[#3f513e] text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Responder Cuestionario</span>
                </button>
              </div>
            )}

            {/* Active Test Form */}
            {showTest && (
              <div className="space-y-4 p-4 bg-[#F9F7F3] rounded-2xl border border-[#F2EFE8] animate-in fade-in duration-200">
                <div className="flex justify-between items-center text-[10px] text-[#78716C] font-bold">
                  <span>PREGUNTA {currentQuestionIndex + 1} DE {gad7Questions.length}</span>
                  <span className="bg-[#DAEDDF] text-[#1A3020] px-2 py-0.5 rounded">GAD-7</span>
                </div>
                
                <h3 className="font-bold text-xs text-[#1C1917] leading-relaxed">
                  {gad7Questions[currentQuestionIndex]}
                </h3>

                <div className="flex flex-col gap-2 pt-2">
                  {gad7Options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleAnswerSelect(opt.value)}
                      className="w-full text-left p-3 bg-white hover:bg-[#DAEDDF]/40 text-[#1C1917] hover:text-[#1A3020] hover:border-[#516750]/30 transition-all border border-[#E2DCD0] rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Test Results Display */}
            {testResult && (
              <div className="space-y-4 p-5 bg-[#DAEDDF]/30 border border-[#A2BC97]/40 rounded-2xl animate-in fade-in duration-200 text-xs">
                <div className="flex justify-between items-center border-b border-[#A2BC97]/30 pb-2">
                  <h3 className="font-bold text-sm text-[#1A3020]">Resultado de tu Evaluación</h3>
                  <span className={`px-2.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                    testResult.severity === 'Mínima' ? 'bg-green-100 text-green-800' :
                    testResult.severity === 'Leve' ? 'bg-yellow-100 text-yellow-800' :
                    testResult.severity === 'Moderada' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    Ansiedad {testResult.severity}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="font-bold text-text-primary text-base">
                    Puntaje Total GAD-7: <span className="font-mono text-[#516750]">{testResult.score} / 21</span>
                  </p>
                  <p className="text-[#78716C] leading-relaxed font-light font-sans bg-white/60 p-3 rounded-xl border border-[#E2DCD0]/20">
                    {testResult.recommendation}
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-[#A2BC97]/20">
                  <button
                    onClick={resetTest}
                    className="px-3.5 py-2 border border-[#E2DCD0] hover:bg-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Repetir Test
                  </button>
                </div>
              </div>
            )}

            {/* Past Assessments History */}
            {assessments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C] flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#516750]" />
                  <span>Historial de Evaluaciones</span>
                </h3>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {assessments.map((a) => (
                    <div key={a.id} className="p-3 bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#1C1917]">{a.assessment_type} - Score: {a.score}/21</p>
                        <p className="text-[9px] text-[#78716C]">
                          Realizado el {new Date(a.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                        a.score < 5 ? 'bg-green-50 text-green-700' :
                        a.score < 10 ? 'bg-yellow-50 text-yellow-700' :
                        a.score < 15 ? 'bg-orange-50 text-orange-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {a.score < 5 ? 'Mínima' : a.score < 10 ? 'Leve' : a.score < 15 ? 'Moderada' : 'Severa'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </>
  );
}
