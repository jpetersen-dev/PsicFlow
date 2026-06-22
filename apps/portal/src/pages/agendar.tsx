import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Clock, ArrowLeft, CheckCircle2, User, ChevronRight, AlertTriangle } from 'lucide-react';

export default function PatientPortalBooking() {
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [specialists, setSpecialists] = useState<any[]>([]);
  
  // Selection states
  const [selectedSpecialist, setSelectedSpecialist] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  // UI States
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Result state
  const [reservationResult, setReservationResult] = useState<any>(null);

  // Fetch patient profile and specialists list
  useEffect(() => {
    const initBooking = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        // Fetch patient info
        const { data: patData } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', session.user.id)
          .limit(1)
          .single();

        if (patData) {
          setPatient(patData);

          // Fetch specialists using our public API
          const res = await fetch(`/api/v1/booking/specialists?organization_id=${patData.organization_id}`);
          const data = await res.json();
          if (res.ok && data.success) {
            setSpecialists(data.specialists);
            if (data.specialists.length > 0) {
              setSelectedSpecialist(data.specialists[0]);
            }
          }
        }
      } catch (err) {
        console.error('Error loading booking data:', err);
      } finally {
        setLoading(false);
      }
    };

    initBooking();
  }, []);

  // Fetch slots whenever specialist or date changes
  useEffect(() => {
    if (!selectedSpecialist || !selectedDate || !patient) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setAvailableSlots([]);
      setSelectedSlot('');
      setError('');

      try {
        const res = await fetch(
          `/api/v1/booking/availability?organization_id=${patient.organization_id}&specialist_id=${selectedSpecialist.id}&date=${selectedDate}`
        );
        const data = await res.json();

        if (res.ok && data.success) {
          setAvailableSlots(data.available_slots || []);
        } else {
          setError(data.error || 'Error al cargar horarios disponibles.');
        }
      } catch (err) {
        console.error('Error fetching availability:', err);
        setError('Error de conexión al buscar disponibilidad.');
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedSpecialist, selectedDate, patient]);

  // Handle Reservation
  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpecialist || !selectedDate || !selectedSlot || !patient) {
      alert('Por favor selecciona especialista, fecha y hora.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Split patient name into first and last name
      const nameParts = patient.full_name.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Paciente';
      const lastName = nameParts.slice(1).join(' ') || 'Ficha';

      const payload = {
        organization_id: patient.organization_id,
        specialist_id: selectedSpecialist.id,
        date: selectedDate,
        start_time: selectedSlot,
        patient_data: {
          first_name: firstName,
          last_name: lastName,
          email: patient.email,
          phone: patient.phone || '',
        },
      };

      const res = await fetch('/api/v1/booking/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setReservationResult(data);
      } else {
        setError(data.error || 'Ocurrió un error al confirmar la reserva.');
      }
    } catch (err: any) {
      console.error('Error in reserve request:', err);
      setError('Error al procesar la reserva. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-12 gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-accent-primary border-t-transparent animate-spin"></div>
        <p className="text-sm text-text-secondary">Inicializando sistema de reservas...</p>
      </div>
    );
  }

  if (reservationResult) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-border-color rounded-3xl p-8 shadow-xl text-center space-y-6">
        <div className="inline-flex p-4 bg-green-50 text-green-600 rounded-full border border-green-100">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-text-primary font-display">¡Reserva Creada Exitosamente!</h2>
          <p className="text-sm text-text-secondary">Tu espacio terapéutico ha sido bloqueado preventivamente durante 15 minutos.</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-left space-y-4">
          <h3 className="font-bold text-yellow-800 text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Instrucciones de Pago Requeridas</span>
          </h3>
          <p className="text-xs text-yellow-800 leading-relaxed">
            Completa la transferencia bancaria en Wise indicando el siguiente código de referencia exacto en el concepto de la transferencia para que el sistema libere y confirme tu cita en Google Calendar de manera definitiva:
          </p>
          <div className="flex items-center justify-between bg-white px-4 py-3 border border-yellow-300 rounded-xl">
            <span className="font-mono font-bold text-sm text-yellow-900 tracking-wide">
              {reservationResult.transaction_id}
            </span>
            <Link 
              href="/sesiones" 
              className="text-xs font-bold text-accent-primary hover:text-accent-hover flex items-center gap-1"
            >
              <span>Ir a pagar / Simular pago</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="pt-4 flex gap-4">
          <Link
            href="/"
            className="flex-1 py-3 border border-border-color text-text-primary hover:bg-bg-secondary rounded-xl text-xs font-semibold text-center transition-all"
          >
            Ir a Inicio
          </Link>
          <Link
            href="/sesiones"
            className="flex-1 py-3 bg-accent-primary hover:bg-accent-hover text-white rounded-xl text-xs font-semibold text-center transition-all shadow-sm"
          >
            Ver mis citas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Agendar Cita - Sentido Migrante</title>
      </Head>

      <div className="space-y-6">
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:text-accent-hover transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Inicio</span>
        </Link>

        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display text-text-primary tracking-tight">Agendar Nueva Cita</h1>
          <p className="text-sm text-text-secondary">Selecciona tu terapeuta, elige un día y horario libre para agendar tu consulta.</p>
        </div>

        <form onSubmit={handleReserve} className="grid grid-cols-12 gap-6">
          {/* Left Column: Form (8/12) */}
          <div className="col-span-12 lg:col-span-8 bg-white border border-border-color rounded-2xl p-6 shadow-sm space-y-6">
            
            {/* Step 1: Specialist Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wide text-text-secondary">1. Selecciona tu Terapeuta</label>
              {specialists.length === 0 ? (
                <p className="text-sm text-text-muted">No hay terapeutas disponibles en este momento.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {specialists.map((spec) => {
                    const isSelected = selectedSpecialist?.id === spec.id;
                    return (
                      <div
                        key={spec.id}
                        onClick={() => setSelectedSpecialist(spec)}
                        className={`border-2 rounded-2xl p-4 flex gap-4 items-center cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-accent-primary bg-accent-primary/5' 
                            : 'border-border-color hover:border-accent-primary/20 bg-bg-secondary'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center font-bold text-lg border border-accent-primary/15">
                          {spec.logo_url ? (
                            <img src={spec.logo_url} alt="Photo" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            spec.full_name[0].toUpperCase()
                          )}
                        </div>
                        <div className="text-left space-y-0.5">
                          <h3 className="font-bold text-text-primary text-sm">{spec.full_name}</h3>
                          <p className="text-[11px] text-text-secondary leading-tight">{spec.specialization || 'Psicoterapeuta'}</p>
                          <p className="text-[9px] text-text-muted">{spec.timezone}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Date & Time Selection */}
            {selectedSpecialist && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border-color">
                {/* Date Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary block">2. Selecciona la Fecha</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-bg-secondary border border-border-color rounded-xl px-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none"
                  />
                </div>

                {/* Time Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-text-secondary block">3. Selecciona la Hora</label>
                  {!selectedDate ? (
                    <div className="h-10 flex items-center justify-center border border-dashed border-border-color rounded-xl text-xs text-text-muted bg-bg-secondary/40">
                      Selecciona una fecha primero
                    </div>
                  ) : loadingSlots ? (
                    <div className="h-10 flex items-center justify-center gap-2 border border-dashed border-border-color rounded-xl text-xs text-text-muted bg-bg-secondary/40 animate-pulse">
                      <Clock className="w-4 h-4 animate-spin text-accent-primary" />
                      <span>Buscando disponibilidad...</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="h-10 flex items-center justify-center border border-dashed border-border-color rounded-xl text-xs text-danger bg-danger/5">
                      No hay horarios disponibles para esta fecha
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto no-scrollbar border border-border-color rounded-xl p-2.5 bg-bg-secondary">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                              isSelected 
                                ? 'bg-accent-primary text-white border-accent-primary' 
                                : 'bg-white text-text-primary border-border-color hover:border-accent-primary'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Feedback */}
            {error && (
              <div className="bg-danger/10 border border-danger/25 p-4 rounded-xl flex items-start gap-3 text-xs text-danger mt-4">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            {selectedSpecialist && selectedDate && selectedSlot && (
              <div className="pt-6 border-t border-border-color text-right">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-accent-primary hover:bg-accent-hover text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>{submitting ? 'Confirmando...' : 'Confirmar Reserva de Cita'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Summary Card (4/12) */}
          <div className="col-span-12 lg:col-span-4 bg-bg-secondary border border-border-color rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary border-b border-border-color pb-2">
                Resumen de Reserva
              </h2>
              
              <div className="space-y-3.5 text-left">
                {selectedSpecialist ? (
                  <div className="space-y-1">
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Terapeuta</p>
                    <p className="font-bold text-text-primary text-xs">{selectedSpecialist.full_name}</p>
                    <p className="text-[10px] text-text-secondary">{selectedSpecialist.specialization}</p>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Ningún terapeuta seleccionado</p>
                )}

                {selectedDate && (
                  <div className="space-y-1 pt-2 border-t border-border-color/30">
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Fecha</p>
                    <p className="font-bold text-text-primary text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-accent-primary" />
                      {selectedDate}
                    </p>
                  </div>
                )}

                {selectedSlot && (
                  <div className="space-y-1 pt-2 border-t border-border-color/30">
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Horario</p>
                    <p className="font-bold text-text-primary text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-accent-primary" />
                      {selectedSlot} ({selectedSpecialist?.timezone || 'GMT-4'})
                    </p>
                  </div>
                )}

                <div className="space-y-1 pt-2 border-t border-border-color/30">
                  <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Paciente</p>
                  <p className="font-bold text-text-primary text-xs">{patient.full_name}</p>
                  <p className="text-[10px] text-text-secondary">{patient.email}</p>
                </div>
              </div>
            </div>

            <div className="bg-accent-primary/5 border border-accent-primary/10 rounded-xl p-4 text-[10px] text-text-secondary leading-relaxed">
              * El espacio reservado se mantendrá bloqueado durante 15 minutos en espera del pago. Pasado este tiempo se liberará automáticamente si no se ha recibido el webhook de Wise.
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
