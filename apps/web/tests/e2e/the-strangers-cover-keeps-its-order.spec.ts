import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * THE STRANGER'S COVER KEEPS ITS ORDER, AND NOTHING ON IT OVERLAPS — measured, on the real markup under the app's CSS.
 *
 * Live, 2026-10-15, right after Batch 8 (`/maria-and-jose`, signed out, 375 × 812): the cover's words regrouped while
 * a first-screen fit made room for the door under the cover. Since 2026-10-17 (owner, on `/cale-ice`: *"the button
 * shows after the cover?"*) the stranger's ONE door — "Confirm your Booking" — stands IN the cover's foot, where a
 * guest's RSVP button stands, with the "Swipe up" hint under it. Since 2026-10-18 the foot is FITTED on a phone the
 * text cover is taller than (`FirstScreenDoor foot`): the air closes, the mark shrinks, and only then whole parts move
 * below the whole foot — so the door is on the first screen at 375 × 667 and above the notice too.
 *
 * So this renders the REAL stranger's page (`SiteBody`, the fixture invitation — Maria & Jose) under the app's own
 * compiled CSS, mounts the REAL `FirstScreenDoor` as the page does, and measures, at 375 × 812, 390 × 844 and
 * 375 × 667, with and without the first-visit cookie notice, with no ground and with a Full / Framed ground:
 *   • the cover's parts stand in the order the page writes them — eyebrow · mark · names · line · date · time · link —
 *     then the door, then the hint, then whatever the fit moved below the foot, in that same order; the names never move;
 *   • no two of them overlap (each box ≥ 2px clear of the next);
 *   • nothing is cut off the top; the names and the date are on the first screen;
 *   • the door is in the cover's own foot and ON THE FIRST SCREEN at every size, notice up or not — clear of the
 *     screen's edge by 16 px, or of the notice by 8 px (the measured gap of 2026-10-17 at 375 × 667, closed 2026-10-18);
 *   • a screen the cover already fits (812 / 844, no notice) is drawn as written: nothing is moved.
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: the couple's own logo image, and WebKit (this suite is Chromium; the 2026-10-18 walk
 * measured both engines).
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
async function parts(page: Page): Promise<{ parts: Part[]; door: Part; hint: Part; inFoot: boolean; vh: number }> {
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
    for (const el of Array.from(header.children)) if (!el.contains(inner) && !el.matches('[data-cover-foot]') && el.querySelector('a[href]')) box('link', el);
    const d = document.querySelector('details[data-get-inside]')!.getBoundingClientRect();
    const hint = document.querySelector('[data-cover-hint]')!.getBoundingClientRect();
    const inFoot = Boolean(document.querySelector('header[data-pahina-first-screen] [data-cover-foot] details[data-get-inside]'));
    return { parts: out, door: { key: 'door', top: d.top, bottom: d.bottom }, hint: { key: 'hint', top: hint.top, bottom: hint.bottom }, inFoot, vh: window.innerHeight };
  });
}

for (const [w, h] of [
  [375, 812],
  [390, 844],
  /* 📱 A short phone (iPhone SE / 8 — Batch 9 walk R4, 2026-10-16): nothing may be cut off the top. */
  [375, 667],
  /* 📱 …and the smallest (iPhone SE 1st gen): the fit's last step — whole parts below the foot — runs here. */
  [320, 568],
] as const) {
  for (const ground of ['plain', 'full', 'framed']) {
    for (const banner of [0, 133]) {
      test(`${w}×${h} · ${ground} · ${banner ? 'cookie notice up' : 'no notice'}: the cover keeps its order, nothing overlaps, the door is in its foot`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await mount(page, RENDER.pages[ground]!, banner);
        const { parts: written, door, hint, inFoot, vh } = await parts(page);
        const keys = written.map((p) => p.key);
        expect(keys.slice(0, 7), 'anti-vacuity: the fixture cover lost a part').toEqual(
          expect.arrayContaining(['eyebrow', 'mark', 'names', 'line', 'date', 'time']),
        );
        expect(inFoot, 'the stranger’s door is not in the cover’s foot').toBe(true);
        // The order: the parts kept as the page writes them, the door, the hint, then the parts the fit moved below the
        // foot — in that same order. The names never move.
        const kept = written.filter((p) => p.top < door.top);
        const given = written.filter((p) => p.top >= door.top);
        expect(given.map((p) => p.key), 'the names gave way').not.toContain('names');
        // A screen the cover fits is drawn as written — nothing moved.
        if (!banner && h >= 812) expect(given, 'a part moved on a screen the cover fits').toEqual([]);
        const drawn = [...kept, door, hint, ...given];
        expect([...drawn].sort((a, b) => a.top - b.top).map((p) => p.key), 'the cover is out of the written order').toEqual(drawn.map((p) => p.key));
        // Nothing is cut off the TOP of the screen: the first part the page writes starts on it (Batch 9 R4).
        expect(written[0]!.top, `"${written[0]!.key}" starts above the top of the screen (${written[0]!.top.toFixed(1)}px)`).toBeGreaterThanOrEqual(0);
        // Nothing overlaps: every box, door and hint included, ≥ 2px clear of the one drawn after it.
        for (let i = 1; i < drawn.length; i++) {
          const gap = drawn[i]!.top - drawn[i - 1]!.bottom;
          expect(gap, `"${drawn[i - 1]!.key}" and "${drawn[i]!.key}" overlap or touch (${gap.toFixed(1)}px)`).toBeGreaterThanOrEqual(2);
        }
        // The first screen: the names and the date — clear of the notice when it is up.
        const limit = vh - (banner ? banner + 8 : 0);
        for (const k of ['names', 'date']) {
          const p = written.find((x) => x.key === k)!;
          expect(p.bottom, `${k} is below the first screen`).toBeLessThanOrEqual(limit + 0.5);
        }
        // …and the door, on every phone, clear of the edge or of the notice (2026-10-18: the foot is fitted).
        const doorLimit = banner ? vh - banner - 8 : vh - 16;
        expect(door.bottom, `"Confirm your Booking" is below the first screen (${door.bottom.toFixed(1)} > ${doorLimit})`).toBeLessThanOrEqual(doorLimit + 0.5);
        await page.screenshot({ path: test.info().outputPath(`cover-${w}x${h}-${ground}-${banner ? 'notice' : 'clear'}.png`) });
      });
    }
  }
}
