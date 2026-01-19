import axios from 'axios';
import type { ScheduleRequest, Task } from './types';

export const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function listTasks(): Promise<Task[]> {
  const response = await api.get<{ tasks: Task[] }>('/tasks');
  return response.data.tasks ?? [];
}

export async function createTask(payload: ScheduleRequest): Promise<{ taskId: string; scheduledTime?: string }> {
  const response = await api.post('/schedule', payload);
  return response.data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}
