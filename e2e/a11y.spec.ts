import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const scan = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze())
    .violations;

for (const colorScheme of ['light', 'dark'] as const) {
  test(`no axe violations in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByRole('button', { name: 'New warband' }).click();
    await page.getByLabel('Warband name').fill('Accessible');
    const model = page.locator('.model-panel').first();
    await model.getByRole('button', { name: 'Add equipment' }).click();
    await model.getByLabel('Choose equipment').selectOption('heavy-armor');
    await page.getByLabel('Points target').fill('1');

    expect(await scan(page), 'editor, edit mode').toEqual([]);
    await model.getByRole('button', { name: /^Save/ }).click();
    expect(await scan(page), 'editor, view mode').toEqual([]);

    await page.getByRole('button', { name: 'Print' }).click();
    await expect(page.locator('.card').first()).toBeVisible();
    expect(await scan(page), 'print view').toEqual([]);

    await page.goto('/#/');
    await expect(page.getByRole('link', { name: 'Accessible' })).toBeVisible();
    expect(await scan(page), 'library').toEqual([]);
  });
}

test('each view has its own title and moves focus to its heading', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Warbands – Space Weirdos Builder');
  await page.getByRole('button', { name: 'New warband' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page).toHaveTitle('Edit New warband – Space Weirdos Builder');
  await page.getByLabel('Warband name').fill('Titled');
  await expect(page).toHaveTitle('Edit Titled – Space Weirdos Builder');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Titled');
  await page.getByRole('button', { name: 'Print' }).click();
  await expect(page).toHaveTitle('Print Titled – Space Weirdos Builder');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('status messages are in live regions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await expect(page.locator('[data-total]')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('[data-warband-warnings]')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('[data-save-status]')).toHaveAttribute('role', 'status');
});
