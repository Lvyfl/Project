'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { postsAPI } from '@/lib/api';
import CalendarSection from './CalendarSection';
import UploadPdfSection from './UploadPdfSection';
import UploadBackgroundSection from './UploadBackgroundSection';
import AccountManagementSection from './AccountManagementSection';
import AdminAccountsPieChart from './AdminAccountsPieChart';

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
    'from-orange-600 to-zinc-900',
    'from-zinc-900 to-orange-700',
    'from-orange-500 to-zinc-900',
    'from-orange-700 to-orange-900',
    'from-zinc-900 to-orange-600',
  ];
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getFirstName(name?: string) {
  if (!name) return 'User';
  const first = name.trim().split(' ')[0];
  return first || 'User';
}

function parsePostImageUrls(imageUrl?: string | null): string[] {
  if (!imageUrl) return [];
  if (imageUrl.startsWith('[')) {
    try { return JSON.parse(imageUrl) as string[]; } catch {}
  }
  return [imageUrl];
}

// Theme color map
function useColors() {
  const { theme } = useTheme();
  const d = theme === 'dark';
  return {
    page: d ? 'bg-[#0D0D0D]' : 'bg-[#FAF5EF]',
    // Surfaces — sidebar is always dark
    sidebar: d ? 'bg-[#0D0D0D] backdrop-blur-xl border-r border-[#1f1f1f]' : 'bg-[#1C1C1C] backdrop-blur-xl border-r border-[#2a2a2a]',
    sidebarHeading: 'text-white',
    sidebarMuted: 'text-[#8B8078]',
    header: d ? 'bg-[#0D0D0D]/75 backdrop-blur-xl border-b border-[#1f1f1f]' : 'bg-white/90 backdrop-blur-xl border-b border-[#E8E0D8] shadow-sm',
    card: d ? 'bg-[#141414] border border-[#1f1f1f] hover:border-orange-500/40 hover:shadow-xl hover:shadow-orange-900/30' : 'bg-white border border-[#E8E0D8] hover:border-[#D0C4B8] shadow-sm hover:shadow-md',
    panel: d ? 'backdrop-blur-xl bg-[#141414] border border-[#1f1f1f]' : 'backdrop-blur-xl bg-white border border-[#E8E0D8] shadow-sm',
    statCard: d ? 'bg-[#141414] border border-[#1f1f1f]' : 'bg-[#FAF5EF] border border-[#E8E0D8]',
    emptyIcon: d ? 'bg-[#141414] border border-[#1f1f1f]' : 'bg-[#FAF5EF] border border-[#E8E0D8]',
    searchInput: d
      ? 'bg-[#0D0D0D]/60 border border-[#1f1f1f] text-white placeholder-[#8B8078] focus:border-orange-500 focus:ring-orange-500/25'
      : 'bg-white border border-[#E8E0D8] text-[#3D3228] placeholder-[#B0A090] focus:border-orange-500 focus:ring-orange-500/20',
    viewToggle: d ? 'bg-[#0D0D0D]/60 border border-[#1f1f1f]' : 'bg-[#FAF5EF] border border-[#E8E0D8]',
    viewActive: d ? 'bg-orange-500/20 text-orange-200' : 'bg-orange-100 text-orange-800',
    viewInactive: d ? 'text-[#8B8078] hover:text-white' : 'text-[#8B7D72] hover:text-[#3D3228]',

    // Text
    heading: d ? 'text-white' : 'text-[#3D3228]',
    text: d ? 'text-[#F5F0EB]' : 'text-[#3D3228]',
    textSecondary: d ? 'text-[#D5CCC2]' : 'text-[#5C5048]',
    textMuted: d ? 'text-[#8B8078]' : 'text-[#9C8E82]',
    sectionLabel: d ? 'text-[#8B8078]' : 'text-[#9C8E82]',
    emailText: d ? 'text-[#D5CCC2]' : 'text-[#7A6E64]',
    subtitle: d ? 'text-[#8B8078]' : 'text-[#9C8E82]',

    // Borders
    border: d ? 'border-[#1f1f1f]' : 'border-[#E8E0D8]',
    borderLight: d ? 'border-[#1a1a1a]' : 'border-[#E8E0D8]',

    // Badges
    deptBadge: d ? 'bg-orange-500/15 text-orange-200 border border-orange-500/30' : 'bg-orange-50 text-orange-800 border border-orange-200',
    pdfBadge: d ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-orange-50 border border-orange-200',
    countBadge: d ? 'bg-orange-500/20 text-orange-100' : 'bg-orange-100 text-orange-800',
    // Nav — always dark sidebar
    navInactive: 'text-[#C5BAB0] hover:bg-[#1a1a1a] hover:text-white',
    navActive: 'bg-orange-600 text-white border-l-4 border-orange-400 shadow-md',
    navActiveBadge: 'bg-white/20 text-white',

    // Buttons
    logoutBtn: d
      ? 'bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white'
      : 'bg-white/70 hover:bg-red-600 border border-red-200/70 hover:border-red-500 text-red-600 hover:text-white',
    clearSearch: d ? 'text-[#8B8078] hover:text-white' : 'text-[#9C8E82] hover:text-[#3D3228]',
    actionBtn: d ? 'text-[#D5CCC2] hover:text-white hover:bg-orange-500/20' : 'text-[#7A6E64] hover:text-[#3D3228] hover:bg-orange-50',
    primaryBtn: d
      ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/40'
      : 'bg-[#E85D04] hover:bg-[#D45300] text-white shadow-md shadow-orange-200/60',
    primaryBtnDisabled: d ? 'bg-[#1a1a1a] text-[#5C5048] cursor-not-allowed' : 'bg-orange-100 text-orange-400 cursor-not-allowed',
    linkAccent: d ? 'text-orange-200 hover:text-white' : 'text-orange-700 hover:text-[#3D3228]',

    // Stats — orange numbers
    statTotal: d ? 'text-orange-500' : 'text-[#E85D04]',
    statToday: d ? 'text-orange-500' : 'text-[#E85D04]',
    statWeek: d ? 'text-orange-500' : 'text-[#E85D04]',
    statPdf: d ? 'text-orange-500' : 'text-[#E85D04]',
    statLabel: d ? 'text-[#8B8078]' : 'text-[#9C8E82]',

    // PDF card
    pdfCard: d ? 'bg-gradient-to-br from-[#141414] to-[#1a0e04] border border-[#1f1f1f]' : 'bg-gradient-to-br from-orange-50 to-white border border-[#E8E0D8]',
    pdfIcon: d ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-orange-100 border border-orange-200',
    pdfLabel: d ? 'text-[#D5CCC2]' : 'text-[#7A6E64]',

    // Iframe border
    iframeBorder: d ? 'border border-[#1f1f1f]' : 'border border-[#E8E0D8]',

    // Theme toggle
    toggleBg: d ? 'bg-[#0D0D0D]/60 border border-[#1f1f1f]' : 'bg-[#FAF5EF] border border-[#E8E0D8]',
  };
}

type PostItem = {
  id: string;
  caption: string;
  body?: string;
  category?: string;
  imageUrl: string;
  createdAt: string;
  adminId?: string;
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
      body: typeof item.body === 'string' ? item.body : undefined,
      category: typeof item.category === 'string' ? item.category : undefined,
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      adminId: typeof item.adminId === 'string' ? item.adminId : undefined,
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [engagement, setEngagement] = useState<{ totalViews: number; posts: { id: string; caption: string; departmentName: string | null; viewCount: number }[] }>({ totalViews: 0, posts: [] });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileConfirmOpen, setIsProfileConfirmOpen] = useState(false);
  const [showProfileSavedNotice, setShowProfileSavedNotice] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [postsScrollProgress, setPostsScrollProgress] = useState(0);
  const [isPostsFeedScrollable, setIsPostsFeedScrollable] = useState(true);
  const [isPostsFlyoutOpen, setIsPostsFlyoutOpen] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'pdf'; src: string } | null>(null);
  const [newCaption, setNewCaption] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviewUrls, setNewImagePreviewUrls] = useState<string[]>([]);
  const [isCropEnabled, setIsCropEnabled] = useState(false);
  const [isPostConfirmOpen, setIsPostConfirmOpen] = useState(false);
  const [isEditConfirmOpen, setIsEditConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [updatingPostId, setUpdatingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<PostItem | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [deleteTargetPostId, setDeleteTargetPostId] = useState<string | null>(null);
  const [postActionMessage, setPostActionMessage] = useState<{ title: string; message: string } | null>(null);
  const [showPostSuccess, setShowPostSuccess] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
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
      if (user?.isMasterAdmin) {
        postsAPI.getEngagement().then(r => setEngagement(r.data)).catch(() => {});
      }
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => {
      newImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [newImagePreviewUrls]);

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
        response = await postsAPI.getDepartmentPosts({ limit: 20, offset: 0 });
      } catch {
        response = await postsAPI.getPosts({ limit: 20, offset: 0 });
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
    setLoggingOut(true);
    setTimeout(() => {
      logout();
      router.push('/login');
    }, 1200);
  };

  const onPickImages = (files: FileList | null) => {
    newImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    if (!files || files.length === 0) {
      setNewImageFiles([]);
      setNewImagePreviewUrls([]);
      setIsCropEnabled(false);
      setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
      setCompletedCrop(null);
      return;
    }
    const arr = Array.from(files);
    setNewImageFiles(arr);
    setNewImagePreviewUrls(arr.map(f => URL.createObjectURL(f)));
    setIsCropEnabled(false);
    setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
    setCompletedCrop(null);
  };

  const removeImageAt = (idx: number) => {
    URL.revokeObjectURL(newImagePreviewUrls[idx]);
    setNewImageFiles(prev => prev.filter((_, i) => i !== idx));
    setNewImagePreviewUrls(prev => prev.filter((_, i) => i !== idx));
    if (isCropEnabled) {
      setIsCropEnabled(false);
      setCompletedCrop(null);
    }
  };

  const openCreatePostModal = () => {
    setIsCreatePostModalOpen(true);
    setIsPostsFlyoutOpen(false);
    setTimeout(() => captionInputRef.current?.focus(), 120);
  };

  const closeCreatePostModal = () => {
    setIsCreatePostModalOpen(false);
    setIsPostConfirmOpen(false);
    setNewBody('');
    onPickImages(null);
  };

  const requestSubmitPost = () => {
    if (posting) return;
    if (!newCaption.trim()) return;
    setIsPostConfirmOpen(true);
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
      setIsPostConfirmOpen(false);

      const imageUrls: string[] = [];
      for (let i = 0; i < newImageFiles.length; i++) {
        const file = newImageFiles[i];
        if (!file.type.startsWith('image/')) {
          alert('Please choose valid image files.');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          alert('Each image must be 5MB or smaller.');
          return;
        }
        // Apply crop only when exactly one image is selected
        if (i === 0 && newImageFiles.length === 1 && isCropEnabled) {
          const img = imgRef.current;
          if (img && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
            const croppedBlob = await getCroppedBlobFromImg(img, completedCrop);
            if (croppedBlob.size > 5 * 1024 * 1024) {
              alert('Cropped image is still larger than 5MB. Please crop tighter or use a smaller image.');
              return;
            }
            imageUrls.push(await blobToDataUrl(croppedBlob));
            continue;
          }
        }
        imageUrls.push(await fileToDataUrl(file));
      }

      await postsAPI.createPost({ caption, body: newBody.trim() || undefined, category: newCategory || undefined, ...(imageUrls.length > 0 ? { imageUrls } : {}) });
      setNewCaption('');
      setNewBody('');
      setNewCategory('');
      onPickImages(null);
      closeCreatePostModal();
      setShowPostSuccess(true);
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

  const editPost = (post: PostItem) => {
    if (updatingPostId || deletingPostId) return;
    const canManage = post.adminId === user?.id && post.departmentId === user?.departmentId;
    if (!canManage) {
      setPostActionMessage({
        title: 'Edit not allowed',
        message: 'You can only edit your own posts in your department.',
      });
      return;
    }

    setEditingPost(post);
    setEditCaption(post.caption || '');
    setEditBody(post.body || '');
    setEditCategory(post.category || '');
  };

  const submitPostEdit = async () => {
    if (!editingPost || updatingPostId || deletingPostId) return;

    const trimmedCaption = editCaption.trim();
    if (!trimmedCaption) {
      setPostActionMessage({
        title: 'Invalid caption',
        message: 'Caption cannot be empty.',
      });
      return;
    }

    setIsEditConfirmOpen(true);
  };

  const confirmSubmitPostEdit = async () => {
    if (!editingPost || updatingPostId || deletingPostId) return;
    const trimmedCaption = editCaption.trim();
    if (!trimmedCaption) return;

    try {
      setUpdatingPostId(editingPost.id);
      setIsEditConfirmOpen(false);
      await postsAPI.updatePost(editingPost.id, {
        caption: trimmedCaption,
        body: editBody.trim() || undefined,
        category: editCategory || undefined,
        imageUrl: editingPost.imageUrl || undefined,
      });
      setEditingPost(null);
      setEditCaption('');
      setEditBody('');
      setEditCategory('');
      setIsEditConfirmOpen(false);
      await fetchPosts();
    } catch (err) {
      console.error('Failed to update post', err);
      setPostActionMessage({
        title: 'Update failed',
        message: 'Failed to update post. Please try again.',
      });
    } finally {
      setUpdatingPostId(null);
    }
  };

  const deletePostItem = (postId: string) => {
    if (updatingPostId || deletingPostId) return;

    const targetPost = posts.find((item) => item.id === postId);
    const canManage = !!targetPost && targetPost.adminId === user?.id && targetPost.departmentId === user?.departmentId;
    if (!canManage) {
      setPostActionMessage({
        title: 'Delete not allowed',
        message: 'You can only delete your own posts in your department.',
      });
      return;
    }

    setDeleteTargetPostId(postId);
  };

  const confirmDeletePost = async () => {
    if (!deleteTargetPostId || updatingPostId || deletingPostId) return;

    const postId = deleteTargetPostId;

    try {
      setDeletingPostId(postId);
      await postsAPI.deletePost(postId);
      setPosts((prev) => prev.filter((item) => item.id !== postId));
      setDeleteTargetPostId(null);
      setShowDeleteSuccess(true);
    } catch (err) {
      console.error('Failed to delete post', err);
      setDeleteTargetPostId(null);
      setPostActionMessage({
        title: 'Delete failed',
        message: 'Failed to delete post. Please try again.',
      });
    } finally {
      setDeletingPostId(null);
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !p.caption?.toLowerCase().includes(q) &&
          !p.adminName?.toLowerCase().includes(q) &&
          !p.departmentName?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [posts, searchQuery, categoryFilter]);

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
    // Seed all known departments with 0 so they always appear
    PROFILE_DEPARTMENTS.forEach(d => map.set(d, 0));
    posts.forEach(p => {
      if (p.departmentName) map.set(p.departmentName, (map.get(p.departmentName) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const viewMap = useMemo<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    engagement.posts.forEach(p => { m[p.id] = p.viewCount; });
    return m;
  }, [engagement.posts]);

  const effectivePostsProgress = isPostsFeedScrollable ? postsScrollProgress : 0;
  const flyoutVisibility = effectivePostsProgress < 0.3 ? 0 : Math.min((effectivePostsProgress - 0.3) / 0.2, 1);

  if (loggingOut || loading) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-[#0D0D0D]' : 'bg-[#FAF5EF]'}`}>
        <style>{`
          @keyframes ceit-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.15; }
          }
          .ceit-logo-blink { animation: ceit-blink 1.4s ease-in-out infinite; }
          .ceit-text-blink { animation: ceit-blink 1.4s ease-in-out infinite; }
        `}</style>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="CEIT Logo"
          className="ceit-logo-blink w-36 h-36 object-contain"
        />
        <p className={`ceit-text-blink mt-4 text-[11px] font-black uppercase tracking-[0.35em] ${theme === 'dark' ? 'text-orange-500/80' : 'text-orange-600/70'}`}>
          {loggingOut ? 'Logging out...' : 'Loading...'}
        </p>
      </div>
    );
  }
  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${c.page}`}>
      {/* Sidebar */}
      <aside className={`w-72 ${c.sidebar} flex flex-col fixed top-0 left-0 h-screen overflow-y-auto z-20 transition-colors duration-300`}>
        {/* Logo */}
        <div className="h-[104px] px-6 border-b border-[#1f1f1f] flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-orange-500 tracking-tight">CEIT Portal</h1>
          <p className="text-[#8B8078] text-xs mt-0.5 tracking-widest uppercase">Admin Dashboard</p>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-4 space-y-1.5 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-[#8B8078] font-semibold mb-3 px-1">Navigation</p>
          {[
            {
              key: 'overview',
              label: 'Overview',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.8}/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.8}/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.8}/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={1.8}/></svg>
              ),
            },
            {
              key: 'posts',
              label: 'Posts',
              badge: stats.total,
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20v-8H7v8M7 4v4h8"/></svg>
              ),
            },
            {
              key: 'announcements',
              label: 'Announcements',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
              ),
            },
            {
              key: 'uploadPdf',
              label: 'Upload PDF',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 11v6m-3-3l3-3 3 3"/></svg>
              ),
            },
            {
              key: 'backgrounds',
              label: 'Upload Backgrounds',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              ),
            },
            ...(user?.isMasterAdmin ? [{
              key: 'accounts',
              label: 'Accounts',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ),
            }] : []),
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
              <span className="flex-shrink-0">{item.icon}</span>
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

        {/* User info at bottom */}
        <div className="mt-auto px-4 py-4 border-t border-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(user?.name || '')} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md`}>
              {getInitials(user?.name || '')}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user?.name || 'User'}</p>
              <p className="text-[#8B8078] text-xs">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen ml-72">
        {/* Top Bar */}
        <header className={`sticky top-0 z-30 h-[104px] ${c.header} px-8 transition-colors duration-300 flex items-center`}>
          <div className="w-full flex items-center justify-between">
            <div>
              <h2 className={`text-2xl font-bold ${c.heading}`}>
                {activeTab === 'overview' && 'Overview'}
                {activeTab === 'posts' && 'Posts'}
                {activeTab === 'announcements' && 'Announcements'}
                {activeTab === 'uploadPdf' && 'Upload PDF'}
                {activeTab === 'backgrounds' && 'Viewer Backgrounds'}
                {activeTab === 'accounts' && 'Account Management'}
              </h2>
              <p className={`${c.textMuted} text-sm mt-0.5`}>
                {activeTab === 'overview' && 'Dashboard metrics at a glance'}
                {activeTab === 'posts' && `${filteredPosts.length} post${filteredPosts.length !== 1 ? 's' : ''} ${searchQuery || categoryFilter ? 'found' : 'total'}`}
                {activeTab === 'announcements' && 'Manage events and calendar'}
                {activeTab === 'uploadPdf' && 'Upload and manage PDF documents'}
                {activeTab === 'backgrounds' && 'Manage the viewer page background image'}
                {activeTab === 'accounts' && 'Create and remove admin accounts'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { openCreatePostModal(); }}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${c.primaryBtn} flex items-center gap-2`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Post
              </button>
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getAvatarColor(user?.name || '')} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
                >
                  {getInitials(user?.name || '')}
                </button>
                {isUserMenuOpen && (
                  <div
                    className={`absolute right-0 z-50 mt-2 w-64 rounded-2xl border p-3 shadow-2xl ${
                      theme === 'dark'
                        ? 'bg-[#0a0a0a] border-orange-500/30'
                        : 'bg-white border-orange-200'
                    }`}
                  >
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
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${c.actionBtn} ${
                          theme === 'dark' ? 'bg-[#141414] border border-orange-500/20' : 'bg-orange-50 border border-orange-200'
                        }`}
                      >
                        <span className="text-sm font-medium">View Profile</span>
                      </button>
                    </div>
                    <div className="px-3 py-3">
                      <p className={`text-[10px] uppercase tracking-widest ${c.sectionLabel} font-semibold mb-2`}>Accessibility</p>
                      <div
                        className={`flex items-center rounded-xl border p-1 ${
                          theme === 'dark'
                            ? 'bg-[#121212] border-orange-500/30'
                            : 'bg-orange-50 border-orange-200'
                        }`}
                      >
                        <button
                          onClick={() => theme !== 'dark' && toggleTheme()}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                            theme === 'dark'
                              ? 'bg-orange-600 text-white shadow-md'
                              : theme === 'light' ? 'text-orange-800' : `${c.textMuted}`
                          }`}
                        >
                          Dark
                        </button>
                        <button
                          onClick={() => theme !== 'light' && toggleTheme()}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                            theme === 'light'
                              ? 'bg-orange-600 text-white shadow-md'
                              : theme === 'dark' ? 'text-orange-200/80' : `${c.textMuted}`
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
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Total Posts */}
                <div className={`rounded-2xl p-6 flex items-center justify-between ${theme === 'dark' ? 'bg-gradient-to-br from-[#141414] to-[#1a1a2e] border border-blue-900/30' : 'bg-gradient-to-br from-blue-50 to-indigo-100 border border-indigo-200'}`}>
                  <div>
                    <p className={`text-[11px] uppercase tracking-widest font-semibold ${theme === 'dark' ? 'text-blue-300/70' : 'text-indigo-500'}`}>Total Posts</p>
                    <p className={`text-5xl font-bold ${c.statTotal} mt-1`}>{stats.total}</p>
                    <p className={`text-xs mt-2 flex items-center gap-1.5 ${theme === 'dark' ? 'text-blue-300/50' : 'text-indigo-400'}`}>
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> All time
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-indigo-200/60'}`}>
                    <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-400' : 'text-indigo-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                </div>
                {/* Posted Today */}
                <div className={`rounded-2xl p-6 flex items-center justify-between ${theme === 'dark' ? 'bg-gradient-to-br from-[#141414] to-[#0d1f0d] border border-green-900/30' : 'bg-gradient-to-br from-green-50 to-emerald-100 border border-emerald-200'}`}>
                  <div>
                    <p className={`text-[11px] uppercase tracking-widest font-semibold ${theme === 'dark' ? 'text-green-300/70' : 'text-emerald-600'}`}>Posted Today</p>
                    <p className={`text-5xl font-bold ${c.statToday} mt-1`}>{stats.today}</p>
                    <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-green-300/50' : 'text-emerald-500'}`}>{stats.today === 0 ? 'No activity today' : 'Active today'}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-green-900/30' : 'bg-emerald-200/60'}`}>
                    <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-green-400' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
                {/* This Week */}
                <div className={`rounded-2xl p-6 flex items-center justify-between ${theme === 'dark' ? 'bg-gradient-to-br from-[#141414] to-[#1a1200] border border-yellow-900/30' : 'bg-gradient-to-br from-yellow-50 to-amber-100 border border-amber-200'}`}>
                  <div>
                    <p className={`text-[11px] uppercase tracking-widest font-semibold ${theme === 'dark' ? 'text-yellow-300/70' : 'text-amber-600'}`}>This Week</p>
                    <p className={`text-5xl font-bold ${c.statWeek} mt-1`}>{stats.thisWeek}</p>
                    <p className={`text-xs mt-2 flex items-center gap-1.5 ${theme === 'dark' ? 'text-yellow-300/50' : 'text-amber-500'}`}>
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active week
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-yellow-900/30' : 'bg-amber-200/60'}`}>
                    <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-yellow-400' : 'text-amber-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                </div>
                {/* PDF Posts */}
                <div className={`rounded-2xl p-6 flex items-center justify-between ${theme === 'dark' ? 'bg-gradient-to-br from-[#141414] to-[#1a0a1a] border border-purple-900/30' : 'bg-gradient-to-br from-purple-50 to-violet-100 border border-violet-200'}`}>
                  <div>
                    <p className={`text-[11px] uppercase tracking-widest font-semibold ${theme === 'dark' ? 'text-purple-300/70' : 'text-violet-600'}`}>PDF Posts</p>
                    <p className={`text-5xl font-bold ${c.statPdf} mt-1`}>{stats.pdfs}</p>
                    <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-purple-300/50' : 'text-violet-500'}`}>{stats.total > 0 ? `${Math.round((stats.pdfs / stats.total) * 100)}% of total` : 'No posts yet'}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-purple-900/30' : 'bg-violet-200/60'}`}>
                    <svg className={`w-6 h-6 ${theme === 'dark' ? 'text-purple-400' : 'text-violet-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </div>
                </div>
              </div>

              {/* Post Engagement + Recent Posts */}
              <div className={`grid grid-cols-1 ${user?.isMasterAdmin ? 'xl:grid-cols-3' : ''} gap-6`}>
                {/* Post Engagement — bar chart (master admin only) */}
                {user?.isMasterAdmin && <div className={`xl:col-span-2 ${c.panel} rounded-2xl p-6`}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className={`${c.heading} text-xl font-black uppercase tracking-wider`} style={{ letterSpacing: '2px' }}>Post Engagement</h3>
                      <p className={`${c.textMuted} text-sm mt-0.5`}>Views &amp; interactions on viewer page</p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl ${theme === 'dark' ? 'bg-[#141414] border border-[#1f1f1f]' : 'bg-[#0D0D0D]'}`}>
                      <span className="text-2xl font-black text-orange-500">{engagement.totalViews}</span>
                      <p className={`text-[10px] font-semibold uppercase tracking-widest mt-0.5 ${theme === 'dark' ? 'text-[#8B8078]' : 'text-[#C5BAB0]'}`}>Total Views</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {(() => {
                      const ENG_COLORS = ['#E85D04', '#18181b', '#22c55e', '#a855f7', '#3b82f6', '#eab308'];
                      const maxViews = engagement.posts[0]?.viewCount || 1;
                      return engagement.posts.slice(0, 6).map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: ENG_COLORS[i % ENG_COLORS.length] }} />
                          <span className={`${c.textSecondary} text-sm w-44 truncate flex-shrink-0`}>{p.caption}</span>
                          <div className="flex-1 relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: theme === 'dark' ? '#1f1f1f' : '#E8E0D8' }}>
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                              style={{ width: `${maxViews > 0 ? (p.viewCount / maxViews) * 100 : 0}%`, backgroundColor: ENG_COLORS[i % ENG_COLORS.length] }}
                            />
                          </div>
                          <span className={`${c.heading} text-sm font-bold tabular-nums w-8 text-right`}>{p.viewCount}</span>
                        </div>
                      ));
                    })()}
                    {engagement.posts.length === 0 && (
                      <p className={`${c.textMuted} text-sm text-center py-8`}>No views recorded yet</p>
                    )}
                  </div>
                </div>}

                {/* Recent Posts */}
                <div className={`${c.panel} rounded-2xl p-6 flex flex-col`}>
                  <div className="mb-4">
                    <h3 className={`${c.heading} text-lg font-semibold`}>Recent Posts</h3>
                    <p className={`${c.textMuted} text-sm mt-0.5`}>Latest content activity</p>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto">
                    {posts.slice(0, 5).map(post => {
                      const isPDF = post.imageUrl?.includes('|') || post.imageUrl?.startsWith('data:application/pdf');
                      return (
                        <div key={post.id} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${c.statCard}`}>
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(post.departmentName || post.adminName || '')} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow`}>
                            {getInitials(post.departmentName || post.adminName || 'A')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`${c.heading} text-sm font-semibold truncate`}>{post.caption}</p>
                            <p className={`${c.textMuted} text-xs truncate`}>
                              {post.departmentName || 'General'} · {timeAgo(post.createdAt)}
                            </p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${isPDF
                            ? (theme === 'dark' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' : 'bg-orange-100 text-orange-700 border border-orange-300')
                            : (theme === 'dark' ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-zinc-100 text-zinc-600 border border-zinc-200')
                          }`}>
                            {isPDF ? 'PDF' : 'Post'}
                          </span>
                        </div>
                      );
                    })}
                    {posts.length === 0 && (
                      <p className={`${c.textMuted} text-sm text-center py-8`}>No posts yet</p>
                    )}
                  </div>
                </div>
              </div>

              <AdminAccountsPieChart />
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="h-full flex flex-col min-h-0 relative">
              {/* Sticky header */}
              <div className={`sticky top-0 z-20 shrink-0 ${theme === 'dark' ? 'bg-[#0D0D0D]/95' : 'bg-[#FAF5EF]/95'} backdrop-blur-sm`}>
                {/* Page title */}
                <div className="max-w-3xl mx-auto pt-2 pb-3">
                  <h1 className={`${c.heading} text-2xl font-black uppercase tracking-tight`}>Posts</h1>
                  <p className={`${c.textMuted} text-sm`}>{posts.length} post{posts.length !== 1 ? 's' : ''} total</p>
                </div>

                {/* Toolbar: search + filter + view toggle */}
                <div className="max-w-3xl mx-auto mb-3">
                  <div className="flex items-center gap-2">
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
                    <div className="relative">
                      <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className={`pl-3 pr-8 py-2.5 rounded-xl text-sm font-medium appearance-none cursor-pointer transition-all focus:outline-none focus:ring-1 ${
                          categoryFilter
                            ? (theme === 'dark' ? 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40' : 'bg-orange-100 text-orange-800 ring-1 ring-orange-400')
                            : (theme === 'dark' ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200')
                        }`}
                      >
                        <option value="">All Categories</option>
                        <option value="Seminar">Seminar</option>
                        <option value="Achievement">Achievement</option>
                        <option value="Workshop">Workshop</option>
                        <option value="Announcement">Announcement</option>
                        <option value="News">News</option>
                        <option value="Research">Research</option>
                        <option value="Other">Other</option>
                      </select>
                      <svg className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${categoryFilter ? (theme === 'dark' ? 'text-orange-300' : 'text-orange-600') : (theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500')}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    <div className={`flex ${c.viewToggle} rounded-xl p-1`}>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? c.viewActive : c.viewInactive}`}
                        title="List view"
                      >List</button>
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === 'grid' ? c.viewActive : c.viewInactive}`}
                        title="Grid view"
                      >Grid</button>
                    </div>
                  </div>
                </div>

                {/* Create post dark banner */}
                <div className="max-w-3xl mx-auto mb-4">
                  <div className="bg-zinc-900 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                      <div>
                        <h3 className="text-white font-black uppercase text-sm tracking-wider">Create a New Post</h3>
                        <p className="text-zinc-400 text-xs mt-0.5">Open the composer to share an update with your department</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openCreatePostModal}
                      className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
                    >
                      Create Post
                    </button>
                  </div>
                </div>
              </div>

              <div ref={postsFeedRef} className="flex-1 min-h-0 overflow-y-auto pr-1">
                {/* ALL POSTS section divider */}
                <div className="max-w-3xl mx-auto flex items-center gap-3 mb-4">
                  <span className="text-orange-500 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">All Posts</span>
                  <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
                </div>

                {filteredPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className={`w-20 h-20 rounded-2xl ${c.emptyIcon} flex items-center justify-center mb-5`}>
                      <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <h3 className={`text-xl font-semibold ${c.heading} mb-2`}>
                      {searchQuery || categoryFilter ? 'No matching posts' : 'No posts yet'}
                    </h3>
                    <p className={`${c.textMuted} text-sm max-w-sm`}>
                      {searchQuery && categoryFilter
                        ? `No posts found in "${categoryFilter}" matching "${searchQuery}".`
                        : categoryFilter
                        ? `No posts found in the "${categoryFilter}" category.`
                        : searchQuery
                        ? `No posts found matching "${searchQuery}". Try a different search term.`
                        : 'Posts shared by administrators will appear here. Create your first post to get started!'}
                    </p>
                    {(searchQuery || categoryFilter) && (
                      <button
                        onClick={() => { setSearchQuery(''); setCategoryFilter(''); }}
                        className="mt-4 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg text-sm hover:bg-orange-200 transition-all"
                      >
                        Clear filters
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
                      const postViewCount = viewMap[post.id] ?? 0;
                      const hasAttachment = !!post.imageUrl;
                      const canManagePost = post.adminId === user?.id && post.departmentId === user?.departmentId;
                      const postDate = new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                      return (
                        <article
                          key={post.id}
                          className={`group ${c.card} min-w-0 rounded-2xl overflow-hidden transition-all duration-300`}
                          style={{ animationDelay: `${idx * 60}ms` }}
                        >
                          {/* Card header: avatar + name + time/date + dept badge */}
                          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(post.adminName || 'Admin')} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-md`}>
                              {getInitials(post.adminName || 'Admin')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`${c.heading} font-semibold text-sm truncate`}>{post.adminName || 'Admin'}</p>
                              <p className={`${c.textMuted} text-xs mt-0.5`}>{timeAgo(post.createdAt)} · {postDate}</p>
                            </div>
                            {isPDF && (
                              <div className={`flex items-center gap-1 px-2 py-1 ${c.pdfBadge} rounded-lg mr-1`}>
                                <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                <span className="text-[10px] font-semibold text-orange-600">PDF</span>
                              </div>
                            )}
                            {post.departmentName && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white whitespace-nowrap">
                                {post.departmentName}
                              </span>
                            )}
                            {post.category && (
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${theme === 'dark' ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}
                              >
                                {post.category}
                              </span>
                            )}
                          </div>

                          {/* Post title — caption as bold heading */}
                          <div className="px-5 pb-2">
                            <h2 className={`${c.heading} text-lg font-bold leading-snug`}>{post.caption}</h2>
                          </div>

                          {/* Body text excerpt */}
                          {post.body && (
                            <div className="px-5 pb-3">
                              <p className={`${c.text} text-sm leading-relaxed whitespace-pre-wrap`} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                {isExpanded || post.body.length <= 200
                                  ? post.body
                                  : post.body.slice(0, 200) + '...'}
                              </p>
                              {post.body.length > 200 && (
                                <button
                                  onClick={() => toggleExpand(post.id)}
                                  className="text-sm font-medium mt-1.5 transition-colors text-orange-500 hover:text-orange-400"
                                >
                                  {isExpanded ? 'Show less' : 'Read more →'}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Media — full-width, no horizontal padding */}
                          {post.imageUrl && (
                            <div className="overflow-hidden">
                              {isPDF && thumbnailUrl ? (
                                <div className="relative group/media">
                                  <img src={thumbnailUrl} alt="PDF Thumbnail" className="w-full h-auto max-h-96 object-cover group-hover/media:scale-[1.02] transition-transform duration-500 cursor-zoom-in" loading="lazy" onClick={() => openPdfPreview(post.id, pdfUrl)} />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                                    <button type="button" onClick={() => openPdfPreview(post.id, pdfUrl)} className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/20 hover:bg-white/20 transition-colors">
                                      View PDF
                                    </button>
                                  </div>
                                </div>
                              ) : isPDF ? (
                                <div className={`${c.pdfCard} p-8 text-center cursor-pointer`} onClick={() => openPdfPreview(post.id, pdfUrl)}>
                                  <div className={`w-14 h-14 mx-auto rounded-xl ${c.pdfIcon} flex items-center justify-center mb-3`}>
                                    <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                  </div>
                                  <p className={`${c.pdfLabel} font-medium text-sm`}>PDF Document</p>
                                  <p className={`${c.textMuted} text-xs mt-1`}>Click to view</p>
                                </div>
                              ) : (
                                (() => {
                                  const imgs = parsePostImageUrls(post.imageUrl);
                                  if (imgs.length === 0) return null;
                                  return (
                                    <div className="relative group/media">
                                      <img src={imgs[0]} alt="Post image" className="w-full h-auto max-h-96 object-cover group-hover/media:scale-[1.02] transition-transform duration-500 cursor-zoom-in" loading="lazy" onClick={() => setMediaPreview({ type: 'image', src: imgs[0] })} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                      {imgs.length > 1 && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                          +{imgs.length - 1}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          )}

                          {/* Footer: stats + actions */}
                          <div className={`px-5 py-3 flex items-center justify-between gap-3 border-t ${c.borderLight}`}>
                            <div className="flex items-center gap-4">
                              {postViewCount > 0 && (
                                <span className={`${c.textMuted} text-xs flex items-center gap-1`}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  {postViewCount.toLocaleString()} views
                                </span>
                              )}
                              {hasAttachment && (
                                <span className={`${c.textMuted} text-xs flex items-center gap-1`}>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                  1 attachment
                                </span>
                              )}
                            </div>
                            {canManagePost && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => editPost(post)}
                                  disabled={updatingPostId === post.id || deletingPostId === post.id}
                                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  {updatingPostId === post.id ? 'Editing...' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePostItem(post.id)}
                                  disabled={updatingPostId === post.id || deletingPostId === post.id}
                                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  {deletingPostId === post.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Flyout: search + create post as small icons when scrolled */}
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

          {activeTab === 'backgrounds' && (
            <UploadBackgroundSection />
          )}

          {activeTab === 'accounts' && user?.isMasterAdmin && (
            <AccountManagementSection />
          )}
        </div>

        {mediaPreview && (
          <div
            className="fixed inset-0 z-50 bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setMediaPreview(null)}
          >
            <div
              className={`relative w-full rounded-2xl overflow-hidden ${
                mediaPreview.type === 'pdf'
                  ? 'max-w-5xl max-h-[90vh]'
                  : 'max-w-5xl max-h-[90vh]'
              } ${theme === 'dark' ? 'bg-zinc-900/85 border border-orange-500/25' : 'bg-white border border-orange-200'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-zinc-900/50 text-white hover:bg-orange-600 transition-colors" onClick={() => setMediaPreview(null)}>
                ✕
              </button>
              {mediaPreview.type === 'image' ? (
                <img src={mediaPreview.src} alt="Preview" className="w-full h-auto max-h-[90vh] object-contain" />
              ) : (
                <div className="h-full">
                  <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 pr-16 ${theme === 'dark' ? 'border-orange-500/20 bg-zinc-900/80' : 'border-orange-200 bg-white/90'}`}>
                    <span className={`mr-auto text-sm font-medium ${theme === 'dark' ? 'text-orange-100' : 'text-zinc-800'}`}>PDF Preview</span>
                    <a
                      href={mediaPreview.src}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${theme === 'dark' ? 'border-orange-500/30 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25' : 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100'}`}
                    >
                      Open Full View
                    </a>
                  </div>
                  <iframe src={mediaPreview.src} className="w-full h-[88vh]" title="PDF Preview" />
                </div>
              )}
            </div>
          </div>
        )}

        {isCreatePostModalOpen && (
          <div className="fixed inset-0 z-50 bg-zinc-900/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={closeCreatePostModal}>
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
                  <label className={`${c.textSecondary} text-sm font-medium`}>Title *</label>
                  <textarea
                    value={newCaption}
                    onChange={(e) => setNewCaption(e.target.value)}
                    ref={captionInputRef}
                    rows={2}
                    placeholder={`Write a short title, ${getFirstName(user?.name)}...`}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  />
                </div>
                <div>
                  <label className={`${c.textSecondary} text-sm font-medium`}>Full Description</label>
                  <textarea
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    rows={4}
                    placeholder="Provide the full details, body text, or additional context..."
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  />
                </div>

                <div>
                  <label className={`${c.textSecondary} text-sm font-medium`}>Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                  >
                    <option value="">— Select a category —</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Achievement">Achievement</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Announcement">Announcement</option>
                    <option value="News">News</option>
                    <option value="Research">Research</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all ${c.primaryBtn}`}>
                      <span>🖼️</span>
                      <span>{newImageFiles.length > 0 ? 'Change Images' : 'Choose Images'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => onPickImages(e.target.files)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onPickImages(null)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}
                      disabled={newImageFiles.length === 0 && !newCaption}
                    >
                      Clear
                    </button>
                    {newImageFiles.length === 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCropEnabled((prev) => !prev);
                          if (isCropEnabled) {
                            setCompletedCrop(null);
                          }
                        }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${isCropEnabled ? (theme === 'dark' ? 'bg-orange-500/20 text-orange-200' : 'bg-orange-100 text-orange-800') : (theme === 'dark' ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100')}`}
                      >
                        {isCropEnabled ? 'Use Original' : 'Crop Image'}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={requestSubmitPost}
                    disabled={posting || !newCaption.trim()}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${posting || !newCaption.trim() ? c.primaryBtnDisabled : c.primaryBtn}`}
                  >
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>

                {newImagePreviewUrls.length > 0 && (
                  <div className={`rounded-xl overflow-hidden border ${c.borderLight}`}>
                    {newImageFiles.length === 1 ? (
                      /* Single image — optional crop */
                      <>
                        <div className={`w-full ${theme === 'dark' ? 'bg-zinc-900/40' : 'bg-gray-100'} flex items-center justify-center p-3`}>
                          <div className="inline-block leading-none max-w-full max-h-[20rem] overflow-auto rounded-lg">
                            {isCropEnabled ? (
                              <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={(c) => setCompletedCrop(c)}>
                                <img
                                  ref={imgRef}
                                  src={newImagePreviewUrls[0]}
                                  alt="Crop"
                                  className="block max-h-[18rem] w-auto max-w-full"
                                />
                              </ReactCrop>
                            ) : (
                              <img
                                src={newImagePreviewUrls[0]}
                                alt="Preview"
                                className="block max-h-[18rem] w-auto max-w-full rounded-lg"
                              />
                            )}
                          </div>
                        </div>
                        <div className={`px-4 py-3 ${theme === 'dark' ? 'bg-zinc-900/20' : 'bg-white'}`}>
                          <p className={`${c.textMuted} text-[11px]`}>
                            {isCropEnabled
                              ? 'Resize the crop box using the corner handles, or drag to reposition.'
                              : 'Cropping is optional. Click "Crop Image" if you want to crop before uploading.'}
                          </p>
                        </div>
                      </>
                    ) : (
                      /* Multiple images — thumbnail grid with remove buttons */
                      <div className={`p-3 ${theme === 'dark' ? 'bg-zinc-900/40' : 'bg-gray-100'}`}>
                        <p className={`${c.textMuted} text-[11px] mb-2`}>{newImageFiles.length} images selected — click × to remove</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {newImagePreviewUrls.map((url, idx) => (
                            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeImageAt(idx)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                              >
                                ×
                              </button>
                              {idx === 0 && (
                                <span className="absolute bottom-1 left-1 text-[9px] bg-[#E85D04] text-white px-1 py-0.5 rounded font-medium">Cover</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isCreatePostModalOpen && isPostConfirmOpen && (
          <div className="fixed inset-0 z-[56] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => !posting && setIsPostConfirmOpen(false)}>
            <div className={`w-full max-w-md rounded-2xl ${c.panel} border ${c.border} p-6`} onClick={(e) => e.stopPropagation()}>
              <h4 className={`text-lg font-semibold ${c.heading}`}>Confirm Post</h4>
              <p className={`${c.textMuted} text-sm mt-2`}>
                Are you sure you want to publish this post now?
              </p>

              <div className={`mt-4 rounded-xl p-3 ${theme === 'dark' ? 'bg-zinc-900/40 border border-orange-500/20' : 'bg-orange-50 border border-orange-200'}`}>
                <p className={`text-sm font-semibold ${c.text} whitespace-pre-wrap break-words`}>
                  {newCaption.trim()}
                </p>
                {newBody.trim() && (
                  <p className={`text-sm ${c.textMuted} whitespace-pre-wrap break-words mt-2`}>
                    {newBody.trim().slice(0, 200)}{newBody.trim().length > 200 ? '…' : ''}
                  </p>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPostConfirmOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${c.viewToggle} ${c.textMuted}`}
                  disabled={posting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPost}
                  disabled={posting}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${posting ? c.primaryBtnDisabled : c.primaryBtn}`}
                >
                  {posting ? 'Posting...' : 'Confirm Post'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteSuccess && (
          <div
            className="fixed inset-0 z-[57] bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowDeleteSuccess(false)}
          >
            <div
              className={`w-full max-w-sm rounded-2xl ${c.panel} border ${c.border} p-8 flex flex-col items-center text-center shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center mb-5">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className={`text-xl font-bold ${c.heading} mb-2`}>Post Deleted</h3>
              <p className={`text-sm ${c.textMuted} mb-7`}>
                The post has been permanently deleted.
              </p>
              <button
                onClick={() => setShowDeleteSuccess(false)}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${c.primaryBtn}`}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {showPostSuccess && (
          <div
            className="fixed inset-0 z-[57] bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowPostSuccess(false)}
          >
            <div
              className={`w-full max-w-sm rounded-2xl ${c.panel} border ${c.border} p-8 flex flex-col items-center text-center shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              {/* Animated checkmark */}
              <div className="w-20 h-20 rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center mb-5">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className={`text-xl font-bold ${c.heading} mb-2`}>Post Published!</h3>
              <p className={`text-sm ${c.textMuted} mb-7`}>
                Your post has been successfully published and is now visible to everyone.
              </p>
              <button
                onClick={() => setShowPostSuccess(false)}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${c.primaryBtn}`}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {editingPost && (
          <div className="fixed inset-0 z-[55] bg-zinc-900/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setEditingPost(null)}>
            <div className={`w-full max-w-xl rounded-2xl ${c.panel} border ${c.border} p-5`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`${c.heading} font-semibold text-lg`}>Edit Post</h3>
                  <p className={`${c.textMuted} text-sm`}>Update your post title and description</p>
                </div>
                <button
                  onClick={() => { setEditingPost(null); setIsEditConfirmOpen(false); }}
                  className={`w-9 h-9 rounded-full ${c.viewToggle} ${c.textMuted}`}
                  disabled={updatingPostId === editingPost.id}
                >
                  ✕
                </button>
              </div>

              <label className={`${c.textSecondary} text-sm font-medium`}>Title *</label>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={2}
                className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                placeholder="Update your title..."
              />
              <label className={`${c.textSecondary} text-sm font-medium mt-4 block`}>Full Description</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={4}
                className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
                placeholder="Full description or body text..."
              />
              <label className={`${c.textSecondary} text-sm font-medium mt-4 block`}>Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all ${c.searchInput}`}
              >
                <option value="">— Select a category —</option>
                <option value="Seminar">Seminar</option>
                <option value="Achievement">Achievement</option>
                <option value="Workshop">Workshop</option>
                <option value="Announcement">Announcement</option>
                <option value="News">News</option>
                <option value="Research">Research</option>
                <option value="Other">Other</option>
              </select>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setEditingPost(null); setIsEditConfirmOpen(false); }}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${c.viewToggle} ${c.textMuted}`}
                  disabled={updatingPostId === editingPost.id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPostEdit}
                  disabled={updatingPostId === editingPost.id || !editCaption.trim()}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${updatingPostId === editingPost.id || !editCaption.trim() ? c.primaryBtnDisabled : c.primaryBtn}`}
                >
                  {updatingPostId === editingPost.id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {editingPost && isEditConfirmOpen && (
          <div className="fixed inset-0 z-[57] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => !updatingPostId && setIsEditConfirmOpen(false)}>
            <div className={`w-full max-w-md rounded-2xl ${c.panel} border ${c.border} p-6`} onClick={(e) => e.stopPropagation()}>
              <h4 className={`text-lg font-semibold ${c.heading}`}>Save Changes?</h4>
              <p className={`${c.textMuted} text-sm mt-2`}>
                Are you sure you want to save these changes to the post?
              </p>

              <div className={`mt-4 rounded-xl p-3 ${theme === 'dark' ? 'bg-zinc-900/40 border border-orange-500/20' : 'bg-orange-50 border border-orange-200'}`}>
                <p className={`text-sm font-semibold ${c.text} whitespace-pre-wrap break-words`}>
                  {editCaption.trim()}
                </p>
                {editBody.trim() && (
                  <p className={`text-sm ${c.textMuted} whitespace-pre-wrap break-words mt-2`}>
                    {editBody.trim().slice(0, 200)}{editBody.trim().length > 200 ? '…' : ''}
                  </p>
                )}
                {editCategory && (
                  <span className={`inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}>
                    {editCategory}
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditConfirmOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${c.viewToggle} ${c.textMuted}`}
                  disabled={!!updatingPostId}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={confirmSubmitPostEdit}
                  disabled={!!updatingPostId}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${updatingPostId ? c.primaryBtnDisabled : c.primaryBtn}`}
                >
                  {updatingPostId ? 'Saving...' : 'Confirm Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTargetPostId && (
          <div className="fixed inset-0 z-[55] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setDeleteTargetPostId(null)}>
            <div className={`w-full max-w-md rounded-2xl ${c.panel} border ${c.border} p-6`} onClick={(e) => e.stopPropagation()}>
              <h4 className={`text-lg font-semibold ${c.heading}`}>Delete Post</h4>
              <p className={`${c.textMuted} text-sm mt-2`}>
                Delete this post? This action cannot be undone.
              </p>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetPostId(null)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${c.viewToggle} ${c.textMuted}`}
                  disabled={deletingPostId === deleteTargetPostId}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePost}
                  disabled={deletingPostId === deleteTargetPostId}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${theme === 'dark' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-600 hover:bg-red-700 text-white'} disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {deletingPostId === deleteTargetPostId ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {postActionMessage && (
          <div className="fixed inset-0 z-[58] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setPostActionMessage(null)}>
            <div className={`w-full max-w-md rounded-2xl ${c.panel} border ${c.border} p-6`} onClick={(e) => e.stopPropagation()}>
              <h4 className={`text-lg font-semibold ${c.heading}`}>{postActionMessage.title}</h4>
              <p className={`${c.textMuted} text-sm mt-2`}>{postActionMessage.message}</p>

              <div className="mt-6 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setPostActionMessage(null)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${c.primaryBtn}`}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {isProfileOpen && (
          <div className="fixed inset-0 z-50 bg-zinc-900/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={closeProfileModal}>
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
          <div className="fixed inset-0 z-[60] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setIsProfileConfirmOpen(false)}>
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
