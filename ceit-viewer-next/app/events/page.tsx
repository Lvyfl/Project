'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

type ThemeMode = 'dark' | 'light';

type CalendarEvent = {
  id: string;
  eventDate: string;
  endDate?: string | null;
  title?: string;
  description?: string;
  location?: string;
  eventLink?: string;
  departmentName?: string;
  isAnnouncement?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function EventsPage() {
  const EVENTS_PER_PAGE = 5;
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const d = theme === 'dark';
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [upcomingSourceEvents, setUpcomingSourceEvents] = useState<CalendarEvent[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [isNavigatingModule, setIsNavigatingModule] = useState(false);
  const [highlightedPage, setHighlightedPage] = useState(1);

  const startModuleNavigation = () => {
    setIsNavigatingModule(true);
  };

  useEffect(() => {
    const stored = localStorage.getItem('theme') as ThemeMode | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme: ThemeMode = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.classList.toggle('light', initialTheme === 'light');
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('light', next === 'light');
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  const loadEventsForMonth = useCallback(async () => {
    try {
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const response = await fetch(`${API_BASE}/events/public?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load events');

      const data = (await response.json()) as CalendarEvent[];
      setMonthEvents(data);
    } catch {
      setMonthEvents([]);
    }
  }, [currentMonth]);

  const loadUpcomingEvents = useCallback(async () => {
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 2);
      endDate.setHours(23, 59, 59, 999);

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const response = await fetch(`${API_BASE}/events/public?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load upcoming events');

      const data = (await response.json()) as CalendarEvent[];
      setUpcomingSourceEvents(data);
    } catch {
      setUpcomingSourceEvents([]);
    }
  }, []);

  useEffect(() => {
    loadEventsForMonth();
  }, [loadEventsForMonth]);

  useEffect(() => {
    loadUpcomingEvents();
  }, [loadUpcomingEvents]);

  useEffect(() => {
    const id = setInterval(() => {
      loadEventsForMonth();
    }, 10000);
    return () => clearInterval(id);
  }, [loadEventsForMonth]);

  useEffect(() => {
    const id = setInterval(() => {
      loadUpcomingEvents();
    }, 10000);
    return () => clearInterval(id);
  }, [loadUpcomingEvents]);

  useEffect(() => {
    const firstEvent = monthEvents[0];
    if (!firstEvent) {
      setSelectedDateKey('');
      return;
    }
    const key = new Date(firstEvent.eventDate).toDateString();
    setSelectedDateKey((prev) => prev || key);
  }, [monthEvents]);

  useEffect(() => {
    setIsNavigatingModule(false);
  }, [pathname]);

  useEffect(() => {
    setHighlightedPage(1);
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, number>();
    monthEvents.forEach((ev) => {
      const key = new Date(ev.eventDate).toDateString();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [monthEvents]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDateKey) return [] as CalendarEvent[];
    return monthEvents
      .filter((ev) => new Date(ev.eventDate).toDateString() === selectedDateKey)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [monthEvents, selectedDateKey]);

  const highlightedEvents = useMemo(() => {
    return [...upcomingSourceEvents].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [upcomingSourceEvents]);

  const announcementEvents = useMemo(() => {
    return highlightedEvents.filter((event) => !!event.isAnnouncement).slice(0, 4);
  }, [highlightedEvents]);

  const totalHighlightedPages = Math.max(1, Math.ceil(highlightedEvents.length / EVENTS_PER_PAGE));

  const pagedHighlightedEvents = useMemo(() => {
    const startIndex = (highlightedPage - 1) * EVENTS_PER_PAGE;
    return highlightedEvents.slice(startIndex, startIndex + EVENTS_PER_PAGE);
  }, [highlightedEvents, highlightedPage]);

  const monthEventCards = useMemo(() => {
    return [...monthEvents].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [monthEvents]);

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedDateLabel = selectedDateKey
    ? new Date(selectedDateKey).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  useEffect(() => {
    setHighlightedPage((prev) => Math.min(prev, totalHighlightedPages));
  }, [totalHighlightedPages]);

  const formatEventTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className={`min-h-screen ${d ? 'bg-gradient-to-br from-black via-[#1a0a00] to-[#2d1400] text-zinc-200' : 'bg-gradient-to-br from-white via-orange-50 to-amber-50 text-zinc-900'}`}
      style={{ fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)" }}>
      
      {/* ── PAGE HEADER ── */}
      <PageHeader
        theme={theme}
        onThemeToggle={toggleTheme}
        onNavigate={startModuleNavigation}
        currentPage="events"
      />

      <main className="mx-auto w-full max-w-[1200px] p-5 lg:p-7">
        <section className={`rounded-2xl border p-5 shadow-xl ${d ? 'border-orange-500/15 bg-black/35 shadow-black/20' : 'border-orange-200 bg-white shadow-orange-100/40'}`}>
          <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <div className={`rounded-2xl border p-5 ${d ? 'border-orange-500/20 bg-black/30' : 'border-orange-200 bg-orange-50/30'}`}>
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className={`rounded p-1 ${d ? 'text-zinc-300 hover:text-orange-300' : 'text-zinc-600 hover:text-orange-700'}`}
                >
                  ‹
                </button>
                <div className={`text-sm font-semibold tracking-[0.18em] uppercase ${d ? 'text-orange-200/90' : 'text-orange-800'}`}>School Calendar</div>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className={`rounded p-1 ${d ? 'text-zinc-300 hover:text-orange-300' : 'text-zinc-600 hover:text-orange-700'}`}
                >
                  ›
                </button>
              </div>

              <div className="mb-5 text-center">
                <div className={`text-4xl font-bold tracking-wide ${d ? 'text-white' : 'text-zinc-900'}`}>{monthLabel.split(' ')[0]}</div>
                <div className={`mt-1 text-3xl font-semibold ${d ? 'text-orange-300' : 'text-orange-700'}`}>{monthLabel.split(' ')[1]}</div>
              </div>

              <div className={`grid grid-cols-7 gap-1 text-center text-xs font-semibold ${d ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayName, idx) => (
                  <div key={`${dayName}-${idx}`} className="py-2">{dayName}</div>
                ))}

                {Array.from({ length: startDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                  const key = date.toDateString();
                  const count = eventsByDate.get(key) || 0;
                  const isToday = key === new Date().toDateString();
                  const isSelected = key === selectedDateKey;

                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedDateKey(count > 0 ? key : '')}
                      key={day}
                      className={`min-h-11 rounded-full px-1 py-2 ${
                        isToday ? (d ? 'bg-orange-500/25 text-white' : 'bg-orange-200 text-zinc-900') : (d ? 'text-zinc-200 hover:bg-white/8' : 'text-zinc-700 hover:bg-orange-100/60')
                      } ${count > 0 ? (d ? 'ring-1 ring-orange-500/35 cursor-pointer' : 'ring-1 ring-orange-300 cursor-pointer') : 'cursor-default'} ${isSelected ? (d ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-orange-500 text-white ring-2 ring-orange-500') : ''}`}
                    >
                      <div className="text-sm font-semibold">{day}</div>
                      {count > 0 && !isSelected && <div className={`mt-1 text-[9px] ${d ? 'text-orange-300' : 'text-orange-700'}`}>•</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className={`rounded-2xl p-5 shadow-lg ${d ? 'bg-orange-600/90 text-white' : 'bg-orange-500 text-white'}`}>
                <h3 className="mb-3 text-2xl font-bold tracking-wide uppercase">📣 Announcements</h3>
                {announcementEvents.length === 0 ? (
                  <p className="text-sm leading-relaxed text-white/95">
                    No marked announcements yet. Mark an event as announcement from the Add/Edit Event form to show it here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {announcementEvents.map((event) => (
                      <article key={event.id} className="rounded-xl border border-white/30 bg-white/15 p-3">
                        <p className="text-sm font-semibold text-white">{event.title || 'Untitled Event'}</p>
                        <p className="mt-1 text-xs text-white/90">
                          {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {event.location ? ` • ${event.location}` : ''}
                        </p>
                        {event.description && (
                          <p className="mt-1 text-xs text-white/85 line-clamp-2">{event.description}</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className={`rounded-2xl p-5 shadow-lg ${d ? 'bg-orange-500/90 text-white' : 'bg-orange-500 text-white'}`}>
                <h3 className="mb-4 text-xl font-bold tracking-wide uppercase">📋 Quick Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/18 px-4 py-3 text-center">
                    <div className="text-3xl font-bold">{monthEventCards.length}</div>
                    <div className="text-xs font-semibold tracking-wide uppercase text-white/90">This Month</div>
                  </div>
                  <div className="rounded-xl bg-white/18 px-4 py-3 text-center">
                    <div className="text-3xl font-bold">{highlightedEvents.length}</div>
                    <div className="text-xs font-semibold tracking-wide uppercase text-white/90">Upcoming</div>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${d ? 'border-orange-500/20 bg-black/35' : 'border-orange-200 bg-white'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${d ? 'text-orange-200' : 'text-orange-800'}`}>Event Cards</h3>
                  <span className={`text-xs ${d ? 'text-zinc-400' : 'text-zinc-600'}`}>{monthEventCards.length} total</span>
                </div>

                {monthEventCards.length === 0 ? (
                  <div className={`rounded-xl border p-4 text-sm ${d ? 'border-orange-500/20 bg-black/30 text-zinc-400' : 'border-orange-200 bg-orange-50/60 text-zinc-600'}`}>
                    No events for {monthLabel}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {monthEventCards.slice(0, 6).map((ev) => {
                      const eventKey = new Date(ev.eventDate).toDateString();
                      const startTime = formatEventTime(ev.eventDate);
                      const endTime = formatEventTime(ev.endDate);
                      const eventDateLabel = new Date(ev.eventDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      });

                      return (
                        <button
                          type="button"
                          key={ev.id}
                          onClick={() => setSelectedDateKey(eventKey)}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${d ? 'border-orange-500/20 bg-black/40 hover:bg-black/50' : 'border-orange-200 bg-white hover:bg-orange-50'}`}
                        >
                          <div className={`font-semibold ${d ? 'text-zinc-100' : 'text-zinc-900'}`}>{ev.title || 'Untitled Event'}</div>
                          <div className={`mt-1 text-xs ${d ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            {eventDateLabel} • {startTime}{endTime ? ` - ${endTime}` : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {isNavigatingModule && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/55 backdrop-blur-sm">
          <div className={`rounded-2xl border px-6 py-5 ${d ? 'bg-black/80 border-orange-500/30' : 'bg-white border-orange-200 shadow-lg'}`}>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500"></div>
              <p className={`text-sm font-medium ${d ? 'text-orange-100' : 'text-zinc-800'}`}>Loading module...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
