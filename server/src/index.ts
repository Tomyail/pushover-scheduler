import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import type { Env } from './types';
import { SchedulerDO } from './scheduler';

export { SchedulerDO };

const app = new Hono<{ Bindings: Env }>();

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

// Login
app.post('/login', async (c) => {
  const secret = c.env.AUTH_PASSWORD;
  const contentType = c.req.header('Content-Type') || '';
  let password = '';

  try {
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      password = body.password;
    } else {
      const formData = await c.req.formData();
      password = formData.get('password') as string;
    }
  } catch (e) {
    console.error('[LOGIN PARSE ERROR]', e);
  }

  if (password && password === secret) {
    const payload = {
      authorized: true,
      exp: Math.floor(Date.now() / 1000) + (86400 * 30),
    };
    const token = await sign(payload, secret, 'HS256');
    
    setCookie(c, 'auth', token, {
      httpOnly: true,
      path: '/',
      maxAge: 2592000,
      sameSite: 'Lax',
    });
    
    return c.json({ success: true, token });
  }

  return c.json({ error: 'Invalid password' }, 401);
});

// Logout
app.post('/logout', (c) => {
  setCookie(c, 'auth', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'Lax' });
  return c.json({ success: true });
});

// DO Handler
const doHandler = async (c: any) => {
  const id = c.env.SCHEDULER.idFromName('scheduler');
  return await c.env.SCHEDULER.get(id).fetch(c.req.raw.clone());
};

app.all('/schedule', authMiddleware, doHandler);
app.all('/schedule/*', authMiddleware, doHandler);
app.all('/tasks', authMiddleware, doHandler);
app.all('/tasks/*', authMiddleware, doHandler);

// Public Routes
app.get('/health', (c) => c.json({ status: 'ok', version: '1.2.4' }));

// Assets
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw).catch(() => c.text('Not found', 404));
  }
  return c.text('Not found', 404);
});

export default app;
