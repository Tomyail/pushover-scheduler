// 任务类型：一次性或重复
export type ScheduleType = 'once' | 'repeat';

// 调度配置
export interface ScheduleConfig {
  type: ScheduleType;
  datetime?: string; // ISO 8601 格式，仅 once 类型需要
  cron?: string; // cron 表达式，仅 repeat 类型需要
}

// Pushover API 参数（允许任意字段）
export interface PushoverParams {
  message: string;
  [key: string]: string | number | boolean | undefined;
}

// 完整的请求体
export interface ScheduleRequest {
  message: string;
  title?: string;
  schedule: ScheduleConfig;
  pushover?: Record<string, string | number | boolean>;
}

// 任务状态（存储在 Durable Object 中）
export interface Task {
  id: string;
  message: string;
  title?: string;
  schedule: ScheduleConfig;
  pushover?: Record<string, string | number | boolean>;
  createdAt: string;
  lastRun?: string; // 上次运行时间（ISO 8601），用于处理延迟触发的 alarm
}

// Worker 环境变量和绑定
export interface Env {
  // Durable Object 绑定
  SCHEDULER: DurableObjectNamespace;
  // Pushover 配置
  PUSHOVER_API_URL: string;
  PUSHOVER_USER_KEY: string;
  PUSHOVER_API_TOKEN: string;
  // Server time zone (IANA name or UTC)
  TIMEZONE?: string;
  // Static assets binding
  ASSETS: Fetcher;
}
