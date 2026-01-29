import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { storage } from '../utils/storage';

// Default API URL - should be configured by user
const DEFAULT_API_URL = 'http://localhost:8787';

// Create axios instance
export const api = axios.create({
  baseURL: DEFAULT_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getToken();
    const savedUrl = await storage.getApiUrl();
    
    if (savedUrl) {
      config.baseURL = savedUrl;
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await storage.removeToken();
    }
    return Promise.reject(error);
  }
);

export function setBaseURL(url: string): void {
  api.defaults.baseURL = url;
}
