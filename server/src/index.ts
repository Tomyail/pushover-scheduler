import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { SchedulerDO } from './scheduler';

export { SchedulerDO };

const app = new Hono<{ Bindings: Env }>();

// CORS Middleware for API routes
app.use('/api/*', cors({
  origin: (origin) => {
    // Allow any localhost port for development
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin || '*';
    }
    // In production, you should restrict this to your actual domain
    return origin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposeHeaders: ['Set-Cookie'],
}));

// Auth Middleware
const authMiddleware = async (c: any, next: any) => {
  const secret = c.env.AUTH_PASSWORD;
  const authHeader = c.req.header('Authorization');
  const cookieToken = getCookie(c, 'auth');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

  if (!token) return c.json({ error: 'Unauthorized: No token provided' }, 401);

  try {
    const payload = await verify(token, secret, 'HS256');
    if (payload) return await next();
  } catch (err) {
    console.error('[AUTH ERROR]', err);
  }
  return c.json({ error: 'Unauthorized: Invalid token' }, 401);
};

const api = new Hono<{ Bindings: Env }>();

// Login
api.post('/login', async (c) => {
  const secret = c.env.AUTH_PASSWORD;
  let password = '';
  try {
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/json')) {
      password = (await c.req.json()).password;
    } else {
      password = (await c.req.formData()).get('password') as string;
    }
  } catch {}

  if (password && password === secret) {
    const token = await sign({ authorized: true, exp: Math.floor(Date.now() / 1000) + (86400 * 30) }, secret, 'HS256');
    setCookie(c, 'auth', token, { httpOnly: true, path: '/', maxAge: 2592000, sameSite: 'Lax' });
    return c.json({ success: true, token });
  }
  return c.json({ error: 'Invalid password' }, 401);
});

// Logout
api.post('/logout', (c) => {
  setCookie(c, 'auth', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'Lax' });
  return c.json({ success: true });
});

// DO Handler
const doHandler = async (c: any) => {
  const id = c.env.SCHEDULER.idFromName('scheduler');
  const obj = c.env.SCHEDULER.get(id);
  
  // CRITICAL: When forwarding to DO, we must strip the "/api" prefix 
  // because the Hono app INSIDE the DO doesn't know about it.
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/api/, '');
  
  return await obj.fetch(new Request(url.toString(), c.req.raw.clone()));
};

api.all('/schedule', authMiddleware, doHandler);
api.all('/schedule/*', authMiddleware, doHandler);
api.all('/tasks', authMiddleware, doHandler);
api.all('/tasks/*', authMiddleware, doHandler);
api.all('/settings', authMiddleware, doHandler);
api.all('/settings/*', authMiddleware, doHandler);
api.all('/parse-input', authMiddleware, doHandler);

api.get('/health', (c) => c.json({ status: 'ok', version: '1.2.6' }));

app.route('/api', api);

// Assets
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw).catch(() => c.text('Not found', 404));
  }
  return c.text('Not found', 404);
});

export default app;
