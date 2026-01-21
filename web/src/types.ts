export type ScheduleType = 'once' | 'repeat';

export interface ScheduleConfig {
  type: ScheduleType;
  datetime?: string;
  cron?: string;
}

export interface ExecutionLog {
  executedAt: string;
  status: 'success' | 'failed';
  response?: string;
  error?: string;
  aiGeneratedMessage?: string;
}

export interface Task {
  id: string;
  message: string;
  title?: string;
  aiPrompt?: string;
  schedule: ScheduleConfig;
  createdAt: string;
  lastRun?: string;
  executionHistory?: ExecutionLog[];
}

export interface ScheduleRequest {
  message: string;
  title?: string;
  aiPrompt?: string;
  schedule: ScheduleConfig;
  pushover?: Record<string, string | number | boolean>;
}
