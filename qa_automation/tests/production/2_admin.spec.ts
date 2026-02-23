import { test, expect, Page } from "@playwright/test";

const normalizeEnv = (value?: string) => value?.trim();

const ADMIN_USERNAME = normalizeEnv(process.env.E2E_ADMIN_USERNAME) ?? normalizeEnv(process.env.E2E_ADMIN_EMAIL);
const ADMIN_PASSWORD = normalizeEnv(process.env.E2E_ADMIN_PASSWORD);
const USERNAME = normalizeEnv(process.env.E2E_USERNAME);
const USER_PASSWORD = normalizeEnv(process.env.E2E_PASSWORD);

async function loginAsAdmin(page: Page, username: string, password: string) {
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

async function loginAsUser(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

test.describe("Phase 1: Admin Authentication (No Credentials Required)", () => {
  test("[ADMIN-01] Redirect Check: Protected /admin route should redirect to admin login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});

test.describe("Phase 1: Admin Authentication (Credentialed)", () => {
  test.skip(
    !ADMIN_USERNAME || !ADMIN_PASSWORD,
    "Skipping admin auth tests: set E2E_ADMIN_USERNAME (or E2E_ADMIN_EMAIL) and E2E_ADMIN_PASSWORD",
  );

  test("[ADMIN-02] Invalid Admin Login", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_USERNAME!, "wrongpassword_123");

    await expect(page.getByText("Invalid admin credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("[ADMIN-03] Valid Admin Login", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_USERNAME!, ADMIN_PASSWORD!);

    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /super admin dashboard/i })).toBeVisible();
  });

  test("[ADMIN-04] Admin Logout", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_USERNAME!, ADMIN_PASSWORD!);
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    await page.getByRole("button", { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });
  });
});

test.describe("Phase 1: Authorization Boundaries (Credentialed User)", () => {
  test.skip(!USERNAME || !USER_PASSWORD, "Skipping role boundary test: set E2E_USERNAME and E2E_PASSWORD");

  test("[ADMIN-05] Non-admin user should be redirected away from /admin", async ({ page }) => {
    await loginAsUser(page, USERNAME!, USER_PASSWORD!);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
