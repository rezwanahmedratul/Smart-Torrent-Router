import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function drawPixel(x, y, width, height) {
  const px = x / width;
  const py = y / height;
  
  // 1. Background Rounded Square
  const cx = 0.5;
  const cy = 0.5;
  const size = 0.46;
  const corner = 0.12;
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  
  let inBg = false;
  if (dx <= size && dy <= size) {
    const q = size - corner;
    if (dx > q && dy > q) {
      const distSq = (dx - q) * (dx - q) + (dy - q) * (dy - q);
      if (distSq <= corner * corner) {
        inBg = true;
      }
    } else {
      inBg = true;
    }
  }
  
  if (!inBg) {
    return { r: 0, g: 0, b: 0, a: 0 }; // Transparent outside
  }
  
  // Background color: Slate 900 (#0f172a)
  let r = 15, g = 23, b = 42, a = 255;
  
  // 2. Draw U-magnet
  // Centered at mcx = 0.5, mcy = 0.52
  const mcx = 0.5;
  const mcy = 0.52;
  const Ro = 0.24;
  const Ri = 0.12;
  const H = 0.18;
  
  const mdx = px - mcx;
  const mdy = py - mcy;
  const dist = Math.sqrt(mdx * mdx + mdy * mdy);
  
  let inMagnet = false;
  let isPole = false;
  
  if (py >= mcy) {
    // Bottom curved part of the U
    if (dist >= Ri && dist <= Ro) {
      inMagnet = true;
    }
  } else if (py < mcy && py >= mcy - H) {
    // Top straight bars
    const absMdx = Math.abs(mdx);
    if (absMdx >= Ri && absMdx <= Ro) {
      inMagnet = true;
      // Check if it's the pole (top portion of the bar)
      if (py >= mcy - H && py <= mcy - H + 0.05) {
        isPole = true;
      }
    }
  }
  
  // 3. Draw Downward Arrow
  // Centered at cx = 0.5
  let inArrow = false;
  // Shaft
  if (Math.abs(px - 0.5) <= 0.035 && py >= 0.16 && py <= 0.48) {
    inArrow = true;
  }
  // Head (triangle pointing down)
  if (py >= 0.48 && py <= 0.64) {
    const arrowWidthAtPy = (0.64 - py) * 0.7; // widens towards the top, narrows at 0.64
    if (Math.abs(px - 0.5) <= arrowWidthAtPy) {
      inArrow = true;
    }
  }
  
  // Colors:
  // Magnet body: Indigo (#6366f1) -> r: 99, g: 102, b: 241
  // Magnet poles: Red (#ef4444) -> r: 239, g: 68, b: 68
  // Arrow: Cyan (#38bdf8) -> r: 56, g: 189, b: 248
  if (inArrow) {
    return { r: 56, g: 189, b: 248, a: 255 };
  } else if (inMagnet) {
    if (isPole) {
      return { r: 239, g: 68, b: 68, a: 255 };
    } else {
      return { r: 99, g: 102, b: 241, a: 255 };
    }
  }
  
  // Else return background
  return { r, g, b, a };
}

function createPng(width, height) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeInt32BE(width, 0);
  ihdrData.writeInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // color type (RGBA)
  ihdrData.writeUInt8(0, 10); // compression method
  ihdrData.writeUInt8(0, 11); // filter method
  ihdrData.writeUInt8(0, 12); // interlace method
  const ihdr = createChunk('IHDR', ihdrData);

  // Generate pixel data (RGBA)
  const rowSize = width * 4;
  const pixelData = Buffer.alloc(height * (rowSize + 1));
  
  let offset = 0;
  for (let y = 0; y < height; y++) {
    pixelData.writeUInt8(0, offset++); // Filter type 0
    for (let x = 0; x < width; x++) {
      const color = drawPixel(x, y, width, height);
      pixelData.writeUInt8(color.r, offset++);
      pixelData.writeUInt8(color.g, offset++);
      pixelData.writeUInt8(color.b, offset++);
      pixelData.writeUInt8(color.a, offset++);
    }
  }

  // Compress pixel data using deflate
  const compressed = zlib.deflateSync(pixelData);
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  // Calculate CRC
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return ~crc;
}

// Generate the icons
fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-16.png', createPng(16, 16));
fs.writeFileSync('public/icons/icon-48.png', createPng(48, 48));
fs.writeFileSync('public/icons/icon-128.png', createPng(128, 128));
console.log('Icons generated successfully.');
