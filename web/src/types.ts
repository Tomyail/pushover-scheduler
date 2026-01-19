export type ScheduleType = 'once' | 'repeat';

export interface ScheduleConfig {
  type: ScheduleType;
  datetime?: string;
  cron?: string;
}

export interface Task {
  id: string;
  message: string;
  title?: string;
  schedule: ScheduleConfig;
  createdAt: string;
  lastRun?: string;
}

export interface ScheduleRequest {
  message: string;
  title?: string;
  schedule: ScheduleConfig;
  pushover?: Record<string, string | number | boolean>;
}
