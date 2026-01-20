import type { Env } from './types';
import { SchedulerDO } from './scheduler';

export { SchedulerDO };

function isAuthenticated(request: Request, password: string): boolean {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return false;
  const match = cookie.match(/auth=([^;]+)/);
  return match ? match[1] === password : false;
}

function getLoginPage(error?: string): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Pushover Scheduler</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 24px;
      text-align: center;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
    }
    .error {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <h1>🔐 Login</h1>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="POST" action="/login">
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autofocus>
      </div>
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.AUTH_PASSWORD) {
      return new Response(JSON.stringify({ error: 'AUTH_PASSWORD is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // 登录接口
      if (path === '/login') {
        if (method === 'POST') {
          const formData = await request.formData();
          const password = formData.get('password') as string;
          
          if (password === env.AUTH_PASSWORD) {
            const response = new Response(JSON.stringify({ success: true }), {
              headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': `auth=${password}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`,
              },
            });
            return response;
          } else {
            return getLoginPage('Invalid password');
          }
        } else if (method === 'GET') {
          return getLoginPage();
        }
      }

      // 检查认证（登录页和 health 接口除外）
      if (!isAuthenticated(request, env.AUTH_PASSWORD) && path !== '/health') {
        // 如果是 JSON 请求（API），返回 401
        if (path.startsWith('/api') || 
            path.startsWith('/schedule') || 
            path.startsWith('/tasks') ||
            request.headers.get('Accept')?.includes('application/json')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // 页面请求返回登录页
        return getLoginPage();
      }

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
