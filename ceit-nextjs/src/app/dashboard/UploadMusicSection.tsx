'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { musicAPI } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';

type MusicTrack = {
  id: string;
  filename: string;
  file_url: string;
  is_active: boolean;
  volume: number;
  created_at: string;
};

function formatDateTime(dateStr: string) {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function UploadMusicSection() {
  const { theme } = useTheme();
  const d = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
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

  const loadTracks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await musicAPI.list();
      setTracks(res.data);
    } catch {
      showNotice('Failed to load music', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
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
      fd.append('audioFile', previewFile);
      await musicAPI.upload(fd);
      setPreviewFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showNotice('Music uploaded successfully', 'success');
      loadTracks();
    } catch (e: any) {
      showNotice(e.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    try {
      await musicAPI.activate(id);
      showNotice('Track set as active background music', 'success');
      loadTracks();
    } catch {
      showNotice('Failed to activate music', 'error');
    } finally {
      setActivatingId(null);
    }
  };

  const handleVolumeChange = async (id: string, volume: number) => {
    try {
      await musicAPI.updateVolume(id, volume);
      loadTracks();
    } catch {
      showNotice('Failed to update volume', 'error');
    }
  };

  const handleDeactivateAll = async () => {
    setActivatingId('__deactivate__');
    try {
      await musicAPI.deactivateAll();
      showNotice('Background music disabled', 'success');
      loadTracks();
    } catch {
      showNotice('Failed to deactivate', 'error');
    } finally {
      setActivatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await musicAPI.delete(id);
      setDeleteTargetId(null);
      showNotice('Track deleted', 'success');
      loadTracks();
    } catch {
      showNotice('Failed to delete track', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Theme Styles
  const card = d ? 'bg-zinc-900/70 border border-orange-500/20' : 'bg-white border border-orange-200 shadow-sm';
  const textMain = d ? 'text-white' : 'text-zinc-900';
  const textMuted = d ? 'text-orange-200/70' : 'text-orange-700';
  const inputCls = d ? 'bg-zinc-800 border border-orange-500/30 text-white file:bg-orange-500/20 file:text-orange-200 file:border-0' : 'bg-orange-50 border border-orange-200 text-zinc-900 file:bg-orange-500 file:text-white file:border-0';
  const primaryBtn = 'bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-all disabled:opacity-40';
  const ghostBtn = d ? 'border border-orange-500/40 text-orange-300 hover:bg-orange-500/10 rounded-xl px-4 py-2 text-sm' : 'border border-orange-300 text-orange-700 hover:bg-orange-50 rounded-xl px-4 py-2 text-sm';

  const activeTrack = tracks.find((t) => t.is_active);

  return (
    <div className="p-8 max-w-4xl space-y-8">
      {notice && (
        <div className={`rounded-xl px-5 py-3 text-sm font-medium ${notice.kind === 'success' ? (d ? 'bg-green-900/40 text-green-300 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200') : (d ? 'bg-red-900/40 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200')}`}>
          {notice.msg}
        </div>
      )}

      {/* Upload Music */}
      <div className={`${card} rounded-2xl p-6`}>
        <h3 className={`font-bold text-lg mb-1 ${textMain}`}>Upload Background Music</h3>
        <p className={`${textMuted} text-sm mb-5`}>
          Upload MP3 or WAV files. The active track will play globally on the viewer site.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className={`w-full rounded-xl text-sm cursor-pointer ${inputCls} p-2`}
          onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
        />

        {previewUrl && (
          <div className="mt-4 space-y-3">
            <audio controls src={previewUrl} className="w-full" />
            <div className="flex gap-3">
              <button onClick={handleUpload} disabled={uploading} className={primaryBtn}>
                {uploading ? 'Uploading…' : 'Upload Track'}
              </button>
              <button onClick={() => onSelectFile(null)} className={ghostBtn}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Active Track Status */}
      {activeTrack && (
        <div className={`${card} rounded-2xl p-5 flex items-center gap-5`}>
          <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
             <span className="animate-pulse">🎵</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className={`font-semibold text-sm ${textMain}`}>Currently Playing</span>
            </div>
            <p className={`${textMuted} text-xs truncate`}>{activeTrack.filename}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className={`${textMuted} text-xs`}>Volume:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={activeTrack.volume}
                onChange={(e) => handleVolumeChange(activeTrack.id, parseFloat(e.target.value))}
                className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className={`${textMuted} text-xs w-8`}>{Math.round(activeTrack.volume * 100)}%</span>
            </div>
          </div>
          <button onClick={handleDeactivateAll} disabled={activatingId === '__deactivate__'} className={ghostBtn}>
            {activatingId === '__deactivate__' ? 'Stopping…' : 'Mute Background'}
          </button>
        </div>
      )}

      {/* Track List */}
      <div className={`${card} rounded-2xl p-6`}>
        <h3 className={`font-bold text-lg mb-4 ${textMain}`}>Music Library</h3>
        {loading ? (
          <p className={`${textMuted} text-sm`}>Loading tracks…</p>
        ) : tracks.length === 0 ? (
          <p className={`${textMuted} text-sm italic`}>No tracks uploaded.</p>
        ) : (
          <div className="space-y-3">
            {tracks.map((track) => (
              <div key={track.id} className={`flex items-center gap-4 p-3 rounded-xl border ${track.is_active ? 'border-orange-500 bg-orange-500/5' : 'border-zinc-500/20'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${textMain}`}>{track.filename}</p>
                  <p className={`text-[10px] ${textMuted}`}>{formatDateTime(track.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  {!track.is_active && (
                    <button onClick={() => handleActivate(track.id)} className="px-3 py-1 bg-orange-500 text-white text-xs rounded-lg">
                      {activatingId === track.id ? '...' : 'Activate'}
                    </button>
                  )}
                  <button onClick={() => setDeleteTargetId(track.id)} className="px-3 py-1 bg-red-500/10 text-red-500 text-xs rounded-lg border border-red-500/20">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${d ? 'bg-zinc-900 border border-orange-500/30' : 'bg-white border border-orange-200'}`}>
            <h4 className={`font-bold text-lg mb-2 ${textMain}`}>Delete Track?</h4>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteTargetId)} className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm">Delete</button>
              <button onClick={() => setDeleteTargetId(null)} className={`flex-1 ${ghostBtn}`}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}