import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { GIVE_WAY_ORDER } from '../../app/[slug]/_lib/first-screen-fit';

/**
 * THE STRANGER'S COVER KEEPS ITS ORDER, AND NOTHING ON IT OVERLAPS — measured, with the shipped fit running.
 *
 * Live, 2026-10-15, right after Batch 8 (`/maria-and-jose`, signed out, 375 × 812): the cover's words regrouped.
 * "TOGETHER WITH THEIR FAMILIES" ran into "Maria", the monogram was drawn BELOW everything at y 706–876 (half under
 * the fold), and "Guests arrive 2:30 PM" fell off the screen. Cause: the Cover Scene made the cover's header the
 * whole first screen on its own (`min-h` 100svh, words centred), so the stranger's "Get inside" — which follows the
 * header in the same first-screen block — was pushed below the fold, and the first-screen fit (`first-screen-door.tsx`
 * → `_lib/first-screen-fit.ts`) moved parts below the door and closed up air that the centring had already spent.
 * Every unit test passed: the static renders draw no fit, and the fit's own test runs on boxes, not on a page.
 *
 * So this renders the REAL stranger's page (`SiteBody`, the fixture invitation — Maria & Jose) under the app's own
 * compiled CSS, runs the REAL `FirstScreenDoor` on it (bundled by the renderer), and measures, at 375 × 812 and
 * 390 × 844, with and without the first-visit cookie notice, with no ground and with a Full / Framed ground:
 *   • the cover's parts stand in the order the page writes them — eyebrow · mark · names · line · date · time · link —
 *     except the ones the fit moved below "Get inside", which follow it in that same order; the names never move;
 *   • no two of them overlap (each box ≥ 2px clear of the next);
 *   • the names, the date and "Get inside" are on the first screen, the button above the notice when it is up.
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: the couple's own logo image (the fixture draws the lettered mark), and WebKit
 * (this suite is Chromium; the walk that shipped the fix measured both).
 */

const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const RENDER = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-strangers-cover-keeps-its-order.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as { pages: Record<string, string>; door: string };

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

/** The page as a stranger opens it: the cover's bars waiting (`CoverSceneMenuWaits`'s marker), the fit running. */
async function mount(page: Page, body: string, banner: number) {
  const { sheets, htmlClass, bodyClass } = shell!;
  await page.goto('/api/health');
  const origin = new URL(page.url()).origin;
  await page.setContent(
    `<!doctype html><html class="${htmlClass}"${banner ? ` style="--cookie-banner-top: ${banner}px"` : ''}><head><base href="${origin}/">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
      sheets.map((s) => `<link rel="stylesheet" href="${s}">`).join('') +
      `<style data-cover-menu="wait"></style></head><body class="${bodyClass}"><main><div data-page-column="">${body}</div></main></body></html>`,
    { waitUntil: 'load' },
  );
  await page.evaluate(() => document.fonts.ready);
  const styled = await page.$eval('header[data-pahina-first-screen]', (el) => getComputedStyle(el).display);
  expect(styled, 'the global stylesheet did not load — every measurement would be of unstyled markup').toBe('flex');
  await page.addScriptTag({ content: RENDER.door });
  // The fit runs in an effect, then again on the next frame when something it watches moves: let it settle.
  await page.waitForTimeout(600);
}

type Part = { key: string; top: number; bottom: number };

/** The cover's parts and the door, as drawn (fit included), in the order the page WRITES them. */
async function parts(page: Page): Promise<{ parts: Part[]; door: Part; vh: number }> {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('header[data-pahina-first-screen]')!;
    const inner = header.querySelector<HTMLElement>('[data-cover-frameless] > div')!;
    const out: { key: string; top: number; bottom: number }[] = [];
    let afterNames = false;
    let afterDate = false;
    const box = (key: string, el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) out.push({ key, top: r.top, bottom: r.bottom });
    };
    for (const el of Array.from(inner.children)) {
      if (el.matches('[data-motion="arrive-mark"]')) box('mark', el);
      else if (el.matches('h1')) {
        box('names', el);
        afterNames = true;
      } else if (el.matches('[data-motion="arrive-date"]')) {
        box('date', el);
        afterDate = true;
      } else box(!afterNames ? 'eyebrow' : !afterDate ? 'line' : 'time', el);
    }
    for (const el of Array.from(header.children)) if (!el.contains(inner) && el.querySelector('a[href]')) box('link', el);
    const d = document.querySelector('details[data-get-inside]')!.getBoundingClientRect();
    return { parts: out, door: { key: 'door', top: d.top, bottom: d.bottom }, vh: window.innerHeight };
  });
}

for (const [w, h] of [
  [375, 812],
  [390, 844],
] as const) {
  for (const ground of ['plain', 'full', 'framed']) {
    for (const banner of [0, 133]) {
      test(`${w}×${h} · ${ground} · ${banner ? 'cookie notice up' : 'no notice'}: the cover keeps its order, nothing overlaps, the door is on the first screen`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await mount(page, RENDER.pages[ground]!, banner);
        const { parts: written, door, vh } = await parts(page);
        const keys = written.map((p) => p.key);
        expect(keys.slice(0, 7), 'anti-vacuity: the fixture cover lost a part').toEqual(
          expect.arrayContaining(['eyebrow', 'mark', 'names', 'line', 'date', 'time']),
        );
        const above = written.filter((p) => p.top < door.top);
        const below = written.filter((p) => p.top >= door.top);
        // The order: what stands above the door is in the page's own order, and so is what the fit moved below it.
        expect([...above].sort((a, b) => a.top - b.top).map((p) => p.key), 'the parts above "Get inside" are out of the written order').toEqual(above.map((p) => p.key));
        expect([...below].sort((a, b) => a.top - b.top).map((p) => p.key), 'the parts moved below "Get inside" are out of the written order').toEqual(below.map((p) => p.key));
        expect(above.map((p) => p.key), 'the names left the first screen group (they never give way)').toContain('names');
        // What moved below the door is the FEWEST the rule allows, in its order (`GIVE_WAY_ORDER`): a prefix of it.
        const present = GIVE_WAY_ORDER.filter((k) => keys.includes(k));
        expect(new Set(below.map((p) => p.key)), 'the fit moved parts below "Get inside" out of its give-way order').toEqual(new Set(present.slice(0, below.length)));
        if (!banner) {
          // 🔒 The approved first screen (live before Batch 8): eyebrow → mark → names → line → date → time → Get inside.
          // On a phone with no notice up, nothing of it moves below the door (only the link down may).
          expect(below.map((p) => p.key).filter((k) => k !== 'link'), 'on a clear phone screen the cover gave parts away below "Get inside" — the approved order is broken').toEqual([]);
        }
        // Nothing overlaps: every box, door included, ≥ 2px clear of the one drawn after it.
        const drawn = [...written, door].sort((a, b) => a.top - b.top);
        for (let i = 1; i < drawn.length; i++) {
          const gap = drawn[i]!.top - drawn[i - 1]!.bottom;
          expect(gap, `"${drawn[i - 1]!.key}" and "${drawn[i]!.key}" overlap or touch (${gap.toFixed(1)}px)`).toBeGreaterThanOrEqual(2);
        }
        // The first screen: the names, the date and the door — the door clear of the notice when it is up.
        const limit = vh - (banner ? banner + 8 : 0);
        for (const k of ['names', 'date']) {
          const p = written.find((x) => x.key === k)!;
          expect(p.bottom, `${k} is below the first screen`).toBeLessThanOrEqual(limit + 0.5);
        }
        expect(door.bottom, '"Get inside" is below the first screen (or under the cookie notice)').toBeLessThanOrEqual(limit + 0.5);
        await page.screenshot({ path: test.info().outputPath(`cover-${w}x${h}-${ground}-${banner ? 'notice' : 'clear'}.png`) });
      });
    }
  }
}
