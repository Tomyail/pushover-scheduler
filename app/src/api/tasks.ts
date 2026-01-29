import { api } from './client';
import type { Task, ScheduleRequest, ExecutionLog } from '../types';

export async function listTasks(): Promise<Task[]> {
  const response = await api.get<{ tasks: Task[] }>('/api/tasks');
  return response.data.tasks ?? [];
}

export async function getTask(taskId: string): Promise<Task> {
  const response = await api.get<{ task: Task }>(`/api/tasks/${taskId}`);
  return response.data.task;
}

export async function getTaskLogs(taskId: string): Promise<ExecutionLog[]> {
  const response = await api.get<{ taskId: string; logs: ExecutionLog[] }>(`/api/tasks/${taskId}/logs`);
  return response.data.logs ?? [];
}

export async function createTask(payload: ScheduleRequest): Promise<{ taskId: string; scheduledTime?: string }> {
  const response = await api.post('/api/schedule', payload);
  return response.data;
}

export async function updateTask(taskId: string, payload: ScheduleRequest): Promise<{ taskId: string; scheduledTime?: string }> {
  const response = await api.put(`/api/tasks/${taskId}`, payload);
  return response.data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/api/tasks/${taskId}`);
}

export async function triggerTask(taskId: string): Promise<void> {
  await api.post(`/api/tasks/${taskId}/trigger`);
}
