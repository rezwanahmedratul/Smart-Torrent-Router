import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QbittorrentClient } from '../../src/services/qbittorrent';

describe('qBittorrent API Client', () => {
  const mockConfig = {
    url: 'http://localhost:8080',
    username: 'admin',
    password: 'adminpassword',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should log in successfully and return true', async () => {
    const client = new QbittorrentClient(mockConfig);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ok.',
    } as Response);

    const result = await client.login();

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v2/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: expect.any(URLSearchParams),
        credentials: 'include',
      })
    );

    // Verify sent credentials and headers
    const lastCall = vi.mocked(fetch).mock.calls[0];
    const bodyParams = lastCall[1]?.body as URLSearchParams;
    expect(bodyParams.get('username')).toBe('admin');
    expect(bodyParams.get('password')).toBe('adminpassword');

    const headers = lastCall[1]?.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
  });

  it('should authenticate via API Key header without calling login endpoint', async () => {
    const client = new QbittorrentClient({
      url: 'http://localhost:8080',
      apiKey: 'mysecrettoken123',
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '2.8.3',
    } as Response);

    const loginResult = await client.login();
    expect(loginResult).toBe(true);
    expect(fetch).not.toHaveBeenCalled(); // Login endpoint bypassed

    const versionRes = await client.testConnection();
    expect(versionRes.success).toBe(true);
    expect(versionRes.version).toBe('2.8.3');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v2/app/webapiVersion',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(Headers),
      })
    );

    const lastCall = vi.mocked(fetch).mock.calls[0];
    const headers = lastCall[1]?.headers as Headers;
    expect(headers.get('X-Api-Key')).toBe('mysecrettoken123');
    expect(headers.get('Authorization')).toBe('Bearer mysecrettoken123');
  });

  it('should handle testConnection correctly', async () => {
    const client = new QbittorrentClient(mockConfig);

    // Mock Login response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ok.',
    } as Response);

    // Mock WebAPI version response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => '2.8.3',
    } as Response);

    const result = await client.testConnection();

    expect(result.success).toBe(true);
    expect(result.version).toBe('2.8.3');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should add a magnet link correctly', async () => {
    const client = new QbittorrentClient(mockConfig);

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ok.',
    } as Response);

    const magnetUrl = 'magnet:?xt=urn:btih:d24513abcde12345';
    const result = await client.addTorrent(magnetUrl, '', {
      paused: true,
      category: '__pending__',
      tags: 'autoclassify',
    });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v2/torrents/add',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
        credentials: 'include',
      })
    );
  });

  it('should fetch files list', async () => {
    const client = new QbittorrentClient(mockConfig);

    const mockFiles = [
      { name: 'folder/file1.mp4', size: 1024, progress: 1 },
      { name: 'folder/file2.mp4', size: 2048, progress: 1 },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFiles,
    } as Response);

    const files = await client.getTorrentFiles('hash123');

    expect(files).toEqual(mockFiles);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v2/torrents/files?hash=hash123',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('should set category after checking/creating it', async () => {
    const client = new QbittorrentClient(mockConfig);

    // 1. Mock list categories (doesn't exist)
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ movies: { savePath: '/movies' } }), // Only 'movies' exists
    } as Response);

    // 2. Mock create category
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    // 3. Mock set category
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    const result = await client.setCategory('hash123', 'anime');

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);

    // First fetch checks categories
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://localhost:8080/api/v2/torrents/categories');
    // Second fetch creates 'anime'
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('http://localhost:8080/api/v2/torrents/createCategory');
    // Third fetch assigns category
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe('http://localhost:8080/api/v2/torrents/setCategory');
  });
});
