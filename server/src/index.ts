import type { Env } from './types';
import { SchedulerDO } from './scheduler';

export { SchedulerDO };

/**
 * Lightweight JWT-like implementation using Web Crypto API (HMAC-SHA256)
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
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(partialToken)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${partialToken}.${signatureBase64}`;
}

async function verifyToken(token: string, password: string): Promise<boolean> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return false;

    const encoder = new TextEncoder();
    const secretKeyData = encoder.encode(password);
    const key = await crypto.subtle.importKey(
      'raw',
      secretKeyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const partialToken = `${headerB64}.${payloadB64}`;
    
    // Decode signature from base64url
    const binarySig = atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'));
    const signatureArray = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      signatureArray[i] = binarySig.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureArray,
      encoder.encode(partialToken)
    );

    if (!isValid) return false;

    // Check expiration
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

async function isAuthenticated(request: Request, password: string): Promise<boolean> {
  // 1. Check Authorization Header (Bearer Token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return await verifyToken(token, password);
  }

  // 2. Check Cookie
  const cookie = request.headers.get('Cookie');
  if (cookie) {
    const match = cookie.match(/auth=([^;]+)/);
    if (match) {
      return await verifyToken(match[1], password);
    }
  }

  return false;
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

      // Login endpoint
      if (path === '/login' && method === 'POST') {
        let password = '';
        const contentType = request.headers.get('Content-Type') || '';

        try {
          if (contentType.includes('application/json')) {
            const body = await request.json() as any;
            password = body.password;
          } else if (contentType.includes('form')) {
            const formData = await request.formData();
            password = formData.get('password') as string;
          } else {
            return new Response(JSON.stringify({ error: 'Unsupported content type' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Failed to parse request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (password === env.AUTH_PASSWORD) {
          const token = await signToken(env.AUTH_PASSWORD);
          return new Response(JSON.stringify({ success: true, token }), {
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': `auth=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`,
            },
          });
        } else {
          return new Response(JSON.stringify({ error: 'Invalid password' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Logout endpoint
      if (path === '/logout' && method === 'POST') {
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'auth=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
          },
        });
      }

      // Check authentication
      if (!(await isAuthenticated(request, env.AUTH_PASSWORD)) && path !== '/health') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Route to Scheduler Durable Object
      if (path.startsWith('/schedule') || path.startsWith('/tasks')) {
        const id = env.SCHEDULER.idFromName('scheduler');
        const obj = env.SCHEDULER.get(id);

        try {
          return await obj.fetch(request.clone());
        } catch (doError) {
          return new Response(JSON.stringify({
            error: 'Durable Object error',
            details: doError instanceof Error ? doError.message : String(doError)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
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

      // Serve static assets
      if (env.ASSETS) {
        try {
          return await env.ASSETS.fetch(request);
        } catch (e) {
          return new Response('Not found', { status: 404 });
        }
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
