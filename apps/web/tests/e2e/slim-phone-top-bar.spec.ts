import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * THE PHONE'S TOP BAR IS ONE SLIM ROW — measured, not read from the source.
 *
 * Owner, 2026-10-03, on the phone, over the signed-in bar (☰ · logo · a wide
 * Search field · chat · bell · an avatar pill with a chevron): *"on mobile.
 * this row takes so much space on all pages."* Rule 13 of the 2026-10-02 live
 * phone test: one row, the visible viewport, room to work.
 *
 * 🔑 WHY A BROWSER AND NOT A SOURCE GUARD. Every part of this is layout: a
 * height, a square, a box that is invisible until it is tapped. The shipped
 * defects in this exact bar were all of that kind — a 40×44 ELLIPSE from
 * globals' `button { min-height: 44px }`, a bar 7px taller than its own token —
 * and each class involved was valid. So this renders the REAL bar
 * (`slim-phone-top-bar.render.ts`: `FrontDoorShell` with the event tree's real
 * cluster and the real search) under the app's own compiled CSS and measures:
 *
 *   at 390 × 844 and 375 × 812
 *   • ONE ROW — every control's centre on one line; the bar ≤ 52px
 *   • NO SEARCH FIELD until tapped — the palette is a button with no input;
 *     the Guest list's input is invisible until a tap focuses it, then spans
 *     the bar
 *   • THE AVATAR HAS NO CHEVRON and no pill border
 *   • EVERY ROUND CONTROL IS A SQUARE ≥ 44px (☰ · search · chat · bell · avatar)
 *   at 1280 — the desktop bar is unchanged (61px, the chevron still there)
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: the notch. `env(safe-area-inset-top)` is 0 in
 * headless Chromium, so the inset is in the stylesheet but not measured here.
 */

const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const BARS = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'slim-phone-top-bar.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
  }),
) as { event: string; guests: string; board: string; shop: string; hq: string };

type Shell = { sheets: string[]; htmlClass: string; bodyClass: string };
let shell: Shell | null = null;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  // `/` is the front door: it carries the compiled global sheet AND front-door.css.
  await page.goto('/');
  shell = await page.evaluate(() => ({
    sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => (l as HTMLLinkElement).href),
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
  }));
  await page.close();
  expect(shell.sheets.length, 'no stylesheet on / — the harness would measure unstyled markup').toBeGreaterThan(0);
});

async function mount(page: Page, html: string) {
  const { sheets, htmlClass, bodyClass } = shell!;
  await page.goto('/api/health');
  const origin = new URL(page.url()).origin;
  await page.setContent(
    `<!doctype html><html class="${htmlClass}"><head><base href="${origin}/">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
      sheets.map((s) => `<link rel="stylesheet" href="${s}">`).join('') +
      `</head><body class="${bodyClass}">${html}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.evaluate(() => document.fonts.ready);
  // The precondition every number below depends on: the bar's sheet loaded.
  const styled = await page.$eval('.fd-topwrap', (el) => getComputedStyle(el).position);
  expect(styled, 'front-door.css did not load — every measurement would be of unstyled markup').toBe('sticky');
}

type Box = { name: string; w: number; h: number; cy: number; radius: number; border: number; shown: boolean };

/** The five round controls, measured. */
async function controls(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const pick: Array<[string, string]> = [
      ['menu', '.fd-topbar button[aria-label="Menu"]'],
      ['search', '.fd-searchwrap > button, .fd-searchwrap [data-guests-top-search]'],
      ['chat', '.fd-topright a[href$="/messages"]'],
      ['bell', '.fd-topright a[href="/dashboard/notifications"]'],
      ['avatar', '.fd-topright .fd-acct'],
    ];
    return pick.map(([name, sel]) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return { name, w: 0, h: 0, cy: 0, radius: 0, border: 0, shown: false };
      const r = el.getBoundingClientRect();
      // A [data-guests-top-search] wrapper paints nothing; its glass box does.
      const painted = (el.querySelector(':scope > .sn-tile-glass') as HTMLElement | null) ?? el;
      const cs = getComputedStyle(painted);
      return {
        name,
        w: r.width,
        h: r.height,
        cy: r.top + r.height / 2,
        radius: parseFloat(cs.borderTopLeftRadius),
        border: parseFloat(cs.borderTopWidth),
        shown: getComputedStyle(el).display !== 'none' && r.width > 0,
      };
    });
  });
}

for (const [w, hgt] of [
  [390, 844],
  [375, 812],
] as const) {
  for (const place of ['event', 'guests'] as const) {
    test(`phone top bar · ${place} · ${w}px — one slim row of square 44px controls`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: hgt });
      await mount(page, BARS[place]);

      const bar = await page.$eval('.fd-topwrap', (el) => el.getBoundingClientRect().height);
      expect(bar, `the bar is ${bar}px tall`).toBeLessThanOrEqual(52);

      const boxes = await controls(page);
      for (const b of boxes) {
        expect(b.shown, `${b.name} is not on the bar`).toBe(true);
        expect(Math.min(b.w, b.h), `${b.name} is ${b.w}×${b.h} — under the 44px tap target`).toBeGreaterThanOrEqual(44);
        expect(Math.abs(b.w - b.h), `${b.name} is ${b.w}×${b.h} — an ellipse, not a circle`).toBeLessThanOrEqual(0.5);
      }
      // One row: every control sits on the same centre line.
      const cys = boxes.map((b) => b.cy);
      expect(Math.max(...cys) - Math.min(...cys), `centres ${cys.join(' / ')}`).toBeLessThanOrEqual(1);
      // Round: the drawn search circle and the bar's own icons.
      const search = boxes.find((b) => b.name === 'search')!;
      expect(search.radius, 'the search icon is not round').toBeGreaterThanOrEqual(22);

      // The avatar: a plain round photo — no chevron, no pill border, no name.
      const avatar = await page.$eval('.fd-topright .fd-acct', (el) => ({
        chevron: [...el.querySelectorAll('svg')].some((s) => s.getBoundingClientRect().width > 0),
        border: parseFloat(getComputedStyle(el).borderTopWidth),
        text: [...el.querySelectorAll(':scope > span + span')].some((s) => s.getBoundingClientRect().width > 0),
      }));
      expect(avatar, 'the avatar still wears its pill').toEqual({ chevron: false, border: 0, text: false });

      // No visible search field until it is tapped.
      const fields = await page.$$eval('.fd-topbar input', (els) =>
        els.map((i) => {
          const r = i.getBoundingClientRect();
          return r.width > 0 && Number(getComputedStyle(i).opacity) > 0.01;
        }),
      );
      expect(fields.filter(Boolean), 'a search field is visible before anyone tapped').toEqual([]);

      await page.screenshot({ path: `test-results/slim-phone-top-bar-${place}-${w}.png`, clip: { x: 0, y: 0, width: w, height: 120 } });
    });
  }

  test(`phone top bar · guests · ${w}px — a tap opens the SAME box over the whole bar`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: hgt });
    await mount(page, BARS.guests);
    await page.click('.fd-searchwrap [data-guests-top-search]');
    const open = await page.evaluate(() => {
      const input = document.querySelector('.fd-topbar input') as HTMLInputElement;
      const box = document.querySelector('[data-guests-top-search]')!.getBoundingClientRect();
      return {
        focused: document.activeElement === input,
        visible: Number(getComputedStyle(input).opacity) > 0.99,
        width: box.width,
        fontSize: parseFloat(getComputedStyle(input).fontSize),
        inputs: document.querySelectorAll('.fd-topbar input').length,
      };
    });
    expect(open.focused, 'the tap did not land in the search field').toBe(true);
    expect(open.visible, 'the field stayed invisible after the tap').toBe(true);
    expect(open.width, `the opened box is ${open.width}px of a ${w}px bar`).toBeGreaterThanOrEqual(w - 2);
    // Below 16px iOS zooms the whole page on focus.
    expect(open.fontSize).toBeGreaterThanOrEqual(16);
    // The same search, not a second one.
    expect(open.inputs).toBe(1);
  });
}

/*
  THE OTHER THREE TREES. Each hands the bar its OWN cluster, so the event
  tree's pass says nothing about them — measured at 375 before this was added,
  HQ's worst case ran 19px past the screen and squeezed its bell to a 27px
  ellipse. Here: nothing spills sideways, one row, and the round controls that
  tree has are true 44px circles.
*/
for (const w of [375, 360] as const) {
  for (const place of ['board', 'shop', 'hq'] as const) {
    test(`phone top bar · ${place} · ${w}px — one row, nothing past the edge`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await mount(page, BARS[place]);

      const bar = await page.$eval('.fd-topwrap', (el) => el.getBoundingClientRect().height);
      expect(bar, `the bar is ${bar}px tall`).toBeLessThanOrEqual(52);

      const row = await page.evaluate(() => {
        const shown = [...document.querySelectorAll<HTMLElement>('.fd-topbar a, .fd-topbar button')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && !el.closest('[role="dialog"]');
        });
        const boxes = shown.map((el) => el.getBoundingClientRect());
        const cys = boxes.map((r) => r.top + r.height / 2);
        return {
          count: shown.length,
          right: Math.max(...boxes.map((r) => r.right)),
          page: document.documentElement.scrollWidth,
          spread: Math.max(...cys) - Math.min(...cys),
          round: [...document.querySelectorAll<HTMLElement>('.fd-topbar button[aria-label="Menu"], .fd-topright .fd-round, .fd-topright .fd-acct')].map(
            (el) => {
              const r = el.getBoundingClientRect();
              return `${Math.round(r.width)}×${Math.round(r.height)}`;
            },
          ),
        };
      });
      expect(row.count, 'no controls on the bar — the harness measured nothing').toBeGreaterThanOrEqual(3);
      expect(row.page, `the page is ${row.page}px wide on a ${w}px screen`).toBeLessThanOrEqual(w);
      expect(row.right, `a control ends at ${row.right}px of ${w}`).toBeLessThanOrEqual(w);
      expect(row.spread, 'the bar broke onto a second row').toBeLessThanOrEqual(1);
      // ☰ · bell · avatar, all square 44s — never squeezed by a crowded row.
      expect(row.round.length).toBe(3);
      for (const size of row.round) expect(size, `a round control is ${size}`).toBe('44×44');

      await page.screenshot({ path: `test-results/slim-phone-top-bar-${place}-${w}.png`, clip: { x: 0, y: 0, width: w, height: 120 } });
    });
  }
}

test('desktop top bar · 1280px — unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mount(page, BARS.event);
  const bar = await page.$eval('.fd-topwrap', (el) => el.getBoundingClientRect().height);
  expect(Math.abs(bar - 61), `the desktop bar is ${bar}px, not 61`).toBeLessThanOrEqual(1);
  const chevron = await page.$eval('.fd-topright .fd-acct svg', (s) => s.getBoundingClientRect().width);
  expect(chevron, 'the desktop account pill lost its chevron').toBeGreaterThan(0);
  const search = await page.$eval('.fd-searchwrap > button', (b) => b.getBoundingClientRect().width);
  expect(search, 'the desktop search collapsed').toBeGreaterThan(300);
});
