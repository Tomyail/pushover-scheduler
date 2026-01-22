import axios from 'axios';
import type { ScheduleRequest, Task, ExecutionLog, Settings } from './types';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function login(password: string): Promise<void> {
  const formData = new FormData();
  formData.append('password', password);
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
    body: formData,
    credentials: 'include',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).error || 'Login failed');
  }
}

export async function logout(): Promise<void> {
  await api.post('/logout');
}

export async function listTasks(): Promise<Task[]> {
  const response = await api.get<{ tasks: Task[] }>('/tasks');
  return response.data.tasks ?? [];
}

export async function getTask(taskId: string): Promise<Task> {
  const response = await api.get<{ task: Task }>(`/tasks/${taskId}`);
  return response.data.task;
}

export async function getTaskLogs(taskId: string): Promise<ExecutionLog[]> {
  const response = await api.get<{ taskId: string; logs: ExecutionLog[] }>(`/tasks/${taskId}/logs`);
  return response.data.logs ?? [];
}

export async function createTask(payload: ScheduleRequest): Promise<{ taskId: string; scheduledTime?: string }> {
  const response = await api.post('/schedule', payload);
  return response.data;
}

export async function updateTask(taskId: string, payload: ScheduleRequest): Promise<{ taskId: string; scheduledTime?: string }> {
  const response = await api.put(`/tasks/${taskId}`, payload);
  return response.data;
}


export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}

export async function triggerTask(taskId: string): Promise<void> {
  await api.post(`/tasks/${taskId}/trigger`);
}

export async function getDefaultExtras(): Promise<Settings> {
  const response = await api.get<Settings>('/settings/default-extras');
  return response.data;
}

export async function setDefaultExtras(settings: Settings): Promise<void> {
  await api.put('/settings/default-extras', settings);
}

export async function parseInput(prompt: string): Promise<Partial<ScheduleRequest>> {
  // Mock implementation for UI development
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate latency

  const lower = prompt.toLowerCase();
  const now = new Date();

  // Simple heuristic mocks
  if (lower.includes('reminder') || lower.includes('remind')) {
    const future = new Date(now.getTime() + 10 * 60000); // +10 mins
    const offset = future.getTimezoneOffset() * 60000;
    const localISOTime = new Date(future.getTime() - offset).toISOString().slice(0, 16);

    return {
      message: prompt,
      title: 'Reminder',
      schedule: { type: 'once', datetime: localISOTime }
    };
  }

  if (lower.includes('daily') || lower.includes('every')) {
    return {
      message: prompt,
      title: 'Daily Task',
      schedule: { type: 'repeat', cron: '0 9 * * *' }
    };
  }

  // Default fallback mock
  const future = new Date(now.getTime() + 60 * 60000); // +1 hour
  const offset = future.getTimezoneOffset() * 60000;
  const localISOTime = new Date(future.getTime() - offset).toISOString().slice(0, 16);
  return {
    message: prompt,
    schedule: { type: 'once', datetime: localISOTime }
  };
}

