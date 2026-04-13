'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

/* ─────────────────────────── types ─────────────────────────── */
type Post = {
  id: string;
  caption: string;
  body?: string;
  imageUrl?: string;
  createdAt: string;
  adminName?: string;
  departmentName?: string;
};

type CalendarEvent = {
  id: string;
  eventDate: string;
  endDate?: string | null;
  title?: string;
  description?: string;
  location?: string;
  eventImageUrl?: string | null;
  eventLink?: string | null;
  isAnnouncement?: boolean;
  departmentName?: string;
  adminName?: string;
};

/* ───────────────────────── helpers ─────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function parsePostImageUrls(imageUrl?: string | null): string[] {
  if (!imageUrl) return [];
  if (imageUrl.startsWith('[')) {
    try { return JSON.parse(imageUrl) as string[]; } catch {}
  }
  // PDF format: pdfUrl|thumbnailUrl  → return thumb only
  if (imageUrl.includes('|')) return [imageUrl.split('|')[1]].filter(Boolean);
  if (imageUrl.toLowerCase().endsWith('.pdf') || imageUrl.startsWith('data:application/pdf')) return [];
  return [imageUrl];
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}
function fmtDateLong(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
/** Extend slide duration for posts with long body text (+1 s per 80 chars, capped at 45 s) */
function getPostSlideMs(post: Post | undefined, baseMs: number): number {
  const len = post?.body?.length ?? 0;
  return Math.min(baseMs + Math.floor(len / 80) * 1000, 45_000);
}

/* ─────────────────── URL param parser (SSR-safe) ───────────── */
function useSearchParam(key: string, fallback: string): string {
  const [val, setVal] = useState(fallback);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get(key);
    if (p !== null) setVal(p);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return val;
}

/* ═══════════════════════════════════════════════════════════════
   KIOSK PAGE
═══════════════════════════════════════════════════════════════ */
export default function KioskPage() {
  /* ── URL params (remote config) ── */
  const paramTheme   = useSearchParam('theme',   'dark');   // dark | light
  const paramSpeed   = useSearchParam('speed',   '9');      // seconds per slide
  const paramRefresh = useSearchParam('refresh', '120');    // auto-refresh interval (s)
  const paramDept    = useSearchParam('dept',    '');       // filter by dept ID
  const paramMusic   = useSearchParam('music',   '');       // URL of background music file

  const dark = paramTheme !== 'light';
  const slideMs  = Math.max(4, parseInt(paramSpeed,   10) || 9)  * 1000;
  const refreshS = Math.max(30, parseInt(paramRefresh, 10) || 120);

  /* ── data state ── */
  const [posts,  setPosts]  = useState<Post[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── clock ── */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── slide indices ── */
  const [heroIdx,  setHeroIdx]  = useState(0);

  /* ── body auto-scroll refs ── */
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const rafRef        = useRef<number>(0);

  /* ── fetch data ── */
  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (paramDept) params.set('departmentId', paramDept);

      const [postsRes, eventsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/posts/public?${params}`),
        fetch(`${API_BASE}/events/public?startDate=${new Date().toISOString()}`),
      ]);

      if (postsRes.status === 'fulfilled' && postsRes.value.ok)
        setPosts(await postsRes.value.json() as Post[]);
      if (eventsRes.status === 'fulfilled' && eventsRes.value.ok)
        setEvents(await eventsRes.value.json() as CalendarEvent[]);
    } catch { /* silently ignore */ }
    setLoading(false);
  }, [paramDept]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── auto-refresh (reload page) ── */
  useEffect(() => {
    const id = setTimeout(() => window.location.reload(), refreshS * 1000);
    return () => clearTimeout(id);
  }, [refreshS]);

  /* ── hero slide timer (per-post duration based on body length) ── */
  const heroSlideables = useMemo(
    () => posts.filter(p => parsePostImageUrls(p.imageUrl).length > 0),
    [posts]
  );
  useEffect(() => {
    if (heroSlideables.length < 2) return;
    const currentPost = heroSlideables[heroIdx];
    const duration = getPostSlideMs(currentPost, slideMs);
    const id = setTimeout(() => setHeroIdx(i => (i + 1) % heroSlideables.length), duration);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroIdx, heroSlideables.length, slideMs]);

  /* ── body auto-scroll ── */
  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el) return;
    // reset to top immediately when hero changes
    el.scrollTop = 0;
    cancelAnimationFrame(rafRef.current);

    const currentPost = heroSlideables[heroIdx] ?? posts[0];
    const totalMs = getPostSlideMs(currentPost, slideMs);
    const delayMs = 2200;                       // pause before scrolling starts
    const scrollMs = totalMs - delayMs - 600;  // finish scrolling 0.6 s before next slide

    const timerId = window.setTimeout(() => {
      const scrollDist = el.scrollHeight - el.clientHeight;
      if (scrollDist <= 0) return;
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - started) / Math.max(scrollMs, 1000), 1);
        // ease-in-out cubic
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        el.scrollTop = scrollDist * ease;
        if (t < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      clearTimeout(timerId);
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroIdx, slideMs, heroSlideables.length, posts.length]);

  /* ── Apply kiosk body class (hides scrollbars, locks overflow) ── */
  useEffect(() => {
    document.body.classList.add('kiosk-mode');
    return () => document.body.classList.remove('kiosk-mode');
  }, []);

  /* ── Wake Lock (prevent display sleep) ── */
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
        }
      } catch { /* not critical */ }
    };
    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  /* ── Background music ── */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicReady, setMusicReady] = useState(false);

  useEffect(() => {
    if (!paramMusic) return;
    const audio = new Audio(paramMusic);
    audio.loop = true;
    audio.volume = 0.35;
    audioRef.current = audio;
    setMusicReady(true);
    // Attempt autoplay immediately; browsers may block until a gesture
    audio.play().catch(() => {
      // Autoplay blocked — retry on first user interaction
      const onGesture = () => {
        audio.play().catch(() => {});
        window.removeEventListener('click', onGesture);
        window.removeEventListener('keydown', onGesture);
      };
      window.addEventListener('click', onGesture);
      window.addEventListener('keydown', onGesture);
    });
    return () => { audio.pause(); audio.src = ''; };
  }, [paramMusic]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const next = !musicMuted;
    audioRef.current.muted = next;
    if (!next && audioRef.current.paused) audioRef.current.play().catch(() => {});
    setMusicMuted(next);
  };

  /* ── fullscreen on click ── */
  const enterFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  };

  /* ── derived values ── */
  const hero = heroSlideables[heroIdx] ?? posts[0];
  const heroImgs = hero ? parsePostImageUrls(hero.imageUrl) : [];
  const heroImg  = heroImgs[0] ?? '';

  // All future non-announcement events — no cap — used by MiniCalendar so every event date is highlighted
  const calendarEvents = useMemo(() => {
    const now = new Date();
    return events.filter(e => !e.isAnnouncement && new Date(e.eventDate) >= now);
  }, [events]);

  /* ── color tokens ── */
  const bg       = dark ? '#0D0D0D' : '#F2EDE7';
  const surface  = dark ? '#161616' : '#FFFFFF';
  const surface2 = dark ? '#222'    : '#EAE5DF';
  const border   = dark ? '#2a2a2a' : '#D8D0C8';
  const txt      = dark ? '#FAFAFA' : '#1A1008';
  const muted    = dark ? '#888'    : '#6B6560';
  const accent   = '#E85D04';

  /* ────────────────────────── render ────────────────────────── */
  return (
    <div
      onClick={enterFullscreen}
      style={{
        width: '100vw', height: '100vh',
        background: bg, color: txt,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-oswald, Oswald, sans-serif)',
        cursor: 'default', userSelect: 'none',
      }}
    >
      {/* ══════════ TOP BAR ══════════ */}
      <header style={{
        flexShrink: 0, height: '10vh',
        background: surface,
        borderBottom: `2px solid ${accent}`,
        boxShadow: dark ? 'none' : '0 2px 12px rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 3vw',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2vw' }}>
          <div style={{
            width: '5.5vh', height: '5.5vh', borderRadius: '50%',
            background: accent, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: '2.5vh', fontWeight: 900, color: '#fff' }}>C</span>
          </div>
          <div>
            <div style={{
              fontSize: '2.8vh', fontWeight: 700, letterSpacing: '1px',
              fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
              color: txt, lineHeight: 1.1,
            }}>
              CvSU CEIT <span style={{ color: accent }}>Bulletin</span>
            </div>
            <div style={{ fontSize: '1.1vh', letterSpacing: '3px', textTransform: 'uppercase', color: muted, marginTop: '1px' }}>
              College of Engineering &amp; Information Technology
            </div>
          </div>
        </div>

        {/* Centre: date */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5vh', letterSpacing: '2px', textTransform: 'uppercase', color: muted }}>
            {now ? fmtDateLong(now) : ''}
          </div>
        </div>

        {/* Right: clock + indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2vw' }}>
          {/* Theme toggle */}
          <button
            onClick={e => {
              e.stopPropagation();
              const url = new URL(window.location.href);
              url.searchParams.set('theme', dark ? 'light' : 'dark');
              window.location.href = url.toString();
            }}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              background: 'none',
              border: `1px solid ${border}`,
              color: muted,
              fontSize: '1.8vh',
              cursor: 'pointer',
              padding: '0.4vh 0.8vw',
              borderRadius: '6px',
              display: 'flex', alignItems: 'center', gap: '0.5vw',
              transition: 'background 0.2s',
            }}
          >
            <span>{dark ? '☀️' : '🌙'}</span>
            <span style={{ fontSize: '1.1vh', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {dark ? 'Light' : 'Dark'}
            </span>
          </button>
          {/* Music toggle (only shown when a music URL is provided) */}
          {musicReady && (
            <button
              onClick={toggleMute}
              title={musicMuted ? 'Unmute music' : 'Mute music'}
              style={{
                background: 'none',
                border: `1px solid ${border}`,
                color: musicMuted ? accent : txt,
                fontSize: '1.8vh',
                cursor: 'pointer',
                padding: '0.4vh 0.8vw',
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', gap: '0.5vw',
                transition: 'background 0.2s',
              }}
            >
              <span>{musicMuted ? '🔇' : '🔊'}</span>
              <span style={{ fontSize: '1.1vh', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {musicMuted ? 'Muted' : 'Music'}
              </span>
            </button>
          )}
          {/* Live refresh dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6vw' }}>
            <span style={{
              display: 'inline-block', width: '1vh', height: '1vh',
              borderRadius: '50%', background: '#22c55e',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{ fontSize: '1.2vh', color: muted, letterSpacing: '1px', textTransform: 'uppercase' }}>Live</span>
          </div>
          {/* Clock */}
          <div style={{
            fontSize: '3.8vh', fontWeight: 600, letterSpacing: '2px',
            color: accent, lineHeight: 1,
          }}>
            {now ? fmtTime(now) : '--:--:-- --'}
          </div>
        </div>
      </header>

      {/* ══════════ MAIN AREA ══════════ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── LEFT: Hero slideshow (65%) ── */}
        <div style={{ flex: '0 0 65%', position: 'relative', overflow: 'hidden', background: dark ? '#000' : '#D6CFC8' }}>
          {loading ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2vh' }}>
              <div style={{
                width: '6vh', height: '6vh',
                border: `3px solid ${accent}33`,
                borderTop: `3px solid ${accent}`,
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }} />
              <span style={{ fontSize: '2vh', color: muted, letterSpacing: '3px', textTransform: 'uppercase' }}>Loading…</span>
            </div>
          ) : hero ? (
            <>
              {/* Background image */}
              {heroImg && (
                <>
                  {/* Blurred backdrop to fill letterbox areas */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`${hero.id}-bg`}
                    src={heroImg}
                    alt=""
                    style={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%',
                      objectFit: 'cover',
                      filter: dark
                        ? 'blur(28px) brightness(0.35) saturate(1.2)'
                        : 'blur(28px) brightness(0.75) saturate(0.9)',
                      transform: 'scale(1.08)',
                      animation: 'fadeIn 0.9s ease',
                    }}
                  />
                  {/* Main image — full photo, no cropping */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={hero.id}
                    src={heroImg}
                    alt=""
                    style={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center center',
                      animation: 'fadeIn 0.9s ease',
                    }}
                  />
                </>
              )}

              {/* Gradient overlay — always dark for text contrast over photos */}
              <div style={{
                position: 'absolute', inset: 0,
                background: heroImg
                  ? dark
                    ? 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.05) 100%)'
                    : 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0.0) 100%)'
                  : bg,
              }} />

              {/* Text overlay */}
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                padding: '4% 5%',
              }}>
                {hero.departmentName && (
                  <div style={{
                    display: 'inline-block',
                    background: accent, color: '#fff',
                    fontSize: '1.6vh', fontWeight: 700,
                    letterSpacing: '2.5px', textTransform: 'uppercase',
                    padding: '0.4vh 1.2vw', marginBottom: '1.5vh',
                  }}>
                    {hero.departmentName}
                  </div>
                )}
                <h1 style={{
                  fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
                  fontSize: 'clamp(2rem, 4.5vh, 5vh)',
                  fontWeight: 900, color: '#fff',
                  lineHeight: 1.15, marginBottom: '1.5vh',
                  textShadow: '0 2px 12px rgba(0,0,0,0.6)',
                }}>
                  {hero.caption}
                </h1>
                <div style={{ fontSize: '1.3vh', color: 'rgba(255,255,255,0.5)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  {hero.adminName && <span>By {hero.adminName}</span>}
                  {hero.adminName && <span style={{ margin: '0 0.8vw' }}>·</span>}
                  <span>{new Date(hero.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>

              {/* Slide dots */}
              {heroSlideables.length > 1 && (
                <div style={{
                  position: 'absolute', bottom: '2.5%', right: '3%',
                  display: 'flex', gap: '0.5vw',
                }}>
                  {heroSlideables.map((_, i) => (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); setHeroIdx(i); }}
                      style={{
                        width: i === heroIdx ? '2.8vw' : '0.8vw',
                        height: '0.5vh',
                        borderRadius: '999px',
                        background: i === heroIdx ? accent : 'rgba(255,255,255,0.35)',
                        border: 'none', cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2vh' }}>
              <span style={{ fontSize: '6vh', opacity: 0.3 }}>📰</span>
              <span style={{ fontSize: '1.8vh', color: muted, letterSpacing: '2px', textTransform: 'uppercase' }}>No posts available</span>
            </div>
          )}
        </div>

        {/* ── RIGHT sidebar (35%) ── */}
        <div style={{
          flex: '0 0 35%',
          display: 'flex', flexDirection: 'column',
          borderLeft: `1px solid ${border}`,
          overflow: 'hidden',
        }}>

          {/* ── Full description of active hero post (TOP) ── */}
          <div style={{
            flex: '0 0 60%',
            padding: '2vh 2vw',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            borderBottom: `1px solid ${border}`,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1vw',
              marginBottom: '1.5vh',
              paddingBottom: '1.2vh',
              borderBottom: `2px solid ${accent}`,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '2.2vh' }}>📰</span>
              <span style={{
                fontSize: '1.5vh', fontWeight: 600,
                letterSpacing: '3px', textTransform: 'uppercase', color: txt,
              }}>Post Details</span>
            </div>

            {hero ? (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1vh' }}>
                {/* Caption */}
                <div style={{
                  fontSize: '2vh', fontWeight: 700, color: txt,
                  fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
                  lineHeight: 1.3,
                  flexShrink: 0,
                }}>
                  {hero.caption}
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1vw', flexShrink: 0, flexWrap: 'wrap' }}>
                  {hero.departmentName && (
                    <span style={{
                      fontSize: '1.1vh', fontWeight: 700, color: '#fff',
                      background: accent, padding: '0.3vh 0.8vw',
                      letterSpacing: '1.5px', textTransform: 'uppercase',
                    }}>
                      {hero.departmentName}
                    </span>
                  )}
                  {hero.adminName && (
                    <span style={{ fontSize: '1.2vh', color: muted }}>By {hero.adminName}</span>
                  )}
                  <span style={{ fontSize: '1.2vh', color: muted }}>
                    {new Date(hero.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                {/* Body — scrollable, auto-scrolled */}
                <div
                  ref={bodyScrollRef}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    fontSize: '2vh',
                    color: dark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.78)',
                    fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)",
                    lineHeight: 1.8,
                    paddingRight: '0.5vw',
                  }}>
                  {hero.body || <span style={{ color: muted, fontStyle: 'italic' }}>No description available.</span>}
                </div>

                {/* Post counter */}
                {heroSlideables.length > 1 && (
                  <div style={{ flexShrink: 0, fontSize: '1.1vh', color: muted, letterSpacing: '1px', textAlign: 'right' }}>
                    {heroIdx + 1} / {heroSlideables.length}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* ── Mini Calendar + Events ── */}
          <MiniCalendar events={calendarEvents} accent={accent} surface={surface} surface2={surface2} border={border} txt={txt} muted={muted} dark={dark} />
        </div>
      </div>

      {/* ══════════ BOTTOM TICKER ══════════ */}
      <div style={{
        flexShrink: 0, height: '7vh',
        background: surface,
        borderTop: `2px solid ${accent}`,
        boxShadow: dark ? 'none' : '0 -2px 12px rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
      }}>
        {/* Label */}
        <div style={{
          flexShrink: 0,
          background: accent, color: '#fff',
          height: '100%',
          display: 'flex', alignItems: 'center',
          padding: '0 2vw',
          fontSize: '1.5vh', fontWeight: 700,
          letterSpacing: '2.5px', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          Latest
        </div>

        {/* Scrolling track */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}>
          <div
            className="kiosk-ticker"
            style={{
              display: 'flex', alignItems: 'center', height: '100%',
              whiteSpace: 'nowrap',
              willChange: 'transform',
              animation: `kioskTicker ${Math.max(3, posts.length * 1)}s linear infinite`,
            }}
          >
            {[...posts, ...posts].map((post, idx) => (
              <div key={`${post.id}-${idx}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: '1.2vw',
                flexShrink: 0, paddingRight: '6vw',
              }}>
                {post.departmentName && (
                  <span style={{
                    fontSize: '1.2vh', fontWeight: 700,
                    color: accent, letterSpacing: '1.5px', textTransform: 'uppercase',
                  }}>
                    [{post.departmentName}]
                  </span>
                )}
                <span style={{
                  fontSize: '1.8vh', color: txt,
                  fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
                  fontWeight: 600,
                }}>
                  {post.caption}
                </span>
                <span style={{ color: accent, fontSize: '1.5vh', opacity: 0.5 }}>◆</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: link to viewer + clock mini */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '1.5vw',
          padding: '0 2vw',
          borderLeft: `1px solid ${border}`,
          height: '100%',
        }}>
          <Link
            href="/viewer"
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: '1.2vh', letterSpacing: '2px', textTransform: 'uppercase',
              color: muted, textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '0.5vw',
            }}
          >
            <span style={{ fontSize: '1.6vh' }}>🖥</span>
            Viewer
          </Link>
          <div style={{
            fontSize: '1.3vh', color: muted, letterSpacing: '1px',
            textAlign: 'right', lineHeight: 1.4,
          }}>
            <div>Refreshes in</div>
            <div style={{ color: accent, fontWeight: 600 }}>{refreshS}s</div>
          </div>
        </div>
      </div>

      {/* ══════════ KEYFRAMES ══════════ */}
      <style>{`
        @keyframes kioskTicker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(1.03); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Mini Calendar with event indicators
───────────────────────────────────────────────────────────── */
function MiniCalendar({ events, accent, surface, surface2, border, txt, muted, dark }: {
  events: CalendarEvent[];
  accent: string; surface: string; surface2: string; border: string; txt: string; muted: string; dark: boolean;
}) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Auto-advance to highlight next event date every 5s
  const eventDatesInView = events
    .map(e => new Date(e.eventDate))
    .filter(d => d.getFullYear() === viewYear && d.getMonth() === viewMonth);

  useEffect(() => {
    if (events.length === 0) return;
    // jump to first event month on load
    const first = new Date(events[0].eventDate);
    setViewYear(first.getFullYear());
    setViewMonth(first.getMonth());
    setSelectedDay(first.getDate());
  }, [events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-cycle selected day through events in current view
  useEffect(() => {
    if (eventDatesInView.length === 0) return;
    const days = [...new Set(eventDatesInView.map(d => d.getDate()))].sort((a, b) => a - b);
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % days.length;
      setSelectedDay(days[i]);
    }, 4000);
    return () => clearInterval(id);
  }, [viewYear, viewMonth, eventDatesInView.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  // Map: day → events
  const dayEventMap: Record<number, CalendarEvent[]> = {};
  events.forEach(ev => {
    const d = new Date(ev.eventDate);
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
      const day = d.getDate();
      if (!dayEventMap[day]) dayEventMap[day] = [];
      dayEventMap[day].push(ev);
    }
  });

  const selectedEvents = selectedDay ? (dayEventMap[selectedDay] ?? []) : [];
  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', padding: '1.5vh 1.5vw', display: 'flex', flexDirection: 'column', gap: '1.2vh', background: surface }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1vw',
        paddingBottom: '1.2vh', borderBottom: `2px solid ${accent}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '2.2vh' }}>📅</span>
        <span style={{ fontSize: '1.5vh', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', color: txt }}>
          Upcoming Events
        </span>
        {events.length > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: '1.1vh', fontWeight: 700,
            background: accent, color: '#fff', padding: '0.2vh 0.7vw', borderRadius: '999px',
          }}>{events.length}</span>
        )}
      </div>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={prevMonth} style={{
          background: 'none', border: `1px solid ${border}`, color: txt,
          fontSize: '1.6vh', cursor: 'pointer', padding: '0.3vh 0.8vw', borderRadius: '4px',
        }}>‹</button>
        <span style={{ fontSize: '1.5vh', fontWeight: 700, color: txt, letterSpacing: '1px' }}>
          {monthName}
        </span>
        <button onClick={nextMonth} style={{
          background: 'none', border: `1px solid ${border}`, color: txt,
          fontSize: '1.6vh', cursor: 'pointer', padding: '0.3vh 0.8vw', borderRadius: '4px',
        }}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3vh', flexShrink: 0 }}>
        {DOW.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '1.1vh', fontWeight: 700,
            color: muted, letterSpacing: '1px', textTransform: 'uppercase',
            paddingBottom: '0.4vh',
          }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4vh', flexShrink: 0 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
          const hasEvent = !!dayEventMap[day];
          const isSelected = day === selectedDay;
          return (
            <div
              key={day}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              style={{
                textAlign: 'center',
                fontSize: '1.4vh',
                padding: '0.5vh 0',
                borderRadius: '4px',
                cursor: hasEvent ? 'pointer' : 'default',
                background: isSelected ? accent
                  : isToday ? `${accent}44`
                  : hasEvent ? `${accent}33`
                  : 'transparent',
                color: isSelected ? '#fff' : hasEvent ? accent : muted,
                border: isSelected ? `1px solid transparent`
                  : isToday ? `1.5px solid ${accent}`
                  : hasEvent ? `1.5px solid ${accent}99`
                  : '1px solid transparent',
                fontWeight: hasEvent ? 800 : 400,
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              {day}
              {hasEvent && !isSelected && (
                <div style={{
                  position: 'absolute', bottom: '0.3vh', left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', gap: '0.2vw',
                }}>
                  {dayEventMap[day].slice(0, 3).map((_, i) => (
                    <div key={i} style={{
                      width: '0.55vw', height: '0.55vw', borderRadius: '50%', background: accent,
                    }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: border, flexShrink: 0 }} />

      {/* Event details for selected day */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1vh' }}>
        {selectedEvents.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: '1vh' }}>
            <span style={{ fontSize: '1.3vh', color: muted, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {events.length === 0 ? 'No upcoming events' : 'Select a highlighted date'}
            </span>
          </div>
        ) : (
          selectedEvents.map(ev => (
            <div key={ev.id} style={{
              background: surface2,
              borderLeft: `3px solid ${accent}`,
              padding: '1.2vh 1.2vw',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: '1.6vh', fontWeight: 700, color: txt, lineHeight: 1.3, marginBottom: '0.5vh' }}>
                {ev.title}
              </div>
              {ev.endDate && (
                <div style={{ fontSize: '1.1vh', color: muted, marginBottom: '0.3vh' }}>
                  Until {new Date(ev.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
              {ev.location && (
                <div style={{ fontSize: '1.2vh', color: muted, marginBottom: '0.3vh' }}>📍 {ev.location}</div>
              )}
              {ev.description && (
                <div style={{
                  fontSize: '1.25vh',
                  color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                  lineHeight: 1.55, marginBottom: '0.4vh',
                  display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {ev.description}
                </div>
              )}
              {ev.departmentName && (
                <div style={{ fontSize: '1.1vh', color: accent, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {ev.departmentName}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

