'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { eventsAPI } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventDate: string;
  endDate?: string;
  location?: string;
  eventImageUrl?: string;
  eventLink?: string;
  isAnnouncement?: boolean;
  adminName?: string;
  departmentName?: string;
  departmentId?: string;
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function CalendarSection() {
  const UPCOMING_EVENTS_PER_PAGE = 5;
  const { theme } = useTheme();
  const d = theme === 'dark';
  const { user } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcomingSourceEvents, setUpcomingSourceEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    eventDate: '',
    endDate: '',
    location: '',
    eventLink: '',
    eventImageUrl: '',
    isAnnouncement: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [openMenuEventId, setOpenMenuEventId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState({
    title: '',
    description: '',
    eventDate: '',
    endDate: '',
    location: '',
    eventLink: '',
    eventImageUrl: '',
    isAnnouncement: false,
  });

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<CalendarEvent | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [upcomingPage, setUpcomingPage] = useState(1);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{ title: string; date: string; isEdit: boolean } | null>(null);

  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const minStartDateTimeLocal = useMemo(() => {
    const min = new Date(today);
    min.setDate(min.getDate() + 1);
    min.setHours(0, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${min.getFullYear()}-${pad(min.getMonth() + 1)}-${pad(min.getDate())}T00:00`;
  }, [today]);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const monthName = currentDate.toLocaleString('default', { month: 'long' }).toUpperCase();

  const loadEvents = useCallback(async () => {
    try {
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      const res = await eventsAPI.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        allDepartments: true,
      });
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  const loadUpcomingEvents = useCallback(async () => {
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 2);
      endDate.setHours(23, 59, 59, 999);

      const res = await eventsAPI.getEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        allDepartments: true,
      });

      setUpcomingSourceEvents(res.data);
    } catch (err) {
      console.error('Failed to load upcoming events', err);
      setUpcomingSourceEvents([]);
    }
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (openMenuEventId && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuEventId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openMenuEventId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadUpcomingEvents();
  }, [loadUpcomingEvents]);

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      days.push({ day, isCurrentMonth: false, date: new Date(currentYear, currentMonth - 1, day) });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(currentYear, currentMonth, i) });
    }

    // Next month leading days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(currentYear, currentMonth + 1, i) });
    }

    return days;
  }, [currentMonth, currentYear]);

  // Events map by date key
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(e => {
      const key = new Date(e.eventDate).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  // Upcoming events (today and future)
  const upcomingEvents = useMemo(() => {
    return upcomingSourceEvents
      .filter(e => new Date(e.eventDate) >= today)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [upcomingSourceEvents, today]);

  const announcementEvents = useMemo(() => {
    return upcomingEvents.filter((event) => !!event.isAnnouncement);
  }, [upcomingEvents]);

  const totalUpcomingPages = Math.max(1, Math.ceil(upcomingEvents.length / UPCOMING_EVENTS_PER_PAGE));

  const pagedUpcomingEvents = useMemo(() => {
    const startIndex = (upcomingPage - 1) * UPCOMING_EVENTS_PER_PAGE;
    return upcomingEvents.slice(startIndex, startIndex + UPCOMING_EVENTS_PER_PAGE);
  }, [upcomingEvents, upcomingPage]);

  useEffect(() => {
    setUpcomingPage((prev) => Math.min(prev, totalUpcomingPages));
  }, [totalUpcomingPages]);

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.eventDate) return;

    if (newEvent.eventLink && !/^https?:\/\//i.test(newEvent.eventLink)) {
      alert('Event link must start with http:// or https://');
      return;
    }

    setSubmitting(true);
    try {
      await eventsAPI.createEvent({
        title: newEvent.title,
        eventDate: newEvent.eventDate,
        description: newEvent.description || undefined,
        endDate: newEvent.endDate || undefined,
        location: newEvent.location || undefined,
        eventLink: newEvent.eventLink || undefined,
        eventImageUrl: newEvent.eventImageUrl || undefined,
        isAnnouncement: newEvent.isAnnouncement,
      });
      setShowAddModal(false);
      setNewEvent({
        title: '',
        description: '',
        eventDate: '',
        endDate: '',
        location: '',
        eventLink: '',
        eventImageUrl: '',
        isAnnouncement: false,
      });
      setConfirmModalData({ title: newEvent.title, date: newEvent.eventDate, isEdit: false });
      setShowConfirmModal(true);
      loadEvents();
      loadUpcomingEvents();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const toInputDateTime = (value?: string) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const openEdit = (event: CalendarEvent) => {
    setOpenMenuEventId(null);
    setEditEventId(event.id);
    setEditEvent({
      title: event.title || '',
      description: event.description || '',
      eventDate: toInputDateTime(event.eventDate),
      endDate: toInputDateTime(event.endDate),
      location: event.location || '',
      eventLink: event.eventLink || '',
      eventImageUrl: event.eventImageUrl || '',
      isAnnouncement: !!event.isAnnouncement,
    });
    setShowEditModal(true);
  };

  const handleUpdateEvent = async () => {
    if (!editEventId || !editEvent.title || !editEvent.eventDate) return;

    if (editEvent.eventLink && !/^https?:\/\//i.test(editEvent.eventLink)) {
      alert('Event link must start with http:// or https://');
      return;
    }

    const id = editEventId;
    setSubmitting(true);
    try {
      const payload = {
        ...editEvent,
        endDate: editEvent.endDate || undefined,
        description: editEvent.description || undefined,
        location: editEvent.location || undefined,
        eventLink: editEvent.eventLink || undefined,
        eventImageUrl: editEvent.eventImageUrl || undefined,
        isAnnouncement: editEvent.isAnnouncement,
      };
      const res = await eventsAPI.updateEvent(id, payload);
      const updated: CalendarEvent = res.data;

      setEvents(prev => prev.map(e => (e.id === updated.id ? { ...e, ...updated } : e)));

      if (updated.eventDate) {
        const dt = new Date(updated.eventDate);
        if (!Number.isNaN(dt.getTime())) {
          setCurrentDate(new Date(dt.getFullYear(), dt.getMonth(), 1));
        }
      }

      loadUpcomingEvents();

      setShowEditModal(false);
      setEditEventId(null);
      setConfirmModalData({ title: editEvent.title, date: editEvent.eventDate, isEdit: true });
      setShowConfirmModal(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update event');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (event: CalendarEvent) => {
    setOpenMenuEventId(null);
    setDeleteTarget(event);
    setDeleteStep(1);
    setDeleteTyped('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (submitting) return;
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteStep(1);
    setDeleteTyped('');
  };

  const continueDelete = () => {
    setDeleteStep(2);
    setDeleteTyped('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTyped.trim().toUpperCase() !== 'DELETE') return;
    setSubmitting(true);
    try {
      await eventsAPI.deleteEvent(deleteTarget.id);
      closeDeleteModal();
      loadEvents();
      loadUpcomingEvents();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete event');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = (event: CalendarEvent) => {
    setDetailsEvent(event);
    setShowDetailsModal(true);
  };

  const isToday = (date: Date) => date.toDateString() === today.toDateString();
  const hasEvents = (date: Date) => eventsByDate.has(date.toDateString());

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
      {/* School Calendar Card */}
          <div className={`rounded-2xl p-5 ${d ? 'bg-gradient-to-br from-orange-900/30 to-orange-800/20 border border-orange-500/20' : 'bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200'} transition-colors duration-300`}>
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className={`p-1.5 rounded-lg transition-colors ${d ? 'hover:bg-white/10 text-orange-400' : 'hover:bg-orange-200 text-orange-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className={`text-sm font-bold uppercase tracking-widest ${d ? 'text-orange-400' : 'text-orange-700'}`}>
                School Calendar
          </h3>
          <button onClick={nextMonth} className={`p-1.5 rounded-lg transition-colors ${d ? 'hover:bg-white/10 text-orange-400' : 'hover:bg-orange-200 text-orange-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Month / Year */}
        <div className="text-center mb-4">
              <p className={`text-2xl font-extrabold tracking-wide ${d ? 'text-white' : 'text-gray-900'}`}>{monthName}</p>
          <p className={`text-lg font-semibold ${d ? 'text-orange-400' : 'text-orange-600'}`}>{currentYear}</p>
        </div>

        {/* Add Event + Time */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md"
          >
            Add Event
          </button>
          <span className={`text-xs font-mono ${d ? 'text-orange-300/60' : 'text-orange-600/60'}`}>{timeStr} PHT</span>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className={`text-center text-xs font-bold py-1 ${d ? 'text-orange-400/70' : 'text-orange-600/70'}`}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((item, i) => {
            const dayEvents = eventsByDate.get(item.date.toDateString()) || [];
            const showDot = dayEvents.length > 0 && !isToday(item.date);
            return (
              <div
                key={i}
                className={`relative group/day flex items-center justify-center h-8 rounded-full text-xs font-medium transition-all
                  ${!item.isCurrentMonth
                    ? d ? 'text-gray-600' : 'text-gray-300'
                    : isToday(item.date)
                      ? 'bg-orange-500 text-white font-bold shadow-lg shadow-orange-500/30 cursor-pointer'
                      : dayEvents.length > 0
                        ? d ? 'text-gray-200 hover:bg-white/10 cursor-pointer' : 'text-gray-700 hover:bg-orange-100 cursor-pointer'
                        : d ? 'text-gray-200' : 'text-gray-700'
                  }
                `}
              >
                {item.day}
                {showDot && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-orange-400" />
                )}
                {/* Hover tooltip for events */}
                {dayEvents.length > 0 && item.isCurrentMonth && (
                  <div className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-xl p-3 shadow-2xl opacity-0 invisible group-hover/day:opacity-100 group-hover/day:visible transition-all duration-200 pointer-events-none
                    ${d ? 'bg-slate-800/95 border border-orange-500/30' : 'bg-white border border-gray-200 shadow-xl'}
                  `}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${d ? 'text-orange-400' : 'text-orange-600'}`}>
                      {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div key={ev.id} className={`rounded-lg p-2 ${d ? 'bg-white/5' : 'bg-orange-50'}`}>
                          <p className={`text-xs font-semibold truncate ${d ? 'text-white' : 'text-gray-900'}`}>{ev.title}</p>
                          {ev.location && (
                            <p className={`text-[10px] mt-0.5 ${d ? 'text-gray-400' : 'text-gray-500'}`}>📍 {ev.location}</p>
                          )}
                          {ev.description && (
                            <p className={`text-[10px] mt-0.5 truncate ${d ? 'text-gray-500' : 'text-gray-400'}`}>{ev.description}</p>
                          )}
                          <p className={`text-[10px] mt-0.5 ${d ? 'text-orange-400/60' : 'text-orange-500/70'}`}>
                            {new Date(ev.eventDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </p>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className={`text-[10px] text-center ${d ? 'text-gray-500' : 'text-gray-400'}`}>+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                    {/* Tooltip arrow */}
                    <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${d ? 'bg-slate-800/95 border-r border-b border-orange-500/30' : 'bg-white border-r border-b border-gray-200'}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events Card */}
      <div className={`rounded-2xl border p-5 shadow-xl ${d ? 'border-orange-500/15 bg-zinc-900/35 shadow-zinc-900/20' : 'border-orange-200 bg-white shadow-orange-100/40'} transition-colors duration-300`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`text-sm font-bold uppercase tracking-widest ${d ? 'text-white' : 'text-zinc-900'}`}>
            Upcoming Events
          </h3>
          <span className={`text-xs font-medium ${d ? 'text-orange-300/80' : 'text-orange-700/80'}`}>📅</span>
        </div>
        <div className={`mb-4 border-t ${d ? 'border-orange-500/15' : 'border-orange-200'}`} />

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500/30 border-t-orange-500"></div>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <p className={`text-sm ${d ? 'text-zinc-400' : 'text-zinc-600'}`}>No upcoming events.</p>
        ) : (
          <>
          <div className="relative pl-8 space-y-4">
            <div className={`absolute left-[11px] top-1 bottom-1 w-px ${d ? 'bg-orange-500/50' : 'bg-orange-300'}`} />
            {pagedUpcomingEvents.map((event) => {
              const eventDate = new Date(event.eventDate);
              const dateLabel = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const timeLabel = eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

              return (
                <article
                  key={event.id}
                  className="relative"
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetails(event)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openDetails(event);
                  }}
                >
                  <span className="absolute -left-8 top-1.5 h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.15)]" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold leading-5 ${d ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        {dateLabel} {event.title || 'Untitled Event'}
                      </p>
                      <p className={`mt-1 text-xs ${d ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {timeLabel}{event.location ? ` • ${event.location}` : ''}
                      </p>
                    </div>

                    {event.departmentId && user?.departmentId && event.departmentId === user.departmentId ? (
                      <div
                        className="relative"
                        ref={openMenuEventId === event.id ? menuRef : undefined}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenMenuEventId(prev => (prev === event.id ? null : event.id))}
                          className={`p-1.5 rounded-lg transition-colors ${d ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-orange-100'}`}
                          aria-label="Event actions"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {openMenuEventId === event.id && (
                          <div className={`absolute right-0 mt-2 w-36 rounded-xl overflow-hidden z-50 ${d ? 'bg-slate-800/95 border border-orange-500/20' : 'bg-white border border-gray-200 shadow-xl'}`}>
                            <button
                              type="button"
                              onClick={() => openEdit(event)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${d ? 'text-gray-200 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(event)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${d ? 'text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                              disabled={submitting}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6M14 11v6" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m-7 0h8m-8 0V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`p-1.5 rounded-lg ${d ? 'text-gray-600' : 'text-gray-400'}`}
                        title="You can only edit events from your department"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11h.01M17 16.5a4.5 4.5 0 00-9 0V18h9v-1.5z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {upcomingEvents.length > UPCOMING_EVENTS_PER_PAGE && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setUpcomingPage((prev) => Math.max(1, prev - 1))}
                disabled={upcomingPage === 1}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${upcomingPage === 1 ? 'opacity-50 cursor-not-allowed' : ''} ${d ? 'bg-zinc-900/60 border border-orange-500/20 text-orange-200 hover:bg-zinc-900/80' : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-50'}`}
              >
                Previous
              </button>

              <span className={`text-[11px] ${d ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Page {upcomingPage} of {totalUpcomingPages}
              </span>

              <button
                type="button"
                onClick={() => setUpcomingPage((prev) => Math.min(totalUpcomingPages, prev + 1))}
                disabled={upcomingPage === totalUpcomingPages}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${upcomingPage === totalUpcomingPages ? 'opacity-50 cursor-not-allowed' : ''} ${d ? 'bg-zinc-900/60 border border-orange-500/20 text-orange-200 hover:bg-zinc-900/80' : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-50'}`}
              >
                Next Page
              </button>
            </div>
          )}
          </>
        )}
      </div>

      </div>

      {/* Info Card (Vision/Mission style) */}
      <div className="space-y-4">
        <div className={`rounded-2xl p-5 ${d ? 'bg-gradient-to-br from-orange-600/20 to-orange-500/10 border border-orange-500/20' : 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg'} transition-colors duration-300`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-lg ${d ? '' : 'opacity-90'}`}>📢</span>
            <h3 className={`text-sm font-bold uppercase tracking-widest ${d ? 'text-orange-400' : 'text-white'}`}>
              Announcements
            </h3>
          </div>
          {announcementEvents.length === 0 ? (
            <p className={`text-xs leading-relaxed ${d ? 'text-gray-300' : 'text-white/90'}`}>
              No marked announcements yet. Toggle the announcement option when adding an event to show it here.
            </p>
          ) : (
            <div className="space-y-2">
              {(showAllAnnouncements ? announcementEvents : announcementEvents.slice(0, 3)).map((event) => (
                <article key={event.id} className={`rounded-lg p-2 ${d ? 'bg-white/5 border border-white/10' : 'bg-white/15 border border-white/30'}`}>
                  <p className={`text-xs font-semibold ${d ? 'text-white' : 'text-white'}`}>{event.title || 'Untitled Event'}</p>
                  <p className={`mt-0.5 text-[11px] ${d ? 'text-gray-300' : 'text-white/90'}`}>
                    {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {event.location ? ` • ${event.location}` : ''}
                  </p>
                  {event.description && (
                    <p className={`mt-1 text-[11px] line-clamp-2 ${d ? 'text-gray-400' : 'text-white/80'}`}>{event.description}</p>
                  )}
                </article>
              ))}
              {announcementEvents.length > 3 && (
                <button
                  onClick={() => setShowAllAnnouncements(p => !p)}
                  className={`w-full mt-1 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    d ? 'bg-white/10 text-orange-300 hover:bg-white/20' : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {showAllAnnouncements ? `Show Less ▲` : `See More (${announcementEvents.length - 3} more) ▼`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className={`rounded-2xl p-5 ${d ? 'bg-gradient-to-br from-amber-600/20 to-orange-500/10 border border-orange-500/20' : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg'} transition-colors duration-300`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-lg ${d ? '' : 'opacity-90'}`}>📋</span>
            <h3 className={`text-sm font-bold uppercase tracking-widest ${d ? 'text-orange-400' : 'text-white'}`}>
              Quick Stats
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`text-center rounded-lg p-2 ${d ? 'bg-white/5' : 'bg-white/20'}`}>
              <p className={`text-xl font-bold ${d ? 'text-white' : 'text-white'}`}>{events.length}</p>
              <p className={`text-[10px] uppercase ${d ? 'text-gray-400' : 'text-white/70'}`}>This Month</p>
            </div>
            <div className={`text-center rounded-lg p-2 ${d ? 'bg-white/5' : 'bg-white/20'}`}>
              <p className={`text-xl font-bold ${d ? 'text-white' : 'text-white'}`}>{upcomingEvents.length}</p>
              <p className={`text-[10px] uppercase ${d ? 'text-gray-400' : 'text-white/70'}`}>Upcoming</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm md:items-center" onClick={() => setShowAddModal(false)}>
          <div
            className={`my-auto w-full max-w-[24rem] rounded-2xl p-4 md:max-w-[26rem] md:p-5 max-h-[88vh] overflow-y-auto ${d ? 'bg-slate-800/95 border border-orange-500/20' : 'bg-white shadow-2xl'}`}
            onClick={e => e.stopPropagation()}
          >
            <h3 className={`text-lg font-bold mb-4 ${d ? 'text-white' : 'text-gray-900'}`}>Add New Event</h3>

            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  placeholder="Event title"
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm resize-none h-20 ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  placeholder="Event description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Start Date *</label>
                  <input
                    type="datetime-local"
                    value={newEvent.eventDate}
                    onChange={e => setNewEvent(p => ({ ...p, eventDate: e.target.value }))}
                    min={minStartDateTimeLocal}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>End Date</label>
                  <input
                    type="datetime-local"
                    value={newEvent.endDate}
                    onChange={e => setNewEvent(p => ({ ...p, endDate: e.target.value }))}
                    min={newEvent.eventDate || minStartDateTimeLocal}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={e => setNewEvent(p => ({ ...p, location: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  placeholder="Event location"
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Event Link (Optional)</label>
                <input
                  type="text"
                  inputMode="url"
                  value={newEvent.eventLink}
                  onChange={e => setNewEvent(p => ({ ...p, eventLink: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  placeholder="https://youtube.com/..."
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Type</label>
                <label className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'}`}>
                  <input
                    type="checkbox"
                    checked={newEvent.isAnnouncement}
                    onChange={e => setNewEvent(p => ({ ...p, isAnnouncement: e.target.checked }))}
                    className="accent-orange-500"
                  />
                  <span>Mark as announcement</span>
                </label>
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Event Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      alert('Please select a valid image file.');
                      return;
                    }
                    if (file.size > 3 * 1024 * 1024) {
                      alert('Image must be less than 3MB.');
                      return;
                    }
                    const dataUrl = await fileToDataUrl(file);
                    setNewEvent(p => ({ ...p, eventImageUrl: dataUrl }));
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 ${d ? 'bg-white/10 border border-white/20 text-white file:bg-orange-500 file:text-white' : 'bg-gray-50 border border-gray-300 text-gray-900 file:bg-orange-500 file:text-white'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                />
                {newEvent.eventImageUrl && (
                  <img src={newEvent.eventImageUrl} alt="Event preview" className="mt-2 w-full h-28 object-cover rounded-lg border border-orange-500/30" />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowAddModal(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${d ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                disabled={submitting || !newEvent.title || !newEvent.eventDate}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (2-step) */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeDeleteModal}>
          <div
            className={`w-full max-w-md rounded-2xl p-6 ${d ? 'bg-slate-800/95 border border-orange-500/20' : 'bg-white shadow-2xl border border-orange-200/60'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${d ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                <span className={d ? 'text-red-300' : 'text-red-600'}>🗑️</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-bold ${d ? 'text-white' : 'text-gray-900'}`}>Delete Event</h3>
                <p className={`text-sm mt-1 ${d ? 'text-gray-300' : 'text-gray-600'}`}>
                  {deleteStep === 1 ? 'This action cannot be undone.' : 'Type DELETE to confirm.'}
                </p>
              </div>
            </div>

            <div className={`mt-4 rounded-xl p-4 ${d ? 'bg-white/5 border border-white/10' : 'bg-orange-50/60 border border-orange-200/60'}`}>
              <p className={`text-sm font-semibold break-all overflow-hidden ${d ? 'text-white' : 'text-gray-900'}`}>{deleteTarget.title}</p>
              <p className={`text-xs mt-1 ${d ? 'text-gray-400' : 'text-gray-600'}`}>{new Date(deleteTarget.eventDate).toLocaleString()}</p>
            </div>

            {deleteStep === 2 && (
              <div className="mt-4">
                <label className={`block text-xs font-semibold mb-2 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Confirmation</label>
                <input
                  value={deleteTyped}
                  onChange={(e) => setDeleteTyped(e.target.value)}
                  placeholder="Type DELETE"
                  className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-white border border-orange-200 text-gray-900'}`}
                />
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={submitting}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  d
                    ? 'text-gray-200 hover:bg-white/10'
                    : 'text-gray-700 hover:bg-gray-100'
                } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Cancel
              </button>

              {deleteStep === 1 ? (
                <button
                  type="button"
                  onClick={continueDelete}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    d
                      ? 'bg-orange-500/20 border border-orange-500/30 text-orange-200 hover:bg-orange-500/30'
                      : 'bg-orange-500/15 border border-orange-300/60 text-orange-700 hover:bg-orange-500/20'
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={submitting || deleteTyped.trim().toUpperCase() !== 'DELETE'}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    submitting || deleteTyped.trim().toUpperCase() !== 'DELETE'
                      ? 'opacity-50 cursor-not-allowed bg-red-600/40 text-white'
                      : d
                        ? 'bg-red-500/20 border border-red-500/30 text-red-200 hover:bg-red-500/30'
                        : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowEditModal(false)}>
          <div
            className={`w-full max-w-md rounded-2xl p-6 ${d ? 'bg-slate-800/95 border border-orange-500/20' : 'bg-white shadow-2xl'}`}
            onClick={e => e.stopPropagation()}
          >
            <h3 className={`text-lg font-bold mb-4 ${d ? 'text-white' : 'text-gray-900'}`}>Edit Event</h3>

            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Title *</label>
                <input
                  type="text"
                  value={editEvent.title}
                  onChange={e => setEditEvent(p => ({ ...p, title: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Description</label>
                <textarea
                  value={editEvent.description}
                  onChange={e => setEditEvent(p => ({ ...p, description: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm resize-none h-20 ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Start Date *</label>
                  <input
                    type="datetime-local"
                    value={editEvent.eventDate}
                    onChange={e => setEditEvent(p => ({ ...p, eventDate: e.target.value }))}
                    min={minStartDateTimeLocal}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>End Date</label>
                  <input
                    type="datetime-local"
                    value={editEvent.endDate}
                    onChange={e => setEditEvent(p => ({ ...p, endDate: e.target.value }))}
                    min={editEvent.eventDate || minStartDateTimeLocal}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Location</label>
                <input
                  type="text"
                  value={editEvent.location}
                  onChange={e => setEditEvent(p => ({ ...p, location: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Event Link (Optional)</label>
                <input
                  type="text"
                  inputMode="url"
                  value={editEvent.eventLink}
                  onChange={e => setEditEvent(p => ({ ...p, eventLink: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  placeholder="https://youtube.com/..."
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Type</label>
                <label className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${d ? 'bg-white/10 border border-white/20 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'}`}>
                  <input
                    type="checkbox"
                    checked={editEvent.isAnnouncement}
                    onChange={e => setEditEvent(p => ({ ...p, isAnnouncement: e.target.checked }))}
                    className="accent-orange-500"
                  />
                  <span>Mark as announcement</span>
                </label>
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Event Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      alert('Please select a valid image file.');
                      return;
                    }
                    if (file.size > 3 * 1024 * 1024) {
                      alert('Image must be less than 3MB.');
                      return;
                    }
                    const dataUrl = await fileToDataUrl(file);
                    setEditEvent(p => ({ ...p, eventImageUrl: dataUrl }));
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 ${d ? 'bg-white/10 border border-white/20 text-white file:bg-orange-500 file:text-white' : 'bg-gray-50 border border-gray-300 text-gray-900 file:bg-orange-500 file:text-white'} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                />
                {editEvent.eventImageUrl && (
                  <img src={editEvent.eventImageUrl} alt="Event preview" className="mt-2 w-full h-28 object-cover rounded-lg border border-orange-500/30" />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowEditModal(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${d ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateEvent}
                disabled={submitting || !editEvent.title || !editEvent.eventDate}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showDetailsModal && detailsEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDetailsModal(false)}>
          <div
            className={`w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto ${d ? 'bg-slate-800/95 border border-orange-500/20' : 'bg-white shadow-2xl'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className={`text-xl font-bold break-all ${d ? 'text-white' : 'text-gray-900'}`}>{detailsEvent.title}</h3>
                <p className={`text-sm mt-1 ${d ? 'text-gray-300' : 'text-gray-600'}`}>
                  {new Date(detailsEvent.eventDate).toLocaleString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                  {detailsEvent.endDate
                    ? ` – ${new Date(detailsEvent.endDate).toLocaleString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className={`p-2 rounded-lg transition-colors ${d ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {detailsEvent.location && (
                <div className={`rounded-xl p-3 ${d ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className={`text-xs font-semibold ${d ? 'text-gray-300' : 'text-gray-700'}`}>Location</p>
                  <p className={`text-sm mt-0.5 break-words ${d ? 'text-white' : 'text-gray-900'}`}>📍 {detailsEvent.location}</p>
                </div>
              )}

              {(detailsEvent.departmentName || detailsEvent.adminName) && (
                <div className={`rounded-xl p-3 ${d ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {detailsEvent.departmentName && (
                      <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold ${d ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                        {detailsEvent.departmentName}
                      </span>
                    )}
                    {detailsEvent.adminName && (
                      <p className={`text-xs ${d ? 'text-gray-400' : 'text-gray-600'}`}>Created by {detailsEvent.adminName}</p>
                    )}
                  </div>
                </div>
              )}

              <div className={`rounded-xl p-3 ${d ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-xs font-semibold ${d ? 'text-gray-300' : 'text-gray-700'}`}>Description</p>
                <p className={`text-sm mt-0.5 whitespace-pre-wrap break-all ${d ? 'text-white' : 'text-gray-900'}`}>
                  {detailsEvent.description?.trim() ? detailsEvent.description : '—'}
                </p>
              </div>

              {detailsEvent.eventLink && (
                <div className={`rounded-xl p-3 ${d ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className={`text-xs font-semibold ${d ? 'text-gray-300' : 'text-gray-700'}`}>Event Link</p>
                  <a
                    href={detailsEvent.eventLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm mt-0.5 text-orange-500 hover:underline break-all"
                  >
                    {detailsEvent.eventLink}
                  </a>
                </div>
              )}

              {detailsEvent.eventImageUrl && (
                <div className={`rounded-xl p-3 ${d ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className={`text-xs font-semibold mb-2 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Event Image</p>
                  <img
                    src={detailsEvent.eventImageUrl}
                    alt={detailsEvent.title}
                    className="w-full max-h-72 object-cover rounded-lg border border-orange-500/20"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Success Confirmation Modal */}
      {showConfirmModal && confirmModalData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}>
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${d ? 'bg-slate-800/95 border border-orange-500/20' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Heading */}
            <h3 className={`text-center text-lg font-bold mb-1 ${d ? 'text-white' : 'text-gray-900'}`}>
              {confirmModalData.isEdit ? 'Event Updated!' : 'Event Created!'}
            </h3>
            <p className={`text-center text-sm mb-4 ${d ? 'text-gray-400' : 'text-gray-500'}`}>
              {confirmModalData.isEdit ? 'Your changes have been saved successfully.' : 'The event has been added to the calendar.'}
            </p>

            {/* Event summary */}
            <div className={`rounded-xl p-3 mb-5 ${d ? 'bg-white/5 border border-white/10' : 'bg-orange-50 border border-orange-100'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${d ? 'text-orange-400' : 'text-orange-600'}`}>
                {confirmModalData.isEdit ? 'Updated Event' : 'New Event'}
              </p>
              <p className={`text-sm font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>{confirmModalData.title}</p>
              {confirmModalData.date && (
                <p className={`text-xs mt-0.5 ${d ? 'text-gray-400' : 'text-gray-500'}`}>
                  {new Date(confirmModalData.date).toLocaleString('en-US', {
                    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </p>
              )}
            </div>

            <button
              onClick={() => setShowConfirmModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
