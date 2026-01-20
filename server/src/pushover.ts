import type { PushoverParams, Env } from './types';

export class PushoverClient {
  private userKey: string;
  private apiToken: string;
  private apiUrl: string;

  constructor(env: Env) {
    this.userKey = env.PUSHOVER_USER_KEY;
    this.apiToken = env.PUSHOVER_API_TOKEN;
    this.apiUrl = env.PUSHOVER_API_URL || 'https://api.pushover.net/1/messages.json';
  }

  /**
   * 发送 Pushover 通知
   */
  async sendNotification(params: PushoverParams): Promise<Response> {
    const formData = new FormData();
    formData.append('user', this.userKey);
    formData.append('token', this.apiToken);
    formData.append('message', params.message);

    for (const [key, value] of Object.entries(params)) {
      if (key === 'user' || key === 'token' || key === 'message') continue;
      if (value === undefined || value === null) continue;
      formData.append(key, String(value));
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pushover API error: ${response.status} - ${error}`);
      }

      return response;
    } catch (error) {
      console.error('Failed to send Pushover notification:', error);
      throw error;
    }
  }

  static isPermanentError(error: unknown): boolean {
    if (error instanceof Error) {
      const errorMessage = error.message;
      if (errorMessage.includes('token is invalid') || 
          errorMessage.includes('user key is invalid') ||
          errorMessage.includes('application token is invalid')) {
        return true;
      }
    }
    return false;
  }
}
