'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { backgroundsAPI } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';

type Background = {
  id: string;
  filename: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
};

function formatDateTime(dateStr: string) {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function UploadBackgroundSection() {
  const { theme } = useTheme();
  const d = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const showNotice = (msg: string, kind: 'success' | 'error') => {
    setNotice({ msg, kind });
    setTimeout(() => setNotice(null), 3500);
  };

  const loadBackgrounds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backgroundsAPI.list();
      setBackgrounds(res.data);
    } catch {
      showNotice('Failed to load backgrounds', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackgrounds();
  }, [loadBackgrounds]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onSelectFile = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
  };

  const handleUpload = async () => {
    if (!previewFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('bgImage', previewFile);
      await backgroundsAPI.upload(fd);
      setPreviewFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showNotice('Background uploaded successfully', 'success');
      loadBackgrounds();
    } catch (e: unknown) {
      showNotice((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    try {
      await backgroundsAPI.activate(id);
      showNotice('Background set as active', 'success');
      loadBackgrounds();
    } catch {
      showNotice('Failed to activate background', 'error');
    } finally {
      setActivatingId(null);
    }
  };

  const handleDeactivateAll = async () => {
    setActivatingId('__deactivate__');
    try {
      await backgroundsAPI.deactivateAll();
      showNotice('Background turned off', 'success');
      loadBackgrounds();
    } catch {
      showNotice('Failed to deactivate', 'error');
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await backgroundsAPI.delete(id);
      setDeleteTargetId(null);
      showNotice('Background deleted', 'success');
      loadBackgrounds();
    } catch {
      showNotice('Failed to delete background', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── theme classes ───────────────────────────────────────────────────────────
  const card = d
    ? 'bg-zinc-900/70 border border-orange-500/20'
    : 'bg-white border border-orange-200 shadow-sm';
  const textMain = d ? 'text-white' : 'text-zinc-900';
  const textMuted = d ? 'text-orange-200/70' : 'text-orange-700';
  const inputCls = d
    ? 'bg-zinc-800 border border-orange-500/30 text-white file:bg-orange-500/20 file:text-orange-200 file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:mr-3 file:cursor-pointer'
    : 'bg-orange-50 border border-orange-200 text-zinc-900 file:bg-orange-500 file:text-white file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:mr-3 file:cursor-pointer';
  const primaryBtn = 'bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed';
  const ghostBtn = d
    ? 'border border-orange-500/40 text-orange-300 hover:bg-orange-500/10 rounded-xl px-4 py-2 text-sm transition-all'
    : 'border border-orange-300 text-orange-700 hover:bg-orange-50 rounded-xl px-4 py-2 text-sm transition-all';

  const activeBackground = backgrounds.find((b) => b.is_active);

  return (
    <div className="p-8 max-w-4xl space-y-8">
      {/* Notice */}
      {notice && (
        <div
          className={`rounded-xl px-5 py-3 text-sm font-medium ${
            notice.kind === 'success'
              ? d ? 'bg-green-900/40 text-green-300 border border-green-500/30' : 'bg-green-50 text-green-700 border border-green-200'
              : d ? 'bg-red-900/40 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {notice.msg}
        </div>
      )}

      {/* Upload card */}
      <div className={`${card} rounded-2xl p-6`}>
        <h3 className={`font-bold text-lg mb-1 ${textMain}`}>Upload New Background</h3>
        <p className={`${textMuted} text-sm mb-5`}>
          Choose an image (JPG, PNG, WEBP). Max 10 MB. The active background appears behind the
          viewer page at low opacity.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={`w-full rounded-xl text-sm cursor-pointer ${inputCls} p-2`}
          onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
        />

        {previewUrl && (
          <div className="mt-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="preview"
              className="w-full max-h-64 object-cover rounded-xl border border-orange-500/30"
            />
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className={primaryBtn}
              >
                {uploading ? 'Uploading…' : 'Upload Image'}
              </button>
              <button
                onClick={() => onSelectFile(null)}
                className={ghostBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active background indicator */}
      {activeBackground && (
        <div className={`${card} rounded-2xl p-5 flex items-center gap-5`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeBackground.image_url}
            alt="active background"
            className="w-28 h-16 object-cover rounded-lg border border-orange-500/40 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <span className={`font-semibold text-sm ${textMain}`}>Active Background</span>
            </div>
            <p className={`${textMuted} text-xs truncate`}>{activeBackground.filename}</p>
          </div>
          <button
            onClick={handleDeactivateAll}
            disabled={activatingId === '__deactivate__'}
            className={`${ghostBtn} flex-shrink-0`}
          >
            {activatingId === '__deactivate__' ? 'Turning off…' : 'Turn Off'}
          </button>
        </div>
      )}

      {/* Backgrounds list */}
      <div className={`${card} rounded-2xl p-6`}>
        <h3 className={`font-bold text-lg mb-4 ${textMain}`}>Uploaded Backgrounds</h3>

        {loading ? (
          <p className={`${textMuted} text-sm`}>Loading…</p>
        ) : backgrounds.length === 0 ? (
          <p className={`${textMuted} text-sm italic`}>No backgrounds uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {backgrounds.map((bg) => (
              <div
                key={bg.id}
                className={`rounded-xl overflow-hidden border transition-all ${
                  bg.is_active
                    ? d ? 'border-green-500/60' : 'border-green-400'
                    : d ? 'border-orange-500/20' : 'border-orange-200'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bg.image_url}
                    alt={bg.filename}
                    className="w-full h-40 object-cover"
                  />
                  {bg.is_active && (
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wide">
                      Active
                    </span>
                  )}
                </div>

                {/* Info + actions */}
                <div className={`p-3 ${d ? 'bg-zinc-900/80' : 'bg-white'}`}>
                  <p className={`text-xs truncate mb-0.5 ${textMain}`}>{bg.filename}</p>
                  <p className={`text-[11px] ${textMuted} mb-3`}>{formatDateTime(bg.created_at)}</p>
                  <div className="flex gap-2">
                    {!bg.is_active && (
                      <button
                        onClick={() => handleActivate(bg.id)}
                        disabled={activatingId === bg.id}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg py-1.5 transition-all disabled:opacity-40"
                      >
                        {activatingId === bg.id ? 'Setting…' : 'Set Active'}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTargetId(bg.id)}
                      className={`flex-1 text-xs font-semibold rounded-lg py-1.5 transition-all ${
                        d
                          ? 'bg-red-900/30 text-red-300 hover:bg-red-900/60 border border-red-500/30'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl ${
              d ? 'bg-zinc-900 border border-orange-500/30' : 'bg-white border border-orange-200'
            }`}
          >
            <h4 className={`font-bold text-lg mb-2 ${textMain}`}>Delete Background?</h4>
            <p className={`${textMuted} text-sm mb-5`}>
              This will permanently delete the image file. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteTargetId)}
                disabled={deletingId === deleteTargetId}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-all disabled:opacity-40"
              >
                {deletingId === deleteTargetId ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteTargetId(null)}
                className={`flex-1 ${ghostBtn}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
