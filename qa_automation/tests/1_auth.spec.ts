import { test, expect } from '@playwright/test';

const normalizeEnv = (value?: string) => value?.trim();

const TEST_USER = normalizeEnv(process.env.E2E_USERNAME);
const TEST_PASS = normalizeEnv(process.env.E2E_PASSWORD);

test.describe('Phase 1: Core & Authentication (No Credentials Required)', () => {

    test('[AUTH-04] Redirect Check: Protected route should redirect to login', async ({ page }) => {
        // Go to a protected route (e.g., /dashboard)
        await page.goto('/dashboard');

        // Should be redirected to /login
        await expect(page).toHaveURL(/\/login/);

        // Check for login form inputs
        // Using name="username" as the app supports Username/Email and uses type="text"
        await expect(page.locator('input[name="username"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
    });
});

test.describe('Phase 1: Core & Authentication (Credentialed)', () => {
    test.skip(!TEST_USER || !TEST_PASS, 'Skipping credentialed auth tests: set E2E_USERNAME and E2E_PASSWORD');

    test('[AUTH-02] Invalid Login', async ({ page }) => {
        await page.goto('/login');

        // Fill credentials
        await page.fill('input[name="username"]', TEST_USER!);
        await page.fill('input[name="password"]', 'wrongpassword_123');

        // Submit
        await page.click('button[type="submit"]');

        // Verification: Error message should appear
        // Using text match or specific error class
        const errorLocator = page.locator('text=Invalid username or password').or(page.locator('text=Error'));
        await expect(errorLocator).toBeVisible();

        // Verify we are STILL on the login page
        await expect(page.locator('input[name="username"]')).toBeVisible();
    });

    test('[AUTH-01] Valid Login', async ({ page }) => {
        await page.goto('/login');

        // Fill credentials
        await page.fill('input[name="username"]', TEST_USER!);
        await page.fill('input[name="password"]', TEST_PASS!);
        await page.click('button[type="submit"]');

        // Verification: URL should change to /dashboard
        // Increase timeout for cold starts/db connection
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });

        // Check for dashboard element
        await expect(page.getByRole('link', { name: 'Devices' }).first()).toBeVisible();
    });

    test('[AUTH-03] Logout', async ({ page }) => {
        // 1. Perform Login First
        await page.goto('/login');
        await page.fill('input[name="username"]', TEST_USER!);
        await page.fill('input[name="password"]', TEST_PASS!);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });

        // 2. Find Logout button
        const logoutBtn = page.getByRole('button', { name: /sign out|logout|salir/i });

        if (await logoutBtn.isVisible()) {
            await logoutBtn.click();
        } else {
            // Try user menu
            const userMenu = page.locator('button[aria-label="User menu"]').or(page.locator('.user-avatar'));
            if (await userMenu.isVisible()) {
                await userMenu.click();
                await page.getByText(/sign out|logout|salir/i).click();
            } else {
                await page.click('text=Sign out');
            }
        }

        // 3. Verify return to login screen
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('input[name="username"]')).toBeVisible();
    });

});
