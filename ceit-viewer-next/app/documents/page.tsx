'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import PdfThumbnail from './PdfThumbnail';
import PageHeader from '@/components/PageHeader';

type ThemeMode = 'dark' | 'light';

type PdfDocument = {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  created_at: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const d = theme === 'dark';
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isNavigatingModule, setIsNavigatingModule] = useState(false);
  const LIMIT = 12;

  const startModuleNavigation = () => setIsNavigatingModule(true);

  useEffect(() => {
    const stored = localStorage.getItem('theme') as ThemeMode | null;
    const initial = stored === 'light' || stored === 'dark' ? stored : 'dark';
    setTheme(initial);
    document.documentElement.classList.toggle('light', initial === 'light');
    document.documentElement.classList.toggle('dark', initial === 'dark');
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

  const loadDocuments = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError('');
    try {
      const offset = (pageNum - 1) * LIMIT;
      const res = await fetch(`${API_BASE}/documents?limit=${LIMIT + 1}&offset=${offset}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = (await res.json()) as PdfDocument[];
      setHasMore(data.length > LIMIT);
      setDocuments(data.slice(0, LIMIT));
    } catch (e) {
      setError(`Failed to load documents: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments(page);
  }, [loadDocuments, page]);

  useEffect(() => {
    setIsNavigatingModule(false);
  }, [pathname]);

  const bg = d ? 'bg-[#0D0D0D]' : 'bg-[#FAFAFA]';
  const textColor = d ? 'text-[#FAFAFA]' : 'text-[#0D0D0D]';

  return (
    <div
      className={`min-h-screen ${bg} ${textColor}`}
      style={{ fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)" }}
    >
      {/* ── PAGE HEADER ── */}
      <PageHeader
        theme={theme}
        onThemeToggle={toggleTheme}
        onNavigate={startModuleNavigation}
        currentPage="documents"
      />

      {/* ── MAIN ── */}
      <main className="mx-auto w-full max-w-[1200px] p-5 lg:p-7">
        {/* Section header */}
        <div className="flex items-center gap-4 mb-6">
          <h2
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '3px' }}
            className={`text-[13px] font-semibold uppercase whitespace-nowrap ${d ? 'text-white' : 'text-[#0D0D0D]'}`}
          >
            PDF Documents
          </h2>
          <div className="flex-1 h-[2px] bg-[#E85D04]" />
          {!loading && (
            <span
              className={`text-xs whitespace-nowrap ${d ? 'text-zinc-400' : 'text-zinc-500'}`}
              style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              {documents.length} file{documents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading && (
          <div
            className={`mb-6 border-l-4 border-[#E85D04] px-5 py-4 ${d ? 'bg-[#1a1000]' : 'bg-[#FFF8F0]'}`}
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}
          >
            Loading documents…
          </div>
        )}

        {error && (
          <div
            className="mb-6 border-l-4 border-red-500 px-5 py-4 text-red-400"
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", fontSize: '13px' }}
          >
            {error}
          </div>
        )}

        {!loading && !error && documents.length === 0 && (
          <div
            className={`rounded-2xl border p-10 text-center ${
              d ? 'border-orange-500/15 bg-black/35 text-zinc-400' : 'border-orange-200 bg-white text-zinc-500'
            }`}
          >
            <div className="text-4xl mb-3">📄</div>
            <p
              style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1.5px', textTransform: 'uppercase', fontSize: '13px' }}
            >
              No documents published yet.
            </p>
          </div>
        )}

        {!loading && documents.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {documents.map((doc) => {
              const pdfUrl = `${API_BASE}/documents/${encodeURIComponent(doc.id)}`;
              const uploadedDate = new Date(doc.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              const displayName = doc.filename.replace(/\.pdf$/i, '');

              return (
                <Link
                  key={doc.id}
                  href={`/pdf/${doc.id}`}
                  className={`group flex flex-col rounded-xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
                    d
                      ? 'border-orange-500/15 bg-black/40 hover:border-orange-500/35 hover:shadow-orange-900/20'
                      : 'border-orange-200 bg-white hover:border-orange-400 hover:shadow-orange-100/60'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className={`relative border-b ${d ? 'border-orange-500/10' : 'border-orange-100'}`}>
                    <PdfThumbnail pdfUrl={pdfUrl} dark={d} />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-[#E85D04]/0 group-hover:bg-[#E85D04]/10 transition-colors flex items-center justify-center">
                      <span
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#E85D04] text-white text-xs font-semibold px-3 py-1.5 rounded-full"
                        style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1px', textTransform: 'uppercase' }}
                      >
                        Open →
                      </span>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="p-3 flex flex-col gap-1">
                    <p
                      className={`text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#E85D04] transition-colors ${
                        d ? 'text-zinc-100' : 'text-zinc-900'
                      }`}
                      style={{ fontFamily: "var(--font-baskerville, 'Libre Baskerville', Georgia, serif)" }}
                    >
                      {displayName}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span
                        className={`text-[10px] ${d ? 'text-zinc-500' : 'text-zinc-400'}`}
                        style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '0.5px', textTransform: 'uppercase' }}
                      >
                        {uploadedDate}
                      </span>
                      <span
                        className={`text-[10px] ${d ? 'text-zinc-500' : 'text-zinc-400'}`}
                        style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '0.5px' }}
                      >
                        {formatFileSize(doc.size)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && (documents.length > 0 || page > 1) && (
          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                d
                  ? 'border-orange-500/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20'
                  : 'border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-200/80'
              }`}
              style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              ← Prev
            </button>
            <span
              className={`text-xs ${d ? 'text-zinc-400' : 'text-zinc-500'}`}
              style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1.5px', textTransform: 'uppercase' }}
            >
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                d
                  ? 'border-orange-500/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20'
                  : 'border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-200/80'
              }`}
              style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {/* ── MODULE NAVIGATION OVERLAY ── */}
      {isNavigatingModule && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/55 backdrop-blur-sm">
          <div
            className={`rounded-2xl border px-6 py-5 ${
              d ? 'bg-black/80 border-orange-500/30' : 'bg-white border-orange-200 shadow-lg'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500"></div>
              <p className={`text-sm font-medium ${d ? 'text-orange-100' : 'text-zinc-800'}`}>
                Loading module...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
