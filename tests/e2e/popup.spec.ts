import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Popup E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock browser APIs
    await page.addInitScript(() => {
      let mockJobs = [
        {
          hash: 'hash1',
          name: 'ubuntu-24.04-desktop-amd64.iso',
          type: 'file',
          status: 'completed',
          addedTime: Date.now() - 10000,
          category: 'iso',
        },
        {
          hash: 'hash2',
          name: 'The Movie (2025) 1080p',
          type: 'magnet',
          status: 'pending_user',
          addedTime: Date.now() - 5000,
          suggestedCategory: 'movies',
          confidence: 0.61,
          files: [
            { path: 'The Movie (2025).mkv', size: 10_000_000_000 },
            { path: 'sample.mkv', size: 50_000_000 },
          ],
        },
        {
          hash: 'hash3',
          name: 'Retrieving Name...',
          type: 'magnet',
          status: 'pending_metadata',
          addedTime: Date.now(),
        },
      ];

      (window as any).browser = {
        storage: {
          local: {
            get: async () => ({ settings: { qbUrl: 'http://localhost:8080', enabled: true } }),
          },
        },
        runtime: {
          sendMessage: async (msg: any) => {
            if (msg.action === 'getSettings') {
              return {
                success: true,
                settings: { qbUrl: 'http://localhost:8080', enabled: true },
              };
            }
            if (msg.action === 'getJobs') {
              return { success: true, jobs: mockJobs };
            }
            if (msg.action === 'testConnection') {
              return { success: true, version: '1.0.0' };
            }
            if (msg.action === 'addMagnet') {
              mockJobs.push({
                hash: 'hash_new',
                name: 'Retrieving Name...',
                type: 'magnet',
                status: 'pending_metadata',
                addedTime: Date.now(),
              });
              return { success: true, hash: 'hash_new' };
            }
            if (msg.action === 'resolveJob') {
              // Mark job 2 as completed
              const job = mockJobs.find((j) => j.hash === msg.hash);
              if (job) {
                job.status = 'completed';
                job.category = msg.category;
              }
              return { success: true };
            }
            return { success: true };
          },
        },
      };
    });

    const filePath = path.resolve(__dirname, '../../dist/src/popup/index.html');
    await page.goto(`file://${filePath}`);
  });

  test('should render connection status and job list correctly', async ({ page }) => {
    // Connection badge should read Connected
    await expect(page.locator('#conn-text')).toHaveText('Connected');

    // Verify jobs are rendered
    await expect(page.locator('text=ubuntu-24.04-desktop-amd64.iso')).toBeVisible();
    await expect(page.locator('text=The Movie (2025) 1080p')).toBeVisible();
    await expect(page.locator('text=Retrieving Name...')).toBeVisible();

    // Verify badges
    await expect(page.locator('text=iso').first()).toBeVisible();
    await expect(page.locator('text=Needs Category')).toBeVisible();
    await expect(page.locator('text=Polling Metadata')).toBeVisible();
  });

  test('should expand file list when clicked in pending user job', async ({ page }) => {
    const fileContainer = page.locator('.file-list-container');
    await expect(fileContainer).not.toBeVisible();

    // Toggle click
    await page.click('text=View Torrent Files');
    await expect(fileContainer).toBeVisible();
    await expect(page.locator('text=The Movie (2025).mkv (9.31 GB)')).toBeVisible();
  });

  test('should allow user override and resume of pending job', async ({ page }) => {
    // Select category 'Anime' from dropdown
    await page.selectOption('.select-control[data-hash="hash2"]', 'anime');

    // Click resume
    await page.click('.btn-resolve[data-hash="hash2"]');

    // Job state should shift to completed (represented by category badge 'anime' and checkmark)
    await expect(page.locator('text=anime').first()).toBeVisible();
    await expect(page.locator('text=Needs Category')).not.toBeVisible();
  });

  test('should support manual magnet paste and send', async ({ page }) => {
    // Fill magnet URL
    const testMagnet = 'magnet:?xt=urn:btih:d24513abcde12345&dn=ubuntu';
    await page.fill('#magnet-url', testMagnet);

    // Send
    await page.click('#btn-send-magnet');

    // Result alert
    const resultAlert = page.locator('#send-result');
    await expect(resultAlert).toBeVisible();
    await expect(resultAlert).toContainText('successfully sent');
  });
});
