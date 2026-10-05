import { expect, test, type Locator, type Page } from '@playwright/test';

/** Press the "+" button of a category, then choose an item from the drop-down that appears. */
async function addItem(model: Locator, noun: string, value: string) {
  await model.getByRole('button', { name: `Add ${noun}` }).click();
  await model.getByLabel(`Choose ${noun}`).selectOption(value);
}

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
  await expect(page.locator('.model-panel').first()).toContainText('Big Boss');
  await expect(page.getByLabel('Model name')).toHaveCount(0); // view mode: no form fields
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

  // 11 cards on 8-up sheets must come out as exactly 2 pages, on both common paper sizes
  for (const format of ['Letter', 'A4'] as const) {
    const pdf = await page.pdf({ format });
    expect(pdf.byteLength).toBeGreaterThan(1000);
    // Count page objects ("/Type /Page" but not "/Type /Pages"); Chromium writes these uncompressed
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? [];
    expect(pages, `${format} page count`).toHaveLength(2);
  }
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
  await page.locator('input[type=file]').evaluate((el, json) => {
    const input = el as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(new File([json], 'odd.json', { type: 'application/json' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  }, JSON.stringify(warband));
  await page.getByRole('link', { name: 'Odd Ids' }).click();
  await expect(page.locator('.model-panel').first()).toContainText('Odd Id');
  await page.getByRole('button', { name: /^Edit/ }).click();
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

const breakStorage = (page: Page) =>
  page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });

test('a failed save is shown and Print asks before showing the stale version', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await breakStorage(page);
  await page.getByLabel('Warband name').fill('Unsaved');
  const status = page.locator('[data-save-status]');
  await expect(status).toContainText('Could not save');
  await expect(status).toHaveCSS('padding-left', '0px');

  const messages: string[] = [];
  page.once('dialog', (d) => {
    messages.push(d.message());
    void d.dismiss();
  });
  await page.getByRole('button', { name: 'Print' }).click();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain('last saved version');
  await expect(page).not.toHaveURL(/print/);
  await expect(status).toContainText('Could not save');

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Print' }).click();
  await expect(page).toHaveURL(/print/);
});

test('the library shows a message when a save fails', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await page.goto('/#/');
  await expect(page.getByRole('button', { name: /^Duplicate/ })).toBeVisible();
  await breakStorage(page);
  await page.getByRole('button', { name: /^Duplicate/ }).click();
  await expect(page.locator('#banner')).toContainText('could not be saved');
  await page.getByRole('button', { name: 'New warband', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator('#banner .banner-warning')).toHaveCount(1);
});

test('weapons, equipment and powers are chosen from drop-downs that show details', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  const model = page.locator('.model-panel').first();

  // The drop-down shows names only: no costs or notes in the option text
  await expect(model.getByLabel('Choose equipment')).toHaveCount(0); // hidden until "+" is pressed
  await model.getByRole('button', { name: 'Add equipment' }).click();
  const optionTexts = await model
    .getByLabel('Choose equipment')
    .locator('option')
    .allTextContents();
  await model.getByLabel('Choose equipment').press('Escape'); // cancels without adding
  await expect(model.getByLabel('Choose equipment')).toHaveCount(0);
  await expect(model.getByLabel('Equipment 1', { exact: true })).toHaveCount(0);
  expect(optionTexts).toContain('Heavy Armor');
  expect(optionTexts.every((t) => !/\d|\+1/.test(t))).toBe(true);

  // Choosing an item shows its details and updates the cost (leader base cost is 7)
  await addItem(model, 'equipment', 'heavy-armor');
  await expect(model.locator('.details', { hasText: '+1 to Def rolls' })).toContainText(
    '1 pt · passive',
  );
  await expect(model.getByText('8 pts', { exact: true })).toBeVisible();
  await expect(model.getByLabel('Choose equipment')).toHaveCount(0); // closes after a choice
  await expect(model.getByRole('button', { name: 'Add equipment' })).toBeVisible();

  // Weapons and powers work the same way
  await addItem(model, 'ranged weapon', 'shotgun');
  await expect(model.locator('.details', { hasText: 'Range ≤ 1 stick' })).toBeVisible();
  await addItem(model, 'psychic power', 'fear');
  await expect(model.locator('.details', { hasText: 'must move 1 stick away' })).toBeVisible();

  // A third equipment item is allowed but warned about (a leader has 2 slots)
  await addItem(model, 'equipment', 'grenade');
  await addItem(model, 'equipment', 'jump-pack');
  await expect(model.getByText(/has 3 equipment, max 2/)).toBeVisible();

  // Remove it again: the warning goes
  await model.getByRole('button', { name: 'Remove Jump Pack' }).click();
  await expect(model.getByText(/has 3 equipment, max 2/)).toHaveCount(0);

  // Change a chosen item through its own drop-down
  await model.getByLabel('Equipment 1', { exact: true }).selectOption('cybernetics');
  await expect(model.locator('.details', { hasText: '+1 to Prw rolls' })).toBeVisible();

  // Choices persist across a reload
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .map((k) => localStorage.getItem(k))
          .join(''),
      ),
    )
    .toContain('cybernetics');
  await page.reload();
  await expect(model).toContainText('Cybernetics');
  await expect(model).toContainText('+1 to Prw rolls');
  await model.getByRole('button', { name: /^Edit/ }).click();
  await expect(model.getByLabel('Equipment 1', { exact: true })).toHaveValue('cybernetics');
});

test('an expansion item stays chosen, and flagged, when the expansion is switched off', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  await page.getByLabel('Include fan expansion').check();
  const model = page.locator('.model-panel').first();
  await addItem(model, 'equipment', 'comms-unit');
  await expect(model.getByLabel('Equipment 1', { exact: true })).toHaveValue('comms-unit');

  await page.getByLabel('Include fan expansion').uncheck();
  // Still chosen, still listed, now labelled as expansion content, and warned about
  const chosen = model.getByLabel('Equipment 1', { exact: true });
  await expect(chosen).toHaveValue('comms-unit');
  await expect(chosen.locator('option:checked')).toHaveText('Comms Unit (expansion)');
  await expect(model.getByText(/Comms Unit is an expansion item/)).toBeVisible();
  // And it is no longer offered for new choices
  await model.getByRole('button', { name: 'Add equipment' }).click();
  const offered = await model.getByLabel('Choose equipment').locator('option').allTextContents();
  expect(offered).not.toContain('Comms Unit');
});

test('a model card is read-only until Edit is pressed and goes back to view mode on Save', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New warband' }).click();
  const model = page.locator('.model-panel').first();

  // A brand-new, untouched model starts in edit mode so it can be filled in
  await expect(model.getByLabel('Model name')).toBeVisible();
  await model.getByLabel('Model name').fill('Boss');
  await addItem(model, 'ranged weapon', 'shotgun');
  await addItem(model, 'psychic power', 'fear');
  await model.getByRole('button', { name: /^Save/ }).click();

  // View mode: the name, stats, weapons and powers are shown, but no form controls
  await expect(model).toContainText('Boss');
  await expect(model).toContainText('Shotgun');
  await expect(model).toContainText('Fear');
  await expect(model).toContainText('Spd');
  await expect(model.locator('select, input, textarea')).toHaveCount(0);
  await expect(model.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
  await expect(model.getByRole('button', { name: /^Save/ })).toHaveCount(0);
  await expect(model.locator('.total')).toContainText('pts');

  // Edit brings the form back, with the values as they were
  await model.getByRole('button', { name: /^Edit/ }).click();
  await expect(model.getByLabel('Model name')).toHaveValue('Boss');
  await expect(model.getByLabel('Ranged weapon 1', { exact: true })).toHaveValue('shotgun');
  await model.getByLabel('Model name').fill('Big Boss');
  await model.getByRole('button', { name: /^Save/ }).click();
  await expect(model).toContainText('Big Boss');

  // Other cards are not affected by editing one, and a newly added model starts in edit mode
  await page.getByRole('button', { name: 'Add model' }).click();
  await expect(page.getByLabel('Model name')).toBeFocused(); // focus goes to the new card
  await expect(page.locator('.model-panel')).toHaveCount(2);
  await expect(page.getByLabel('Model name')).toHaveCount(1);
  await expect(page.locator('.model-panel').first()).toContainText('Big Boss');

  // Edit mode is not remembered: after a reload every model is back in view mode
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
  await expect(page.getByLabel('Model name')).toHaveCount(1); // the untouched new model only
});
