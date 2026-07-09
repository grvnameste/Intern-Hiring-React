import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle global errors (e.g., 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error('Network unavailable. Please check your connection.');
      return Promise.reject(error);
    }

    const status = error.response.status;

    if (status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      toast.error('Session expired or unauthorized. Please log in again.');
    } else if (status === 403) {
      toast.error('Unauthorized: You do not have permission for this action.');
    } else if (status >= 500) {
      toast.error('Server error. Please try again later.');
    }
    // We do not globally toast 400/404 errors here to avoid double toasts in specific components 
    // that implement their own specific error handling, but we ensure components use user-friendly messages.

    return Promise.reject(error);
  }
);
