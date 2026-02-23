import axios from 'axios';

const API_URL = 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
});

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
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
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
  createPost: (data: { caption: string; imageUrl?: string }) =>
    api.post('/posts', data),
  updatePost: (id: string, data: { caption: string; imageUrl?: string }) =>
    api.put(`/posts/${id}`, data),
  deletePost: (id: string) => api.delete(`/posts/${id}`),
};

export const eventsAPI = {
  getEvents: (params?: { startDate?: string; endDate?: string; allDepartments?: boolean }) =>
    api.get('/events', { params }),
  createEvent: (data: { title: string; description?: string; eventDate: string; endDate?: string; location?: string; eventImageUrl?: string; eventLink?: string }) =>
    api.post('/events', data),
  updateEvent: (id: string, data: { title?: string; description?: string; eventDate?: string; endDate?: string; location?: string; eventImageUrl?: string | null; eventLink?: string | null }) =>
    api.put(`/events/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/events/${id}`),
};
