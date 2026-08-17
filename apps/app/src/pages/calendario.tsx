/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Edit3,
  CheckCircle2,
  Circle,
  Paperclip,
  Send,
  Lightbulb,
  X,
  Trash2,
  CalendarDays,
  Briefcase,
  CalendarClock,
  ExternalLink,
  RefreshCw,
  Mail,
  Phone,
  AlertTriangle,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { usePrivacyMode } from '../components/PrivacyModeProvider';
import { NewSessionModal } from '../components/NewSessionModal';

export default function Calendario() {
  const { maskName } = usePrivacyMode();

  // Navigation & View States
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 16)); // Initialize at June 2026 (matching system metadata)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 5, 16));
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');

  // Data States
  const [sessions, setSessions] = useState<any[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [personalEvents, setPersonalEvents] = useState<any[]>([]);

  const visibleSessions = sessions.filter(s => showPending || s.status_payment !== 'Pendiente');
  const [reminders, setReminders] = useState<{ id: string; text: string; completed: boolean; due?: string }[]>([]);
  const [quickNotes, setQuickNotes] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);

  // Loading & Modal States
  const [loading, setLoading] = useState(true);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Form States for Personal Event
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventType, setEventType] = useState('Reunión');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');

  // Form State for Task
  const [newReminderText, setNewReminderText] = useState('');

  // Event Details Modal state
  const [selectedEventData, setSelectedEventData] = useState<{ type: 'session' | 'personal'; data: any } | null>(null);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<'session' | 'personal' | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // FreeBusy / Availability states
  const [availabilityTimeline, setAvailabilityTimeline] = useState<any[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [availabilityCache, setAvailabilityCache] = useState<Record<string, any>>({});

  // For prefilled values when agendamiento occurs via slot click
  const [sessionDefaultDate, setSessionDefaultDate] = useState('');
  const [sessionDefaultTime, setSessionDefaultTime] = useState('');

  // Event selector modal states
  const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false);
  const [selectedSlotStart, setSelectedSlotStart] = useState('');
  const [selectedSlotEnd, setSelectedSlotEnd] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQuickNotes(prev => prev + `\n[Archivo adjunto: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\n`);
    }
  };

  // 1. Fetch functions declared first to avoid hoisting/access-before-declaration issues
  const fetchSessions = async () => {
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
          transaction_id,
          payment_type,
          comentarios_internos,
          google_event_id,
          patient:patient_id (full_name, email, phone),
          professional:professional_id (full_name),
          service:service_id (title)
        `);

      if (error) {
        console.error('Supabase error fetching sessions:', error);
      } else if (data) {
        setSessions(data);
      }
    } catch (err) {
      console.error('Error fetching calendar sessions:', err);
    }
  };

  const fetchPersonalEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('personal_events')
        .select('*')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (!error && data) {
        setPersonalEvents(data);
      }
    } catch (err) {
      console.error('Error fetching personal events:', err);
    }
  };

  const handleCalendarDelete = async () => {
    if (!deletingId || !deletingType) return;
    try {
      if (deletingType === 'session') {
        const sess = sessions.find(s => s.id === deletingId);
        if (sess && sess.google_event_id && tenantId) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await fetch('/api/google/sync-event', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                  'x-tenant-id': tenantId,
                },
                body: JSON.stringify({
                  type: 'session',
                  id: deletingId,
                  action: 'delete'
                }),
              });
            }
            console.log('UI: Google Calendar event deletion triggered successfully.');
          } catch (gErr: any) {
            console.error('Failed to trigger Google event deletion:', gErr);
          }
        }

        const { error: delErr } = await supabase
          .from('sessions')
          .delete()
          .eq('id', deletingId);

        if (delErr) throw delErr;

        setSessions(sessions.filter(s => s.id !== deletingId));
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && tenantId) {
          await fetch('/api/google/sync-event', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'x-tenant-id': tenantId,
            },
            body: JSON.stringify({
              type: 'event',
              id: deletingId,
              action: 'delete'
            }),
          }).catch((syncErr) => console.error('Error triggering event deletion sync:', syncErr));
        }

        const { error: delErr } = await supabase
          .from('personal_events')
          .delete()
          .eq('id', deletingId);

        if (delErr) throw delErr;

        setPersonalEvents(personalEvents.filter(e => e.id !== deletingId));
      }
    } catch (err: any) {
      console.error('Error deleting calendar item:', err);
      alert('Error al eliminar el elemento: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsDeleteConfirmOpen(false);
      setIsEventDetailOpen(false);
      setDeletingId(null);
      setDeletingType(null);
    }
  };

  const fetchTasks = async (profId: string) => {
    try {
      const { data, error } = await supabase
        .from('clinical_tasks')
        .select('*')
        .eq('profile_id', profId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setReminders(data.map((t: any) => ({
          id: t.id,
          text: t.text,
          completed: t.completed,
          due: t.due_info || ''
        })));
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const fetchQuickNotes = async (profId: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .select('*')
        .eq('profile_id', profId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setQuickNotes(data[0].content || '');
        setNoteId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching quick notes:', err);
    }
  };

  // Fetch active session and load profile & tenant info
  useEffect(() => {
    const loadUserContext = async () => {
      try {
        const activeTenant = localStorage.getItem('active-tenant-id');
        const { data: { session } } = await supabase.auth.getSession();

        if (activeTenant) {
          setTenantId(activeTenant);
        }

        if (session?.user?.id && activeTenant) {
          const { data: profData } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('organization_id', activeTenant)
            .limit(1)
            .single();

          if (profData) {
            setProfileId(profData.id);
            fetchTasks(profData.id);
            fetchQuickNotes(profData.id);
          }
        }
      } catch (err) {
        console.error('Error loading user context:', err);
      }
    };

    loadUserContext();
  }, []);

  const loadAllCalendarData = async () => {
    setLoading(true);
    await Promise.all([fetchSessions(), fetchPersonalEvents()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllCalendarData();
  }, []);

  // FreeBusy: Fetch availability when selectedDate changes
  const fetchAvailability = async (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // Check cache first
    if (availabilityCache[dateStr]) {
      const cached = availabilityCache[dateStr];
      setAvailabilityTimeline(cached.timeline);
      setGoogleConnected(cached.googleConnected);
      return;
    }

    setAvailabilityLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = localStorage.getItem('active-tenant-id');

      const res = await fetch('/api/google/freebusy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'x-tenant-id': tenantId || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: dateStr, dayStartHour: 8, dayEndHour: 20 }),
      });

      if (res.ok) {
        const data = await res.json();
        setAvailabilityTimeline(data.timeline || []);
        setGoogleConnected(data.googleConnected || false);
        // Cache the result
        setAvailabilityCache(prev => ({ ...prev, [dateStr]: { timeline: data.timeline, googleConnected: data.googleConnected } }));
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchAvailability(selectedDate);
    }
  }, [selectedDate]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim() || !tenantId || !profileId) return;
    try {
      const { data, error } = await supabase
        .from('clinical_tasks')
        .insert({
          organization_id: tenantId,
          profile_id: profileId,
          text: newReminderText,
          completed: false,
          due_info: 'Hoy'
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setReminders(prev => [...prev, {
          id: data.id,
          text: data.text,
          completed: data.completed,
          due: data.due_info || ''
        }]);
        setNewReminderText('');
      }
    } catch (err: any) {
      alert('Error al crear tarea: ' + err.message);
    }
  };

  const handleToggleReminder = async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    try {
      const { error } = await supabase
        .from('clinical_tasks')
        .update({ completed: !reminder.completed })
        .eq('id', id);

      if (error) throw error;
      setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r));
    } catch (err: any) {
      alert('Error al actualizar tarea: ' + err.message);
    }
  };

  const handleDeleteReminder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('¿Deseas eliminar esta tarea?')) return;
    try {
      const { error } = await supabase
        .from('clinical_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert('Error al eliminar tarea: ' + err.message);
    }
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !profileId) {
      alert('No se ha podido identificar la sesión del profesional.');
      return;
    }
    try {
      if (noteId) {
        const { error } = await supabase
          .from('quick_notes')
          .update({ content: quickNotes })
          .eq('id', noteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('quick_notes')
          .insert({
            organization_id: tenantId,
            profile_id: profileId,
            content: quickNotes
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setNoteId(data.id);
      }
      alert('Nota rápida guardada en la base de datos.');
    } catch (err: any) {
      alert('Error al guardar nota: ' + err.message);
    }
  };

  const handleCreatePersonalEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate || !eventStartTime || !eventEndTime || !tenantId) {
      alert('Por favor complete todos los campos requeridos.');
      return;
    }
    try {
      if (editingEventId) {
        const { error } = await supabase
          .from('personal_events')
          .update({
            title: eventTitle,
            description: eventDescription,
            event_type: eventType,
            event_date: eventDate,
            start_time: eventStartTime.slice(0, 5) + ':00',
            end_time: eventEndTime.slice(0, 5) + ':00'
          })
          .eq('id', editingEventId);

        if (error) throw error;

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          fetch('/api/google/sync-event', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'x-tenant-id': tenantId,
            },
            body: JSON.stringify({
              type: 'event',
              id: editingEventId,
              action: 'update'
            }),
          }).catch((syncErr) => console.error('Error triggering event sync:', syncErr));
        }

        alert('Actividad/Evento actualizado exitosamente.');
        setEditingEventId(null);
      } else {
        const { data: insertedData, error } = await supabase
          .from('personal_events')
          .insert({
            organization_id: tenantId,
            title: eventTitle,
            description: eventDescription,
            event_type: eventType,
            event_date: eventDate,
            start_time: eventStartTime + ':00',
            end_time: eventEndTime + ':00'
          })
          .select('id')
          .single();

        if (error) throw error;

        if (insertedData?.id) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            fetch('/api/google/sync-event', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'x-tenant-id': tenantId,
              },
              body: JSON.stringify({
                type: 'event',
                id: insertedData.id,
                action: 'create'
              }),
            }).catch((syncErr) => console.error('Error triggering event sync:', syncErr));
          }
        }

        alert('Actividad/Evento creado exitosamente.');
      }

      setEventTitle('');
      setEventDescription('');
      setIsNewEventOpen(false);
      fetchPersonalEvents();
    } catch (err: any) {
      alert('Error al procesar evento personal: ' + err.message);
    }
  };

  const handleDeletePersonalEvent = async (id: string) => {
    if (!confirm('¿Deseas eliminar este evento personal?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && tenantId) {
        await fetch('/api/google/sync-event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'x-tenant-id': tenantId,
          },
          body: JSON.stringify({
            type: 'event',
            id: id,
            action: 'delete'
          }),
        }).catch((syncErr) => console.error('Error triggering event deletion sync:', syncErr));
      }

      const { error } = await supabase
        .from('personal_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPersonalEvents(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      alert('Error al eliminar evento personal: ' + err.message);
    }
  };

  // Calendar Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Week navigation
  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() - 7);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() + 7);
    setCurrentDate(d);
  };

  // Day navigation
  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(selectedDate.getDate() - 1);
    setSelectedDate(d);
    setCurrentDate(d);
  };

  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(selectedDate.getDate() + 1);
    setSelectedDate(d);
    setCurrentDate(d);
  };

  // Generate calendar grid array for Month View
  const generateCalendarCells = () => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // Weekday of 1st day (0 = Sun, 1 = Mon)
    const totalDays = new Date(year, month + 1, 0).getDate(); // Total days in current month
    const prevMonthTotalDays = new Date(year, month, 0).getDate(); // Total days in previous month

    const cells = [];

    // 1. Padding from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const cellMonth = month === 0 ? 11 : month - 1;
      const cellYear = month === 0 ? year - 1 : year;
      const dayNum = prevMonthTotalDays - i;
      cells.push({
        dayNum,
        isCurrentMonth: false,
        dateString: `${cellYear}-${(cellMonth + 1).toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`
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

    // 3. Padding for next month
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const cellMonth = month === 11 ? 0 : month + 1;
      const cellYear = month === 11 ? year + 1 : year;
      cells.push({
        dayNum: i,
        isCurrentMonth: false,
        dateString: `${cellYear}-${(cellMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`
      });
    }

    return cells;
  };

  // Generate 7 days of the week containing currentDate
  const getDaysOfWeek = (date: Date) => {
    const currentDay = date.getDay(); // 0 (Sun) - 6 (Sat)
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - currentDay);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const calendarCells = generateCalendarCells();
  const weekDays = getDaysOfWeek(currentDate);

  const getSessionColorClass = (modality: string, status: string, statusPayment?: string) => {
    if (status === 'Cancelada') {
      return 'bg-error-container/40 border-l-4 border-error text-on-error-container';
    }
    if (status === 'Reprogramada') {
      return 'bg-tertiary-fixed border-l-4 border-tertiary text-on-tertiary-fixed-variant';
    }
    if (statusPayment === 'Pendiente') {
      return 'bg-surface-variant/40 border-l-4 border-outline-variant text-on-surface-variant border-dashed opacity-75';
    }
    return modality === 'Online'
      ? 'bg-primary-container/25 border-l-4 border-primary text-primary'
      : 'bg-secondary-container/30 border-l-4 border-secondary text-on-secondary-container';
  };

  const getEventColorClass = (type: string) => {
    switch (type) {
      case 'Supervisión':
        return 'bg-purple-100 text-purple-900 border-l-4 border-purple-500';
      case 'Descanso':
        return 'bg-green-100 text-green-900 border-l-4 border-green-500';
      case 'Reunión':
        return 'bg-amber-100 text-amber-900 border-l-4 border-amber-500';
      default:
        return 'bg-blue-100 text-blue-900 border-l-4 border-blue-500';
    }
  };

  // Format ISO Date to readable Spanish string
  const formatDateString = (date: Date) => {
    return date.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <>
      <Head>
        <title>PsicFlow Portal - Calendario Clínico</title>
      </Head>

      <main className="flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] gap-gutter -m-gutter bg-surface">
        {/* Left Side: Calendar View Grid */}
        <div className="flex-1 p-gutter overflow-y-auto space-y-6">

          {/* Header & Navigation Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold capitalize">
                {calendarView === 'day'
                  ? formatDateString(selectedDate)
                  : `${monthNames[month]} ${year}`}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Calendario clínico y personal integrado.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Toggle Reservas Pendientes */}
              <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant cursor-pointer bg-surface-container-low border border-outline-variant/20 rounded-xl px-3 py-2">
                <input
                  type="checkbox"
                  checked={showPending}
                  onChange={(e) => setShowPending(e.target.checked)}
                  className="rounded border-outline-variant/30 text-primary focus:ring-primary/20 cursor-pointer"
                />
                <span>Mostrar pre-reservas</span>
              </label>

              {/* View Switchers */}
              <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/20 text-xs font-semibold">
                {(['month', 'week', 'day'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => {
                      setCalendarView(view);
                      if (view === 'day') {
                        setSelectedDate(currentDate);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${calendarView === view
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container-lowest'
                      }`}
                  >
                    {view === 'month' ? 'Mes' : view === 'week' ? 'Semana' : 'Día'}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-xl">
                <button
                  onClick={
                    calendarView === 'month' ? prevMonth :
                      calendarView === 'week' ? prevWeek : prevDay
                  }
                  className="p-1.5 hover:bg-surface-container-lowest rounded-lg text-on-surface-variant hover:text-primary transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    setCurrentDate(today);
                    setSelectedDate(today);
                  }}
                  className="px-2.5 py-1 hover:bg-surface-container-lowest rounded-lg text-xs font-bold text-primary transition-all cursor-pointer"
                >
                  Hoy
                </button>
                <button
                  onClick={
                    calendarView === 'month' ? nextMonth :
                      calendarView === 'week' ? nextWeek : nextDay
                  }
                  className="p-1.5 hover:bg-surface-container-lowest rounded-lg text-on-surface-variant hover:text-primary transition-all cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>


            </div>
          </div>

          {/* LOADING STATE */}
          {loading ? (
            <div className="py-20 text-center text-on-surface-variant text-sm">Cargando agenda...</div>
          ) : (
            <>
              {/* MONTH VIEW */}
              {calendarView === 'month' && (
                <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.03)] border border-outline-variant/20 overflow-hidden">
                  <div className="calendar-grid border-b border-outline-variant/10 bg-surface-container-low/50">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                      <div key={day} className="py-3.5 text-center font-label-md text-label-md text-on-surface-variant font-semibold">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="calendar-grid divide-x divide-y divide-outline-variant/10">
                    {calendarCells.map((cell, idx) => {
                      const daySessions = visibleSessions.filter(s => s.date_session === cell.dateString);
                      const dayEvents = personalEvents.filter(e => e.event_date === cell.dateString);
                      const isToday = new Date().toISOString().split('T')[0] === cell.dateString;

                      return (
                        <div
                          key={`${cell.dateString}-${idx}`}
                          onClick={() => {
                            setSelectedDate(new Date(cell.dateString + 'T12:00:00'));
                            setCalendarView('day');
                          }}
                          className={`min-h-[120px] p-2 flex flex-col justify-between transition-colors cursor-pointer hover:bg-surface-container-lowest/80 ${cell.isCurrentMonth
                              ? 'bg-surface-container-lowest text-on-surface'
                              : 'bg-surface-container-low/20 text-outline-variant'
                            } ${isToday ? 'ring-2 ring-inset ring-primary/45 bg-primary/5' : ''}`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isToday
                                ? 'bg-primary text-on-primary font-bold'
                                : cell.isCurrentMonth ? 'text-on-surface' : 'text-outline-variant/60'
                              }`}>
                              {cell.dayNum.toString().padStart(2, '0')}
                            </span>
                            {(daySessions.length + dayEvents.length) > 0 && (
                              <span className="text-[9px] text-primary font-bold">
                                {daySessions.length + dayEvents.length} Act.
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 flex-1 overflow-y-auto max-h-24 hide-scrollbar">
                            {/* Render Sessions */}
                            {daySessions.map((sess) => {
                              const patName = sess.patient?.full_name || 'Paciente';
                              return (
                                <div
                                  key={sess.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEventData({ type: 'session', data: sess });
                                    setIsEventDetailOpen(true);
                                  }}
                                  className={`appointment-card block p-1 rounded text-[9px] leading-tight font-medium border-l-4 truncate cursor-pointer hover:scale-[1.02] transition-all ${getSessionColorClass(sess.modality, sess.status_session, sess.status_payment)}`}
                                  title={`Cita: ${sess.time_session.slice(0, 5)} - ${patName}`}
                                >
                                  <span className="font-bold">{sess.time_session.slice(0, 5)}</span> {maskName(patName)}
                                </div>
                              );
                            })}

                            {/* Render Personal Events */}
                            {dayEvents.map((evt) => (
                              <div
                                key={evt.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEventData({ type: 'personal', data: evt });
                                  setIsEventDetailOpen(true);
                                }}
                                className={`block p-1 rounded text-[9px] leading-tight font-medium border-l-4 truncate cursor-pointer hover:scale-[1.02] transition-all ${getEventColorClass(evt.event_type)}`}
                                title={`Evento: ${evt.start_time.slice(0, 5)} - ${evt.title}`}
                              >
                                <span className="font-bold">{evt.start_time.slice(0, 5)}</span> {evt.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* WEEK VIEW */}
              {calendarView === 'week' && (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  {weekDays.map((day, idx) => {
                    const dateStr = day.toISOString().split('T')[0];
                    const daySessions = visibleSessions.filter(s => s.date_session === dateStr);
                    const dayEvents = personalEvents.filter(e => e.event_date === dateStr);
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;
                    const dayName = day.toLocaleDateString('es-CL', { weekday: 'short' });

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedDate(day);
                          setCalendarView('day');
                        }}
                        className={`bg-surface-container-lowest p-4 rounded-2xl shadow-sm border flex flex-col min-h-[350px] transition-all cursor-pointer hover:border-primary/30 ${isToday
                            ? 'ring-2 ring-primary/40 border-primary/40 bg-primary/5'
                            : 'border-outline-variant/20'
                          }`}
                      >
                        <div className="border-b border-outline-variant/15 pb-2 mb-3 flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-on-surface-variant uppercase">{dayName}</p>
                            <p className="text-lg font-extrabold text-on-surface mt-0.5">{day.getDate()}</p>
                          </div>
                          {(daySessions.length + dayEvents.length) > 0 && (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {daySessions.length + dayEvents.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 flex-1 overflow-y-auto max-h-72 hide-scrollbar">
                          {daySessions.length === 0 && dayEvents.length === 0 ? (
                            <p className="text-[11px] text-outline-variant/80 italic text-center mt-10">Sin actividades</p>
                          ) : (
                            <>
                              {daySessions.map(sess => (
                                <div
                                  key={sess.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEventData({ type: 'session', data: sess });
                                    setIsEventDetailOpen(true);
                                  }}
                                  className={`block p-2 rounded-lg text-[10px] leading-snug font-semibold border-l-4 shadow-sm hover:scale-[1.02] transition-all cursor-pointer ${getSessionColorClass(sess.modality, sess.status_session, sess.status_payment)}`}
                                >
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-bold">{sess.time_session.slice(0, 5)} hrs</span>
                                    <span className="text-[8px] opacity-75">{sess.modality}</span>
                                  </div>
                                  <div className="truncate text-on-surface">{maskName(sess.patient?.full_name || 'Paciente')}</div>
                                </div>
                              ))}

                              {dayEvents.map(evt => (
                                <div
                                  key={evt.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEventData({ type: 'personal', data: evt });
                                    setIsEventDetailOpen(true);
                                  }}
                                  className={`p-2 rounded-lg text-[10px] leading-snug font-semibold border-l-4 shadow-sm cursor-pointer hover:scale-[1.02] transition-all ${getEventColorClass(evt.event_type)}`}
                                >
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-bold">{evt.start_time.slice(0, 5)} - {evt.end_time.slice(0, 5)}</span>
                                    <span className="text-[8px] opacity-75">{evt.event_type}</span>
                                  </div>
                                  <div className="text-on-surface font-bold truncate">{evt.title}</div>
                                  {evt.description && <div className="text-[9px] opacity-85 mt-0.5 truncate">{evt.description}</div>}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* DAY VIEW */}
              {calendarView === 'day' && (
                <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-outline-variant/15 pb-4">
                    <h4 className="text-lg font-bold text-on-surface flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-primary" />
                      <span>Agenda Diaria</span>
                    </h4>
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold font-mono">
                      {selectedDate.toISOString().split('T')[0]}
                    </span>
                  </div>

                  {(() => {
                    const selDateStr = selectedDate.toISOString().split('T')[0];
                    const daySessions = visibleSessions.filter(s => s.date_session === selDateStr);
                    const dayEvents = personalEvents.filter(e => e.event_date === selDateStr);

                    const sortedTimeline = [
                      ...daySessions.map(s => ({ type: 'session', time: s.time_session, data: s })),
                      ...dayEvents.map(e => ({ type: 'event', time: e.start_time, data: e }))
                    ].sort((a, b) => a.time.localeCompare(b.time));

                    if (sortedTimeline.length === 0) {
                      return (
                        <div className="py-20 text-center text-on-surface-variant flex flex-col items-center justify-center space-y-3">
                          <CalendarDays className="w-12 h-12 text-outline-variant/50" />
                          <p className="font-bold text-sm">No tienes eventos registrados para este día.</p>
                          <p className="text-xs text-on-surface-variant max-w-sm">Aprovecha este tiempo para avanzar en tus registros clínicos o tomar un respiro.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="relative border-l border-outline-variant/30 ml-4 pl-6 space-y-6">
                        {sortedTimeline.map((item, idx) => {
                          if (item.type === 'session') {
                            const sess = item.data;
                            const patName = sess.patient?.full_name || 'Paciente';
                            return (
                              <div key={`timeline-sess-${sess.id}-${idx}`} className="relative">
                                {/* Timeline Bullet */}
                                <span className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-surface bg-primary shadow-sm flex items-center justify-center"></span>

                                <div
                                  onClick={() => {
                                    setSelectedEventData({ type: 'session', data: sess });
                                    setIsEventDetailOpen(true);
                                  }}
                                  className={`bg-surface-container-low p-4 rounded-xl border transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4 cursor-pointer ${sess.status_payment === 'Pendiente'
                                      ? 'border-outline-variant/25 border-dashed bg-surface-variant/20 opacity-75 hover:bg-surface-variant/30'
                                      : 'border-outline-variant/15 hover:border-primary/30 shadow-sm hover:bg-surface-container'
                                    }`}
                                >
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-xs font-bold text-primary flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{sess.time_session.slice(0, 5)} hrs</span>
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sess.status_session === 'Completa' ? 'bg-success/10 text-success' :
                                          sess.status_session === 'Programada' ? 'bg-primary/10 text-primary' : 'bg-outline-variant/10 text-on-surface-variant'
                                        }`}>
                                        Cita {sess.status_session}
                                      </span>
                                      <span className="text-[10px] bg-secondary-container/45 text-on-secondary-container px-2 py-0.5 rounded-md font-medium">
                                        {sess.modality}
                                      </span>
                                    </div>
                                    <p className="text-sm font-bold text-on-surface">{maskName(patName)}</p>
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEventData({ type: 'session', data: sess });
                                      setIsEventDetailOpen(true);
                                    }}
                                    className="bg-primary text-on-primary hover:bg-primary-container px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all self-start sm:self-auto cursor-pointer"
                                  >
                                    <span>Ver Detalles</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          } else {
                            const evt = item.data;
                            return (
                              <div key={`timeline-evt-${evt.id}-${idx}`} className="relative">
                                {/* Timeline Bullet */}
                                <span className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-surface bg-purple-500 shadow-sm"></span>

                                <div
                                  onClick={() => {
                                    setSelectedEventData({ type: 'personal', data: evt });
                                    setIsEventDetailOpen(true);
                                  }}
                                  className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/15 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 cursor-pointer hover:border-purple-300 hover:bg-surface-container transition-all"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{evt.start_time.slice(0, 5)} - {evt.end_time.slice(0, 5)} hrs</span>
                                      </span>
                                      <span className="bg-purple-100 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                        {evt.event_type}
                                      </span>
                                    </div>
                                    <p className="text-sm font-bold text-on-surface">{evt.title}</p>
                                    {evt.description && <p className="text-xs text-on-surface-variant max-w-xl">{evt.description}</p>}
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEventData({ type: 'personal', data: evt });
                                      setIsEventDetailOpen(true);
                                    }}
                                    className="bg-purple-600 text-white hover:bg-purple-700 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all self-start sm:self-auto cursor-pointer"
                                  >
                                    <span>Ver Detalles</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-outline-variant/20 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-primary-container/30 border-l-4 border-primary"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Terapia (Online)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-secondary-container/40 border-l-4 border-secondary"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Seguimiento (Presencial)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-error-container/40 border-l-4 border-error"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Cancelada</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-tertiary-fixed border-l-4 border-tertiary"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Reprogramada / Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-purple-100 border-l-4 border-purple-500"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Eventos Personales</span>
            </div>
          </div>
        </div>

        {/* Right Side: Reminders & Notes Panel */}
        <aside className="w-full lg:w-[320px] bg-surface-container-low border-l border-outline-variant/20 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">

          {/* Availability Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                Disponibilidad
              </h4>
              <span className="text-[11px] text-on-surface-variant font-medium">
                {selectedDate.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            {availabilityLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-on-surface-variant">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs">Cargando disponibilidad...</span>
              </div>
            ) : availabilityTimeline.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {availabilityTimeline.map((block: any, idx: number) => {
                  const isAvailable = block.type === 'available';
                  const isGoogle = block.source === 'google';
                  const isPsicFlow = block.source === 'psicflow';

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${isAvailable
                          ? 'bg-green-50 border border-green-200/60'
                          : isGoogle
                            ? 'bg-orange-50 border border-orange-200/60'
                            : 'bg-blue-50 border border-blue-200/60'
                        }`}
                    >
                      {/* Time */}
                      <span className={`font-mono font-semibold shrink-0 ${isAvailable ? 'text-green-700' : isGoogle ? 'text-orange-700' : 'text-blue-700'
                        }`}>
                        {block.start}
                      </span>
                      <span className="text-on-surface-variant">—</span>
                      <span className={`font-mono font-semibold shrink-0 ${isAvailable ? 'text-green-700' : isGoogle ? 'text-orange-700' : 'text-blue-700'
                        }`}>
                        {block.end}
                      </span>

                      {/* Label */}
                      <span className={`truncate ${isAvailable ? 'text-green-600' : isGoogle ? 'text-orange-600' : 'text-blue-600'
                        }`}>
                        {isAvailable ? '✓ Disponible' : block.label}
                      </span>

                      {/* Plus button / Source badge */}
                      {isAvailable ? (
                        <button
                          onClick={() => {
                            setSelectedSlotStart(block.start);
                            setSelectedSlotEnd(block.end);
                            setIsSelectorModalOpen(true);
                          }}
                          className="ml-auto p-1 bg-green-200/40 hover:bg-green-200 text-green-700 rounded transition-colors cursor-pointer flex items-center justify-center"
                          title="Agendar en este horario"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      ) : isGoogle ? (
                        <span className="ml-auto px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[9px] font-bold shrink-0">
                          G
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-on-surface-variant">Sin datos de disponibilidad para este día.</p>
              </div>
            )}

            {/* Google Calendar connection hint */}
            {!googleConnected && (
              <a
                href="/perfil"
                className="flex items-center gap-2 px-3 py-2 bg-primary-container/15 border border-primary/10 rounded-lg text-[11px] text-primary hover:bg-primary-container/25 transition-colors group"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>Conecta Google Calendar para ver toda tu disponibilidad</span>
              </a>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[10px] text-on-surface-variant">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                Disponible
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                PsicFlow
              </div>
              {googleConnected && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  Google
                </div>
              )}
            </div>
          </section>

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
                className="flex-1 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs focus:ring-1 focus:ring-primary focus:outline-none text-on-surface"
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
                  className={`p-3 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 flex items-start justify-between gap-3 cursor-pointer hover:border-primary/20 transition-all group ${r.completed ? 'opacity-65' : ''
                    }`}
                >
                  <div className="flex items-start gap-3 overflow-hidden">
                    <button className="shrink-0 mt-0.5 text-primary">
                      {r.completed ? (
                        <CheckCircle2 className="w-4 h-4 fill-primary text-on-primary" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <div className="overflow-hidden">
                      <p className={`font-label-md text-label-md text-on-surface break-words ${r.completed ? 'line-through text-outline' : ''}`}>
                        {r.text}
                      </p>
                      {r.due && (
                        <p className="text-[10px] text-on-surface-variant mt-0.5">{r.due}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteReminder(e, r.id)}
                    className="text-on-surface-variant hover:text-danger p-1 hover:bg-surface-container rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar tarea"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                className="w-full h-40 p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl font-body-sm text-body-sm focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-on-surface-variant/40 shadow-sm focus:outline-none text-on-surface"
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
                &quot;La evolución terapéutica no es una línea recta, sino una espiral. A menudo volvemos a visitar los mismos temas, pero desde una perspectiva más alta.&quot;
              </p>
            </div>
          </section>
        </aside>
      </main>

      {/* MODAL: NUEVA CITA CLINICA */}
      <NewSessionModal
        isOpen={isNewSessionOpen}
        onClose={() => setIsNewSessionOpen(false)}
        onSuccess={loadAllCalendarData}
        defaultDate={sessionDefaultDate}
        defaultTime={sessionDefaultTime}
      />

      {/* MODAL: SELECCIONAR TIPO DE EVENTO */}
      {isSelectorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-sm w-full shadow-2xl border border-outline-variant/30 overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/15">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span>¿Qué deseas agendar?</span>
              </h3>
              <button
                onClick={() => setIsSelectorModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-on-surface-variant bg-surface-container-low p-3 rounded-xl border border-outline-variant/10 space-y-1">
              <p className="font-semibold text-on-surface">Horario seleccionado:</p>
              <p className="font-mono text-[11px] text-primary">
                {selectedDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p className="font-mono text-[11px] text-primary font-bold">
                {selectedSlotStart} — {selectedSlotEnd} hrs
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => {
                  setSessionDefaultDate(selectedDate.toISOString().split('T')[0]);
                  setSessionDefaultTime(selectedSlotStart);
                  setIsSelectorModalOpen(false);
                  setIsNewSessionOpen(true);
                }}
                className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-on-primary hover:bg-primary-container text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Agendar Cita Clínica</span>
              </button>

              <button
                onClick={() => {
                  setEventDate(selectedDate.toISOString().split('T')[0]);
                  setEventStartTime(selectedSlotStart);
                  setEventEndTime(selectedSlotEnd);
                  setEventTitle('');
                  setEventDescription('');
                  setIsSelectorModalOpen(false);
                  setIsNewEventOpen(true);
                }}
                className="flex items-center justify-center gap-2 w-full py-3 bg-secondary-container text-on-secondary-container hover:bg-surface-container-high border border-outline-variant/30 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Briefcase className="w-4 h-4" />
                <span>Agendar Evento Personal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA ACTIVIDAD / EVENTO PERSONAL */}
      {isNewEventOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full shadow-xl border border-outline-variant/30 overflow-hidden transform transition-all duration-300">
            <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                <span>Agendar Actividad o Evento</span>
              </h3>
              <button
                onClick={() => setIsNewEventOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePersonalEvent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase">Título del Evento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Almuerzo de equipo, Supervisión clínica..."
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 px-3 py-2 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Tipo de Actividad</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 px-3 py-2 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none text-on-surface"
                  >
                    <option value="Reunión">Reunión</option>
                    <option value="Supervisión">Supervisión</option>
                    <option value="Descanso">Descanso</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 px-3 py-2 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none text-on-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Hora Inicio *</label>
                  <input
                    type="time"
                    required
                    value={eventStartTime}
                    onChange={(e) => setEventStartTime(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 px-3 py-2 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none text-on-surface"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface-variant uppercase">Hora Fin *</label>
                  <input
                    type="time"
                    required
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 px-3 py-2 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none text-on-surface"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase">Descripción / Observación</label>
                <textarea
                  rows={3}
                  placeholder="Detalles opcionales..."
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 p-3 rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none text-on-surface resize-none"
                ></textarea>
              </div>

              <div className="pt-2 border-t border-outline-variant/15 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewEventOpen(false)}
                  className="px-4 py-2 border border-outline-variant/30 text-on-surface hover:bg-surface-container-low rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Guardar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLES DEL EVENTO (PREMIUM) */}
      {isEventDetailOpen && selectedEventData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-surface-container-lowest rounded-3xl max-w-lg w-full shadow-2xl border border-outline-variant/30 overflow-hidden transform transition-all duration-300 scale-100 flex flex-col">
            {/* Gradient accent line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-tertiary"></div>

            {/* Header */}
            <div className="p-6 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/40">
              <h3 className="text-base font-extrabold text-on-surface flex items-center gap-2.5">
                {selectedEventData.type === 'session' ? (
                  <>
                    <CalendarClock className="w-5.5 h-5.5 text-primary" />
                    <span>Detalles de la Cita Clínica</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-5.5 h-5.5 text-purple-600" />
                    <span>Detalles del Evento Personal</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsEventDetailOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 hover:bg-surface-variant/20 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[70vh]">
              {selectedEventData.type === 'session' ? (
                // Clinical Session Details
                (() => {
                  const sess = selectedEventData.data;
                  const patName = sess.patient?.full_name || 'Paciente';
                  const isPaid = sess.status_payment === 'Pagado';

                  return (
                    <div className="space-y-5">
                      {/* Patient Name Section */}
                      <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-base">
                          {patName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Paciente</p>
                          <p className="text-base font-extrabold text-on-surface">{maskName(patName)}</p>
                        </div>
                      </div>

                      {/* Date & Time Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/10 space-y-1">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Fecha de Sesión</p>
                          <p className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-primary" />
                            <span>{sess.date_session}</span>
                          </p>
                        </div>
                        <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/10 space-y-1">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Hora de Sesión</p>
                          <p className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            <span>{sess.time_session?.slice(0, 5)} hrs</span>
                          </p>
                        </div>
                      </div>

                      {/* Service associated */}
                      {sess.service?.title && (
                        <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/10 space-y-1">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Servicio de la Sesión</p>
                          <p className="text-sm font-extrabold text-on-surface">
                            {sess.service.title}
                          </p>
                        </div>
                      )}

                      {/* Session Metadata Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/10 space-y-1">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Modalidad</p>
                          <span className="inline-block text-xs bg-secondary-container/45 text-on-secondary-container px-2.5 py-1 rounded-md font-semibold mt-1">
                            {sess.modality}
                          </span>
                        </div>
                        <div className="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/10 space-y-1">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Estado de Pago</p>
                          <span className={`inline-block text-xs px-2.5 py-1 rounded-md font-semibold mt-1 ${isPaid ? 'bg-success/10 text-success' : 'bg-error-container/40 text-on-error-container border border-error/10'
                            }`}>
                            {sess.status_payment}
                          </span>
                        </div>
                      </div>

                      {/* Contact Info (CRM/Ficha) */}
                      <div className="border border-outline-variant/20 rounded-2xl p-4 space-y-3.5">
                        <p className="text-xs text-on-surface-variant font-extrabold uppercase tracking-wider">Datos de Contacto</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {sess.patient?.email ? (
                            <a
                              href={`mailto:${sess.patient.email}`}
                              className="flex items-center gap-2.5 text-xs text-on-surface hover:text-primary transition-colors bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/10 hover:border-primary/20"
                            >
                              <Mail className="w-4 h-4 text-primary" />
                              <span className="truncate">{sess.patient.email}</span>
                            </a>
                          ) : (
                            <div className="flex items-center gap-2.5 text-xs text-on-surface-variant bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/10">
                              <Mail className="w-4 h-4 opacity-50" />
                              <span>Sin correo</span>
                            </div>
                          )}
                          {sess.patient?.phone ? (
                            <a
                              href={`tel:${sess.patient.phone}`}
                              className="flex items-center gap-2.5 text-xs text-on-surface hover:text-primary transition-colors bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/10 hover:border-primary/20"
                            >
                              <Phone className="w-4 h-4 text-primary" />
                              <span>{sess.patient.phone}</span>
                            </a>
                          ) : (
                            <div className="flex items-center gap-2.5 text-xs text-on-surface-variant bg-surface-container-low px-3 py-2 rounded-xl border border-outline-variant/10">
                              <Phone className="w-4 h-4 opacity-50" />
                              <span>Sin teléfono</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Comments / Video Call Link */}
                      {sess.comentarios_internos && (
                        <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 space-y-2">
                          <p className="text-xs text-on-surface-variant font-extrabold uppercase tracking-wider">Notas e Información Adicional</p>
                          <div className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
                            {sess.comentarios_internos.includes('Google Meet') ? (
                              <div className="space-y-3">
                                <p>{sess.comentarios_internos}</p>
                                {(() => {
                                  const meetUrl = sess.comentarios_internos.match(/https:\/\/meet\.google\.com\/[a-z-]+/i)?.[0];
                                  if (meetUrl) {
                                    return (
                                      <a
                                        href={meetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1A3020] text-white hover:bg-[#25442E] rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Entrar a Videollamada</span>
                                      </a>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              sess.comentarios_internos
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                // Personal Event Details
                (() => {
                  const evt = selectedEventData.data;
                  return (
                    <div className="space-y-5">
                      <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center font-black text-purple-600 text-base">
                          {evt.event_type.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs text-purple-700 font-bold uppercase tracking-wider">Tipo: {evt.event_type}</p>
                          <p className="text-base font-extrabold text-purple-950">{evt.title}</p>
                        </div>
                      </div>

                      {/* Date & Time Grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/10 space-y-1">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Fecha</p>
                          <p className="text-xs font-bold text-on-surface">{evt.event_date}</p>
                        </div>
                        <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/10 space-y-1">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Hora Inicio</p>
                          <p className="text-xs font-bold text-on-surface">{evt.start_time?.slice(0, 5)} hrs</p>
                        </div>
                        <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/10 space-y-1">
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Hora Fin</p>
                          <p className="text-xs font-bold text-on-surface">{evt.end_time?.slice(0, 5)} hrs</p>
                        </div>
                      </div>

                      {/* Description */}
                      {evt.description && (
                        <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 space-y-2">
                          <p className="text-xs text-on-surface-variant font-extrabold uppercase tracking-wider">Descripción del Evento</p>
                          <p className="text-xs text-on-surface leading-relaxed">{evt.description}</p>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Actions Footer */}
            <div className="p-6 border-t border-outline-variant/15 bg-surface-container-low/40 flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingId(selectedEventData.data.id);
                  setDeletingType(selectedEventData.type);
                  setIsDeleteConfirmOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4.5 py-2.5 border border-error/30 text-error hover:bg-error/5 hover:border-error rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar</span>
              </button>

              <div className="flex items-center gap-3">
                {selectedEventData.type === 'session' ? (
                  <Link
                    href={`/sesiones/${selectedEventData.data.id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Ir a Nota SOAP</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const evt = selectedEventData.data;
                      setEditingEventId(evt.id);
                      setEventTitle(evt.title);
                      setEventDescription(evt.description || '');
                      setEventType(evt.event_type);
                      setEventDate(evt.event_date);
                      setEventStartTime(evt.start_time?.slice(0, 5) || '09:00');
                      setEventEndTime(evt.end_time?.slice(0, 5) || '10:00');
                      setIsEventDetailOpen(false);
                      setIsNewEventOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Editar Evento</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsEventDetailOpen(false)}
                  className="px-4.5 py-2.5 border border-outline-variant/30 text-on-surface hover:bg-surface-container-low rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl max-w-sm w-full shadow-2xl border border-outline-variant/30 overflow-hidden transform transition-all p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-error-container/30 flex items-center justify-center border border-error/25">
                <AlertTriangle className="w-6 h-6 text-error" />
              </div>
              <h3 className="text-base font-extrabold text-on-surface">
                ¿Eliminar {deletingType === 'session' ? 'Cita Clínica' : 'Evento Personal'}?
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Esta acción no se puede deshacer. Se eliminará de la base de datos de PsicFlow y, si corresponde, se cancelará/sincronizará la eliminación en Google Calendar.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setDeletingId(null);
                  setDeletingType(null);
                }}
                className="w-full py-2.5 border border-outline-variant/30 text-on-surface hover:bg-surface-container-low rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCalendarDelete}
                className="w-full py-2.5 bg-error text-on-error hover:bg-error-container rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
