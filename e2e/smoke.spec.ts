import { expect, test } from '@playwright/test';

test('a warband survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await page.getByLabel('Warband name').fill('Persistent Weirdos');
  await page.getByLabel('Model name').first().fill('Big Boss');
  // Autosave is debounced; wait until the edit has reached local storage before reloading
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .map((k) => localStorage.getItem(k))
          .join(''),
      ),
    )
    .toContain('Big Boss');
  await page.reload();
  await expect(page.getByLabel('Warband name')).toHaveValue('Persistent Weirdos');
  await expect(page.getByLabel('Model name').first()).toHaveValue('Big Boss');
  await page.goto('/#/');
  await expect(page.getByRole('link', { name: 'Persistent Weirdos' })).toBeVisible();
});

test('print view gives equal-sized cards, eight to a page, in portrait', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  // Leader plus 9 more models = 10 models, so summary + 10 cards = 11 cards on 2 pages
  for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'Add model' }).click();
  // Give one model a lot of content so card sizes would differ if they depended on it
  await page
    .getByLabel('Model name')
    .nth(1)
    .fill('A model with an extremely long name that goes on and on');
  // The editor's Print button flushes any pending autosave before it navigates
  await page.getByRole('button', { name: 'Print' }).click();
  await page.emulateMedia({ media: 'print' });

  const cards = page.locator('.card');
  await expect(cards).toHaveCount(11);
  const boxes = await cards.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height)];
    }),
  );
  for (const [w, h] of boxes) {
    expect(w).toBe(336); // 3.5 in at 96 dpi
    expect(h).toBe(240); // 2.5 in at 96 dpi
  }
  await expect(page.locator('.sheet')).toHaveCount(2);
  await expect(page.locator('.sheet').nth(0).locator('.card')).toHaveCount(8);
  await expect(page.locator('.sheet').nth(1).locator('.card')).toHaveCount(3);

  const pdf = await page.pdf({ preferCSSPageSize: false, format: 'Letter' });
  expect(pdf.byteLength).toBeGreaterThan(1000);
});
