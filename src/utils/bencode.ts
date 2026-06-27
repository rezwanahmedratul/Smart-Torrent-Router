export interface TorrentMetadata {
  infoHash: string;
  name: string;
  files: { path: string[]; length: number }[];
}

export async function computeSha1(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', bytes as any);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function parseTorrent(buffer: Uint8Array): {
  infoHashPromise: Promise<string>;
  name: string;
  files: { path: string[]; length: number }[];
  announce?: string;
  announceList?: string[];
} {
  let index = 0;
  let infoStart = -1;
  let infoEnd = -1;

  const decoder = new TextDecoder('utf-8');

  function readNext(isInfoKey = false): any {
    if (index >= buffer.length) {
      throw new Error('Unexpected end of torrent file buffer');
    }

    const byte = buffer[index];

    if (byte === 105) {
      // 'i' - Integer
      index++; // skip 'i'
      const end = buffer.indexOf(101, index); // 'e' is 101
      if (end === -1) {
        throw new Error('Unterminated integer in torrent file');
      }
      const valStr = decoder.decode(buffer.subarray(index, end));
      index = end + 1; // skip 'e'
      return parseInt(valStr, 10);
    }

    if (byte === 108) {
      // 'l' - List
      index++; // skip 'l'
      const list: any[] = [];
      while (buffer[index] !== 101) {
        // until 'e'
        list.push(readNext());
      }
      index++; // skip 'e'
      return list;
    }

    if (byte === 100) {
      // 'd' - Dictionary
      const dictStart = index;
      index++; // skip 'd'
      const dict: Record<string, any> = {};

      while (buffer[index] !== 101) {
        // until 'e'
        const key = readNext();
        if (typeof key !== 'string') {
          throw new Error('Dictionary key must be a string in torrent file');
        }

        const isInfo = key === 'info';
        if (isInfo) {
          infoStart = index;
        }

        const val = readNext(isInfo);

        if (isInfo) {
          infoEnd = index;
        }

        dict[key] = val;
      }
      index++; // skip 'e'
      return dict;
    }

    // String: length:data
    const colon = buffer.indexOf(58, index); // ':' is 58
    if (colon === -1) {
      throw new Error('Invalid string length prefix in torrent file');
    }
    const lenStr = decoder.decode(buffer.subarray(index, colon));
    const len = parseInt(lenStr, 10);
    if (isNaN(len)) {
      throw new Error('Invalid string length in torrent file');
    }
    index = colon + 1; // skip ':'

    const dataBytes = buffer.subarray(index, index + len);
    index += len;

    // Decode as string if possible, otherwise return raw bytes for binary data
    if (isInfoKey) {
      // We don't want to attempt full string decode of binary 'pieces' in info
      return dataBytes;
    }

    try {
      // Try to decode as UTF-8 string
      return decoder.decode(dataBytes);
    } catch {
      // Fallback to raw bytes
      return dataBytes;
    }
  }

  const torrent = readNext();
  if (!torrent || typeof torrent !== 'object') {
    throw new Error('Root of torrent file is not a dictionary');
  }

  if (infoStart === -1 || infoEnd === -1) {
    throw new Error('Could not locate info dictionary inside torrent file');
  }

  const infoBytes = buffer.subarray(infoStart, infoEnd);
  const infoHashPromise = computeSha1(infoBytes);

  const info = torrent.info;
  const name = typeof info.name === 'string' ? info.name : 'Unnamed Torrent';
  const files: { path: string[]; length: number }[] = [];

  if (info.files && Array.isArray(info.files)) {
    // Multi-file torrent
    for (const f of info.files) {
      const length = typeof f.length === 'number' ? f.length : 0;
      let path: string[] = [];
      if (Array.isArray(f.path)) {
        path = f.path.map((p: any) => (typeof p === 'string' ? p : String(p)));
      } else if (typeof f.path === 'string') {
        path = [f.path];
      }
      files.push({ path, length });
    }
  } else {
    // Single-file torrent
    const length = typeof info.length === 'number' ? info.length : 0;
    files.push({ path: [name], length });
  }

  const announce = typeof torrent.announce === 'string' ? torrent.announce : '';
  const announceList: string[] = [];
  if (torrent['announce-list'] && Array.isArray(torrent['announce-list'])) {
    for (const list of torrent['announce-list']) {
      if (Array.isArray(list)) {
        for (const url of list) {
          if (typeof url === 'string') {
            announceList.push(url);
          }
        }
      } else if (typeof list === 'string') {
        announceList.push(list);
      }
    }
  }

  return {
    infoHashPromise,
    name,
    files,
    announce,
    announceList,
  };
}
