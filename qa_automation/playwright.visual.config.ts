import { defineConfig, devices } from '@playwright/test';
import { requireE2EBaseUrl } from './requireBaseUrl';

const baseURL = requireE2EBaseUrl();

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
