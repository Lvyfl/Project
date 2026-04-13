import axios from 'axios';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const resolveApiUrl = () => {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredApiUrl) {
    return normalizeBaseUrl(configuredApiUrl);
  }

  return 'http://localhost:3000';
};

export const api = axios.create({
  baseURL: resolveApiUrl(),
});

const isConnectionError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  return !error.response;
};

const getAuthBaseCandidates = () => {
  const candidates: string[] = [];
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const preferred = normalizeBaseUrl(configuredApiUrl || resolveApiUrl());
  candidates.push(preferred);

  ['http://localhost:3000', 'http://localhost:3001'].forEach((url) => {
    if (!candidates.includes(url)) {
      candidates.push(url);
    }
  });

  return candidates;
};

const postAuthWithFallback = async <T>(path: string, data: T) => {
  const baseCandidates = getAuthBaseCandidates();
  let lastError: unknown;

  for (const baseURL of baseCandidates) {
    try {
      return await api.request({
        method: 'post',
        url: path,
        data,
        baseURL,
      });
    } catch (error) {
      lastError = error;
      if (!isConnectionError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
};

// Add token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle expired/invalid tokens globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token is invalid or expired — clear auth and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: { name: string; email: string; password: string; departmentName: string }) =>
    postAuthWithFallback('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    postAuthWithFallback('/auth/login', data),
};

export const postsAPI = {
  getPosts: (params?: { limit?: number; offset?: number; departmentId?: string }) => api.get('/posts/public', { params }),
  getDepartmentPosts: (params?: { limit?: number; offset?: number }) => api.get('/posts', { params }),
  getPostById: (id: string) => api.get(`/posts/${id}`),
  uploadDocument: (formData: FormData) =>
    api.post('/posts/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  createPost: (data: { caption: string; body?: string; category?: string; imageUrl?: string; imageUrls?: string[] }) =>
    api.post('/posts', data),
  updatePost: (id: string, data: { caption: string; body?: string; category?: string; imageUrl?: string }) =>
    api.put(`/posts/${id}`, data),
  deletePost: (id: string) => api.delete(`/posts/${id}`),
  getEngagement: () => api.get('/posts/engagement'),
};

export const eventsAPI = {
  getEvents: (params?: { startDate?: string; endDate?: string; allDepartments?: boolean }) =>
    api.get('/events', { params }),
  createEvent: (data: { title: string; description?: string; eventDate: string; endDate?: string; location?: string; eventImageUrl?: string; eventLink?: string; isAnnouncement?: boolean }) =>
    api.post('/events', data),
  updateEvent: (id: string, data: { title?: string; description?: string; eventDate?: string; endDate?: string; location?: string; eventImageUrl?: string | null; eventLink?: string | null; isAnnouncement?: boolean }) =>
    api.put(`/events/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/events/${id}`),
};

export const backgroundsAPI = {
  list: () => api.get('/backgrounds'),
  getActive: () => api.get('/backgrounds/active'),
  upload: (formData: FormData) =>
    api.post('/backgrounds/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  activate: (id: string) => api.put(`/backgrounds/${id}/activate`),
  deactivateAll: () => api.put('/backgrounds/deactivate-all'),
  delete: (id: string) => api.delete(`/backgrounds/${id}`),
};
