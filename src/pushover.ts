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

    if (params.title) formData.append('title', params.title);
    if (params.priority !== undefined) formData.append('priority', params.priority.toString());
    if (params.sound) formData.append('sound', params.sound);
    if (params.device) formData.append('device', params.device);
    if (params.url) formData.append('url', params.url);
    if (params.url_title) formData.append('url_title', params.url_title);
    if (params.html !== undefined) formData.append('html', params.html.toString());
    if (params.expire !== undefined) formData.append('expire', params.expire.toString());
    if (params.retry !== undefined) formData.append('retry', params.retry.toString());

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
}
