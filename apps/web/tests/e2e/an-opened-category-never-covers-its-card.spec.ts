import { test, expect, type Page } from '@playwright/test';

/**
 * 📌 AN OPENED CATEGORY NEVER COVERS ITS OWN FIRST CARD — laid out in a browser.
 *
 * Owner, 2026-10-29, live, Suppliers › Find on a phone: *"when i tapped a category, this is how it pinned on top. it
 * made the service card not placed properly"*. On `/dev/suppliers-lab` at 375, opening Photo & Video after Reception
 * scrolled UP, the top bar came back, and the pinned head covered its first card by 36 px (`lib/pin-landing.ts`).
 *
 * A PROPERTY, measured after each open: the head rests directly under the pinned Find · Build · Booked row (±2 px),
 * and the first thing in the category's body starts at or below the head's bottom.
 *
 * Labs only — production builds 404 `/dev/*`, so this runs against a dev server:
 *   E2E_LABS=1 E2E_BASE_URL=http://localhost:3000 pnpm test:e2e an-opened-category-never-covers-its-card
 * (with NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=true — the one-screen page is behind it). WebKit (iOS Safari's engine,
 * where the owner saw it) was walked by hand with the same measurement: add `--browser=webkit` via a project.
 * CI's mechanism guard is `lib/an-opened-category-never-covers-its-card.test.ts`.
 */

const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const STATES = ['', 'planned=1', 'empty=1', 'covers=1'];

async function settle(page: Page) {
  let last = -1;
  for (let same = 0, i = 0; i < 80 && same < 6; i += 1) {
    await page.waitForTimeout(100);
    const y = await page.evaluate(() => window.scrollY);
    same = y === last ? same + 1 : 0;
    last = y;
  }
  await page.waitForTimeout(450); // the bar's .3s slide and the head's .3s `top`
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const stick = document.querySelector('[data-suppliers-stick]');
    const row = document.querySelector('.slcat .cat.open');
    const head = row?.querySelector(':scope > .cat-head-row');
    const first = [...(row?.querySelectorAll('.cat-body *') ?? [])].find((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 4 && r.width > 4 && getComputedStyle(el).visibility !== 'hidden';
    });
    if (!stick || !head) return null;
    return {
      pinnedBottom: stick.getBoundingClientRect().bottom,
      headTop: head.getBoundingClientRect().top,
      headBottom: head.getBoundingClientRect().bottom,
      firstTop: first ? first.getBoundingClientRect().top : null,
    };
  });
}

for (const state of STATES) {
  for (const size of SIZES) {
    test(`an opened category sits under the pinned row, its card uncovered — ${state || 'default'} @ ${size.width}`, async ({ page }) => {
      test.skip(process.env.E2E_LABS !== '1', 'labs need a dev server: E2E_LABS=1 against `next dev` with the lab env');
      test.setTimeout(90_000);
      await page.setViewportSize(size);
      await page.goto(`/dev/suppliers-lab${state ? `?${state}` : ''}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.slcat .cat[data-tile]');
      const tiles = await page.$$eval('.slcat .cat[data-tile]', (els) => els.map((e) => e.getAttribute('data-tile')!));
      expect(tiles.length, 'the lab drew no categories').toBeGreaterThan(1);
      // Down the list, far down, then back UP — the up landing is the one that brought the bar back over the card.
      const plan = [...new Set([tiles[1], tiles[Math.min(tiles.length - 2, 5)], tiles[2], tiles[0]].filter(Boolean))];
      for (const tile of plan) {
        const button = page.locator(`.slcat .cat[data-tile="${tile}"] > .cat-head-row button`).first();
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await settle(page);
        const m = await measure(page);
        expect(m, `${tile}: nothing opened`).not.toBeNull();
        expect(Math.abs(m!.headTop - m!.pinnedBottom), `${tile}: the head is not right under the pinned row`).toBeLessThanOrEqual(2);
        if (m!.firstTop != null)
          expect(m!.firstTop, `${tile}: the head covers its own first card`).toBeGreaterThanOrEqual(m!.headBottom - 1);
      }
    });
  }
}
