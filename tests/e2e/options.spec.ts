import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Options Page E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock browser extension API
    await page.addInitScript(() => {
      (window as any).browser = {
        storage: {
          local: {
            get: async () => ({
              settings: {
                enabled: true,
                qbUrl: 'http://localhost:8080',
                qbUsername: 'admin',
                qbPassword: 'password123',
                categoryMapping: {},
              },
            }),
            set: async () => {},
            remove: async () => {},
          },
        },
        runtime: {
          sendMessage: async (msg: any) => {
            if (msg.action === 'getSettings') {
              return {
                success: true,
                settings: {
                  enabled: true,
                  qbUrl: 'http://localhost:8080',
                  qbUsername: 'admin',
                  qbPassword: 'password123',
                  qbApiKey: 'token123',
                  categoryMapping: {
                    movies: 'movies-custom',
                    series: 'series-custom',
                  },
                },
              };
            }
            if (msg.action === 'testConnection') {
              return { success: true, version: '2.8.4' };
            }
            if (msg.action === 'saveSettings') {
              return { success: true };
            }
            return { success: true };
          },
        },
      };
    });

    const filePath = path.resolve(__dirname, '../../dist/src/options/index.html');
    await page.goto(`file://${filePath}`);
  });

  test('should load options and populate fields from settings', async ({ page }) => {
    await expect(page.locator('#qb-url')).toHaveValue('http://localhost:8080');
    await expect(page.locator('#qb-username')).toHaveValue('admin');
    await expect(page.locator('#qb-password')).toHaveValue('password123');
    await expect(page.locator('#qb-apikey')).toHaveValue('token123');

    // Mappings tab should have loaded values
    await page.click('text=Category Mappings');
    await expect(page.locator('#map-movies')).toHaveValue('movies-custom');
    await expect(page.locator('#map-series')).toHaveValue('series-custom');
  });

  test('should trigger connection testing successfully', async ({ page }) => {
    // Click connection testing
    await page.click('#btn-test-conn');

    // Verify successful banners
    const resultBanner = page.locator('#conn-test-result');
    await expect(resultBanner).toBeVisible();
    await expect(resultBanner).toContainText('Connection successful');
    await expect(resultBanner).toContainText('2.8.4');

    // Header badge should update to connected
    await expect(page.locator('#conn-text')).toHaveText('Connected');
  });

  test('should navigate between tabs correctly', async ({ page }) => {
    // Start on connection
    await expect(page.locator('#tab-connection')).toBeVisible();
    await expect(page.locator('#tab-behavior')).not.toBeVisible();

    // Click Behavior tab
    await page.click('text=Router Behavior');
    await expect(page.locator('#tab-behavior')).toBeVisible();
    await expect(page.locator('#tab-connection')).not.toBeVisible();
  });
});
