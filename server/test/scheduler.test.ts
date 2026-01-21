import { describe, expect, it, vi } from 'vitest';
import { SchedulerDO } from '../src/scheduler';
import type { Env, Task } from '../src/types';

const createScheduler = () => {
  const state = {
    storage: {
      list: vi.fn(),
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      setAlarm: vi.fn(),
    },
  } as any;

  const env: Env = {
    SCHEDULER: null as any,
    AI: null,
    PUSHOVER_API_URL: 'https://example.invalid',
    PUSHOVER_USER_KEY: 'user',
    PUSHOVER_API_TOKEN: 'token',
    TIMEZONE: 'UTC',
    AUTH_PASSWORD: 'secret',
    ASSETS: null as any,
  };

  return new SchedulerDO(state, env);
};

describe('SchedulerDO cron helpers', () => {
  it('matches cron expressions for minute and weekday', () => {
    const scheduler = createScheduler() as any;
    const date = new Date('2024-01-01T00:15:00Z'); // Monday

    expect(scheduler.matchesCron('*/15 * * * *', date, 'UTC')).toBe(true);
    expect(scheduler.matchesCron('*/15 * * * *', new Date('2024-01-01T00:14:00Z'), 'UTC')).toBe(false);
    expect(scheduler.matchesCron('* * * * 1', date, 'UTC')).toBe(true);
    expect(scheduler.matchesCron('* * * * 2', date, 'UTC')).toBe(false);
  });

  it('calculates next cron time after a given timestamp', () => {
    const scheduler = createScheduler() as any;
    const after = new Date('2024-01-01T00:02:00Z');
    const next = scheduler.getNextCronTimeAfter('*/5 * * * *', after, 'UTC');

    expect(next.toISOString()).toBe('2024-01-01T00:05:00.000Z');
  });
});

describe('SchedulerDO time zone parsing', () => {
  it('parses naive datetimes using the provided timezone', () => {
    const scheduler = createScheduler() as any;
    const parsed = scheduler.parseDateTimeInTimeZone('2024-01-01 09:30:00', 'Asia/Shanghai');
    const local = scheduler.getLocalTimeParts(parsed, 'Asia/Shanghai');

    expect(local.hour).toBe(9);
    expect(local.minute).toBe(30);
  });

  it('runs one-time tasks when current time is past schedule', () => {
    const scheduler = createScheduler() as any;
    const now = new Date('2024-01-01T00:10:00Z');
    const task: Task = {
      id: 'task-1',
      message: 'hi',
      schedule: { type: 'once', datetime: '2024-01-01T00:05:00Z' },
      createdAt: '2024-01-01T00:00:00Z',
    };

    expect(scheduler.shouldRunTask(task, now, 'UTC')).toBe(true);
  });
});
