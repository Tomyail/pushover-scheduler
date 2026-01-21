import { Hono } from 'hono';
import type { Task, ScheduleRequest, Env, ExecutionLog } from './types';
import { PushoverClient } from './pushover';

export class SchedulerDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private pushover: PushoverClient;
  private app: Hono = new Hono();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.pushover = new PushoverClient(env);
    this.setupRoutes();
  }

  private setupRoutes() {
    // List all tasks
    this.app.get('/tasks', async (c) => {
      const tasks = await this.listAllTasks();
      return c.json({ tasks });
    });

    // Create a task
    this.app.post('/schedule', async (c) => {
      const body = (await c.req.json()) as ScheduleRequest;
      
      if ((!body.message && !body.aiPrompt) || !body.schedule) {
        return c.json({ error: 'message or aiPrompt and schedule are required' }, 400);
      }

      if (body.schedule.type === 'once' && !body.schedule.datetime) {
        return c.json({ error: 'datetime is required for once type' }, 400);
      }

      if (body.schedule.type === 'repeat' && !body.schedule.cron) {
        return c.json({ error: 'cron is required for repeat type' }, 400);
      }

      const taskId = crypto.randomUUID();
      const task: Task = {
        id: taskId,
        message: body.message,
        title: body.title,
        aiPrompt: body.aiPrompt,
        schedule: body.schedule,
        pushover: body.pushover,
        createdAt: new Date().toISOString(),
      };

      await this.state.storage.put(`task:${taskId}`, task);
      const timeZone = this.env.TIMEZONE || 'UTC';
      
      // Update Alarm
      const tasks = await this.listAllTasks();
      const nextAlarmTime = this.findEarliestRunTime(tasks, timeZone);
      if (nextAlarmTime) {
        await this.state.storage.setAlarm(nextAlarmTime);
      }

      return c.json({ taskId, scheduledTime: this.calculateNextRunTime(task.schedule, timeZone) }, 201);
    });

    // Get a specific task
    this.app.get('/tasks/:id', async (c) => {
      const id = c.req.param('id');
      const task = await this.state.storage.get<Task>(`task:${id}`);
      if (!task) return c.json({ error: 'Task not found' }, 404);
      return c.json({ task });
    });

    // Get task logs
    this.app.get('/tasks/:id/logs', async (c) => {
      const id = c.req.param('id');
      const task = await this.state.storage.get<Task>(`task:${id}`);
      if (!task) return c.json({ error: 'Task not found' }, 404);
      return c.json({ taskId: task.id, logs: task.executionHistory || [] });
    });

    // Delete a task
    this.app.delete('/tasks/:id', async (c) => {
      const id = c.req.param('id');
      await this.state.storage.delete(`task:${id}`);
      return c.json({ success: true });
    });
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }

  /**
   * Helper to list all tasks from storage
   */
  private async listAllTasks(): Promise<Task[]> {
    const tasks: Task[] = [];
    try {
      const result = await this.state.storage.list();
      if (!result) return [];
      
      const entries = result instanceof Map ? result.entries() : Object.entries(result);
      for (const [key, value] of entries) {
        if (key.startsWith('task:') && typeof value === 'object' && value !== null && 'id' in value) {
          tasks.push(value as Task);
        }
      }
      return tasks;
    } catch {
      return [];
    }
  }

  /**
   * Alarm Handler
   */
  async alarm(): Promise<void> {
    const tasks = await this.listAllTasks();
    const now = new Date();
    const timeZone = this.env.TIMEZONE || 'UTC';

    const tasksToRun = tasks.filter(task => this.shouldRunTask(task, now, timeZone));

    await Promise.all(
      tasksToRun.map(async (task) => {
        try {
          let finalMessage = task.message;
          let aiGeneratedMessage: string | undefined;

          if (task.aiPrompt && this.env.AI) {
            try {
              const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
                messages: [
                  { role: 'system', content: 'You are a helpful assistant generating short notification messages. Always respond in the same language as the user\'s prompt.' },
                  { role: 'user', content: task.aiPrompt }
                ],
                max_tokens: 100
              });
              
              if (response && response.response) {
                aiGeneratedMessage = response.response;
                finalMessage = aiGeneratedMessage!;
              }
            } catch (aiError) {
              console.error('[AI ERROR]', aiError);
            }
          }

          const response = await this.pushover.sendNotification({
            message: finalMessage,
            title: task.title,
            ...task.pushover,
          });

          const executionLog: ExecutionLog = {
            executedAt: new Date().toISOString(),
            status: 'success',
            response: `HTTP ${response.status}`,
            aiGeneratedMessage,
          };

          if (task.schedule.type === 'once') {
            await this.state.storage.delete(`task:${task.id}`);
          } else {
            const updatedTask: Task = {
              ...task,
              lastRun: new Date().toISOString(),
              executionHistory: [...(task.executionHistory || []), executionLog].slice(-100),
            };
            await this.state.storage.put(`task:${task.id}`, updatedTask);
          }
        } catch (error) {
          const executionLog: ExecutionLog = {
            executedAt: new Date().toISOString(),
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          };

          if (PushoverClient.isPermanentError(error)) {
            await this.state.storage.delete(`task:${task.id}`);
          } else {
            const updatedTask: Task = {
              ...task,
              lastRun: new Date().toISOString(),
              executionHistory: [...(task.executionHistory || []), executionLog].slice(-100),
            };
            await this.state.storage.put(`task:${task.id}`, updatedTask);
          }
        }
      })
    );

    const updatedTasks = await this.listAllTasks();
    const nextRun = this.findEarliestRunTime(updatedTasks, timeZone);
    if (nextRun) await this.state.storage.setAlarm(nextRun);
  }

  // --- Logic Helpers (unchanged, just moved) ---

  private shouldRunTask(task: Task, now: Date, timeZone: string): boolean {
    if (task.schedule.type === 'once') {
      return now >= this.parseDateTimeInTimeZone(task.schedule.datetime!, timeZone);
    } else if (task.schedule.type === 'repeat') {
      const lastRun = task.lastRun ? new Date(task.lastRun) : new Date(0);
      return now >= this.getNextCronTimeAfter(task.schedule.cron!, lastRun, timeZone);
    }
    return false;
  }

  private calculateNextRunTime(schedule: any, timeZone: string): Date | null {
    if (schedule.type === 'once') return this.parseDateTimeInTimeZone(schedule.datetime!, timeZone);
    if (schedule.type === 'repeat') return this.getNextCronTime(schedule.cron!, timeZone);
    return null;
  }

  private findEarliestRunTime(tasks: Task[], timeZone: string): Date | null {
    let earliest: Date | null = null;
    for (const task of tasks) {
      const next = this.calculateNextRunTime(task.schedule, timeZone);
      if (next && (!earliest || next < earliest)) earliest = next;
    }
    return earliest;
  }

  private matchesCron(cron: string, date: Date, timeZone: string): boolean {
    const parts = cron.split(/\s+/);
    if (parts.length !== 5) return false;
    const [minute, hour, day, month, weekday] = parts;
    const local = this.getLocalTimeParts(date, timeZone);
    return this.matchCronPart(minute, local.minute) &&
           this.matchCronPart(hour, local.hour) &&
           this.matchCronPart(day, local.day) &&
           this.matchCronPart(month, local.month) &&
           this.matchCronPart(weekday, local.weekday);
  }

  private matchCronPart(pattern: string, value: number): boolean {
    if (pattern === '*') return true;
    if (pattern.includes('/')) {
      const [base, interval] = pattern.split('/');
      const baseVal = base === '*' ? 0 : parseInt(base);
      return (value - baseVal) % parseInt(interval) === 0;
    }
    if (pattern.includes(',')) return pattern.split(',').map(v => parseInt(v)).includes(value);
    if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(v => parseInt(v));
      return value >= start && value <= end;
    }
    return parseInt(pattern) === value;
  }

  private getNextCronTime(cron: string, timeZone: string): Date {
    const now = new Date();
    const next = new Date(now.getTime() + 60_000);
    for (let i = 0; i < 525600; i++) {
      if (this.matchesCron(cron, next, timeZone)) return next;
      next.setMinutes(next.getMinutes() + 1);
    }
    const fallback = new Date(now);
    fallback.setHours(fallback.getHours() + 1);
    return fallback;
  }

  private getNextCronTimeAfter(cron: string, after: Date, timeZone: string): Date {
    const next = new Date(after.getTime() + 60_000);
    for (let i = 0; i < 525600; i++) {
      if (this.matchesCron(cron, next, timeZone)) return next;
      next.setMinutes(next.getMinutes() + 1);
    }
    const fallback = new Date(after);
    fallback.setHours(fallback.getHours() + 1);
    return fallback;
  }

  private parseDateTimeInTimeZone(value: string, timeZone: string): Date {
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return new Date(value);
    const utcGuess = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), match[6] ? Number(match[6]) : 0));
    const offsetMinutes = this.getTimeZoneOffsetMinutes(utcGuess, timeZone);
    return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  }

  private getLocalTimeParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
    const parts = formatter.formatToParts(date);
    const lookup = new Map(parts.map(part => [part.type, part.value]));
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { 
      year: Number(lookup.get('year')), 
      month: Number(lookup.get('month')), 
      day: Number(lookup.get('day')), 
      hour: Number(lookup.get('hour')), 
      minute: Number(lookup.get('minute')), 
      second: Number(lookup.get('second')), 
      weekday: weekdayMap[lookup.get('weekday') || 'Sun'] ?? 0 
    };
  }

  private getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
    const parts = this.getLocalTimeParts(date, timeZone);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return (localAsUtc - date.getTime()) / 60_000;
  }
}
