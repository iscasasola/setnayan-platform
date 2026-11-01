// Playwright WebKit at 390 (iPhone emulation) — Planning Stage + Home labs, light and dark.
import { webkit, devices } from '@playwright/test';
const OUT = process.argv[2];
const BASE = 'http://localhost:3503';
const browser = await webkit.launch();
const res = {};
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: scheme });
  const page = await ctx.newPage();
  // 1 · Planning Stage, everything
  await page.goto(`${BASE}/dev/schedule-lab?view=preparation`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForSelector('[data-plan-row]', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/planning-all-${scheme}.png` });
  const all = await page.evaluate(() => ({
    rows: document.querySelectorAll('[data-plan-row]').length,
    todoRows: document.querySelectorAll('[data-plan-todo]').length,
    todoOpen: document.querySelectorAll('[data-plan-todo="open"]').length,
    folded: [...document.querySelectorAll('[data-plan-row="task"]')].filter((li) => /Casa Catering|Food tasting|Marriage license/.test(li.textContent || '')).map((li) => li.textContent?.slice(0, 120)),
    autofillShown: [...document.querySelectorAll('[data-plan-row="payment"],[data-plan-row="meeting"],[data-plan-row="paperwork"]')].map((li) => li.textContent?.slice(0, 80)),
    filterLabel: document.querySelector('[data-planning-filter]')?.textContent,
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
  }));
  // 2 · switch to To do in place
  await page.click('[data-planning-filter]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/planning-filter-menu-${scheme}.png` });
  await page.getByRole('option', { name: /To do/ }).first().click().catch(async () => { await page.getByText(/^To do ·/).first().click(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/planning-todo-${scheme}.png` });
  const todo = await page.evaluate(() => ({
    url: location.search,
    visibleRows: [...document.querySelectorAll('[data-plan-row]')].filter((li) => li.offsetParent !== null).length,
    visibleNonTodo: [...document.querySelectorAll('[data-plan-row]:not([data-plan-todo])')].filter((li) => li.offsetParent !== null).length,
  }));
  // 3 · open a task's date sheet
  await page.locator('[data-task-date]').nth(2).click();
  await page.waitForSelector('[data-schedule-sheet="task-date"]', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/planning-date-sheet-${scheme}.png` });
  const sheet = await page.evaluate(() => ({ max: document.querySelector('[data-task-date-input]')?.getAttribute('max'), value: document.querySelector('[data-task-date-input]')?.value }));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // 4 · press a tick — no sign-in in the lab: the real action refuses, the row must say so and go back
  const tick = page.locator('[data-planning-tick="task"][aria-pressed="false"]').first();
  await tick.click();
  await page.waitForTimeout(4000);
  const tickAfter = await page.evaluate(() => ({ alert: document.querySelector('[data-planning-tick] ~ [role="alert"]')?.textContent || [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent).join(' | ') }));
  await page.screenshot({ path: `${OUT}/planning-tick-refused-${scheme}.png` });
  // 5 · deep link from Home's To do: filter=todo opens on To do
  await page.goto(`${BASE}/dev/schedule-lab?view=preparation&filter=todo`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const deep = await page.evaluate(() => document.querySelector('[data-plan-filter]')?.getAttribute('data-plan-filter'));
  // 6 · Home lab, To do tile
  await page.goto(`${BASE}/dev/home-lab`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForTimeout(1200);
  const tile = page.locator('[data-home-tile="plan"], [data-hc="plan"], [data-k="plan"]').first();
  let homeText = '';
  if (await tile.count()) { await tile.scrollIntoViewIfNeeded(); homeText = (await tile.textContent()) ?? ''; }
  else { const t = page.getByText(/^To do/).first(); if (await t.count()) { await t.scrollIntoViewIfNeeded(); homeText = (await t.locator('xpath=ancestor::*[3]').textContent()) ?? ''; } }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/home-todo-${scheme}.png` });
  res[scheme] = { all, todo, sheet, tickAfter, deep, homeText: homeText.slice(0, 300) };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(res, null, 2));
