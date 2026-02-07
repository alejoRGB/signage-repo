import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '../../docs/screenshots');
const BASE_URL = 'https://signage-repo-dc5s-k539ahs2i-alejos-projects-7a73f1be.vercel.app';

test('capture production ui screenshots', async ({ page }) => {
    // Use a larger viewport to ensure good screenshots
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Login Page
    console.log('Navigating to login...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_01_login.png'), fullPage: true });

    // 2. Login Flow
    console.log('Logging in...');
    const username = process.env.E2E_USERNAME || 'demo@expanded.com'; // Fallback only for local dev if needed, but better to force env
    const password = process.env.E2E_PASSWORD;

    if (!password) {
        throw new Error('E2E_PASSWORD environment variable is not set');
    }

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');

    // 3. Dashboard
    console.log('Capturing Dashboard...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_02_dashboard.png'), fullPage: true });

    // 4. Devices
    console.log('Capturing Devices...');
    await page.goto(`${BASE_URL}/dashboard/devices`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra wait for dynamic data
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_03_devices.png'), fullPage: true });

    // 5. Playlists
    console.log('Capturing Playlists...');
    await page.goto(`${BASE_URL}/dashboard/playlists`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_04_playlists.png'), fullPage: true });

    // 6. Media
    console.log('Capturing Media...');
    await page.goto(`${BASE_URL}/dashboard/media`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_05_media.png'), fullPage: true });

    // 7. Schedules
    console.log('Capturing Schedules...');
    await page.goto(`${BASE_URL}/dashboard/schedules`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'prod_06_schedules.png'), fullPage: true });
});
