import { api } from './client';
import type { Settings, ScheduleRequest } from '../types';

export async function getDefaultExtras(): Promise<Settings> {
  const response = await api.get<Settings>('/api/settings/default-extras');
  return response.data;
}

export async function setDefaultExtras(settings: Settings): Promise<void> {
  await api.put('/api/settings/default-extras', settings);
}

export async function parseInput(prompt: string): Promise<Partial<ScheduleRequest>> {
  const response = await api.post<Partial<ScheduleRequest>>('/api/parse-input', { prompt });
  return response.data;
}
