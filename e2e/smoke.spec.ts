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

test('a model id containing quote and bracket characters does not break the editor', async ({
  page,
}) => {
  const model = {
    id: 'a"]',
    name: 'Odd Id',
    isLeader: true,
    leaderTrait: null,
    powerful: false,
    speed: 1,
    defense: '2d6',
    firepower: 'none',
    prowess: '2d6',
    willpower: '2d6',
    rangedWeapons: [],
    closeWeapons: [],
    equipment: [],
    powers: [],
  };
  const warband = {
    id: 'odd-wb',
    schemaVersion: 1,
    name: 'Odd Ids',
    target: 75,
    expansion: false,
    warbandTrait: null,
    models: [model],
    updatedAt: new Date().toISOString(),
  };
  await page.goto('/');
  page.on('dialog', (d) => d.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'odd.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(warband)),
  });
  await page.getByRole('link', { name: 'Odd Ids' }).click();
  await expect(page.getByLabel('Model name').first()).toHaveValue('Odd Id');
  await expect(page.locator('.panel .total').filter({ hasText: /pts$/ }).first()).toBeVisible();
  await expect(page.locator('[data-total]')).toContainText('/ 75 points');
});

test('the points target ignores empty and non-numeric input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  const target = page.getByLabel('Points target');
  await expect(page.locator('[data-total]')).toContainText('/ 75 points');
  await target.fill('abc');
  await expect(page.locator('[data-total]')).toContainText('/ 75 points');
  await target.fill('');
  await expect(page.locator('[data-total]')).toContainText('/ 75 points');
  await target.fill('150');
  await expect(page.locator('[data-total]')).toContainText('/ 150 points');
  await expect
    .poll(() => page.evaluate(() => Object.values(localStorage).join('')))
    .toContain('"target":150');
});

test('the Powerful flag can be cleared after the expansion is switched off', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await page.getByLabel('Include fan expansion').check();
  await page.getByLabel('Powerful').check();
  await page.getByLabel('Include fan expansion').uncheck();
  await expect(page.getByLabel('Powerful')).toBeChecked();
  // The editor redraws on toggle, so click rather than uncheck (which re-checks the old element)
  await page.getByLabel('Powerful').click();
  await expect(page.getByLabel('Powerful')).toHaveCount(0);
});

test('a pending edit is saved when the page becomes hidden', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await expect(page.getByLabel('Warband name')).toBeVisible();
  const saved = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Warband name"]')!;
    input.value = 'Hidden Save';
    input.dispatchEvent(new Event('input'));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return Object.values(localStorage).join('');
  });
  expect(saved).toContain('Hidden Save');
});

test('library buttons name the warband for screen readers', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await page.getByLabel('Warband name').fill('Labelled');
  await expect
    .poll(() => page.evaluate(() => Object.values(localStorage).join('')))
    .toContain('Labelled');
  await page.goto('/#/');
  for (const verb of ['Print', 'Duplicate', 'Rename', 'Export', 'Delete']) {
    await expect(page.getByRole('button', { name: `${verb} “Labelled”` })).toBeVisible();
  }
});
