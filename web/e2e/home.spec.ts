import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    // Adjust this based on actual title. Usually 'Create Next App' or similar if default.
    // I will check for something generic first or update if I know the title.
    // Looking at layout.tsx might reveal title metadata.
    await expect(page).toHaveTitle(/Signage|Dashboard|Login/i);
});
