'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type ThemeMode = 'dark' | 'light';

interface Department {
  id: string;
  name: string;
}

interface PageHeaderProps {
  theme: ThemeMode;
  onThemeToggle: () => void;
  onNavigate?: () => void;
  currentPage?: 'viewer' | 'events' | 'documents';
  departments?: Department[];
  currentFilter?: string;
  onFilterChange?: (deptId: string) => void;
  showFilter?: boolean;
  todayStr?: string;
}

export default function PageHeader({
  theme,
  onThemeToggle,
  onNavigate,
  currentPage = 'viewer',
  departments = [],
  currentFilter = '',
  onFilterChange,
  showFilter: externalShowFilter = false,
  todayStr,
}: PageHeaderProps) {
  const d = theme === 'dark';
  const [scrolled, setScrolled] = useState(false);
  const [showFilter, setShowFilter] = useState(externalShowFilter);
  const filterRef = useRef<HTMLDivElement | null>(null);

  // Handle scroll effect for masthead collapse
useEffect(() => {
  let lastY = window.scrollY;
  let ticking = false;
  let topPullAccum = 0;
  let waitingForTopPull = false;

  const stateRef = { current: false }; // false = expanded, true = collapsed

  const PULL_THRESHOLD = 60;

  const setSafeScrolled = (value: boolean) => {
    if (stateRef.current === value) return;
    stateRef.current = value;
    setScrolled(value);
  };

  const update = (y: number) => {
    const atTop = y <= 0;

    if (!atTop) {
      // Any scroll away from top keeps the masthead collapsed.
      setSafeScrolled(true);
      waitingForTopPull = false;
      topPullAccum = 0;
      lastY = y;
      return;
    }

    // Reaching top from below arms expansion, but does not expand yet.
    if (lastY > 0) {
      waitingForTopPull = true;
      topPullAccum = 0;
    }

    // Stay collapsed at top until user performs an extra upward pull.
    lastY = y;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      update(window.scrollY);
      ticking = false;
    });
  };

  const onWheel = (e: WheelEvent) => {
    if (window.scrollY === 0 && waitingForTopPull && e.deltaY < 0) {
      topPullAccum += Math.abs(e.deltaY);

      if (topPullAccum >= PULL_THRESHOLD) {
        setSafeScrolled(false);
        waitingForTopPull = false;
        topPullAccum = 0;
      }
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: true });

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("wheel", onWheel);
  };
}, []);

  const handleFilterToggle = () => {
    setShowFilter((v) => !v);
  };

  const handleFilterSelect = (deptId: string) => {
    onFilterChange?.(deptId);
    setShowFilter(false);
  };

  const defaultTodayStr =
    todayStr ||
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const navItems = [
    { href: '/viewer', label: 'Home', id: 'viewer' },
    { href: '/events', label: 'Events', id: 'events' },
    { href: '/documents', label: 'Documents', id: 'documents' },
  ];

  return (
    <>
      {/* ── TICKER ── */}
      <div className="sticky top-0 z-50 bg-[#E85D04] overflow-hidden py-[7px]">
        <div className="flex items-center">
          <div
            className="flex-shrink-0 bg-[#0D0D0D] text-[#E85D04] px-3 h-[26px] flex items-center"
            style={{
              fontFamily: "var(--font-oswald, Oswald, sans-serif)",
              fontSize: '11px',
              letterSpacing: '2px',
              fontWeight: 600,
            }}
          >
            BREAKING
          </div>
          <div className="overflow-hidden flex-1">
            <div
              className="ticker-scroll-track whitespace-nowrap inline-flex gap-16 text-white"
              style={{
                fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                fontSize: '12px',
                letterSpacing: '0.5px',
              }}
            >
              <span>◆&nbsp;&nbsp;CvSU CEIT Bulletin — Truth, Excellence, and Service</span>
              <span>◆&nbsp;&nbsp;CvSU CEIT Bulletin — Truth, Excellence, and Service</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MASTHEAD ── */}
      <div
        className={`sticky top-[40px] z-30 border-b-4 border-[#E85D04] transition-shadow duration-300 ${
          scrolled ? 'shadow-xl' : ''
        } ${d ? 'bg-[#0D0D0D]' : 'bg-[#FAFAFA]'}`}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          {/* Collapsible large title strip */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              scrolled
                ? 'max-h-0 opacity-0 pointer-events-none'
                : 'max-h-[200px] opacity-100 pt-6 pb-4'
            }`}
          >
            <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4">
              <div
                className={d ? 'text-[#888888]' : 'text-[#4A4A4A]'}
                style={{
                  fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                  fontSize: '11px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  lineHeight: '1.8',
                }}
              >
                {defaultTodayStr}
                <br />
                Cavite State University
                <br />
                CEIT Department
              </div>
              <div className="text-center flex-1">
                <h1
                  style={{
                    fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
                    fontWeight: 900,
                    lineHeight: 0.95,
                    letterSpacing: '-2px',
                    fontSize: 'clamp(36px,7vw,74px)',
                  }}
                  className={d ? 'text-white' : 'text-[#0D0D0D]'}
                >
                  CvSU CEIT <span className="text-[#E85D04]">BULLETIN</span>
                </h1>
                <div
                  className={`mt-2 py-1 border-t border-b ${
                    d ? 'border-[#2a2a2a]' : 'border-[#C4C4C4]'
                  }`}
                  style={{
                    fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                    fontSize: '11px',
                    letterSpacing: '4px',
                    color: d ? '#888888' : '#4A4A4A',
                    textTransform: 'uppercase',
                  }}
                >
                  Truth &nbsp;·&nbsp; Excellence &nbsp;·&nbsp; Service
                </div>
              </div>
            </div>
          </div>

          {/* NAV */}
          <nav className="bg-[#0D0D0D] -mx-6 md:-mx-10 px-6 md:px-10 relative">
            <div className="max-w-[1280px] mx-auto flex flex-wrap items-center">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  onClick={onNavigate}
                  href={item.href}
                  className={`text-[#C4C4C4] hover:text-[#E85D04] border-b-[3px] transition-all ${
                    currentPage === item.id
                      ? 'border-[#E85D04] text-[#E85D04]'
                      : 'border-transparent hover:border-[#E85D04]'
                  }`}
                  style={{
                    fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                    fontSize: '13px',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    padding: '12px 18px',
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  {item.label}
                </Link>
              ))}

              <div className="ml-auto flex items-center gap-2 relative" ref={filterRef}>
                {/* Theme toggle */}
                <div className="flex items-center border border-[#2a2a2a]">
                  <button
                    onClick={() => theme !== 'dark' && onThemeToggle()}
                    className={`px-3 py-[6px] font-semibold transition-all ${
                      theme === 'dark'
                        ? 'bg-[#E85D04] text-white'
                        : 'text-[#C4C4C4] hover:text-[#E85D04]'
                    }`}
                    style={{
                      fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                      fontSize: '13px',
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => theme !== 'light' && onThemeToggle()}
                    className={`px-3 py-[6px] font-semibold transition-all ${
                      theme === 'light'
                        ? 'bg-[#E85D04] text-white'
                        : 'text-[#C4C4C4] hover:text-[#E85D04]'
                    }`}
                    style={{
                      fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                      fontSize: '13px',
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Light
                  </button>
                </div>

                {/* Department filter (only show if departments are provided) */}
                {departments.length > 0 && (
                  <button
                    onClick={handleFilterToggle}
                    className="flex items-center gap-2 text-[#C4C4C4] hover:text-[#E85D04] transition-colors border border-[#2a2a2a] hover:border-[#E85D04] py-[6px] px-3"
                    style={{
                      fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                      fontSize: '12px',
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {currentFilter
                      ? departments.find((dep) => dep.id === currentFilter)?.name ??
                        'Filtered'
                      : 'All Depts'}
                    <span className="text-[10px]">▾</span>
                  </button>
                )}

                {showFilter && departments.length > 0 && (
                  <div
                    className="absolute top-full right-0 z-30 min-w-[200px] border border-[#2a2a2a] bg-[#0D0D0D] shadow-xl"
                    style={{ marginTop: '1px' }}
                  >
                    <button
                      onClick={() => handleFilterSelect('')}
                      className="block w-full px-4 py-3 text-left text-[#C4C4C4] hover:text-[#E85D04] hover:bg-[rgba(232,93,4,0.1)] transition-colors"
                      style={{
                        fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                        fontSize: '12px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      All Departments
                    </button>
                    {departments.map((dept) => (
                      <button
                        key={dept.id}
                        onClick={() => handleFilterSelect(dept.id)}
                        className="block w-full px-4 py-3 text-left text-[#C4C4C4] hover:text-[#E85D04] hover:bg-[rgba(232,93,4,0.1)] transition-colors"
                        style={{
                          fontFamily: "var(--font-oswald, Oswald, sans-serif)",
                          fontSize: '12px',
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                        }}
                      >
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
    </>
  );
}
