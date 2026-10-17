import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * 📱 THE COLOUR SHEET FITS ONE PHONE SCREEN — NO SCROLL (owner 2026-10-17, on the Attire › Shirt sheet, verbatim:
 * *"maybe there is a better way to arrange this scroll free. so color code box can be viewed easily. Just have the
 * Moodboard and Recently Used 5 colors."*), measured in the rendered page.
 *
 * It scrolled through five Mood Board rows, five "Goes with" rows, sixteen swatches and only then the code field. A
 * source-reading guard can say the shelves are gone; only the drawn sheet can say it FITS. So this renders the REAL
 * picker body (`ColourPickerBody`) with five Mood Board colours and five recently used, inside BOTH frames it opens
 * in — the new Maker's bottom sheet (`MakerSheet`, max 62% of the screen) and the centred panel (`StudioPopup`, 80%) —
 * for every caller shape that ships plus all of them at once, loads it under the app's own compiled CSS at 375 × 812
 * and 390 × 844, and reads:
 *   • the sheet's scroll box does not scroll (its content is no taller than the box) — the property the owner asked for;
 *   • the whole sheet stands inside the screen, and Custom's code field and ✓ Use are on screen, unscrolled;
 *   • Your Mood Board and Recently used are each ONE row of five, every dot a ≥ 44 px target;
 *   • no Swatches, no "Goes with your Mood Board", no "From your photos" in the drawn sheet.
 * Set `SHOTS_DIR` to keep a 375 picture of each.
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: the typed-name matches (they open under the field as you type — the keyboard is up then
 * and the list is brought into view, `scrollIntoView`); a caller whose own quiet row is tall (the Mood Board's swatch,
 * `swatch-popover.tsx`, still adds its search-by-name block); WebKit (this suite is Chromium).
 *
 * 🛡 Sabotaged (2026-10-17), each red alone: the sixteen swatches put back under Recently used → the scroll box
 * scrolls in the Maker sheet; the Mood Board drawn as a column of rows again → scrolls + "not one row"; a sixth recent
 * colour let through (`RECENT_SHOWN` 6) → "not five".
 */

const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const RENDER = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-colour-sheet-fits-one-screen.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as { five: string[]; recent: string[]; pages: Record<string, string> };

type Shell = { sheets: string[]; htmlClass: string; bodyClass: string };
let shell: Shell | null = null;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/');
  shell = await page.evaluate(() => ({
    sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => (l as HTMLLinkElement).href),
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
  }));
  await page.close();
  expect(shell.sheets.length, 'no stylesheet on / — the harness would measure unstyled markup').toBeGreaterThan(0);
});

async function mount(page: Page, body: string) {
  const { sheets, htmlClass, bodyClass } = shell!;
  await page.goto('/api/health');
  const origin = new URL(page.url()).origin;
  await page.setContent(
    `<!doctype html><html class="${htmlClass}"><head><base href="${origin}/">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
      sheets.map((s) => `<link rel="stylesheet" href="${s}">`).join('') +
      `</head><body class="${bodyClass}">${body}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.evaluate(() => document.fonts.ready);
  const styled = await page.$eval('[role="dialog"]', (el) => getComputedStyle(el).display);
  expect(styled, 'the global stylesheet did not load — every measurement would be of unstyled markup').toBe('flex');
}

const SHOTS = process.env.SHOTS_DIR;

for (const [w, h] of [
  [375, 812],
  [390, 844],
] as const) {
  for (const key of Object.keys(RENDER.pages)) {
    test(`${w}×${h} · ${key}: the colour sheet fits — no scroll, Custom on screen, one row of five each`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mount(page, RENDER.pages[key]!);
      const m = await page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
        const box = dialog.querySelector<HTMLElement>('.overflow-y-auto')!;
        const rect = (el: Element | null) => {
          const r = el?.getBoundingClientRect();
          return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height } : null;
        };
        const dots = (sel: string) => [...document.querySelectorAll(`${sel} > button`)].map((b) => rect(b)!);
        return {
          vh: window.innerHeight,
          vw: window.innerWidth,
          scroll: box.scrollHeight,
          client: box.clientHeight,
          dialog: rect(dialog)!,
          box: rect(box)!,
          custom: rect(document.querySelector('[data-picker-custom]')),
          code: rect(document.querySelector('[data-picker-custom] input[type="text"]')),
          use: rect(document.querySelector('[data-picker-custom] button')),
          board: dots('[data-picker-palette]'),
          recent: dots('[data-picker-recent]'),
          gone: [...document.querySelectorAll('[data-picker-swatches], [data-picker-goes-with], [data-picker-from-photos]')].length,
          words: document.body.innerText,
        };
      });
      // Anti-vacuity: the sheet drew its two colour rows, five each, and the Custom row.
      expect(m.board.length, 'Your Mood Board did not draw five').toBe(5);
      expect(m.recent.length, 'Recently used did not draw five').toBe(5);
      expect(m.custom, 'Custom is missing').not.toBeNull();
      // THE PROPERTY: nothing to scroll.
      expect(m.scroll, `the sheet scrolls: ${m.scroll}px of content in a ${m.client}px box`).toBeLessThanOrEqual(m.client + 1);
      expect(m.dialog.top, 'the sheet is taller than the screen').toBeGreaterThanOrEqual(0);
      expect(m.dialog.bottom).toBeLessThanOrEqual(m.vh + 1);
      // Custom's code field and ✓ Use are on screen, inside the box, unscrolled.
      for (const [name, r] of [
        ['Custom', m.custom],
        ['the code field', m.code],
        ['✓ Use', m.use],
      ] as const) {
        expect(r, `${name} is missing`).not.toBeNull();
        expect(r!.bottom, `${name} is below the sheet's box`).toBeLessThanOrEqual(m.box.bottom + 1);
        expect(r!.right, `${name} runs off the screen`).toBeLessThanOrEqual(m.vw + 1);
      }
      // One row of five each, every dot a thumb's target.
      for (const [name, row] of [
        ['Your Mood Board', m.board],
        ['Recently used', m.recent],
      ] as const) {
        const tops = new Set(row.map((r) => Math.round(r.top)));
        expect(tops.size, `${name} is not one row`).toBe(1);
        for (const r of row) {
          expect(r.h, `a ${name} dot is shorter than 44 px`).toBeGreaterThanOrEqual(44);
          expect(r.w, `a ${name} dot is narrower than 44 px`).toBeGreaterThanOrEqual(44);
        }
      }
      // The shelves the owner took away are not drawn.
      expect(m.gone, 'a removed shelf is drawn').toBe(0);
      expect(m.words).not.toMatch(/Swatches|Goes with your Mood Board|From your photos/i);
      expect(m.words).toMatch(/Your Mood Board[\s\S]*Recently used[\s\S]*Custom/i);
      if (SHOTS && w === 375) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: join(SHOTS, `${key.replace(':', '-')}-375.png`) });
      }
    });
  }
}
