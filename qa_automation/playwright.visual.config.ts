import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL?.trim() || 'https://signage-repo-dc5s.vercel.app';

export default defineConfig({
    testDir: './tests/visual',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    timeout: 180_000,
    reporter: 'html',
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
