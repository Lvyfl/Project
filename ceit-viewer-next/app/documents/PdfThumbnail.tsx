'use client';

import { useEffect, useRef, useState } from 'react';

type Status = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  pdfUrl: string;
  dark: boolean;
}

export default function PdfThumbnail({ pdfUrl, dark }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.5.207/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) { pdf.destroy(); return; }

        const page = await pdf.getPage(1);
        if (cancelled) { pdf.destroy(); return; }

        const viewport = page.getViewport({ scale: 1 });
        const TARGET_WIDTH = 320;
        const scale = TARGET_WIDTH / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) { pdf.destroy(); return; }

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) { pdf.destroy(); return; }

        await page.render({ canvasContext: ctx, canvas, viewport: scaledViewport }).promise;
        pdf.destroy();

        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  return (
    <div
      className={`w-full overflow-hidden rounded-t-xl flex items-center justify-center ${
        dark ? 'bg-zinc-900' : 'bg-zinc-100'
      }`}
      style={{ aspectRatio: '1 / 1.414' /* A4 ratio */ }}
    >
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500" />
          <span
            className={`text-[10px] ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1px', textTransform: 'uppercase' }}
          >
            Rendering…
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
          <div
            className={`text-3xl font-bold ${dark ? 'text-orange-500/30' : 'text-orange-300'}`}
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)" }}
          >
            PDF
          </div>
          <span
            className={`text-[10px] ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}
            style={{ fontFamily: "var(--font-oswald, Oswald, sans-serif)", letterSpacing: '1px', textTransform: 'uppercase' }}
          >
            No preview
          </span>
        </div>
      )}

      {/* Canvas — rendered by pdfjs, shown only when done */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-contain ${status === 'done' ? 'block' : 'hidden'}`}
        style={{ display: status === 'done' ? 'block' : 'none' }}
      />
    </div>
  );
}
