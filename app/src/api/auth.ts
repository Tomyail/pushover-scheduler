import { api } from './client';
import { storage } from '../utils/storage';

export async function login(password: string, apiUrl?: string): Promise<void> {
  const formData = new FormData();
  formData.append('password', password);
  
  const baseURL = apiUrl || api.defaults.baseURL;
  
  const response = await fetch(`${baseURL}/api/login`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).error || 'Login failed');
  }
  
  const data = await response.json();
  
  if (data.token) {
    await storage.setToken(data.token);
  }
  
  if (apiUrl) {
    await storage.setApiUrl(apiUrl);
    api.defaults.baseURL = apiUrl;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/api/logout');
  } finally {
    await storage.removeToken();
  }
}

export async function checkAuth(): Promise<boolean> {
  try {
    const token = await storage.getToken();
    if (!token) {
      return false;
    }
    await api.get('/api/tasks');
    return true;
  } catch {
    return false;
  }
}
