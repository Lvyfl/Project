'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type ThemeMode = 'dark' | 'light';

type Post = {
  id: string;
  caption: string;
  body?: string;
  imageUrl?: string;
  createdAt: string;
  adminName?: string;
  departmentName?: string;
  departmentId?: string;
};

type CalendarEvent = {
  id: string;
  eventDate: string;
  endDate?: string | null;
  title?: string;
  description?: string;
  location?: string;
  eventLink?: string;
  departmentName?: string;
  adminName?: string;
  isAnnouncement?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function getOrCreateClientKey(): string {
  if (typeof window === 'undefined') return 'ssr';
  let key = localStorage.getItem('ceit_client_key');
  if (!key) {
    key = 'ck_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('ceit_client_key', key);
  }
  return key;
}

function trackPostView(postId: string) {
  const clientKey = getOrCreateClientKey();
  fetch(`${API_BASE}/posts/public/${postId}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientKey }),
  }).catch(() => {/* fire-and-forget */});
}

function getDocumentId(pdfUrl: string) {
  try {
    const u = new URL(pdfUrl, typeof window !== 'undefined' ? window.location.origin : API_BASE);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('documents');
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : '';
  } catch {
    return '';
  }
}

function parsePdfPost(imageUrl?: string) {
  if (!imageUrl) return { isPdf: false, pdfUrl: '', thumbnailUrl: '' };
  // JSON array = multiple images, not a PDF
  if (imageUrl.startsWith('[')) return { isPdf: false, pdfUrl: '', thumbnailUrl: '' };
  if (imageUrl.includes('|')) {
    const [pdf, thumb] = imageUrl.split('|');
    return { isPdf: true, pdfUrl: pdf, thumbnailUrl: thumb || '' };
  }
  if (imageUrl.toLowerCase().endsWith('.pdf') || imageUrl.startsWith('data:application/pdf')) {
    return { isPdf: true, pdfUrl: imageUrl, thumbnailUrl: '' };
  }
  return { isPdf: false, pdfUrl: '', thumbnailUrl: '' };
}

function parsePostImageUrls(imageUrl?: string | null): string[] {
  if (!imageUrl) return [];
  if (imageUrl.startsWith('[')) {
    try { return JSON.parse(imageUrl) as string[]; } catch {}
  }
  return [imageUrl];
}

function SectionHeader({ label, dark }: { label: string; dark: boolean }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <h2
        style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '3px' }}
        className={`text-[13px] font-semibold uppercase whitespace-nowrap ${dark ? 'text-white' : 'text-[#0D0D0D]'}`}
      >
        {label}
      </h2>
      <div className="flex-1 h-[2px] bg-[#E85D04]" />
    </div>
  );
}

export default function ViewerPage() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const d = theme === 'dark';
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentFilter, setCurrentFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [upcomingSourceEvents, setUpcomingSourceEvents] = useState<CalendarEvent[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [imageModalSrc, setImageModalSrc] = useState('');
  const [postModal, setPostModal] = useState<Post | null>(null);
  const [postModalImageIndex, setPostModalImageIndex] = useState(0);
  const [isNavigatingModule, setIsNavigatingModule] = useState(false);
  const [bgImageUrl, setBgImageUrl] = useState('');
  const [scrolled, setScrolled] = useState(false);

useEffect(() => {
  let expandTimer: ReturnType<typeof setTimeout> | null = null;
  let lastY = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      
      if (y > 50) {
        if (expandTimer) { clearTimeout(expandTimer); expandTimer = null; }
        setScrolled(true);
      } else if (y === 0) {
        // ONLY expand at absolute zero — no exceptions
        if (expandTimer) clearTimeout(expandTimer);
        expandTimer = setTimeout(() => {
          if (window.scrollY === 0) setScrolled(false);
        }, 500);
      }
      // anything between 1px and 50px → do absolutely nothing

      lastY = y;
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll);
    if (expandTimer) clearTimeout(expandTimer);
  };
}, []);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const startModuleNavigation = () => setIsNavigatingModule(true);

  // Fetch active background image from admin
  useEffect(() => {
    const fetchBg = async () => {
      try {
        const res = await fetch(`${API_BASE}/backgrounds/active`);
        if (res.ok) {
          const data = await res.json();
          setBgImageUrl(data?.image_url || '');
        }
      } catch {
        // silently ignore — background is decorative
      }
    };
    fetchBg();
  }, []);

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

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  // Fetch all departments from the dedicated endpoint (unfiltered, stable)
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        // Fetch only departments that have at least one post (inner join on backend).
        // This ensures the dropdown only shows depts with content, and the IDs
        // returned directly match the departmentId on posts so filtering works correctly.
        const res = await fetch(`${API_BASE}/posts/public/departments`);
        if (!res.ok) return;
        const data = (await res.json()) as { id: string; name: string }[];
        // Deduplicate by name as a safety net for duplicate DB rows
        const seen = new Set<string>();
        const unique = data.filter((d) => {
          const key = d.name.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setDepartments(unique);
      } catch { /* ignore */ }
    };
    fetchDepts();
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (currentFilter) params.set('departmentId', currentFilter);
      const response = await fetch(`${API_BASE}/posts/public?${params.toString()}`);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = (await response.json()) as Post[];
      setPosts(data);
    } catch (e) {
      setError(`Failed to load: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [currentFilter]);

  const loadEventsForMonth = useCallback(async () => {
    try {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd   = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      // Upcoming window: today → +2 months (for sidebar/announcements)
      const upcomingStart = new Date();
      upcomingStart.setHours(0, 0, 0, 0);
      const upcomingEnd = new Date(upcomingStart);
      upcomingEnd.setMonth(upcomingEnd.getMonth() + 2);
      upcomingEnd.setHours(23, 59, 59, 999);

      // Use the wider of the two date ranges for a single request
      const fetchStart = monthStart < upcomingStart ? monthStart : upcomingStart;
      const fetchEnd   = monthEnd   > upcomingEnd   ? monthEnd   : upcomingEnd;

      const params = new URLSearchParams({ startDate: fetchStart.toISOString(), endDate: fetchEnd.toISOString() });
      if (currentFilter) params.set('departmentId', currentFilter);
      const response = await fetch(`${API_BASE}/events/public?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load events');
      const data = (await response.json()) as CalendarEvent[];

      // Split into the two consumers
      setMonthEvents(data.filter(ev => {
        const d = new Date(ev.eventDate);
        return d >= monthStart && d <= monthEnd;
      }));
      setUpcomingSourceEvents(data.filter(ev => {
        const d = new Date(ev.eventDate);
        return d >= upcomingStart && d <= upcomingEnd;
      }));
    } catch {
      setMonthEvents([]);
      setUpcomingSourceEvents([]);
    }
  }, [currentFilter, currentMonth]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    loadEventsForMonth();
  }, [loadEventsForMonth]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setShowFilter(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setImageModalSrc(''); setPostModal(null); }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, []);

  useEffect(() => { setIsNavigatingModule(false); }, [pathname]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, number>();
    monthEvents.forEach((ev) => {
      const key = new Date(ev.eventDate).toDateString();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [monthEvents]);

  const calendarDerived = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const last  = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return {
      startDay:    first.getDay(),
      daysInMonth: last.getDate(),
      monthLabel:  currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  }, [currentMonth]);
  const { startDay, daysInMonth, monthLabel } = calendarDerived;

  const selectedDateEvents = useMemo(() => {
    if (!selectedDateKey) return [] as CalendarEvent[];
    return monthEvents
      .filter((ev) => new Date(ev.eventDate).toDateString() === selectedDateKey)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [monthEvents, selectedDateKey]);

  const highlightedEvents = useMemo(() =>
    [...upcomingSourceEvents].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()),
    [upcomingSourceEvents]);

  const announcementEvents = useMemo(() =>
    highlightedEvents.filter((ev) => !!ev.isAnnouncement),
    [highlightedEvents]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateKey) return '';
    return new Date(selectedDateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [selectedDateKey]);

  const formatEventTime = useCallback((value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, []);

  // Group posts by department, preserving server order within each group
  const deptGroups = useMemo(() => {
    const map = new Map<string, Post[]>();
    posts.forEach(p => {
      const key = p.departmentName || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries()); // [ [deptName, posts[]], ... ]
  }, [posts]);

  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);

  // Auto-rotate spotlight every 6s
  useEffect(() => {
    if (deptGroups.length < 2) return;
    const id = setInterval(() => setSpotlightIndex(i => (i + 1) % deptGroups.length), 6000);
    return () => clearInterval(id);
  }, [deptGroups.length]);

  const todayStr = useMemo(() =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  , []);

  const tickerItems = useMemo(() => {
    const items: string[] = [];
    posts.slice(0, 8).forEach(p => { if (p.caption) items.push(p.caption.slice(0, 100)); });
    highlightedEvents.slice(0, 5).forEach(e => { if (e.title) items.push(e.title); });
    return items.length ? [...items, ...items] : ['CvSU CEIT Bulletin — Truth, Excellence, and Service', 'CvSU CEIT Bulletin — Truth, Excellence, and Service'];
  }, [posts, highlightedEvents]);

  const bg = d ? 'bg-[#0D0D0D]' : 'bg-[#FAFAFA]';
  const textColor = d ? 'text-[#FAFAFA]' : 'text-[#0D0D0D]';
  const muted = d ? 'text-[#888]' : 'text-[#4A4A4A]';

  return (
    <div className={`min-h-screen ${bg} ${textColor} relative`} style={{ fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)" }}>

      {/* ── VIEWER BACKGROUND ── */}
      {bgImageUrl && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url('${bgImageUrl}')`, opacity: d ? 0.12 : 0.15 }}
          />
        </div>
      )}

      {/* ── TICKER ── */}
      <div className="sticky top-0 z-50 bg-[#E85D04] overflow-hidden py-[7px]">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-[#0D0D0D] text-[#E85D04] px-3 h-[26px] flex items-center"
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '2px', fontWeight: 600 }}>
            BREAKING
          </div>
          <div className="overflow-hidden flex-1">
            <div className="ticker-scroll-track whitespace-nowrap inline-flex gap-16 text-white"
              style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', letterSpacing: '0.5px' }}>
              {tickerItems.map((item, i) => (
                <span key={i}>◆&nbsp;&nbsp;{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MASTHEAD ── */}
      <div className={`sticky top-[40px] z-30 border-b-4 border-[#E85D04] transition-shadow duration-300 ${scrolled ? 'shadow-xl' : ''} ${d ? 'bg-[#0D0D0D]' : 'bg-[#FAFAFA]'}`}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          {/* Collapsible large title strip */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              scrolled ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[200px] opacity-100 pt-6 pb-4'
            }`}
          >
            <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4">
            <div className={d ? 'text-[#888888]' : 'text-[#4A4A4A]'} style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', lineHeight: '1.8' }}>
              {todayStr}<br />Cavite State University<br />CEIT Department
            </div>
            <div className="text-center flex-1">
              <h1
                style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontWeight: 900, lineHeight: 0.95, letterSpacing: '-2px',  fontSize: 'clamp(36px,7vw,74px)' }}
                className={d ? 'text-white' : 'text-[#0D0D0D]'}>
                CvSU CEIT <span className="text-[#E85D04]">BULLETIN</span>
              </h1>
              <div className={`mt-2 py-1 border-t border-b ${d ? 'border-[#2a2a2a]' : 'border-[#C4C4C4]'}`}
                style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '4px', color: d ? '#888888' : '#4A4A4A', textTransform: 'uppercase' }}>
                Truth &nbsp;·&nbsp; Excellence &nbsp;·&nbsp; Service
              </div>
            </div>
            </div>
          </div>

          {/* NAV */}
          <nav className="bg-[#0D0D0D] -mx-6 md:-mx-10 px-6 md:px-10 relative">
            <div className="max-w-[1280px] mx-auto flex flex-wrap items-center">
              <a href="/viewer" style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '12px 18px', textDecoration: 'none', display: 'block', color: '#E85D04', borderBottom: '3px solid #E85D04' }}>
                Home
              </a>
              <Link onClick={startModuleNavigation} href="/events"
                className="text-[#C4C4C4] hover:text-[#E85D04] border-b-[3px] border-transparent hover:border-[#E85D04] transition-all"
                style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '12px 18px', textDecoration: 'none', display: 'block' }}>
                Events
              </Link>
              <Link onClick={startModuleNavigation} href="/documents"
                className="text-[#C4C4C4] hover:text-[#E85D04] border-b-[3px] border-transparent hover:border-[#E85D04] transition-all"
                style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '12px 18px', textDecoration: 'none', display: 'block' }}>
                Documents
              </Link>
              <div className="ml-auto flex items-center gap-2 relative" ref={filterRef}>
                {/* Theme toggle */}
                <div className="flex items-center border border-[#2a2a2a]">
                  <button onClick={() => theme !== 'dark' && toggleTheme()}
                    className={`px-3 py-[6px] font-semibold transition-all ${theme === 'dark' ? 'bg-[#E85D04] text-white' : 'text-[#C4C4C4] hover:text-[#E85D04]'}`}
                    style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    Dark
                  </button>
                  <button onClick={() => theme !== 'light' && toggleTheme()}
                    className={`px-3 py-[6px] font-semibold transition-all ${theme === 'light' ? 'bg-[#E85D04] text-white' : 'text-[#C4C4C4] hover:text-[#E85D04]'}`}
                    style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                    Light
                  </button>
                </div>
                <button onClick={() => setShowFilter(v => !v)}
                  className="flex items-center gap-2 text-[#C4C4C4] hover:text-[#E85D04] transition-colors border border-[#2a2a2a] hover:border-[#E85D04] py-[6px] px-3"
                  style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  {currentFilter ? (departments.find(dep => dep.id === currentFilter)?.name ?? 'Filtered') : 'All Depts'}
                  <span className="text-[10px]">▾</span>
                </button>
                {showFilter && (
                  <div className="absolute top-full right-0 z-30 min-w-[200px] border border-[#2a2a2a] bg-[#0D0D0D] shadow-xl" style={{ marginTop: '1px' }}>
                    <button onClick={() => { setCurrentFilter(''); setShowFilter(false); }}
                      className="block w-full px-4 py-3 text-left text-[#C4C4C4] hover:text-[#E85D04] hover:bg-[rgba(232,93,4,0.1)] transition-colors"
                      style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      All Departments
                    </button>
                    {departments.map((dept) => (
                      <button key={dept.id} onClick={() => { setCurrentFilter(dept.id); setShowFilter(false); }}
                        className="block w-full px-4 py-3 text-left text-[#C4C4C4] hover:text-[#E85D04] hover:bg-[rgba(232,93,4,0.1)] transition-colors"
                        style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {dept.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>
      </div>

      {/* ── PAGE ── */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-10 py-8">

        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start animate-pulse">
            {/* Left skeleton */}
            <div className="min-w-0 space-y-14">
              {[0, 1].map((i) => (
                <div key={i}>
                  <div className={`h-4 w-48 mb-6 rounded ${d ? 'bg-[#2a2a2a]' : 'bg-[#e5e5e5]'}`} />
                  <div className={`border mb-8 ${d ? 'border-[#2a2a2a] bg-[#1a1a1a]' : 'border-[#e0e0e0] bg-white'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr]">
                      <div className={`${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`} style={{ minHeight: '260px' }} />
                      <div className="p-8 space-y-4">
                        <div className={`h-3 w-24 rounded ${d ? 'bg-[#2a2a2a]' : 'bg-[#e5e5e5]'}`} />
                        <div className={`h-6 w-3/4 rounded ${d ? 'bg-[#2a2a2a]' : 'bg-[#e5e5e5]'}`} />
                        <div className={`h-6 w-1/2 rounded ${d ? 'bg-[#2a2a2a]' : 'bg-[#e5e5e5]'}`} />
                        <div className={`h-4 w-full rounded ${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`} />
                        <div className={`h-4 w-5/6 rounded ${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[0, 1].map((j) => (
                      <div key={j} className={`overflow-hidden border ${d ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-[#e0e0e0]'}`}>
                        <div className={`${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`} style={{ height: '185px' }} />
                        <div className="p-5 space-y-2">
                          <div className={`h-5 w-3/4 rounded ${d ? 'bg-[#2a2a2a]' : 'bg-[#e5e5e5]'}`} />
                          <div className={`h-4 w-full rounded ${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`} />
                          <div className={`h-4 w-2/3 rounded ${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Right rail skeleton */}
            <div className="space-y-4">
              <div className={`h-4 w-40 mb-6 rounded ${d ? 'bg-[#2a2a2a]' : 'bg-[#e5e5e5]'}`} />
              {[0, 1, 2].map((i) => (
                <div key={i} className={`border p-4 ${d ? 'border-[#2a2a2a] bg-[#1a1a1a]' : 'border-[#e5e5e5] bg-white'}`}>
                  <div className={`h-4 w-2/3 rounded mb-2 ${d ? 'bg-[#2a2a2a]' : 'bg-[#e5e5e5]'}`} />
                  <div className={`h-3 w-1/2 rounded ${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`} />
                </div>
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="mb-6 border-l-4 border-red-500 bg-red-900/20 px-5 py-4 text-red-300"
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* 2-COL LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start">

          {/* ── LEFT ── */}
          <div className="min-w-0">
            <SectionHeader label="Announcements by Department" dark={d} />

            {/* ── PER-DEPARTMENT SECTIONS ── */}
            {!loading && deptGroups.map(([deptName, deptPosts]) => {
              const hero = deptPosts[0];
              const restPosts = deptPosts.slice(1);
              const { isPdf: hIsPdf, pdfUrl: hPdfUrl, thumbnailUrl: hThumb } = parsePdfPost(hero.imageUrl);
              const hImgs = hIsPdf ? (hThumb ? [hThumb] : []) : parsePostImageUrls(hero.imageUrl);
              const hImg = hImgs[0] || '';
              const hDocId = hPdfUrl ? getDocumentId(hPdfUrl) : '';
              const hDate = new Date(hero.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              return (
                <div key={deptName} className="mb-14">
                  <SectionHeader label={deptName} dark={d} />

                  {/* featured hero — image left, text right */}
                  <div className={`mb-8 overflow-hidden border ${d ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-[#e0e0e0] shadow-sm'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr]">
                      {/* image */}
                      <div className="relative overflow-hidden cursor-zoom-in group" style={{ minHeight: '260px' }}
                        onClick={() => hImg && setImageModalSrc(hImg)}>
                        {hImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hImg} alt="" className="absolute inset-0 w-full h-full object-cover"
                            onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                        ) : (
                          <div className={`absolute inset-0 flex items-center justify-center text-5xl ${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`}>📰</div>
                        )}
                        {hImgs.length > 1 && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            +{hImgs.length - 1}
                          </div>
                        )}
                      </div>
                      {/* text */}
                      <div className="p-7 md:p-8 flex flex-col justify-start overflow-hidden">
                        <span className="inline-block self-start bg-[#E85D04] text-white px-2.5 py-0.5 mb-4 flex-shrink-0"
                          style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600, borderRadius: '2px' }}>
                          {deptName}
                        </span>
                        <h2 className={`mb-4 flex-shrink-0 ${d ? 'text-white' : 'text-[#0D0D0D]'}`}
                          style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontSize: 'clamp(20px,2.2vw,28px)', fontWeight: 800, lineHeight: 1.25, wordBreak: 'break-word', overflowWrap: 'break-word',
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {hero.caption}
                        </h2>
                        {hero.body && (
                          <p style={{ fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)", fontSize: '13.5px', fontStyle: 'italic', lineHeight: 1.75, color: d ? '#aaa' : '#555', marginBottom: '20px', wordBreak: 'break-word',
                            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', flexShrink: 0 }}>
                            {hero.body}
                          </p>
                        )}
                        <div className={`border-t mb-4 ${d ? 'border-[#2a2a2a]' : 'border-[#ececec]'}`} />
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <p style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '0.8px', color: d ? '#666' : '#999', textTransform: 'uppercase', marginBottom: '2px' }}>
                              {hDate}{hero.body && <> · {Math.max(1, Math.ceil(hero.body.split(' ').length / 200))} min read</>}
                            </p>
                            <p style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '0.8px', color: d ? '#666' : '#999', textTransform: 'uppercase' }}>
                              By {hero.adminName || 'CEIT'}
                            </p>
                          </div>
                          {hIsPdf ? (
                            hDocId ? (
                              <Link href={`/pdf/${encodeURIComponent(hDocId)}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[#E85D04] hover:text-[#F48C06] transition-colors"
                                style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                Open PDF <span style={{ fontSize: '16px' }}>›</span>
                              </Link>
                            ) : (
                              <a href={hPdfUrl} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[#E85D04] hover:text-[#F48C06] transition-colors"
                                style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                Open PDF <span style={{ fontSize: '16px' }}>›</span>
                              </a>
                            )
                          ) : (
                            <button onClick={() => { setPostModalImageIndex(0); setPostModal(hero); trackPostView(hero.id); }}
                              className="inline-flex items-center gap-1 font-semibold text-[#E85D04] hover:text-[#F48C06] transition-colors"
                              style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                              Read More <span style={{ fontSize: '16px' }}>›</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* remaining posts for this dept */}
                  {restPosts.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {restPosts.map((post) => {
                        const { isPdf, pdfUrl, thumbnailUrl } = parsePdfPost(post.imageUrl);
                        const displayImgs = isPdf ? (thumbnailUrl ? [thumbnailUrl] : []) : parsePostImageUrls(post.imageUrl);
                        const displayImg = displayImgs[0] || '';
                        const docId = pdfUrl ? getDocumentId(pdfUrl) : '';
                        const dateLabel = new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                        return (
                          <article key={post.id}
                            className={`flex flex-col overflow-hidden rounded-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${d ? 'bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#E85D04]/40' : 'bg-white border border-[#e0e0e0] hover:border-[#E85D04]/50 shadow-sm'}`}>
                            <div className="relative overflow-hidden cursor-zoom-in group flex-shrink-0" style={{ height: '185px' }}
                              onClick={() => displayImg && setImageModalSrc(displayImg)}>
                              {displayImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={displayImg} alt="" loading="lazy" className="w-full h-full object-cover" />
                              ) : (
                                <div className={`w-full h-full flex items-center justify-center text-4xl ${d ? 'bg-[#222]' : 'bg-[#f0ede8]'}`}>📰</div>
                              )}
                              {displayImgs.length > 1 && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium pointer-events-none">
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  +{displayImgs.length - 1}
                                </div>
                              )}
                            </div>
                            <div className="p-5 flex flex-col flex-1 min-h-0">
                              <h4 className={`mb-2 ${d ? 'text-white' : 'text-[#0D0D0D]'}`}
                                style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontSize: '18px', fontWeight: 700, lineHeight: 1.3, flexShrink: 0 }}>
                                {post.caption}
                              </h4>
                              {post.body && (
                                <p className={`${muted} mb-3`}
                                  style={{ fontSize: '13.5px', lineHeight: 1.65, fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)",
                                    fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flexShrink: 0 }}>
                                  {post.body}
                                </p>
                              )}
                              <div className="mt-auto pt-2">
                                <p style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '10px', letterSpacing: '0.8px', color: d ? '#666' : '#999', marginBottom: '1px', textTransform: 'uppercase' }}>
                                  {dateLabel}{post.body && <> · {Math.max(1, Math.ceil(post.body.split(' ').length / 200))} min read</>}
                                </p>
                                <p style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '10px', letterSpacing: '0.8px', color: d ? '#666' : '#999', marginBottom: '8px', textTransform: 'uppercase' }}>
                                  By {post.adminName || 'CEIT'}
                                </p>
                                {isPdf ? (
                                  docId ? (
                                    <Link href={`/pdf/${encodeURIComponent(docId)}`} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 font-semibold text-[#E85D04] hover:text-[#F48C06] transition-colors"
                                      style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                      Open PDF <span style={{ fontSize: '14px' }}>›</span>
                                    </Link>
                                  ) : (
                                    <a href={pdfUrl} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 font-semibold text-[#E85D04] hover:text-[#F48C06] transition-colors"
                                      style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                      Open PDF <span style={{ fontSize: '14px' }}>›</span>
                                    </a>
                                  )
                                ) : (
                                  <button onClick={() => { setPostModalImageIndex(0); setPostModal(post); trackPostView(post.id); }}
                                    className="inline-flex items-center gap-1 font-semibold text-[#E85D04] hover:text-[#F48C06] transition-colors"
                                    style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                    Read More <span style={{ fontSize: '14px' }}>›</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* DEPARTMENT SPOTLIGHT */}
            {!loading && deptGroups.length > 0 && (() => {
              const idx = spotlightIndex % deptGroups.length;
              const [deptName, deptPosts] = deptGroups[idx];
              const latest = deptPosts[0];
              const { isPdf, thumbnailUrl } = parsePdfPost(latest?.imageUrl);
              const spotImgs = isPdf ? (thumbnailUrl ? [thumbnailUrl] : []) : parsePostImageUrls(latest?.imageUrl);
              const img = spotImgs[0] || '';
              return (
                <div className="mb-10">
                  <SectionHeader label="Department Spotlight" dark={d} />
                  <div className={`border-l-4 border-[#E85D04] overflow-hidden ${d ? 'bg-[#1a1000] border border-[#2a2a2a]' : 'bg-[#FFF8F0] border border-[#eee]'}`}>
                    {/* Dept label + navigation */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-[#E85D04]/25">
                      <span style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#E85D04' }}>
                        {deptName}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSpotlightIndex(i => (i - 1 + deptGroups.length) % deptGroups.length)}
                          className="w-6 h-6 flex items-center justify-center text-[#C4C4C4] hover:text-[#E85D04] transition-colors"
                          style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '16px' }}
                          aria-label="Previous department"
                        >‹</button>
                        <span style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '10px', letterSpacing: '1px', color: '#666' }}>
                          {idx + 1}/{deptGroups.length}
                        </span>
                        <button
                          onClick={() => setSpotlightIndex(i => (i + 1) % deptGroups.length)}
                          className="w-6 h-6 flex items-center justify-center text-[#C4C4C4] hover:text-[#E85D04] transition-colors"
                          style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '16px' }}
                          aria-label="Next department"
                        >›</button>
                      </div>
                    </div>
                    {/* Latest post preview */}
                    {latest && (
                      <div className="flex gap-4 p-4">
                        {img && (
                          <div className="w-20 h-20 flex-shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-semibold leading-snug mb-1 line-clamp-3 ${d ? 'text-white' : 'text-[#0D0D0D]'}`}
                            style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)" }}>
                            {latest.caption}
                          </p>
                          {latest.body && (
                            <p className={`text-[12px] line-clamp-2 mb-2 ${d ? 'text-[#888]' : 'text-[#666]'}`}
                              style={{ fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)" }}>
                              {latest.body}
                            </p>
                          )}
                          <button onClick={() => { setPostModalImageIndex(0); setPostModal(latest); trackPostView(latest.id); }}
                            className="text-[#E85D04] hover:text-[#F48C06] transition-colors"
                            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                            Read More ›
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Dot indicators */}
                    {deptGroups.length > 1 && (
                      <div className="flex justify-center gap-1.5 pb-3">
                        {deptGroups.map((_, i) => (
                          <button key={i} onClick={() => setSpotlightIndex(i)}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-[#E85D04]' : (d ? 'bg-[#3a3a3a]' : 'bg-[#ccc]')}`}
                            aria-label={`Go to department ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {!loading && !error && posts.length === 0 && (
              <div className={`border p-14 text-center ${d ? 'border-[#2a2a2a] bg-[#1A1A1A]' : 'border-[#e5e5e5] bg-white'}`}>
                <p className={`${muted} text-lg`} style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontStyle: 'italic' }}>
                  No announcements yet — check back later.
                </p>
              </div>
            )}
          </div>

          {/* ── RIGHT RAIL ── */}
          <div className="lg:sticky lg:top-[52px] lg:max-h-[calc(100vh-72px)] lg:overflow-y-auto">
            <SectionHeader label="Events Calendar" dark={d} />

            {/* ANNOUNCEMENTS */}
            {announcementEvents.length > 0 && (
              <div className={`mb-6 border-l-4 border-[#E85D04] ${d ? 'bg-[#1a1000] border border-[#2a2a2a]' : 'bg-[#FFF8F0] border border-[#eee]'}`}>
                <div className="px-4 py-3 border-b border-[#E85D04]/30 flex items-center gap-2">
                  <span className="text-base">📣</span>
                  <span style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#E85D04' }}>
                    Announcements
                  </span>
                </div>
                <div className="divide-y divide-[#E85D04]/15">
                  {(showAllAnnouncements ? announcementEvents : announcementEvents.slice(0, 3)).map((ev) => (
                    <div key={ev.id} className="px-4 py-3">
                      <p className={`text-[13px] font-semibold leading-snug mb-1 ${d ? 'text-white' : 'text-[#0D0D0D]'}`}
                        style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)" }}>
                        {ev.title || 'Untitled'}
                      </p>
                      <p className={`${muted} text-[11px]`} style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '0.5px' }}>
                        {new Date(ev.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </p>
                      {ev.description && (
                        <p className={`${muted} text-[12px] mt-1`} style={{ lineHeight: 1.5 }}>
                          {ev.description.slice(0, 80)}{ev.description.length > 80 ? '…' : ''}
                        </p>
                      )}
                    </div>
                  ))}
                  {announcementEvents.length > 3 && (
                    <button
                      onClick={() => setShowAllAnnouncements(p => !p)}
                      className={`w-full px-4 py-2.5 text-[11px] font-semibold tracking-widest uppercase transition-colors ${
                        d ? 'text-[#E85D04] hover:bg-[#E85D04]/10' : 'text-[#E85D04] hover:bg-[#E85D04]/5'
                      }`}
                      style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)" }}
                    >
                      {showAllAnnouncements ? 'Show Less ▲' : `See More (${announcementEvents.length - 3} more) ▼`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* MINI CALENDAR */}
            <div className={`border p-5 mb-6 ${d ? 'border-[#2a2a2a] bg-[#1A1A1A]' : 'border-[#e5e5e5] bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className={`text-lg px-2 transition-colors border-none bg-transparent cursor-pointer ${d ? 'text-[#FAFAFA] hover:text-[#E85D04]' : 'text-[#0D0D0D] hover:text-[#E85D04]'}`}>‹</button>
                <h3 style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '15px', letterSpacing: '2px', textTransform: 'uppercase' }}
                  className={d ? 'text-white' : 'text-[#0D0D0D]'}>{monthLabel}</h3>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className={`text-lg px-2 transition-colors border-none bg-transparent cursor-pointer ${d ? 'text-[#FAFAFA] hover:text-[#E85D04]' : 'text-[#0D0D0D] hover:text-[#E85D04]'}`}>›</button>
              </div>
              <div className="grid grid-cols-7 text-center mb-2" style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: '#888' }}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(day => <div key={day} className="py-1">{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-[2px] text-center">
                {Array.from({ length: startDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                  const key = date.toDateString();
                  const count = eventsByDate.get(key) || 0;
                  const isToday = key === new Date().toDateString();
                  const isSelected = key === selectedDateKey;
                  return (
                    <button key={day} type="button" onClick={() => setSelectedDateKey(count > 0 ? key : '')}
                      className={`flex flex-col items-center justify-center py-1 relative transition-all
                        ${isToday ? 'bg-[#0D0D0D] text-white font-bold' : d ? 'text-[#FAFAFA] hover:bg-[#E85D04] hover:text-white' : 'text-[#0D0D0D] hover:bg-[#E85D04] hover:text-white'}
                        ${count > 0 && !isToday ? 'ring-1 ring-[#E85D04] cursor-pointer' : count === 0 ? 'cursor-default' : ''}
                        ${isSelected ? 'ring-2 ring-[#F48C06]' : ''}`}
                      style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', aspectRatio: '1' }}>
                      {day}
                      {count > 0 && <span className="absolute bottom-[3px] w-1 h-1 rounded-full bg-[#E85D04]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EVENTS LIST */}
            <div className="mb-6">
              <h4 className={`mb-4 ${muted}`} style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                {selectedDateKey ? selectedDateLabel : `Upcoming · ${monthLabel}`}
              </h4>
              {selectedDateKey && selectedDateEvents.length === 0 && (
                <p className={`${muted} text-[13px]`}>No events on this date.</p>
              )}
              <div className="max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#E85D04 transparent' }}>
              {(selectedDateKey ? selectedDateEvents : highlightedEvents).map((ev) => {
                const evDate = new Date(ev.eventDate);
                const evDay = evDate.toLocaleDateString('en-US', { day: 'numeric' });
                const evMonth = evDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                const startTime = formatEventTime(ev.eventDate);
                const endTime = formatEventTime(ev.endDate);
                return (
                  <div key={ev.id}
                    className={`flex gap-4 py-4 border-b transition-all cursor-default group ${d ? 'border-[#2a2a2a] hover:bg-[rgba(232,93,4,0.05)]' : 'border-[#eee] hover:bg-[#FFF8F0]'}`}>
                    <div className={`flex-shrink-0 w-[50px] border border-[#E85D04] text-center py-1.5 transition-all group-hover:bg-[#E85D04] group-hover:text-white ${d ? 'bg-[#1a1000]' : 'bg-[#FFF8F0]'}`}>
                      <div style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontSize: '22px', fontWeight: 900, lineHeight: 1 }}>{evDay}</div>
                      <div style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>{evMonth}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className={`mb-1 ${d ? 'text-white' : 'text-[#0D0D0D]'}`}
                        style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontSize: '14px', fontWeight: 700, lineHeight: 1.35 }}>
                        {ev.title || 'Untitled Event'}
                      </h5>
                      {(startTime || ev.location) && (
                        <div className={`${muted} mb-1`}
                          style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                          {startTime}{endTime ? ` – ${endTime}` : ''}{ev.location ? ` · ${ev.location}` : ''}
                        </div>
                      )}
                      {ev.departmentName && (
                        <div className="text-[#E85D04] mb-1"
                          style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                          {ev.departmentName}
                        </div>
                      )}
                      {ev.description && (
                        <p className={`${muted} text-[12px]`} style={{ lineHeight: 1.55 }}>
                          {ev.description.slice(0, 100)}{ev.description.length > 100 ? '…' : ''}
                        </p>
                      )}
                      {ev.eventLink && (
                        <a href={ev.eventLink} target="_blank" rel="noreferrer"
                          className="mt-1 inline-block text-[#E85D04] hover:text-[#F48C06] underline"
                          style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1px' }}>
                          Open link
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

              {!selectedDateKey && highlightedEvents.length === 0 && !loading && (
                <p className={`${muted} text-[13px] italic`}>No upcoming events.</p>
              )}
              </div>

              {selectedDateKey && (
                <button onClick={() => setSelectedDateKey('')}
                  className="mt-3 text-[#E85D04] hover:text-[#F48C06] text-xs"
                  style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1px', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  ← Back to upcoming
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 bg-[#1A1A1A] text-[#888] mt-10 py-10">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 pb-8 border-b border-[#333] mb-5">
            <div className="md:col-span-1">
              <h2 style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontSize: '24px', fontWeight: 900, color: 'white', marginBottom: '10px' }}>
                CvSU CEIT <span style={{ color: '#E85D04' }}>Bulletin</span>
              </h2>
              <p style={{ fontSize: '12px', lineHeight: 1.7 }}>
                Public announcements and updates from the CvSU College of Engineering and Information Technology.
              </p>
            </div>
            <div>
              <h4 style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'white', marginBottom: '12px', borderBottom: '2px solid #E85D04', paddingBottom: '8px', display: 'inline-block' }}>
                Navigation
              </h4>
              <a href="/viewer" style={{ display: 'block', fontSize: '12px', color: '#888', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.2s' }}
                className="hover:text-[#E85D04]">Home</a>
              <Link href="/events" style={{ display: 'block', fontSize: '12px', color: '#888', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.2s' }}
                className="hover:text-[#E85D04]">Events</Link>
            </div>
            <div>
              <h4 style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'white', marginBottom: '12px', borderBottom: '2px solid #E85D04', paddingBottom: '8px', display: 'inline-block' }}>
                About
              </h4>
              <p style={{ fontSize: '12px', lineHeight: 1.7 }}>
                Cavite State University<br />
                CEIT Department<br />
                Indang, Cavite, Philippines
              </p>
              <div className="flex flex-col items-start gap-3 mt-4">
                <a
                  href="https://cvsu.edu.ph/2018/01/13/library/#"
                  target="_blank"
                  rel="noreferrer"
                  title="Visit CvSU Official Website"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#E85D04]"
                  style={{ fontSize: '12px', color: '#888', textDecoration: 'none' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0 text-[#E85D04]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1.5px', textTransform: 'uppercase', fontSize: '11px' }}>
                    CvSU Official Website
                  </span>
                </a>
                <a
                  href="https://www.facebook.com/CaviteStateU"
                  target="_blank"
                  rel="noreferrer"
                  title="CvSU Facebook Page"
                  className="inline-flex items-center gap-2 transition-colors hover:text-[#E85D04]"
                  style={{ fontSize: '12px', color: '#888', textDecoration: 'none' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0 text-[#E85D04]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1.5px', textTransform: 'uppercase', fontSize: '11px' }}>
                    Facebook Page
                  </span>
                </a>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2"
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: '#555' }}>
            <span>© {new Date().getFullYear()} CvSU CEIT Bulletin. All rights reserved.</span>
            <span>Truth · Excellence · Service</span>
          </div>
        </div>
      </footer>

      {/* ── POST MODAL ── */}
      {postModal && (() => {
        const { isPdf: mIsPdf, pdfUrl: mPdfUrl, thumbnailUrl: mThumb } = parsePdfPost(postModal.imageUrl);
        const mImgs = mIsPdf ? (mThumb ? [mThumb] : []) : parsePostImageUrls(postModal.imageUrl);
        const mImg = mImgs[postModalImageIndex] || '';
        const mDocId = mPdfUrl ? getDocumentId(mPdfUrl) : '';
        const mDate = new Date(postModal.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const readMins = postModal.body ? Math.max(1, Math.ceil(postModal.body.split(' ').length / 200)) : 1;
        const hasImage = mImgs.length > 0;
        const hasMultipleImgs = mImgs.length > 1;
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-10"
            style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
            onClick={() => setPostModal(null)}>

            {/* modal shell — side-by-side on md+, stacked on mobile */}
            <div className={`relative w-full flex flex-col md:flex-row overflow-hidden shadow-2xl ${d ? 'bg-[#111]' : 'bg-white'}`}
              style={{ maxWidth: '900px', maxHeight: '88vh' }}
              onClick={e => e.stopPropagation()}>

              {/* close — top-right corner, always visible */}
              <button onClick={() => setPostModal(null)}
                className={`absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center text-2xl leading-none transition-colors ${d ? 'text-white/30 hover:text-white' : 'text-black/25 hover:text-black'}`}>
                ×
              </button>

              {/* ── LEFT: article text ── */}
              <div className={`flex flex-col justify-between overflow-y-auto px-8 py-10 md:px-10 md:py-12 ${hasImage ? 'md:w-[42%]' : 'w-full'} ${hasImage && !d ? 'border-r border-[#e8e4de]' : ''} ${hasImage && d ? 'border-r border-[#1e1e1e]' : ''}`}>
                <div>
                  {/* section label */}
                  <div className="flex items-center gap-3 mb-5">
                    {postModal.departmentName && (
                      <span className="text-[#E85D04]"
                        style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 600 }}>
                        {postModal.departmentName}
                      </span>
                    )}
                    {postModal.departmentName && (
                      <span className={`block h-px flex-1 ${d ? 'bg-[#1e1e1e]' : 'bg-[#e8e4de]'}`} />
                    )}
                  </div>

                  {/* headline */}
                  <h2 className={`mb-6 ${d ? 'text-white' : 'text-[#0D0D0D]'}`}
                    style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 800, lineHeight: 1.18, wordBreak: 'break-word' }}>
                    {postModal.caption}
                  </h2>

                  {/* body */}
                  {postModal.body && (
                    <p className={d ? 'text-[#9a9390]' : 'text-[#444]'}
                      style={{ fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)", fontSize: '14.5px', lineHeight: 1.85, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {postModal.body}
                    </p>
                  )}

                  {/* PDF CTA */}
                  {mIsPdf && (
                    <div className="mt-7">
                      {mDocId ? (
                        <Link href={`/pdf/${encodeURIComponent(mDocId)}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 bg-[#E85D04] hover:bg-[#c94e00] text-white px-5 py-2.5 transition-colors"
                          style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>
                          📄 Open PDF Document
                        </Link>
                      ) : (
                        <a href={mPdfUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 bg-[#E85D04] hover:bg-[#c94e00] text-white px-5 py-2.5 transition-colors"
                          style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>
                          📄 Open PDF Document
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* byline + timestamp — pinned to bottom of left column */}
                <div className={`mt-8 pt-5 border-t ${d ? 'border-[#1e1e1e] text-[#555]' : 'border-[#e8e4de] text-[#999]'}`}
                  style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                  <span className="font-semibold text-[#E85D04]">{postModal.adminName || 'CEIT'}</span>
                  <span className="mx-2">·</span>
                  <span>{mDate}</span>
                  <span className="mx-2">·</span>
                  <span>{readMins} min read</span>
                </div>
              </div>

              {/* ── RIGHT: image (with optional multi-image carousel) ── */}
              {hasImage && (
                <div className="md:flex-1 h-52 md:h-auto overflow-hidden flex-shrink-0 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mImg} alt="" className="w-full h-full object-cover"
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => setImageModalSrc(mImg)}
                    onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                  {hasMultipleImgs && (
                    <>
                      {/* Prev arrow */}
                      <button
                        onClick={e => { e.stopPropagation(); setPostModalImageIndex(i => (i - 1 + mImgs.length) % mImgs.length); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white text-2xl flex items-center justify-center transition-colors z-10 leading-none"
                        aria-label="Previous image">
                        ‹
                      </button>
                      {/* Next arrow */}
                      <button
                        onClick={e => { e.stopPropagation(); setPostModalImageIndex(i => (i + 1) % mImgs.length); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white text-2xl flex items-center justify-center transition-colors z-10 leading-none"
                        aria-label="Next image">
                        ›
                      </button>
                      {/* Dot indicators */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                        {mImgs.map((_, i) => (
                          <button key={i}
                            onClick={e => { e.stopPropagation(); setPostModalImageIndex(i); }}
                            className={`rounded-full transition-all ${i === postModalImageIndex ? 'w-3 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'}`}
                            aria-label={`Image ${i + 1}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── IMAGE MODAL ── */}
      {imageModalSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setImageModalSrc('')}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setImageModalSrc('')}
              className="absolute -right-3 -top-3 z-10 h-8 w-8 rounded-full bg-[#E85D04] text-white text-lg flex items-center justify-center hover:bg-[#9D0208] transition-colors">
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageModalSrc} alt="Preview" className="max-h-[90vh] max-w-[90vw] object-contain" />
          </div>
        </div>
      )}

      {/* ── NAVIGATION OVERLAY ── */}
      {isNavigatingModule && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="border border-[#E85D04]/30 bg-[#0D0D0D] px-6 py-5 flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E85D04]/30 border-t-[#E85D04]" />
            <p style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: '#FAFAFA' }}>
              Loading…
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-scroll-track {
          animation: tickerScroll 45s linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
