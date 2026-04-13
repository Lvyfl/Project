import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default async function PdfPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pdfUrl = `${API_BASE}/documents/${encodeURIComponent(id)}`;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-6 py-4 border-b border-orange-500/20 bg-black/40 backdrop-blur-xl flex items-center gap-4">
        <Link href="/dashboard" className="text-orange-300 hover:text-orange-200 font-semibold">
          ← Back
        </Link>
        <div className="text-sm text-gray-300 truncate">PDF Preview</div>
        <div className="ml-auto">
          <a
            href={pdfUrl}
            className="px-3 py-2 rounded-lg bg-orange-500/15 border border-orange-500/25 text-orange-200 text-sm font-semibold hover:bg-orange-500/25"
            target="_blank"
            rel="noreferrer"
          >
            Open in new tab
          </a>
        </div>
      </div>

      <div className="flex-1">
        <iframe
          src={pdfUrl}
          title="PDF Preview"
          className="w-full h-[calc(100vh-64px)] border-0"
        />
      </div>
    </div>
  );
}
