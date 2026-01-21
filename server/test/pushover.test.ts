import { describe, expect, it, vi } from 'vitest';
import { PushoverClient } from '../src/pushover';
import type { Env } from '../src/types';

const createEnv = (): Env => ({
  SCHEDULER: null as any,
  AI: null,
  PUSHOVER_API_URL: 'https://example.invalid',
  PUSHOVER_USER_KEY: 'user',
  PUSHOVER_API_TOKEN: 'token',
  TIMEZONE: 'UTC',
  AUTH_PASSWORD: 'secret',
  ASSETS: null as any,
});

describe('PushoverClient', () => {
  it('detects permanent credential errors', () => {
    expect(PushoverClient.isPermanentError(new Error('token is invalid'))).toBe(true);
    expect(PushoverClient.isPermanentError(new Error('user key is invalid'))).toBe(true);
    expect(PushoverClient.isPermanentError(new Error('application token is invalid'))).toBe(true);
    expect(PushoverClient.isPermanentError(new Error('temporary failure'))).toBe(false);
  });

  it('sends a notification payload via fetch', async () => {
    const fetchSpy = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const client = new PushoverClient(createEnv());
    await client.sendNotification({ message: 'hello', priority: 1 });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.invalid');
    expect(init?.method).toBe('POST');

    vi.unstubAllGlobals();
  });
});
