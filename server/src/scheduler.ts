import type { Task, ScheduleRequest, Env, ScheduleConfig, ExecutionLog } from './types';
import { PushoverClient } from './pushover';

export class SchedulerDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private pushover: PushoverClient;
  // 本地开发环境的内存存储后备
  private memoryStorage: Map<string, Task> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.pushover = new PushoverClient(env);
  }

  /**
   * 兼容本地和生产环境的存储辅助函数
   */
  private async putTask(key: string, task: Task): Promise<void> {
    // 写入持久化存储
    await this.state.storage.put(key, task);
  }

  private async deleteTask(key: string): Promise<void> {
    await this.state.storage.delete(key);
    this.memoryStorage.delete(key);
  }

  /**
   * 兼容本地和生产环境的 storage.list() 辅助函数
   */
  private async listAllTasks(): Promise<Task[]> {
    const tasks: Task[] = [];

    // 从持久化存储读取
    try {
      const result = await this.state.storage.list();

      console.log('[DEBUG] Storage list result type:', typeof result, 'isMap:', result instanceof Map, 'size:', result.size);

      // storage.list() returns a Map, iterate it directly
      for (const [key, value] of result.entries()) {
        if (key.startsWith('task:') && typeof value === 'object' && value !== null && 'id' in value) {
          tasks.push(value as Task);
        }
      }

      console.log('[DEBUG] Found', tasks.length, 'tasks in persistent storage');
      return tasks;
    } catch (error) {
      console.error('[ERROR] Error reading from storage:', error);

      // 仅在本地开发环境使用内存存储
      for (const [key, task] of this.memoryStorage.entries()) {
        tasks.push(task);
      }
      console.log('[INFO] Using in-memory storage fallback, tasks:', tasks.length);
    }

    return tasks;
  }

  /**
   * 处理 HTTP 请求
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/schedule' && request.method === 'POST') {
        return await this.handleSchedule(request);
      } else if (path === '/tasks' && request.method === 'GET') {
        return await this.handleListTasks();
      } else if (path.startsWith('/tasks/') && request.method === 'GET') {
        const taskId = path.split('/')[2];
        if (path.endsWith('/logs')) {
          return await this.handleTaskLogs(taskId);
        } else {
          return await this.handleGetTask(taskId);
        }
      } else if (path.startsWith('/tasks/') && request.method === 'DELETE') {
        const taskId = path.split('/')[2];
        return await this.handleDeleteTask(taskId);
      } else {
        return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * 创建新的调度任务
   */
  private async handleSchedule(request: Request): Promise<Response> {
    const body = (await request.json()) as ScheduleRequest;

    // 验证请求
    if (!body.message) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.schedule) {
      return new Response(JSON.stringify({ error: 'schedule is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.schedule.type === 'once' && !body.schedule.datetime) {
      return new Response(JSON.stringify({ error: 'datetime is required for once type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.schedule.type === 'repeat' && !body.schedule.cron) {
      return new Response(JSON.stringify({ error: 'cron is required for repeat type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 生成任务 ID
    const taskId = crypto.randomUUID();
    const task: Task = {
      id: taskId,
      message: body.message,
      title: body.title,
      schedule: body.schedule,
      pushover: body.pushover,
      createdAt: new Date().toISOString(),
    };

    // 存储任务
    await this.putTask(`task:${taskId}`, task);

    const timeZone = this.env.TIMEZONE || 'UTC';

    // 重新计算所有任务的最早 Alarm，避免覆盖其他任务的 alarm
    const tasks = await this.listAllTasks();

    const nextAlarmTime = this.findEarliestRunTime(tasks, timeZone);
    if (nextAlarmTime) {
      await this.state.storage.setAlarm(nextAlarmTime);
    }

    const taskScheduledTime = this.calculateNextRunTime(task.schedule, timeZone);
    return new Response(JSON.stringify({ taskId, scheduledTime: taskScheduledTime }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 列出所有任务
   */
  private async handleListTasks(): Promise<Response> {
    const tasks = await this.listAllTasks();
    return new Response(JSON.stringify({ tasks }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 获取单个任务详情
   */
  private async handleGetTask(taskId: string): Promise<Response> {
    const tasks = await this.listAllTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return new Response(JSON.stringify({ error: 'Task not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ task }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 获取任务执行日志
   */
  private async handleTaskLogs(taskId: string): Promise<Response> {
    const tasks = await this.listAllTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      return new Response(JSON.stringify({ error: 'Task not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      taskId: task.id,
      logs: task.executionHistory || [],
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 删除任务
   */
  private async handleDeleteTask(taskId: string): Promise<Response> {
    await this.deleteTask(`task:${taskId}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Alarm 触发器
   */
  async alarm(): Promise<void> {
    const tasks = await this.listAllTasks();
    const now = new Date();
    const timeZone = this.env.TIMEZONE || 'UTC';

    // 找出所有应该运行的任务
    const tasksToRun = tasks.filter(task => this.shouldRunTask(task, now, timeZone));

    // 并发执行所有任务（提升性能）
    await Promise.all(
      tasksToRun.map(async (task) => {
        try {
          const response = await this.pushover.sendNotification({
            message: task.message,
            title: task.title,
            ...task.pushover,
          });

          const executionLog: ExecutionLog = {
            executedAt: new Date().toISOString(),
            status: 'success',
            response: `HTTP ${response.status}`,
          };

          if (task.schedule.type === 'once') {
            await this.deleteTask(`task:${task.id}`);
          } else {
            const updatedTask: Task = {
              ...task,
              lastRun: new Date().toISOString(),
              executionHistory: [...(task.executionHistory || []), executionLog].slice(-100),
            };
            await this.putTask(`task:${task.id}`, updatedTask);
          }
        } catch (error) {
          console.error(`Failed to execute task ${task.id}:`, error);
          
          const executionLog: ExecutionLog = {
            executedAt: new Date().toISOString(),
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          };

          if (PushoverClient.isPermanentError(error)) {
            console.error(`Deleting task ${task.id} due to permanent error:`, error);
            await this.deleteTask(`task:${task.id}`);
          } else {
            const updatedTask: Task = {
              ...task,
              lastRun: new Date().toISOString(),
              executionHistory: [...(task.executionHistory || []), executionLog].slice(-100),
            };
            await this.putTask(`task:${task.id}`, updatedTask);
          }
        }
      })
    );

    // 重新获取任务列表（因为一次性任务可能已被删除）
    const updatedTasks = await this.listAllTasks();

    // 为所有任务找到最早的下次运行时间并设置 Alarm
    const nextRun = this.findEarliestRunTime(updatedTasks, timeZone);
    if (nextRun) {
      await this.state.storage.setAlarm(nextRun);
    }
  }

  /**
   * 检查任务是否应该在指定时间运行
   */
  private shouldRunTask(task: Task, now: Date, timeZone: string): boolean {
    if (task.schedule.type === 'once') {
      const scheduledTime = this.parseDateTimeInTimeZone(task.schedule.datetime!, timeZone);
      return now >= scheduledTime;
    } else if (task.schedule.type === 'repeat') {
      // 对于重复任务，检查是否已经过了下次运行时间
      // 从上次运行时间开始，找到第一个应该在现在之前运行的时间
      const lastRun = task.lastRun ? new Date(task.lastRun) : new Date(0); // 默认从 epoch 开始
      const nextScheduled = this.getNextCronTimeAfter(task.schedule.cron!, lastRun, timeZone);
      return now >= nextScheduled;
    }
    return false;
  }

  /**
   * 计算下次运行时间
   */
  private calculateNextRunTime(schedule: ScheduleConfig, timeZone: string): Date | null {
    if (schedule.type === 'once') {
      return this.parseDateTimeInTimeZone(schedule.datetime!, timeZone);
    } else if (schedule.type === 'repeat') {
      return this.getNextCronTime(schedule.cron!, timeZone);
    }
    return null;
  }

  /**
   * 找到所有任务中的最早下次运行时间（包括一次性任务和重复任务）
   */
  private findEarliestRunTime(tasks: Task[], timeZone: string): Date | null {
    let earliest: Date | null = null;

    for (const task of tasks) {
      const next = this.calculateNextRunTime(task.schedule, timeZone);
      if (next && (!earliest || next < earliest)) {
        earliest = next;
      }
    }

    return earliest;
  }

  /**
   * 简单的 cron 匹配检查
   * 支持格式: 分 时 日 月 周
   */
  private matchesCron(cron: string, date: Date, timeZone: string): boolean {
    const parts = cron.split(/\s+/);
    if (parts.length !== 5) return false;

    const [minute, hour, day, month, weekday] = parts;

    const local = this.getLocalTimeParts(date, timeZone);
    const m = local.minute;
    const h = local.hour;
    const d = local.day;
    const mo = local.month;
    const wd = local.weekday;

    return this.matchCronPart(minute, m) &&
           this.matchCronPart(hour, h) &&
           this.matchCronPart(day, d) &&
           this.matchCronPart(month, mo) &&
           this.matchCronPart(weekday, wd);
  }

  /**
   * 匹配 cron 单个部分
   */
  private matchCronPart(pattern: string, value: number): boolean {
    if (pattern === '*') return true;
    if (pattern.includes('/')) {
      const [base, interval] = pattern.split('/');
      const baseVal = base === '*' ? 0 : parseInt(base);
      const intVal = parseInt(interval);
      return (value - baseVal) % intVal === 0;
    }
    if (pattern.includes(',')) {
      const values = pattern.split(',').map(v => parseInt(v));
      return values.includes(value);
    }
    if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(v => parseInt(v));
      return value >= start && value <= end;
    }
    return parseInt(pattern) === value;
  }

  /**
   * 获取下一个 cron 时间
   */
  private getNextCronTime(cron: string, timeZone: string): Date {
    const now = new Date();
    const next = new Date(now.getTime() + 60_000);

    // 简单实现：向前检查最多一年
    for (let i = 0; i < 525600; i++) {
      if (this.matchesCron(cron, next, timeZone)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }

    // 如果找不到，返回 1 小时后
    const fallback = new Date(now);
    fallback.setHours(fallback.getHours() + 1);
    return fallback;
  }

  /**
   * 获取指定时间之后的下一个 cron 时间
   */
  private getNextCronTimeAfter(cron: string, after: Date, timeZone: string): Date {
    const next = new Date(after.getTime() + 60_000);

    // 简单实现：向前检查最多一年
    for (let i = 0; i < 525600; i++) {
      if (this.matchesCron(cron, next, timeZone)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }

    // 如果找不到，返回 1 小时后
    const fallback = new Date(after);
    fallback.setHours(fallback.getHours() + 1);
    return fallback;
  }

  private parseDateTimeInTimeZone(value: string, timeZone: string): Date {
    if (this.hasTimeZoneDesignator(value)) {
      return new Date(value);
    }

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) {
      return new Date(value);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] ? Number(match[6]) : 0;

    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const offsetMinutes = this.getTimeZoneOffsetMinutes(utcGuess, timeZone);
    return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  }

  private hasTimeZoneDesignator(value: string): boolean {
    return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  }

  private getLocalTimeParts(date: Date, timeZone: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    weekday: number;
  } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });

    const parts = formatter.formatToParts(date);
    const lookup = new Map(parts.map(part => [part.type, part.value]));
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const weekdayLabel = lookup.get('weekday') || 'Sun';

    return {
      year: Number(lookup.get('year')),
      month: Number(lookup.get('month')),
      day: Number(lookup.get('day')),
      hour: Number(lookup.get('hour')),
      minute: Number(lookup.get('minute')),
      second: Number(lookup.get('second')),
      weekday: weekdayMap[weekdayLabel] ?? 0,
    };
  }

  private getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
    const parts = this.getLocalTimeParts(date, timeZone);
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    return (localAsUtc - date.getTime()) / 60_000;
  }
}
