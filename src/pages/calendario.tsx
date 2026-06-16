import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  MapPin, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  Circle, 
  Paperclip, 
  Send, 
  Lightbulb,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { usePrivacyMode } from '../components/PrivacyModeProvider';
import { NewSessionModal } from '../components/NewSessionModal';

export default function Calendario() {
  const { maskName } = usePrivacyMode();
  
  // Calendar Navigation State
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 16)); // Initialize at June 2026 (matching system metadata)
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);

  // Reminders & Notes States (Local Storage persistent)
  const [reminders, setReminders] = useState<{ id: string; text: string; completed: boolean; due?: string }[]>([
    { id: '1', text: "Revisar evaluación clínica de Lucas", completed: false, due: '10:00' },
    { id: '2', text: "Redactar informe de alta de Sofía", completed: false, due: 'Final de sesión' },
    { id: '3', text: "Revisar bitácora de seguimiento clínico", completed: true, due: 'Completado 08:30' }
  ]);
  const [newReminderText, setNewReminderText] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQuickNotes(prev => prev + `\n[Archivo adjunto: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\n`);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, 
          date_session, 
          time_session, 
          modality, 
          status_session, 
          value_session, 
          status_payment,
          patient:patient_id (full_name)
        `);

      if (!error && data) {
        setSessions(data);
      }
    } catch (err) {
      console.error('Error fetching calendar sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all sessions from the database
  useEffect(() => {
    fetchSessions();
  }, []);

  // Load / save notes and reminders from localStorage
  useEffect(() => {
    const storedReminders = localStorage.getItem('mindcare-reminders');
    if (storedReminders) setReminders(JSON.parse(storedReminders));

    const storedNotes = localStorage.getItem('mindcare-quicknotes');
    if (storedNotes) setQuickNotes(storedNotes);
  }, []);

  const saveReminders = (newReminders: typeof reminders) => {
    setReminders(newReminders);
    localStorage.setItem('mindcare-reminders', JSON.stringify(newReminders));
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;
    const item = {
      id: Date.now().toString(),
      text: newReminderText,
      completed: false,
      due: 'Hoy'
    };
    const updated = [...reminders, item];
    saveReminders(updated);
    setNewReminderText('');
  };

  const handleToggleReminder = (id: string) => {
    const updated = reminders.map(r => r.id === id ? { ...r, completed: !r.completed } : r);
    saveReminders(updated);
  };

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('mindcare-quicknotes', quickNotes);
    alert('Nota rápida guardada localmente.');
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Navigate months
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar grid array
  const generateCalendarCells = () => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // Weekday of 1st day (0 = Sun, 1 = Mon)
    const totalDays = new Date(year, month + 1, 0).getDate(); // Total days in current month
    const prevMonthTotalDays = new Date(year, month, 0).getDate(); // Total days in previous month
    
    const cells = [];

    // 1. Padding from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        dayNum: prevMonthTotalDays - i,
        isCurrentMonth: false,
        dateString: `${month === 0 ? year - 1 : year}-${(month === 0 ? 12 : month).toString().padStart(2, '0')}-${(prevMonthTotalDays - i).toString().padStart(2, '0')}`
      });
    }

    // 2. Current month days
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        dayNum: i,
        isCurrentMonth: true,
        dateString: `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`
      });
    }

    // 3. Padding for next month to complete the row multiplier of 7
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      cells.push({
        dayNum: i,
        isCurrentMonth: false,
        dateString: `${month === 11 ? year + 1 : year}-${(month === 11 ? 1 : month + 2).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`
      });
    }

    return cells;
  };

  const calendarCells = generateCalendarCells();
  const sessionsThisMonth = sessions.filter(s => {
    const sDate = new Date(s.date_session);
    return sDate.getFullYear() === year && sDate.getMonth() === month;
  });

  // Color mapping based on modality & status
  const getSessionColorClass = (modality: string, status: string) => {
    if (status === 'Cancelada') {
      return 'bg-error-container/40 border-l-4 border-error text-on-error-container';
    }
    if (status === 'Reprogramada') {
      return 'bg-tertiary-fixed border-l-4 border-tertiary text-on-tertiary-fixed-variant';
    }
    // modality colors
    return modality === 'Online'
      ? 'bg-primary-container/25 border-l-4 border-primary text-primary'
      : 'bg-secondary-container/30 border-l-4 border-secondary text-on-secondary-container';
  };

  return (
    <>
      <Head>
        <title>MindCare Portal - Calendario de Sesiones</title>
      </Head>

      <main className="flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] gap-gutter -m-gutter bg-surface">
        {/* Left Side: Calendar Grid */}
        <div className="flex-1 p-gutter overflow-y-auto space-y-6">
          {/* Calendar Navigation Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                {monthNames[month]} {year}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Tienes {sessionsThisMonth.length} {sessionsThisMonth.length === 1 ? 'sesión agendada' : 'sesiones agendadas'} para este mes.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-surface-container-low p-1 rounded-xl">
                <button 
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-surface-container-lowest rounded-lg text-on-surface-variant hover:text-primary transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-label-md text-label-md px-2 text-on-surface">Navegar</span>
                <button 
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-surface-container-lowest rounded-lg text-on-surface-variant hover:text-primary transition-all cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => setIsNewSessionOpen(true)}
                className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md flex items-center gap-2 shadow-sm hover:bg-primary-container active:scale-95 transition-all cursor-pointer text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Sesión</span>
              </button>
            </div>
          </div>

          {/* Calendar Monthly Grid */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/20 overflow-hidden">
            {/* Weekdays Headers */}
            <div className="calendar-grid border-b border-outline-variant/10 bg-surface-container-low/50">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                <div key={day} className="py-3.5 text-center font-label-md text-label-md text-on-surface-variant font-semibold">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days Cells */}
            <div className="calendar-grid divide-x divide-y divide-outline-variant/10">
              {calendarCells.map((cell, idx) => {
                const daySessions = sessions.filter(s => s.date_session === cell.dateString);
                const isToday = new Date().toISOString().split('T')[0] === cell.dateString;

                return (
                  <div 
                    key={`${cell.dateString}-${idx}`}
                    className={`min-h-[120px] p-2 flex flex-col justify-between transition-colors ${
                      cell.isCurrentMonth 
                        ? 'bg-surface-container-lowest text-on-surface' 
                        : 'bg-surface-container-low/20 text-outline-variant'
                    } ${isToday ? 'ring-2 ring-inset ring-primary/45 bg-primary/5' : ''}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        isToday 
                          ? 'bg-primary text-on-primary font-bold' 
                          : cell.isCurrentMonth ? 'text-on-surface' : 'text-outline-variant/60'
                      }`}>
                        {cell.dayNum.toString().padStart(2, '0')}
                      </span>
                      {daySessions.length > 0 && (
                        <span className="text-[10px] text-primary font-bold">{daySessions.length} Cita(s)</span>
                      )}
                    </div>

                    <div className="space-y-1 flex-1 overflow-y-auto max-h-24 hide-scrollbar">
                      {daySessions.map((sess) => {
                        const patName = sess.patient?.full_name || 'Paciente';
                        return (
                          <Link 
                            key={sess.id}
                            href={`/sesiones/${sess.id}`}
                            className={`appointment-card block p-1.5 rounded text-[10px] leading-tight font-medium border-l-4 truncate ${getSessionColorClass(sess.modality, sess.status_session)}`}
                            title={`${sess.time_session.slice(0, 5)} - ${patName} (${sess.modality})`}
                          >
                            <span className="font-bold">{sess.time_session.slice(0, 5)}</span> {maskName(patName)}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-outline-variant/20 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-primary-container/30 border-l-4 border-primary"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Terapia Individual (Online)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-secondary-container/40 border-l-4 border-secondary"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Seguimiento (Presencial)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-error-container/40 border-l-4 border-error"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Urgente / Crisis (Cancelada)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-tertiary-fixed border-l-4 border-tertiary"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Reprogramada / Administrativa</span>
            </div>
          </div>
        </div>

        {/* Right Side: Reminders & Notes Panel */}
        <aside className="w-full lg:w-[320px] bg-surface-container-low border-l border-outline-variant/20 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
          {/* Daily Reminders */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">Tareas Diarias</h4>
              <Edit3 className="w-4 h-4 text-primary" />
            </div>

            <form onSubmit={handleAddReminder} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Nueva tarea..."
                value={newReminderText}
                onChange={(e) => setNewReminderText(e.target.value)}
                className="flex-1 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <button 
                type="submit"
                className="bg-primary text-on-primary p-1.5 rounded-lg hover:bg-primary-container cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {reminders.map((r) => (
                <div 
                  key={r.id} 
                  onClick={() => handleToggleReminder(r.id)}
                  className={`p-3 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 flex items-start gap-3 cursor-pointer hover:border-primary/20 transition-all ${
                    r.completed ? 'opacity-65' : ''
                  }`}
                >
                  <button className="shrink-0 mt-0.5 text-primary">
                    {r.completed ? (
                      <CheckCircle2 className="w-4 h-4 fill-primary text-on-primary" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>
                  <div className="overflow-hidden">
                    <p className={`font-label-md text-label-md text-on-surface truncate ${r.completed ? 'line-through text-outline' : ''}`}>
                      {r.text}
                    </p>
                    {r.due && (
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{r.due}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Notes */}
          <section className="space-y-4">
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold border-b border-outline-variant/20 pb-2">Notas Rápidas</h4>
            <form onSubmit={handleSaveNotes} className="relative group">
              <textarea 
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                className="w-full h-40 p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl font-body-sm text-body-sm focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-on-surface-variant/40 shadow-sm focus:outline-none" 
                placeholder="Apunta algo rápido para recordar..."
              ></textarea>
              <div className="absolute bottom-3 right-3 flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileAttach} 
                  className="hidden" 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-surface-container-high hover:bg-surface-container-highest p-2 rounded-full transition-colors text-on-surface-variant cursor-pointer"
                  title="Adjuntar archivo"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button type="submit" className="bg-primary text-on-primary p-2 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </section>

          {/* Insight of the Day */}
          <section className="mt-auto">
            <div className="bg-primary-container/20 p-4 rounded-2xl border border-primary/10 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary">
                <Lightbulb className="w-4 h-4" />
                <h5 className="font-label-md text-label-md font-bold uppercase tracking-wider">Reflexión del Día</h5>
              </div>
              <p className="text-[12px] italic text-on-primary-fixed-variant leading-relaxed">
                "La evolución terapéutica no es una línea recta, sino una espiral. A menudo volvemos a visitar los mismos temas, pero desde una perspectiva más alta."
              </p>
            </div>
          </section>
        </aside>
      </main>

      <NewSessionModal
        isOpen={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        onSuccess={fetchSessions}
      />
    </>
  );
}
