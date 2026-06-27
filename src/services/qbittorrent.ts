export interface QbittorrentConfig {
  url: string;
  username?: string;
  password?: string;
  apiKey?: string;
}

export interface QbittorrentTorrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  status: string;
  category: string;
  tags: string;
  added_on: number;
}

export interface QbittorrentFile {
  name: string;
  size: number;
  progress: number;
}

export class QbittorrentClient {
  private config: QbittorrentConfig;

  constructor(config: QbittorrentConfig) {
    this.config = {
      ...config,
      url: config.url.replace(/\/$/, ''), // Strip trailing slash
    };
  }

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.config.url}${path}`;
    
    // Inject auth headers if API Key is configured
    const headers = new Headers(options.headers || {});
    if (this.config.apiKey) {
      headers.set('X-Api-Key', this.config.apiKey);
      if (this.config.apiKey.startsWith('Bearer ')) {
        headers.set('Authorization', this.config.apiKey);
      } else {
        headers.set('Authorization', `Bearer ${this.config.apiKey}`);
      }
    }

    const defaultOptions: RequestInit = {
      credentials: 'include', // Crucial for sending/receiving cookies (SID)
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, defaultOptions);

      // Handle auth expired or unauthorized
      if ((response.status === 403 || response.status === 401) && !this.config.apiKey) {
        // Try to re-authenticate and retry the request once if it's not a login request itself
        if (path !== '/api/v2/auth/login') {
          console.log('qBittorrent returned 403/401. Attempting auto-login...');
          const success = await this.login();
          if (success) {
            return await fetch(url, defaultOptions);
          }
        }
      }

      return response;
    } catch (error: any) {
      // Enhance error message for SSL / network errors
      if (
        this.config.url.startsWith('https://') &&
        (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch'))
      ) {
        throw new Error(
          'Network connection failed. If you are using a self-signed HTTPS certificate, ' +
            'you must open the qBittorrent Web UI in a new tab and accept the certificate exception.'
        );
      }
      throw error;
    }
  }

  async login(): Promise<boolean> {
    if (this.config.apiKey) {
      // Bypassed if API Key is configured
      return true;
    }

    if (!this.config.username || !this.config.password) {
      throw new Error('Username and password are required for qBittorrent login.');
    }

    const params = new URLSearchParams();
    params.append('username', this.config.username);
    params.append('password', this.config.password);

    try {
      const response = await this.request('/api/v2/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (!response.ok) {
        return false;
      }

      const text = await response.text();
      return text.trim() === 'Ok.';
    } catch (e: any) {
      console.error('qBittorrent login error:', e);
      throw new Error(`Failed to connect to qBittorrent: ${e.message}`);
    }
  }

  async testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const isLoggedIn = await this.login();
      if (!isLoggedIn) {
        return { success: false, error: 'Invalid credentials. Server returned non-OK status.' };
      }

      const response = await this.request('/api/v2/app/webapiVersion');
      if (response.ok) {
        const version = await response.text();
        return { success: true, version: version.trim() };
      }

      return { success: false, error: `WebAPI test failed with status ${response.status}` };
    } catch (e: any) {
      return { success: false, error: e.message || 'Unknown network error' };
    }
  }

  async addTorrent(
    input: Uint8Array | string, // Buffer of .torrent file or Magnet URL string
    filename: string, // Dummy filename for torrent upload
    options: {
      paused: boolean;
      category: string;
      tags: string;
      ratioLimit?: number;
      seedingTimeLimit?: number;
    }
  ): Promise<boolean> {
    const formData = new FormData();

    if (typeof input === 'string') {
      // Magnet URL
      formData.append('urls', input);
    } else {
      // .torrent file buffer
      const blob = new Blob([input as any], { type: 'application/x-bittorrent' });
      formData.append('torrents', blob, filename);
    }

    formData.append('paused', options.paused ? 'true' : 'false');
    formData.append('category', options.category);
    formData.append('tags', options.tags);

    if (options.ratioLimit !== undefined) {
      formData.append('ratioLimit', String(options.ratioLimit));
    }
    if (options.seedingTimeLimit !== undefined) {
      formData.append('seedingTimeLimit', String(options.seedingTimeLimit));
    }

    const response = await this.request('/api/v2/torrents/add', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to add torrent: ${errText || response.statusText}`);
    }

    return true;
  }

  async getTorrentInfo(hash: string): Promise<QbittorrentTorrent | null> {
    const response = await this.request(`/api/v2/torrents/info?hashes=${hash}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch torrent info: ${response.statusText}`);
    }

    const list = (await response.json()) as QbittorrentTorrent[];
    return list.length > 0 ? list[0] : null;
  }

  async getTorrentFiles(hash: string): Promise<QbittorrentFile[]> {
    const response = await this.request(`/api/v2/torrents/files?hash=${hash}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch torrent files: ${response.statusText}`);
    }
    return (await response.json()) as QbittorrentFile[];
  }

  async createCategory(category: string): Promise<boolean> {
    // First, list existing categories to see if it already exists
    const listResponse = await this.request('/api/v2/torrents/categories');
    if (listResponse.ok) {
      const categories = await listResponse.json();
      if (categories && categories[category]) {
        return true; // Already exists
      }
    }

    const params = new URLSearchParams();
    params.append('category', category);

    const response = await this.request('/api/v2/torrents/createCategory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    return response.ok;
  }

  async setCategory(hash: string, category: string): Promise<boolean> {
    // Ensure category exists in qBittorrent first
    await this.createCategory(category);

    const params = new URLSearchParams();
    params.append('hashes', hash);
    params.append('category', category);

    const response = await this.request('/api/v2/torrents/setCategory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    return response.ok;
  }

  async resume(hash: string): Promise<boolean> {
    const params = new URLSearchParams();
    params.append('hashes', hash);

    const response = await this.request('/api/v2/torrents/resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    return response.ok;
  }

  async deleteTorrent(hash: string, deleteFiles = false): Promise<boolean> {
    const params = new URLSearchParams();
    params.append('hashes', hash);
    params.append('deleteFiles', deleteFiles ? 'true' : 'false');

    const response = await this.request('/api/v2/torrents/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    return response.ok;
  }
}
