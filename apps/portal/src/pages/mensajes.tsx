import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, 
  MessageSquare, 
  Send, 
  User, 
  ShieldCheck, 
  Clock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function PatientMessages() {
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Selector states
  const [recipientType, setRecipientType] = useState<'therapist' | 'support'>('support');
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [content, setContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
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

        // Fetch sessions to see who their therapists are
        const { data: sessData } = await supabase
          .from('sessions')
          .select('*, professional:professional_id (id, full_name, specialization)')
          .eq('patient_id', patData.id);

        if (sessData) {
          setSessions(sessData);
          // Set default therapist if available
          const therapists = sessData
            .map(s => s.professional)
            .filter((v, i, a) => v && a.findIndex(t => t.id === v.id) === i);
          
          if (therapists.length > 0) {
            setSelectedTherapistId(therapists[0].id);
            setRecipientType('therapist'); // default to therapist if they have sessions
          }
        }

        // Fetch messages thread
        const res = await fetch(`/api/v1/booking/messages`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'x-tenant-id': patData.organization_id
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setMessages(data.messages || []);
        }
      }
    } catch (err) {
      console.error('Error fetching messaging data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Scroll to bottom whenever messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !patient) return;
    
    if (recipientType === 'therapist' && !selectedTherapistId) {
      alert('Por favor selecciona un terapeuta.');
      return;
    }

    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload: any = {
        recipientType,
        content: content.trim(),
        subject: recipientType === 'support' ? '[Consulta de Soporte Portal Paciente]' : '[Mensaje Clínico Portal Paciente]'
      };

      if (recipientType === 'therapist') {
        payload.professionalId = selectedTherapistId;
      }

      const res = await fetch('/api/v1/booking/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          'x-tenant-id': patient.organization_id
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setContent('');
        // Refresh local thread
        const updatedRes = await fetch(`/api/v1/booking/messages`, {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'x-tenant-id': patient.organization_id
          }
        });
        const updatedData = await updatedRes.json();
        if (updatedRes.ok && updatedData.success) {
          setMessages(updatedData.messages || []);
        }
      } else {
        alert(data.error || 'Error al enviar el mensaje.');
      }
    } catch (err: any) {
      alert('Error de conexión: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  // Get unique list of therapists from sessions
  const uniqueTherapists = sessions
    .map(s => s.professional)
    .filter((v, i, a) => v && a.findIndex(t => t.id === v.id) === i);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#516750] border-t-transparent animate-spin"></div>
        <p className="text-sm text-[#78716C]">Cargando canal de comunicación...</p>
      </div>
    );
  }

  // Filter messages in the current conversation thread
  const filteredMessages = messages.filter(msg => {
    if (recipientType === 'support') {
      return msg.recipient_type === 'support';
    } else {
      return msg.recipient_type === 'therapist' && msg.professional_id === selectedTherapistId;
    }
  });

  return (
    <>
      <Head>
        <title>Mensajería y Soporte - Sentido Migrante</title>
      </Head>

      <div className="space-y-6 pb-12">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#516750] hover:text-[#3f513e] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Inicio</span>
          </Link>
          <button 
            onClick={() => { setLoading(true); fetchConversations(); }}
            className="p-2 border border-[#E2DCD0] hover:bg-[#F9F7F3] rounded-xl transition-all text-[#78716C] cursor-pointer"
            title="Refrescar chat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-[#1C1917] tracking-tight">Canal de Contacto</h1>
          <p className="text-sm text-[#78716C]">Comunícate directamente con tu psicólogo o solicita ayuda al soporte de la clínica.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Sidebar / Configuration card (4/12) */}
          <aside className="col-span-12 lg:col-span-4 bg-white border border-[#E2DCD0] rounded-3xl p-6 shadow-sm space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C] border-b border-[#F2EFE8] pb-2">
                Destinatario del Mensaje
              </h3>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientType('support')}
                  className={`w-full p-3 text-left text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                    recipientType === 'support'
                      ? 'bg-[#DAEDDF] text-[#1A3020] border-[#516750]/20'
                      : 'bg-[#F9F7F3] text-[#78716C] border-[#E2DCD0] hover:bg-[#E2DCD0]/35'
                  }`}
                >
                  <p>Soporte y Administración</p>
                  <span className="text-[9px] font-normal opacity-90">Consultas de pago, técnicas y generales</span>
                </button>

                {uniqueTherapists.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRecipientType('therapist')}
                    className={`w-full p-3 text-left text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                      recipientType === 'therapist'
                        ? 'bg-[#DAEDDF] text-[#1A3020] border-[#516750]/20'
                        : 'bg-[#F9F7F3] text-[#78716C] border-[#E2DCD0] hover:bg-[#E2DCD0]/35'
                    }`}
                  >
                    <p>Mi Terapeuta Especialista</p>
                    <span className="text-[9px] font-normal opacity-90">Consultas clínicas sobre tu proceso</span>
                  </button>
                )}
              </div>
            </div>

            {recipientType === 'therapist' && uniqueTherapists.length > 0 && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <label className="text-[11px] font-bold text-[#78716C]">Selecciona Especialista</label>
                <select
                  value={selectedTherapistId}
                  onChange={(e) => setSelectedTherapistId(e.target.value)}
                  className="w-full p-2.5 bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl text-xs font-bold text-[#1C1917] focus:outline-none focus:border-[#516750] cursor-pointer"
                >
                  {uniqueTherapists.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.specialization || 'Psicoterapeuta'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-[#F9F7F3] border border-[#E2DCD0] p-4 rounded-2xl flex gap-3 text-[10px] text-[#78716C]">
              <ShieldCheck className="w-5 h-5 text-[#516750] shrink-0" />
              <span>
                Este canal está encriptado y resguarda tu privacidad clínica. Tu terapeuta leerá tus consultas antes de la sesión.
              </span>
            </div>
          </aside>

          {/* Chat Window (8/12) */}
          <section className="col-span-12 lg:col-span-8 bg-white border border-[#E2DCD0] rounded-3xl overflow-hidden shadow-sm flex flex-col h-[550px]">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-[#F2EFE8] bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#DAEDDF] flex items-center justify-center font-bold text-[#1A3020] text-sm">
                  {recipientType === 'support' ? 'S' : 'T'}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-[#1C1917]">
                    {recipientType === 'support' ? 'Soporte y Administración' : uniqueTherapists.find(t => t.id === selectedTherapistId)?.full_name || 'Mi Terapeuta'}
                  </h3>
                  <p className="text-[9px] text-[#78716C]">
                    {recipientType === 'support' ? 'Atención al Cliente' : 'Especialista Clínico'}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#FCFBF9] space-y-4">
              {filteredMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <MessageSquare className="w-8 h-8 text-[#E2DCD0] mx-auto" />
                  <p className="text-xs font-semibold text-[#78716C]">Comienza la conversación</p>
                  <p className="text-[10px] text-[#A8A29E] max-w-xs leading-relaxed">
                    Escribe tu consulta y nos pondremos en contacto contigo lo antes posible.
                  </p>
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isMe = msg.sender === 'patient';
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl p-4 text-xs space-y-1.5 shadow-sm border ${
                        isMe 
                          ? 'bg-[#516750] text-white border-[#516750]' 
                          : 'bg-white text-[#1C1917] border-[#E2DCD0]'
                      }`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center justify-between gap-4 text-[9px] opacity-75">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!isMe && (
                            <span className="font-bold">Especialista</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="border-t border-[#F2EFE8] p-4 bg-white flex gap-3">
              <input
                type="text"
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  recipientType === 'support' 
                    ? 'Escribe tu consulta para soporte administrativo...' 
                    : 'Escribe tu consulta clínica para tu terapeuta...'
                }
                className="flex-1 bg-[#F9F7F3] border border-[#E2DCD0] rounded-xl px-4 py-3 text-xs text-[#1C1917] focus:border-[#516750] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !content.trim()}
                className="bg-[#516750] hover:bg-[#3f513e] disabled:opacity-50 text-white p-3 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
              >
                {sending ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </section>

        </div>
      </div>
    </>
  );
}
