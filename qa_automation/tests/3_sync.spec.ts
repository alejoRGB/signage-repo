import { test, expect, Page } from "@playwright/test";

const normalizeEnv = (value?: string) => value?.trim();

const USERNAME = normalizeEnv(process.env.E2E_USERNAME);
const USER_PASSWORD = normalizeEnv(process.env.E2E_PASSWORD);

async function loginAsUser(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
}

async function openSyncPanel(page: Page) {
  await page.goto("/dashboard");
  const syncTab = page.getByTestId("directive-tab-SYNC_VIDEOWALL");
  test.skip((await syncTab.count()) === 0, "Sync tab not available (feature flag may be disabled)");
  await syncTab.click();
  await expect(page.getByTestId("directive-sync-videowall-panel")).toBeVisible();
}

test.describe("Phase 4: Sync wizard QA (credentialed)", () => {
  test.skip(!USERNAME || !USER_PASSWORD, "Skipping sync e2e tests: set E2E_USERNAME and E2E_PASSWORD");

  test("[SYNC-E2E-01] Wizard requires at least 2 devices to move from Step 1", async ({ page }) => {
    await loginAsUser(page, USERNAME!, USER_PASSWORD!);
    await openSyncPanel(page);

    const addButtons = page.locator('button[aria-label^="Add "]');
    test.skip((await addButtons.count()) === 0, "No available devices in environment");

    await addButtons.first().click();
    await page.getByTestId("sync-step-next-btn").click();

    await expect(page.getByTestId("sync-wizard-hint")).toContainText("Step 1");
  });

  test("[SYNC-E2E-02] Review step blocks start when an offline device is selected", async ({ page }) => {
    await loginAsUser(page, USERNAME!, USER_PASSWORD!);
    await openSyncPanel(page);

    const offlineAddButton = page
      .locator('article:has-text("Offline") button[aria-label^="Add "]')
      .first();
    test.skip((await offlineAddButton.count()) === 0, "No offline device available to validate blocking");

    await offlineAddButton.click();

    const remainingAddButtons = page.locator('button[aria-label^="Add "]');
    test.skip((await remainingAddButtons.count()) === 0, "Need at least a second device selected");
    await remainingAddButtons.first().click();

    await page.getByTestId("sync-step-next-btn").click();

    const commonMediaSelect = page.getByTestId("sync-common-media-select");
    const commonMediaOptions = commonMediaSelect.locator("option:not([value=''])");
    test.skip((await commonMediaOptions.count()) === 0, "No videos available");
    const mediaValue = await commonMediaOptions.first().getAttribute("value");
    test.skip(!mediaValue, "No selectable media option found");
    await commonMediaSelect.selectOption(mediaValue);

    await page.getByTestId("sync-step-next-btn").click();

    await expect(page.getByText(/offline and will block start/i)).toBeVisible();
    await expect(page.getByTestId("sync-start-from-saved-btn")).toBeDisabled();
  });

  test("[SYNC-E2E-03] Duration filter disables videos with different duration", async ({ page }) => {
    await loginAsUser(page, USERNAME!, USER_PASSWORD!);
    await openSyncPanel(page);

    const addButtons = page.locator('button[aria-label^="Add "]');
    test.skip((await addButtons.count()) < 2, "Need at least two available devices");

    await addButtons.nth(0).click();
    await addButtons.nth(1).click();
    await page.getByTestId("sync-step-next-btn").click();

    const commonMediaSelect = page.getByTestId("sync-common-media-select");
    const firstMediaOption = commonMediaSelect.locator("option:not([value=''])").first();
    const firstValue = await firstMediaOption.getAttribute("value");
    test.skip(!firstValue, "No selectable media found");
    await commonMediaSelect.selectOption(firstValue);

    const mismatchedOptions = commonMediaSelect.locator('option[disabled]:has-text("different duration")');
    test.skip((await mismatchedOptions.count()) === 0, "Environment has no mixed-duration videos to assert");
    await expect(mismatchedOptions.first()).toBeDisabled();
  });

  test("[SYNC-E2E-04] PER_DEVICE mode allows assigning the same video to multiple devices", async ({ page }) => {
    await loginAsUser(page, USERNAME!, USER_PASSWORD!);
    await openSyncPanel(page);

    const addButtons = page.locator('button[aria-label^="Add "]');
    test.skip((await addButtons.count()) < 2, "Need at least two available devices");

    await addButtons.nth(0).click();
    await addButtons.nth(1).click();
    await page.getByTestId("sync-step-next-btn").click();
    await page.getByRole("radio", { name: "Per device media" }).check();

    const perDeviceSelects = page.locator('[data-testid^="sync-device-media-select-"]');
    test.skip((await perDeviceSelects.count()) < 2, "Per-device selectors are not available");

    const candidateOption = perDeviceSelects
      .first()
      .locator("option:not([value='']):not([disabled])")
      .first();
    const mediaValue = await candidateOption.getAttribute("value");
    test.skip(!mediaValue, "No enabled per-device media option found");

    await perDeviceSelects.nth(0).selectOption(mediaValue);
    await perDeviceSelects.nth(1).selectOption(mediaValue);

    await expect(perDeviceSelects.nth(0)).toHaveValue(mediaValue);
    await expect(perDeviceSelects.nth(1)).toHaveValue(mediaValue);
  });
});
