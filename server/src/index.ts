import type { Env } from './types';
import { SchedulerDO } from './scheduler';

export { SchedulerDO };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 路由到 Scheduler Durable Object
      if (path.startsWith('/schedule') || path.startsWith('/tasks')) {
        const id = env.SCHEDULER.idFromName('scheduler');
        const obj = env.SCHEDULER.get(id);
        return await obj.fetch(request);
      }

      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'Pushover Scheduler',
          version: '1.0.0'
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
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
