'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { postsAPI } from '@/lib/api';
import CalendarSection from './CalendarSection';
import UploadPdfSection from './UploadPdfSection';

// Relative time helper
function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getAvatarColor(name: string) {
  const colors = [
    'from-orange-500 to-orange-700',
    'from-orange-600 to-black',
    'from-black to-orange-700',
    'from-orange-500 to-black',
    'from-orange-700 to-orange-900',
    'from-black to-orange-600',
  ];
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getFirstName(name?: string) {
  if (!name) return 'Kim';
  const first = name.trim().split(' ')[0];
  return first || 'Kim';
}

// Theme color map
function useColors() {
  const { theme } = useTheme();
  const d = theme === 'dark';
  return {
    page: d ? 'bg-black' : 'bg-orange-50',
    // Surfaces
    sidebar: d ? 'bg-black/85 backdrop-blur-xl border-r border-orange-500/30' : 'bg-white/95 backdrop-blur-xl border-r border-orange-200 shadow-sm',
    header: d ? 'bg-black/75 backdrop-blur-xl border-b border-orange-500/20' : 'bg-white/90 backdrop-blur-xl border-b border-orange-200 shadow-sm',
    card: d ? 'bg-black/70 border border-orange-500/20 hover:border-orange-400/50 hover:shadow-xl hover:shadow-orange-900/30' : 'bg-white border border-orange-200 hover:border-orange-300 shadow-sm hover:shadow-md',
    panel: d ? 'backdrop-blur-xl bg-black/75 border border-orange-500/20' : 'backdrop-blur-xl bg-white border border-orange-200 shadow-sm',
    statCard: d ? 'bg-black/70 border border-orange-500/20' : 'bg-orange-50 border border-orange-200',
    emptyIcon: d ? 'bg-black/70 border border-orange-500/20' : 'bg-orange-50 border border-orange-200',
    searchInput: d
      ? 'bg-black/60 border border-orange-500/30 text-white placeholder-orange-200/60 focus:border-orange-400 focus:ring-orange-400/25'
      : 'bg-white border border-orange-200 text-black placeholder-orange-400/70 focus:border-orange-500 focus:ring-orange-500/20',
    viewToggle: d ? 'bg-black/60 border border-orange-500/30' : 'bg-orange-50 border border-orange-200',
    viewActive: d ? 'bg-orange-500/20 text-orange-200' : 'bg-orange-100 text-orange-800',
    viewInactive: d ? 'text-orange-200/80 hover:text-white' : 'text-orange-700 hover:text-black',

    // Text
    heading: d ? 'text-white' : 'text-black',
    text: d ? 'text-orange-50' : 'text-black',
    textSecondary: d ? 'text-orange-100' : 'text-orange-900',
    textMuted: d ? 'text-orange-200/80' : 'text-orange-700',
    sectionLabel: d ? 'text-orange-200/80' : 'text-orange-700',
    emailText: d ? 'text-orange-100/85' : 'text-orange-800',
    subtitle: d ? 'text-orange-200/85' : 'text-orange-700',

    // Borders
    border: d ? 'border-orange-500/25' : 'border-orange-200',
    borderLight: d ? 'border-orange-500/20' : 'border-orange-200',

    // Badges
    deptBadge: d ? 'bg-orange-500/15 text-orange-100 border border-orange-500/30' : 'bg-orange-100 text-orange-800 border border-orange-300',
    pdfBadge: d ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-orange-100 border border-orange-300',
    countBadge: d ? 'bg-orange-500/20 text-orange-100' : 'bg-orange-100 text-orange-800',
    navInactive: d ? 'text-orange-100/85 hover:bg-black hover:text-white' : 'text-orange-800 hover:bg-orange-50 hover:text-black',
    navActive: d ? 'bg-orange-500/20 text-white border-l-4 border-orange-400 shadow-md' : 'bg-orange-100 text-black border-l-4 border-orange-600 shadow-sm',
    navActiveBadge: d ? 'bg-orange-500/35 text-white' : 'bg-orange-200 text-orange-900',

    // Buttons
    logoutBtn: d
      ? 'bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white'
      : 'bg-white/70 hover:bg-red-600 border border-red-200/70 hover:border-red-500 text-red-600 hover:text-white',
    clearSearch: d ? 'text-orange-200/75 hover:text-white' : 'text-orange-700 hover:text-black',
    actionBtn: d ? 'text-orange-100 hover:text-white hover:bg-orange-500/20' : 'text-orange-800 hover:text-black hover:bg-orange-100',
    primaryBtn: d
      ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/40'
      : 'bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-200/60',
    primaryBtnDisabled: d ? 'bg-black/60 text-orange-200/60 cursor-not-allowed' : 'bg-orange-100 text-orange-500 cursor-not-allowed',
    linkAccent: d ? 'text-orange-200 hover:text-white' : 'text-orange-700 hover:text-black',

    // Stats
    statTotal: d ? 'text-orange-200' : 'text-orange-700',
    statToday: d ? 'text-orange-300' : 'text-orange-600',
    statWeek: d ? 'text-orange-100' : 'text-orange-800',
    statPdf: d ? 'text-orange-200' : 'text-orange-700',
    statLabel: d ? 'text-orange-200/80' : 'text-orange-700',

    // PDF card
    pdfCard: d ? 'bg-gradient-to-br from-black/80 to-orange-900/30 border border-orange-500/25' : 'bg-gradient-to-br from-orange-50 to-white border border-orange-200',
    pdfIcon: d ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-orange-100 border border-orange-300',
    pdfLabel: d ? 'text-orange-100' : 'text-orange-800',

    // Iframe border
    iframeBorder: d ? 'border border-white/10' : 'border border-gray-200',

    // Theme toggle
    toggleBg: d ? 'bg-black/60 border border-orange-500/30' : 'bg-orange-50 border border-orange-200',
  };
}

type PostItem = {
  id: string;
  caption: string;
  imageUrl: string;
  createdAt: string;
  adminName?: string;
  departmentName?: string;
  departmentId?: string;
  hasMedia?: boolean;
};

type UserProfile = {
  firstName: string;
  lastName: string;
  age: string;
  dateOfBirth: string;
  department: string;
  photoDataUrl: string;
};

const PROFILE_DEPARTMENTS = ['DIT', 'DIET', 'DAFE', 'DCEE', 'DCEA'];

function splitName(fullName?: string) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePosts(data: unknown): PostItem[] {
  if (!Array.isArray(data)) return [];
  const out: PostItem[] = [];
  for (const item of data) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id : '';
    if (!id) continue;
    out.push({
      id,
      caption: typeof item.caption === 'string' ? item.caption : String(item.caption ?? ''),
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      adminName: typeof item.adminName === 'string' ? item.adminName : undefined,
      departmentName: typeof item.departmentName === 'string' ? item.departmentName : undefined,
      departmentId: typeof item.departmentId === 'string' ? item.departmentId : undefined,
      hasMedia: typeof item.hasMedia === 'boolean' ? item.hasMedia : undefined,
    });
  }
  return out;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const c = useColors();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileConfirmOpen, setIsProfileConfirmOpen] = useState(false);
  const [showProfileSavedNotice, setShowProfileSavedNotice] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [postsScrollProgress, setPostsScrollProgress] = useState(0);
  const [isPostsFeedScrollable, setIsPostsFeedScrollable] = useState(true);
  const [isPostsFlyoutOpen, setIsPostsFlyoutOpen] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'pdf'; src: string } | null>(null);
  const [newCaption, setNewCaption] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreviewUrl, setNewImagePreviewUrl] = useState<string>('');
  const [posting, setPosting] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const captionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const postsFeedRef = useRef<HTMLDivElement | null>(null);
  const postsFlyoutRef = useRef<HTMLDivElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const inferredDepartment = useMemo(() => {
    if (!user?.name) return '';
    const postMatch = posts.find((item) => item.adminName === user.name && item.departmentName);
    return postMatch?.departmentName || '';
  }, [posts, user?.name]);

  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    age: '',
    dateOfBirth: '',
    department: '',
    photoDataUrl: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchPosts();
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => {
      if (newImagePreviewUrl) URL.revokeObjectURL(newImagePreviewUrl);
    };
  }, [newImagePreviewUrl]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const { firstName, lastName } = splitName(user.name);
    const defaultProfile: UserProfile = {
      firstName,
      lastName,
      age: '',
      dateOfBirth: '',
      department: inferredDepartment || '',
      photoDataUrl: '',
    };

    const storageKey = `user-profile:${user.id}`;
    const savedProfile = localStorage.getItem(storageKey);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile) as Partial<UserProfile>;
        setProfile({ ...defaultProfile, ...parsed });
        return;
      } catch {
      }
    }
    setProfile(defaultProfile);
  }, [user?.id, user?.name, inferredDepartment]);

  useEffect(() => {
    if (activeTab !== 'posts') {
      setPostsScrollProgress(0);
      setIsPostsFlyoutOpen(false);
      return;
    }

    const feedEl = postsFeedRef.current;
    if (!feedEl) return;

    const updateFeedMetrics = () => {
      const isScrollable = feedEl.scrollHeight > feedEl.clientHeight + 2;
      setIsPostsFeedScrollable(isScrollable);
      if (!isScrollable) {
        setPostsScrollProgress(0);
      }
    };

    const onFeedScroll = () => {
      const scrollTop = feedEl.scrollTop;
      updateFeedMetrics();
      setPostsScrollProgress(Math.min(scrollTop / 150, 1));
      if (scrollTop <= 24) {
        setIsPostsFlyoutOpen(false);
      }
    };

    updateFeedMetrics();
    onFeedScroll();
    feedEl.addEventListener('scroll', onFeedScroll, { passive: true });
    window.addEventListener('resize', updateFeedMetrics);
    return () => {
      feedEl.removeEventListener('scroll', onFeedScroll);
      window.removeEventListener('resize', updateFeedMetrics);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!isPostsFlyoutOpen || activeTab !== 'posts') return;

    const onClickOutside = (event: MouseEvent) => {
      if (postsFlyoutRef.current && !postsFlyoutRef.current.contains(event.target as Node)) {
        setIsPostsFlyoutOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isPostsFlyoutOpen, activeTab]);

  const fetchPosts = async () => {
    try {
      let response;
      try {
        response = await postsAPI.getPosts({ limit: 20, offset: 0 });
      } catch {
        response = await postsAPI.getDepartmentPosts({ limit: 20, offset: 0 });
      }

      const basePosts = normalizePosts(response.data);
      setPosts(basePosts);
    } catch (err) {
      console.error('Failed to fetch posts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const onPickImage = (file: File | null) => {
    setNewImageFile(file);
    if (newImagePreviewUrl) URL.revokeObjectURL(newImagePreviewUrl);
    setNewImagePreviewUrl(file ? URL.createObjectURL(file) : '');
    setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
    setCompletedCrop(null);
  };

  const openCreatePostModal = () => {
    setIsCreatePostModalOpen(true);
    setIsPostsFlyoutOpen(false);
    setTimeout(() => captionInputRef.current?.focus(), 120);
  };

  const closeCreatePostModal = () => {
    setIsCreatePostModalOpen(false);
  };

  const onProfilePicturePick = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfile((prev) => ({ ...prev, photoDataUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const onProfileBirthDateChange = (value: string) => {
    let computedAge = '';
    if (value) {
      const birthDate = new Date(value);
      if (!Number.isNaN(birthDate.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age -= 1;
        }
        computedAge = age >= 0 ? String(age) : '';
      }
    }

    setProfile((prev) => ({
      ...prev,
      dateOfBirth: value,
      age: computedAge || prev.age,
    }));
  };

  const saveProfile = () => {
    if (!user?.id) return;
    localStorage.setItem(`user-profile:${user.id}`, JSON.stringify(profile));
    setIsProfileConfirmOpen(false);
    setIsProfileOpen(false);
    setShowProfileSavedNotice(true);
  };

  useEffect(() => {
    if (!showProfileSavedNotice) return;
    const timer = setTimeout(() => setShowProfileSavedNotice(false), 2200);
    return () => clearTimeout(timer);
  }, [showProfileSavedNotice]);

  const closeProfileModal = () => {
    setIsProfileConfirmOpen(false);
    setIsProfileOpen(false);
  };

  const requestProfileSave = () => {
    setIsProfileConfirmOpen(true);
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });

  const getCroppedBlobFromImg = async (image: HTMLImageElement, area: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = Math.max(1, Math.round(area.width * scaleX));
    canvas.height = Math.max(1, Math.round(area.height * scaleY));

    ctx.drawImage(
      image,
      area.x * scaleX,
      area.y * scaleY,
      area.width * scaleX,
      area.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to crop image'))), 'image/jpeg', 0.92);
    });
    return blob;
  };

  const submitPost = async () => {
    if (posting) return;
    const caption = newCaption.trim();
    if (!caption) return;
    try {
      setPosting(true);

      let imageUrl: string | undefined;
      if (newImageFile) {
        if (!newImageFile.type.startsWith('image/')) {
          alert('Please choose a valid image file.');
          return;
        }
        if (newImageFile.size > 5 * 1024 * 1024) {
          alert('Image must be 5MB or smaller.');
          return;
        }
        const img = imgRef.current;
        if (img && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
          const croppedBlob = await getCroppedBlobFromImg(img, completedCrop);
          if (croppedBlob.size > 5 * 1024 * 1024) {
            alert('Cropped image is still larger than 5MB. Please crop tighter or use a smaller image.');
            return;
          }
          imageUrl = await blobToDataUrl(croppedBlob);
        } else {
          imageUrl = await fileToDataUrl(newImageFile);
        }
      }

      await postsAPI.createPost({ caption, imageUrl });
      setNewCaption('');
      onPickImage(null);
      closeCreatePostModal();
      await fetchPosts();
    } catch (err) {
      console.error('Failed to create post', err);
      alert('Failed to create post.');
    } finally {
      setPosting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openPdfPreview = async (postId: string, pdfSrc?: string) => {
    try {
      if (!pdfSrc) return;
      let resolved = pdfSrc;
      if (pdfSrc === 'PDF_PLACEHOLDER') {
        const full = await postsAPI.getPostById(postId);
        const fullUrl: string = full.data?.imageUrl || '';
        if (fullUrl.includes('|')) {
          resolved = fullUrl.split('|')[0];
        } else {
          resolved = fullUrl;
        }
      }
      if (!resolved) return;
      setMediaPreview({ type: 'pdf', src: resolved });
    } catch (err) {
      console.error('Failed to open PDF preview', err);
    }
  };

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(p =>
      p.caption?.toLowerCase().includes(q) ||
      p.adminName?.toLowerCase().includes(q) ||
      p.departmentName?.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    return {
      total: posts.length,
      today: posts.filter(p => new Date(p.createdAt) >= today).length,
      thisWeek: posts.filter(p => new Date(p.createdAt) >= thisWeek).length,
      pdfs: posts.filter(p => p.imageUrl?.includes('|') || p.imageUrl?.startsWith('data:application/pdf')).length,
    };
  }, [posts]);

  const departments = useMemo(() => {
    const map = new Map<string, number>();
    posts.forEach(p => {
      if (p.departmentName) map.set(p.departmentName, (map.get(p.departmentName) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const effectivePostsProgress = isPostsFeedScrollable ? postsScrollProgress : 0;
  const flyoutVisibility = effectivePostsProgress < 0.3 ? 0 : Math.min((effectivePostsProgress - 0.3) / 0.2, 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-14 w-14 border-2 border-orange-500/25 border-t-orange-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 animate-pulse"></div>
            </div>
          </div>
          <p className={`text-sm font-medium animate-pulse ${theme === 'dark' ? 'text-orange-200/90' : 'text-orange-700'}`}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${c.page}`}>
      {/* Sidebar */}
      <aside className={`w-72 ${c.sidebar} flex flex-col fixed top-0 left-0 h-screen overflow-y-auto z-20 transition-colors duration-300`}>
        {/* Logo */}
        <div className={`p-6 pb-4 border-b ${c.border}`}>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-black bg-clip-text text-transparent tracking-tight">CEIT Portal</h1>
          <p className={`${c.subtitle} text-xs mt-0.5 tracking-widest uppercase`}>Admin Dashboard</p>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-4 space-y-1.5 flex-1">
          <p className={`text-[10px] uppercase tracking-widest ${c.sectionLabel} font-semibold mb-3 px-1`}>Navigation</p>
          {[
            { key: 'overview', icon: '📊', label: 'Overview' },
            { key: 'posts', icon: '📄', label: 'Posts', badge: stats.total },
            { key: 'announcements', icon: '📢', label: 'Announcements' },
            { key: 'uploadPdf', icon: '📤', label: 'Upload PDF' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.key
                  ? c.navActive
                  : c.navInactive
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
              {item.badge !== undefined && (
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                  activeTab === item.key
                    ? c.navActiveBadge
                    : c.countBadge
                }`}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen ml-72">
        {/* Top Bar */}
        <header className={`sticky top-0 z-30 ${c.header} px-8 py-4 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-2xl font-bold ${c.heading}`}>
                {activeTab === 'overview' && 'Overview'}
                {activeTab === 'posts' && 'Posts'}
                {activeTab === 'announcements' && 'Announcements'}
                {activeTab === 'uploadPdf' && 'Upload PDF'}
              </h2>
              <p className={`${c.textMuted} text-sm mt-0.5`}>
                {activeTab === 'overview' && 'Dashboard metrics at a glance'}
                {activeTab === 'posts' && `${filteredPosts.length} post${filteredPosts.length !== 1 ? 's' : ''} ${searchQuery ? 'found' : 'total'}`}
                {activeTab === 'announcements' && 'Manage events and calendar'}
                {activeTab === 'uploadPdf' && 'Upload and manage PDF documents'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getAvatarColor(user?.name || '')} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
                >
                  {getInitials(user?.name || '')}
                </button>
                {isUserMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-64 rounded-2xl p-3 ${c.panel} shadow-xl`}>
                    <div className={`px-3 py-2 border-b ${c.border}`}>
                      <p className={`${c.heading} font-semibold text-sm truncate`}>{user?.name}</p>
                      <p className={`${c.emailText} text-xs truncate`}>{user?.email}</p>
                    </div>
                    <div className={`px-3 py-3 border-b ${c.border}`}>
                      <button
                        onClick={() => {
                          setIsProfileOpen(true);
                          setIsUserMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${c.actionBtn}`}
                      >
                        <span className="text-sm font-medium">View Profile</span>
                      </button>
                    </div>
                    <div className="px-3 py-3">
                      <p className={`text-[10px] uppercase tracking-widest ${c.sectionLabel} font-semibold mb-2`}>Accessibility</p>
                      <div className={`flex items-center rounded-xl p-1 ${c.toggleBg}`}>
                        <button
                          onClick={() => theme !== 'dark' && toggleTheme()}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                            theme === 'dark'
                              ? 'bg-orange-600 text-white shadow-md'
                              : `${c.textMuted}`
                          }`}
                        >
                          Dark
                        </button>
                        <button
                          onClick={() => theme !== 'light' && toggleTheme()}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                            theme === 'light'
                              ? 'bg-orange-600 text-white shadow-md'
                              : `${c.textMuted}`
                          }`}
                        >
                          Light
                        </button>
                      </div>
                    </div>
                    <div className={`px-3 pt-2 border-t ${c.border}`}>
                      <button
                        onClick={handleLogout}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 ${c.logoutBtn} rounded-xl transition-all duration-200`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span className="text-sm font-medium">Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={`flex-1 p-8 ${activeTab === 'posts' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className={`${c.panel} rounded-2xl p-6`}>
                  <p className={`${c.textMuted} text-sm mb-2`}>Total Posts</p>
                  <p className={`text-4xl font-bold ${c.statTotal}`}>{stats.total}</p>
                </div>
                <div className={`${c.panel} rounded-2xl p-6`}>
                  <p className={`${c.textMuted} text-sm mb-2`}>Posted Today</p>
                  <p className={`text-4xl font-bold ${c.statToday}`}>{stats.today}</p>
                </div>
                <div className={`${c.panel} rounded-2xl p-6`}>
                  <p className={`${c.textMuted} text-sm mb-2`}>This Week</p>
                  <p className={`text-4xl font-bold ${c.statWeek}`}>{stats.thisWeek}</p>
                </div>
                <div className={`${c.panel} rounded-2xl p-6`}>
                  <p className={`${c.textMuted} text-sm mb-2`}>PDF Posts</p>
                  <p className={`text-4xl font-bold ${c.statPdf}`}>{stats.pdfs}</p>
                </div>
              </div>

              {departments.length > 0 && (
                <div className={`${c.panel} rounded-2xl p-6`}>
                  <h3 className={`${c.heading} text-lg font-semibold mb-4`}>Department Activity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {departments.map(([name, count]) => (
                      <div key={name} className={`flex items-center justify-between rounded-xl px-4 py-3 ${c.statCard}`}>
                        <span className={`${c.textSecondary} text-sm truncate`}>{name}</span>
                        <span className={`text-sm font-semibold ${c.heading}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="h-full flex flex-col min-h-0 relative">
              <div
                className="shrink-0 transition-all duration-500 ease-in-out"
                style={{
                  opacity: 1 - (effectivePostsProgress * 1.5),
                  transform: `translateX(-${effectivePostsProgress * 110}%)`,
                  marginTop: `-${effectivePostsProgress * 280}px`,
                  pointerEvents: effectivePostsProgress > 0.5 ? 'none' : 'auto',
                  visibility: effectivePostsProgress > 0.9 ? 'hidden' : 'visible'
                }}
              >
                <div className="max-w-3xl mx-auto mb-4">
                  <div className={`${c.panel} rounded-2xl p-4 shadow-sm`}>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="relative flex-1">
                        <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${c.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                          type="text"
                          placeholder="Search posts..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className={`pl-10 pr-10 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 w-full transition-all ${c.searchInput}`}
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${c.clearSearch}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-start md:self-auto">
                      <div className={`flex ${c.viewToggle} rounded-xl p-1`}>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? c.viewActive : c.viewInactive}`}
                          title="List view"
                        >
                          List
                        </button>
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === 'grid' ? c.viewActive : c.viewInactive}`}
                          title="Grid view"
                        >
                          Grid
                        </button>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="max-w-3xl mx-auto mb-6">
                  <div className={`${c.panel} rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${c.statCard} flex items-center justify-center`}>
                        <span className="text-lg">🖼️</span>
                      </div>
                      <div>
                        <h3 className={`${c.heading} font-semibold text-lg`}>Create Post</h3>
                        <p className={`${c.textMuted} text-sm`}>Open composer to share an update</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openCreatePostModal}
                      className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${c.primaryBtn}`}
                    >
                      Create Post
                    </button>
                  </div>
                </div>
              </div>

              <div ref={postsFeedRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
              {filteredPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className={`w-20 h-20 rounded-2xl ${c.emptyIcon} flex items-center justify-center mb-5`}>
                    <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <h3 className={`text-xl font-semibold ${c.heading} mb-2`}>
                    {searchQuery ? 'No matching posts' : 'No posts yet'}
                  </h3>
                  <p className={`${c.textMuted} text-sm max-w-sm`}>
                    {searchQuery
                      ? `No posts found matching "${searchQuery}". Try a different search term.`
                      : 'Posts shared by administrators will appear here. Create your first post to get started!'}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-4 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg text-sm hover:bg-orange-200 transition-all"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-5' : 'space-y-5 max-w-3xl mx-auto'}>
                  {filteredPosts.map((post, idx) => {
                    const isPDF = post.imageUrl?.includes('|') || post.imageUrl?.startsWith('data:application/pdf');
                    const [pdfUrl, thumbnailUrl] = post.imageUrl?.includes('|')
                      ? post.imageUrl.split('|')
                      : [post.imageUrl, null];
                    const isExpanded = expandedPosts.has(post.id);
                    const isLongCaption = (post.caption?.length || 0) > 200;

                    return (
                      <article
                        key={post.id}
                        className={`group ${c.card} rounded-2xl overflow-hidden transition-all duration-300`}
                        style={{ animationDelay: `${idx * 60}ms` }}
                      >
                        {/* Card Header */}
                        <div className="flex items-center gap-3 px-5 py-4">
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(post.adminName || 'Admin')} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-md`}>
                            {getInitials(post.adminName || 'Admin')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`${c.heading} font-semibold text-base truncate`}>{post.adminName || 'Admin'}</p>
                              {post.departmentName && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${c.deptBadge} whitespace-nowrap`}>
                                  {post.departmentName}
                                </span>
                              )}
                            </div>
                            <p className={`${c.textMuted} text-xs mt-0.5`}>{timeAgo(post.createdAt)}</p>
                          </div>
                          {isPDF && (
                            <div className={`flex items-center gap-1 px-2 py-1 ${c.pdfBadge} rounded-lg`}>
                              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                              <span className="text-[10px] font-semibold text-orange-600">PDF</span>
                            </div>
                          )}
                        </div>

                        {/* Caption */}
                        <div className="px-5 pb-3">
                          <p className={`${c.text} text-sm leading-relaxed whitespace-pre-wrap`}>
                            {isLongCaption && !isExpanded
                              ? post.caption.slice(0, 200) + '...'
                              : post.caption}
                          </p>
                          {isLongCaption && (
                            <button
                              onClick={() => toggleExpand(post.id)}
                              className={`text-xs font-medium mt-1 transition-colors ${c.linkAccent}`}
                            >
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </div>

                        {/* Media */}
                        {post.imageUrl && (
                          <div className="px-5 pb-5">
                            {isPDF && thumbnailUrl ? (
                              <div className={`relative rounded-xl overflow-hidden border ${c.borderLight} group/media`}>
                                <img src={thumbnailUrl} alt="PDF Thumbnail" className="w-full h-auto max-h-96 object-cover group-hover/media:scale-[1.02] transition-transform duration-500 cursor-zoom-in" loading="lazy" onClick={() => openPdfPreview(post.id, pdfUrl)} />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                                  <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/20">View PDF</span>
                                </div>
                              </div>
                            ) : isPDF ? (
                              <div className={`${c.pdfCard} rounded-xl p-8 text-center cursor-pointer`} onClick={() => openPdfPreview(post.id, pdfUrl)}>
                                <div className={`w-14 h-14 mx-auto rounded-xl ${c.pdfIcon} flex items-center justify-center mb-3`}>
                                  <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                </div>
                                <p className={`${c.pdfLabel} font-medium text-sm`}>PDF Document</p>
                                <p className={`${c.textMuted} text-xs mt-1`}>Click to view</p>
                              </div>
                            ) : (
                              <div className={`relative rounded-xl overflow-hidden border ${c.borderLight} group/media`}>
                                <img src={post.imageUrl} alt="Post image" className="w-full h-auto max-h-96 object-cover group-hover/media:scale-[1.02] transition-transform duration-500 cursor-zoom-in" loading="lazy" onClick={() => setMediaPreview({ type: 'image', src: post.imageUrl })} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              </div>
                            )}
                          </div>
                        )}

                        <div className={`px-5 py-3 border-t ${c.borderLight} flex items-center gap-4`}>
                          <button type="button" className={`inline-flex items-center gap-2 text-xs ${c.actionBtn} rounded-lg px-2 py-1 transition-colors`}>
                            <span>♡</span>
                            <span>Like</span>
                          </button>
                          <button type="button" className={`inline-flex items-center gap-2 text-xs ${c.actionBtn} rounded-lg px-2 py-1 transition-colors`}>
                            <span>💬</span>
                            <span>Comment</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              </div>

              {/* Flyout: search + create post as small icons when scrolled — left of content, right of sidebar, below header */}
              <div
                ref={postsFlyoutRef}
                className="fixed z-[40] flex flex-col items-center gap-3 transition-all duration-500 ease-out"
                style={{
                  top: '6rem',
                  left: '19.5rem',
                  opacity: flyoutVisibility,
                  transform: `translateX(${(1 - flyoutVisibility) * -50}px)`,
                  pointerEvents: flyoutVisibility > 0.1 ? 'auto' : 'none',
                  visibility: flyoutVisibility > 0.1 ? 'visible' : 'hidden'
                }}
              >
                <div className={`flex flex-col gap-2 rounded-2xl p-2 shadow-2xl border ${c.panel} ${c.border} bg-orange-500/10 backdrop-blur-md`}>
                  <button
                    type="button"
                    onClick={() => setIsPostsFlyoutOpen((prev) => !prev)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${c.primaryBtn}`}
                    title="Search posts"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={openCreatePostModal}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${c.primaryBtn}`}
                    title="Create post"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>

                {isPostsFlyoutOpen && (
                  <div className={`absolute left-16 top-0 w-64 ${c.panel} rounded-2xl p-3 shadow-2xl border ${c.border}`}>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Quick search..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className={`w-full px-4 py-2 rounded-xl text-sm focus:outline-none ${c.searchInput}`}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'announcements' && (
            <CalendarSection />
          )}

          {activeTab === 'uploadPdf' && (
            <UploadPdfSection />
          )}
        </div>

        {mediaPreview && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setMediaPreview(null)}>
            <div className={`relative w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden ${theme === 'dark' ? 'bg-black/85 border border-orange-500/25' : 'bg-white border border-orange-200'}`} onClick={(e) => e.stopPropagation()}>
              <button className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 text-white hover:bg-orange-600 transition-colors" onClick={() => setMediaPreview(null)}>
                ✕
              </button>
              {mediaPreview.type === 'image' ? (
                <img src={mediaPreview.src} alt="Preview" className="w-full h-auto max-h-[90vh] object-contain" />
              ) : (
                <iframe src={mediaPreview.src} className="w-full h-[85vh]" title="PDF Preview" />
              )}
            </div>
          </div>
        )}

        {isCreatePostModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={closeCreatePostModal}>
            <div className={`w-full max-w-3xl rounded-2xl ${c.panel} border ${c.border} p-5`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`${c.heading} font-semibold text-lg`}>Create Post</h3>
                  <p className={`${c.textMuted} text-sm`}>Share an image with a caption</p>
                </div>
                <button onClick={closeCreatePostModal} className={`w-9 h-9 rounded-full ${c.viewToggle} ${c.textMuted}`}>
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={`${c.textSecondary} text-sm font-medium`}>Caption *</label>
                  <textarea
                    value={newCaption}
                    onChange={(e) => setNewCaption(e.target.value)}
                    ref={captionInputRef}
                    rows={3}
                    placeholder={`Share an update, ${getFirstName(user?.name)}...`}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all ${c.primaryBtn}`}>
                      <span>🖼️</span>
                      <span>Choose Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onPickImage(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onPickImage(null)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}
                      disabled={!newImageFile && !newCaption}
                    >
                      Clear
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={submitPost}
                    disabled={posting || !newCaption.trim()}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${posting || !newCaption.trim() ? c.primaryBtnDisabled : c.primaryBtn}`}
                  >
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>

                {newImagePreviewUrl && (
                  <div className={`rounded-xl overflow-hidden border ${c.borderLight}`}>
                    <div className={`w-full ${theme === 'dark' ? 'bg-black/40' : 'bg-gray-100'} flex items-center justify-center p-3`}>
                      <div className="inline-block leading-none max-w-full max-h-[20rem] overflow-auto rounded-lg">
                        <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)}>
                          <img
                            ref={imgRef}
                            src={newImagePreviewUrl}
                            alt="Crop"
                            className="block max-h-[18rem] w-auto max-w-full"
                          />
                        </ReactCrop>
                      </div>
                    </div>
                    <div className={`px-4 py-3 ${theme === 'dark' ? 'bg-black/20' : 'bg-white'}`}>
                      <p className={`${c.textMuted} text-[11px]`}>Resize the crop box using the corner handles, or drag to reposition.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isProfileOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={closeProfileModal}>
            <div className={`w-full max-w-2xl rounded-2xl ${c.panel} border ${c.border} p-6`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className={`text-xl font-semibold ${c.heading}`}>User Profile</h3>
                <button onClick={closeProfileModal} className={`w-9 h-9 rounded-full ${c.viewToggle} ${c.textMuted}`}>
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-full overflow-hidden border ${c.border}`}>
                  {profile.photoDataUrl ? (
                    <img src={profile.photoDataUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${getAvatarColor(user?.name || '')} flex items-center justify-center text-white font-bold`}>
                      {getInitials(user?.name || '')}
                    </div>
                  )}
                </div>
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all ${c.primaryBtn}`}>
                  <span>Upload Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onProfilePicturePick(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`${c.textSecondary} text-sm font-medium`}>First Name</label>
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) => setProfile((prev) => ({ ...prev, firstName: e.target.value }))}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  />
                </div>

                <div>
                  <label className={`${c.textSecondary} text-sm font-medium`}>Last Name</label>
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) => setProfile((prev) => ({ ...prev, lastName: e.target.value }))}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  />
                </div>

                <div>
                  <label className={`${c.textSecondary} text-sm font-medium`}>Date of Birth</label>
                  <input
                    type="date"
                    value={profile.dateOfBirth}
                    onChange={(e) => onProfileBirthDateChange(e.target.value)}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  />
                </div>

                <div>
                  <label className={`${c.textSecondary} text-sm font-medium`}>Age</label>
                  <input
                    type="number"
                    min={0}
                    value={profile.age}
                    onChange={(e) => setProfile((prev) => ({ ...prev, age: e.target.value }))}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`${c.textSecondary} text-sm font-medium`}>Department</label>
                  <select
                    value={profile.department}
                    onChange={(e) => setProfile((prev) => ({ ...prev, department: e.target.value }))}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  >
                    <option value="">Select department</option>
                    {PROFILE_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeProfileModal}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${c.viewToggle} ${c.textMuted}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={requestProfileSave}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${c.primaryBtn}`}
                >
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        )}

        {isProfileOpen && isProfileConfirmOpen && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setIsProfileConfirmOpen(false)}>
            <div className={`w-full max-w-md rounded-2xl ${c.panel} border ${c.border} p-6`} onClick={(e) => e.stopPropagation()}>
              <h4 className={`text-lg font-semibold ${c.heading}`}>Confirm Profile Update</h4>
              <p className={`${c.textMuted} text-sm mt-2`}>
                Are you sure you want to save changes to your profile information?
              </p>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileConfirmOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${c.viewToggle} ${c.textMuted}`}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={saveProfile}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${c.primaryBtn}`}
                >
                  Confirm Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showProfileSavedNotice && (
          <div className="fixed top-5 right-5 z-[70]">
            <div className={`rounded-xl px-4 py-3 border ${c.border} ${c.panel} shadow-lg`}>
              <p className={`${c.heading} text-sm font-semibold`}>Profile saved successfully.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
