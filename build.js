import { build } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  console.log('Starting build...');

  // 1. Build Popup and Options UI
  console.log('Building Popup and Options UIs...');
  await build({
    configFile: false,
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    build: {
      emptyOutDir: true,
      outDir: resolve(__dirname, 'dist'),
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/index.html'),
          options: resolve(__dirname, 'src/options/index.html'),
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
  });

  // 2. Build Background Script
  console.log('Building Background script...');
  await build({
    configFile: false,
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    build: {
      emptyOutDir: false,
      outDir: resolve(__dirname, 'dist'),
      lib: {
        entry: resolve(__dirname, 'src/background/index.ts'),
        name: 'background',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
  });

  // 3. Build Content Script
  console.log('Building Content script...');
  await build({
    configFile: false,
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    build: {
      emptyOutDir: false,
      outDir: resolve(__dirname, 'dist'),
      lib: {
        entry: resolve(__dirname, 'src/content/index.ts'),
        name: 'content',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
  });

  // 4. Copy public assets (manifest.json, icons, etc.)
  console.log('Copying public files...');
  const publicDir = resolve(__dirname, 'public');
  const distDir = resolve(__dirname, 'dist');
  if (fs.existsSync(publicDir)) {
    copyFolderSync(publicDir, distDir);
  }

  console.log('Build completed successfully!');
}

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach((element) => {
    const stat = fs.lstatSync(resolve(from, element));
    if (stat.isFile()) {
      fs.copyFileSync(resolve(from, element), resolve(to, element));
    } else if (stat.isDirectory()) {
      copyFolderSync(resolve(from, element), resolve(to, element));
    }
  });
}

run().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
