import { describe, it, expect } from 'vitest';
import { parseTorrent } from '../../src/utils/bencode';

describe('Bencode Parser', () => {
  it('should parse single-file torrents correctly', async () => {
    // Construct mock single-file torrent bencode:
    // d4:name12:test-torrent4:infod6:lengthi12345e4:name12:test-torrent6:pieces20:01234567890123456789ee
    const bencodeStr =
      'd4:name12:test-torrent4:infod6:lengthi12345e4:name12:test-torrent6:pieces20:01234567890123456789ee';
    
    const buffer = new TextEncoder().encode(bencodeStr);
    
    // Polyfill crypto for Node test environment if needed (though modern Node has global crypto)
    if (typeof global.crypto === 'undefined') {
      const { webcrypto } = await import('crypto');
      // @ts-ignore
      global.crypto = webcrypto;
    }

    const parsed = parseTorrent(buffer);
    
    expect(parsed.name).toBe('test-torrent');
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].path).toEqual(['test-torrent']);
    expect(parsed.files[0].length).toBe(12345);

    const hash = await parsed.infoHashPromise;
    expect(hash).toHaveLength(40); // Hex length of SHA-1 is 40 characters
    expect(hash).toMatch(/^[a-f0-9]{40}$/);
  });

  it('should parse multi-file torrents correctly', async () => {
    // Construct mock multi-file torrent bencode:
    // d4:info5:filesld6:lengthi100e4:pathl8:file1.txteed6:lengthi200e4:pathl8:file2.txteeee
    // For info: d5:filesld6:lengthi100e4:pathl8:file1.txteed6:lengthi200e4:pathl8:file2.txtee4:name10:multi-folder6:pieces20:01234567890123456789e
    const bencodeStr =
      'd4:infod5:filesld6:lengthi100e4:pathl9:file1.txteed6:lengthi200e4:pathl9:file2.txteee4:name12:multi-folder6:pieces20:01234567890123456789ee';
    
    const buffer = new TextEncoder().encode(bencodeStr);

    const parsed = parseTorrent(buffer);

    expect(parsed.name).toBe('multi-folder');
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].path).toEqual(['file1.txt']);
    expect(parsed.files[0].length).toBe(100);
    expect(parsed.files[1].path).toEqual(['file2.txt']);
    expect(parsed.files[1].length).toBe(200);
  });
});
