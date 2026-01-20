import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import type { Env } from './types';
import { SchedulerDO } from './scheduler';

export { SchedulerDO };

const app = new Hono<{ Bindings: Env }>();

/**
 * JWT-like HMAC signing/verification helper functions
 */
async function signToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretKeyData = encoder.encode(password);
  const key = await crypto.subtle.importKey(
    'raw',
    secretKeyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ 
    authorized: true, 
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (86400 * 30) // 30 days
  }));

  const partialToken = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(partialToken));

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${partialToken}.${signatureBase64}`;
}

async function verifyToken(token: string, password: string): Promise<boolean> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const binarySig = atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'));
    const signatureArray = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) signatureArray[i] = binarySig.charCodeAt(i);

    const isValid = await crypto.subtle.verify('HMAC', key, signatureArray, encoder.encode(`${headerB64}.${payloadB64}`));
    if (!isValid) return false;

    const payload = JSON.parse(atob(payloadB64));
    return !(payload.exp && Date.now() / 1000 > payload.exp);
  } catch {
    return false;
  }
}

// Auth Middleware
const authMiddleware = async (c: any, next: any) => {
  const password = c.env.AUTH_PASSWORD;
  
  // 1. Check Header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    if (await verifyToken(authHeader.substring(7), password)) return await next();
  }

  // 2. Check Cookie
  const token = getCookie(c, 'auth');
  if (token && await verifyToken(token, password)) return await next();

  return c.json({ error: 'Unauthorized' }, 401);
};

// Health check (Public)
app.get('/health', (c) => c.json({ status: 'ok', service: 'Pushover Scheduler', version: '1.1.0' }));

// Login
app.post('/login', async (c) => {
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
  } catch {
    return c.json({ error: 'Failed to parse request' }, 400);
  }

  if (password === c.env.AUTH_PASSWORD) {
    const token = await signToken(c.env.AUTH_PASSWORD);
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

// Protected routes - Route to Durable Object
app.all('/schedule/*', authMiddleware, async (c) => {
  const id = c.env.SCHEDULER.idFromName('scheduler');
  const obj = c.env.SCHEDULER.get(id);
  return await obj.fetch(c.req.raw.clone());
});

app.all('/tasks/*', authMiddleware, async (c) => {
  const id = c.env.SCHEDULER.idFromName('scheduler');
  const obj = c.env.SCHEDULER.get(id);
  return await obj.fetch(c.req.raw.clone());
});

// Single schedule/tasks (without trailing slash)
app.all('/schedule', authMiddleware, async (c) => {
  const id = c.env.SCHEDULER.idFromName('scheduler');
  return await c.env.SCHEDULER.get(id).fetch(c.req.raw.clone());
});

app.all('/tasks', authMiddleware, async (c) => {
  const id = c.env.SCHEDULER.idFromName('scheduler');
  return await c.env.SCHEDULER.get(id).fetch(c.req.raw.clone());
});

// Assets (Static files)
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    try {
      return await c.env.ASSETS.fetch(c.req.raw);
    } catch {
      return c.text('Not found', 404);
    }
  }
  return c.text('Not found', 404);
});

export default app;
