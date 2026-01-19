import type { Env } from './types';
import { SchedulerDO } from './scheduler';

export { SchedulerDO };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 健康检查
      if (path === '/health' || path === '/') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'Pushover Scheduler',
          version: '1.0.0'
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 路由到 Scheduler Durable Object
      if (path.startsWith('/schedule') || path.startsWith('/tasks')) {
        const id = env.SCHEDULER.idFromName('scheduler');
        const obj = env.SCHEDULER.get(id);
        return await obj.fetch(request);
      }

      // /trigger-alarm 仅在本地开发环境允许（用于测试）
      if (path.startsWith('/trigger-alarm')) {
        const url = new URL(request.url);
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
        if (!isLocalhost) {
          return new Response(JSON.stringify({ error: 'Forbidden: trigger-alarm is only available in development' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const id = env.SCHEDULER.idFromName('scheduler');
        const obj = env.SCHEDULER.get(id);
        return await obj.fetch(request);
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
