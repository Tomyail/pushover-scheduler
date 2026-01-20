import axios from 'axios';
import type { ScheduleRequest, Task, ExecutionLog } from './types';

export const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function login(password: string): Promise<void> {
  const formData = new FormData();
  formData.append('password', password);
  await fetch('/login', {
    method: 'POST',
    body: formData,
  });
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

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}
