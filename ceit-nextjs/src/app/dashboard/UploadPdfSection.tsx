'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { postsAPI } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'next/navigation';

type DepartmentPost = {
  id: string;
  caption: string;
  imageUrl?: string | null;
  createdAt: string;
  hasPdf?: boolean;
};

function formatDateTime(dateStr: string) {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function UploadPdfSection({
  mode = 'full',
  onUploaded,
}: {
  mode?: 'full' | 'formOnly';
  onUploaded?: () => void;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const d = theme === 'dark';

  const [caption, setCaption] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);
  const [generatingThumb, setGeneratingThumb] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [posts, setPosts] = useState<DepartmentPost[]>([]);
  const [deleteTargetPostId, setDeleteTargetPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{ title: string; message: string; kind: 'success' | 'error' } | null>(null);

  const pdfInfo = useMemo(() => {
    if (!pdfFile) return null;
    const sizeMB = (pdfFile.size / (1024 * 1024)).toFixed(2);
    return { name: pdfFile.name, sizeMB };
  }, [pdfFile]);

  const loadDepartmentPosts = useCallback(async () => {
    if (mode !== 'full') return;
    setLoadingPosts(true);
    try {
      const res = await postsAPI.getDepartmentPosts({ limit: 50, offset: 0 });
      setPosts(res.data);
    } catch (e) {
      console.error('Failed to load department posts', e);
    } finally {
      setLoadingPosts(false);
    }
  }, [mode]);

  useEffect(() => {
    loadDepartmentPosts();
  }, [loadDepartmentPosts]);

  useEffect(() => {
    return () => {
      if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    };
  }, [thumbPreviewUrl]);

  const onSelectPdf = async (file: File | null) => {
    setPdfFile(null);
    setThumbFile(null);
    if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    setThumbPreviewUrl(null);
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('PDF size must be less than 10MB');
      return;
    }

    setPdfFile(file);
  };

  const generateThumbnailFromFirstPage = async () => {
    if (!pdfFile) {
      alert('Please select a PDF file first');
      return;
    }

    setGeneratingThumb(true);
    try {
      const pdfjs = await import('pdfjs-dist');
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      }

      const bytes = await pdfFile.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      const firstPage = await pdf.getPage(1);

      const viewport = firstPage.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context');

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await firstPage.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.9);
      });
      if (!blob) throw new Error('Failed to generate thumbnail image');
      if (blob.size > 5 * 1024 * 1024) throw new Error('Generated thumbnail is larger than 5MB');

      const generatedThumb = new File(
        [blob],
        `${pdfFile.name.replace(/\.pdf$/i, '') || 'pdf'}-thumb.jpg`,
        { type: 'image/jpeg' }
      );

      setThumbFile(generatedThumb);
      if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
      setThumbPreviewUrl(URL.createObjectURL(generatedThumb));
    } catch (e: any) {
      alert(e?.message || 'Failed to generate thumbnail from PDF');
    } finally {
      setGeneratingThumb(false);
    }
  };

  const onSelectThumb = async (file: File | null) => {
    setThumbFile(null);
    if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    setThumbPreviewUrl(null);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file for thumbnail');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Thumbnail size must be less than 5MB');
      return;
    }

    setThumbFile(file);
    try {
      setThumbPreviewUrl(URL.createObjectURL(file));
    } catch (e: any) {
      alert(e?.message || 'Failed to preview thumbnail file');
    }
  };

  const resetForm = () => {
    setCaption('');
    setPdfFile(null);
    setThumbFile(null);
    if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    setThumbPreviewUrl(null);
  };

  const runUpload = async () => {
    if (!caption.trim()) {
      setUploadNotice({ title: 'Missing caption', message: 'Document caption is required.', kind: 'error' });
      return;
    }
    if (!pdfFile) {
      setUploadNotice({ title: 'Missing PDF', message: 'Please select a PDF file.', kind: 'error' });
      return;
    }
    if (!thumbFile) {
      setUploadNotice({ title: 'Missing thumbnail', message: 'Please select a thumbnail image.', kind: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('caption', caption.trim());
      fd.append('pdfFile', pdfFile);
      fd.append('thumbnailFile', thumbFile);

      await postsAPI.uploadDocument(fd);
      setUploadNotice({ title: 'Upload complete', message: '✅ Document uploaded successfully!', kind: 'success' });
      resetForm();
      if (mode === 'full') loadDepartmentPosts();
      onUploaded?.();
    } catch (err: any) {
      setUploadNotice({
        title: 'Upload failed',
        message: err.response?.data?.error || '❌ Failed to upload document',
        kind: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!caption.trim()) {
      setUploadNotice({ title: 'Missing caption', message: 'Document caption is required.', kind: 'error' });
      return;
    }
    if (!pdfFile) {
      setUploadNotice({ title: 'Missing PDF', message: 'Please select a PDF file.', kind: 'error' });
      return;
    }
    if (!thumbFile) {
      setUploadNotice({ title: 'Missing thumbnail', message: 'Please select a thumbnail image.', kind: 'error' });
      return;
    }

    setShowUploadConfirm(true);
  };

  const parseImageUrl = (imageUrl?: string | null) => {
    if (!imageUrl) return { isPdf: false, pdfData: '', thumbData: '' };
    if (imageUrl.includes('|')) {
      const [pdfData, thumbData] = imageUrl.split('|');
      return { isPdf: true, pdfData, thumbData };
    }
    if (imageUrl.toLowerCase().endsWith('.pdf') || imageUrl.startsWith('data:application/pdf')) {
      return { isPdf: true, pdfData: imageUrl, thumbData: '' };
    }
    return { isPdf: false, pdfData: imageUrl, thumbData: '' };
  };

  const viewPdf = async (post: DepartmentPost) => {
    const parsed = parseImageUrl(post.imageUrl);
    let pdfData = parsed.pdfData;

    try {
      if (pdfData === 'PDF_PLACEHOLDER') {
        const full = await postsAPI.getPostById(post.id);
        const fullParsed = parseImageUrl(full.data.imageUrl);
        pdfData = fullParsed.pdfData;
      }

      if (!pdfData) {
        alert('PDF data is not available for viewing.');
        return;
      }

      // Preferred: redirect to dedicated preview page (iframe-based)
      try {
        const url = new URL(pdfData, window.location.origin);
        const idx = url.pathname.indexOf('/documents/');
        if (idx >= 0) {
          const docId = url.pathname.slice(idx + '/documents/'.length).split('/')[0];
          if (docId) {
            router.push(`/pdf/${encodeURIComponent(docId)}`);
            return;
          }
        }
      } catch {
        // ignore
      }

      // Fallback: open the PDF URL/data directly
      window.open(pdfData, '_blank');
    } catch (e) {
      console.error(e);
      alert('Failed to open PDF');
    }
  };

  const deletePost = (id: string) => {
    setDeleteTargetPostId(id);
  };

  const confirmDeletePost = async () => {
    if (!deleteTargetPostId || deletingPostId) return;
    const id = deleteTargetPostId;
    try {
      setDeletingPostId(id);
      await postsAPI.deletePost(id);
      setDeleteTargetPostId(null);
      loadDepartmentPosts();
    } catch (err: any) {
      setDeleteTargetPostId(null);
      setDeleteErrorMessage(err.response?.data?.error || 'Failed to delete post');
    } finally {
      setDeletingPostId(null);
    }
  };

  return (
    <div className={`space-y-6 ${mode === 'formOnly' ? 'max-w-3xl mx-auto' : 'max-w-4xl'}`}>
      {/* Upload */}
      <div className={`rounded-2xl p-6 ${d ? 'bg-black/30 border border-orange-500/15' : 'bg-white border border-gray-200 shadow-sm'} transition-colors duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold ${d ? 'text-white' : 'text-gray-900'}`}>📄 Upload Document</h3>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-2 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Document Caption *</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              required
              className={`w-full px-4 py-3 rounded-xl text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                d ? 'bg-white/5 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-900'
              }`}
              placeholder="Enter a description or caption for this document..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-semibold mb-2 ${d ? 'text-gray-300' : 'text-gray-700'}`}>PDF Document *</label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => onSelectPdf(e.target.files?.[0] || null)}
                className="hidden"
                id="pdfInput"
              />
              <label
                htmlFor="pdfInput"
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                  d ? 'bg-white/5 border-2 border-dashed border-orange-500/30 text-orange-300 hover:bg-white/10' : 'bg-white border-2 border-dashed border-orange-300 text-orange-700 hover:bg-orange-50'
                }`}
              >
                <span>📎</span>
                <span className="text-sm font-semibold">Choose PDF File</span>
              </label>
              {pdfInfo && (
                <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${d ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                  ✅ Selected: <strong>{pdfInfo.name}</strong> ({pdfInfo.sizeMB} MB) - PDF
                </div>
              )}
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-2 ${d ? 'text-gray-300' : 'text-gray-700'}`}>Thumbnail Image *</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onSelectThumb(e.target.files?.[0] || null)}
                className="hidden"
                id="thumbInput"
              />
              <label
                htmlFor="thumbInput"
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                  d ? 'bg-white/5 border-2 border-dashed border-orange-500/30 text-orange-300 hover:bg-white/10' : 'bg-white border-2 border-dashed border-orange-300 text-orange-700 hover:bg-orange-50'
                }`}
              >
                <span>🖼️</span>
                <span className="text-sm font-semibold">Choose Thumbnail Image</span>
              </label>

              <button
                type="button"
                onClick={generateThumbnailFromFirstPage}
                disabled={!pdfFile || generatingThumb || submitting}
                className={`mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  d
                    ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/20'
                    : 'bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100'
                }`}
              >
                {generatingThumb ? 'Generating preview…' : '✨ Use first PDF page as thumbnail'}
              </button>

              {thumbPreviewUrl && (
                <div className="mt-2">
                  <img src={thumbPreviewUrl} alt="Thumbnail preview" className="w-40 h-24 object-cover rounded-xl border border-white/10" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                d ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
              }`}
              disabled={submitting}
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Uploading…' : '📤 Upload Document'}
            </button>
          </div>
        </form>
      </div>

      {/* Posts list */}
      {mode === 'full' && (
      <div className={`rounded-2xl p-6 ${d ? 'bg-black/30 border border-orange-500/15' : 'bg-white border border-gray-200 shadow-sm'} transition-colors duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold ${d ? 'text-white' : 'text-gray-900'}`}>📋 Your Department's Posts</h3>
          <button
            type="button"
            onClick={loadDepartmentPosts}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              d ? 'bg-white/5 border border-orange-500/20 text-orange-300 hover:bg-white/10' : 'bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100'
            }`}
          >
            🔄 Refresh
          </button>
        </div>

        {loadingPosts ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500/30 border-t-orange-500"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className={`text-center py-10 ${d ? 'text-gray-400' : 'text-gray-500'}`}>
            No posts yet. Upload your first document!
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const parsed = parseImageUrl(post.imageUrl);
              const isPdf = parsed.isPdf;
              const thumb = parsed.thumbData;
              return (
                <div key={post.id} className={`rounded-2xl p-4 ${d ? 'bg-white/5 border border-orange-500/10' : 'bg-gray-50 border border-gray-200'} transition-colors`}>
                  <div className="flex items-start gap-4">
                    <div className="w-24 flex-shrink-0">
                      {thumb ? (
                        <img src={thumb} alt="Thumbnail" className="w-24 h-24 object-cover rounded-xl border border-white/10" />
                      ) : (
                        <div className={`w-24 h-24 rounded-xl flex items-center justify-center ${d ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-100 border border-orange-200'}`}>
                          <span className="text-2xl">{isPdf ? '📄' : '🖼️'}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`max-w-full overflow-hidden text-sm font-semibold whitespace-pre-wrap ${d ? 'text-white' : 'text-gray-900'}`}
                        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                      >
                        {post.caption}
                      </p>
                      <p className={`text-xs mt-1 ${d ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateTime(post.createdAt)}</p>
                      {isPdf && (
                        <span className={`inline-flex items-center mt-2 text-[10px] px-2 py-1 rounded-full font-bold ${d ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                          📄 PDF
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isPdf && (
                        <button
                          type="button"
                          onClick={() => viewPdf(post)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            d ? 'bg-white/5 border border-orange-500/20 text-orange-300 hover:bg-white/10' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          View PDF
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deletePost(post.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          d ? 'bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/15' : 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {deleteTargetPostId && (
        <div className="fixed inset-0 z-[60] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setDeleteTargetPostId(null)}>
          <div className={`w-full max-w-md rounded-2xl p-6 ${d ? 'bg-zinc-900 border border-orange-500/25' : 'bg-white border border-orange-200 shadow-sm'}`} onClick={(e) => e.stopPropagation()}>
            <h4 className={`text-lg font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>Delete Post</h4>
            <p className={`mt-2 text-sm ${d ? 'text-orange-100/80' : 'text-gray-600'}`}>
              Delete this post? This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetPostId(null)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${d ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}
                disabled={deletingPostId === deleteTargetPostId}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeletePost}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={deletingPostId === deleteTargetPostId}
              >
                {deletingPostId === deleteTargetPostId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteErrorMessage && (
        <div className="fixed inset-0 z-[61] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setDeleteErrorMessage(null)}>
          <div className={`w-full max-w-md rounded-2xl p-6 ${d ? 'bg-zinc-900 border border-orange-500/25' : 'bg-white border border-orange-200 shadow-sm'}`} onClick={(e) => e.stopPropagation()}>
            <h4 className={`text-lg font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>Delete failed</h4>
            <p className={`mt-2 text-sm ${d ? 'text-orange-100/80' : 'text-gray-600'}`}>{deleteErrorMessage}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDeleteErrorMessage(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadConfirm && (
        <div className="fixed inset-0 z-[62] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => !submitting && setShowUploadConfirm(false)}>
          <div className={`w-full max-w-md rounded-2xl p-6 ${d ? 'bg-zinc-900 border border-orange-500/25' : 'bg-white border border-orange-200 shadow-sm'}`} onClick={(e) => e.stopPropagation()}>
            <h4 className={`text-lg font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>Confirm Upload</h4>
            <p className={`mt-2 text-sm ${d ? 'text-orange-100/80' : 'text-gray-600'}`}>
              Upload this PDF document now?
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUploadConfirm(false)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${d ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowUploadConfirm(false);
                  await runUpload();
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? 'Uploading...' : 'Confirm Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadNotice && (
        <div className="fixed inset-0 z-[63] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setUploadNotice(null)}>
          <div className={`w-full max-w-md rounded-2xl p-6 ${d ? 'bg-zinc-900 border border-orange-500/25' : 'bg-white border border-orange-200 shadow-sm'}`} onClick={(e) => e.stopPropagation()}>
            <h4 className={`text-lg font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>{uploadNotice.title}</h4>
            <p className={`mt-2 text-sm ${uploadNotice.kind === 'success' ? (d ? 'text-emerald-300' : 'text-emerald-700') : (d ? 'text-orange-100/80' : 'text-gray-600')}`}>
              {uploadNotice.message}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setUploadNotice(null)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white ${uploadNotice.kind === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
