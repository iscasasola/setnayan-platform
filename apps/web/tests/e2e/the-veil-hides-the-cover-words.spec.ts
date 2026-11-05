import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * BEHIND THE VEIL, NONE OF THE COVER'S WORDS SHOW — AND AFTER THE UNVEIL EVERY LINE ENTERS (owner 2026-10-16,
 * DECISION_LOG "BEHIND THE VEIL, NONE OF THE COVER'S WORDS SHOW"), measured in the rendered page.
 *
 * Live on cale-ice, veil closed: the date and the venue showed through the fabric, with the mark's two hairlines —
 * they had no Build in, so nothing held them back. Every unit test of the day passed: none of them drew the page.
 *
 * So this renders the REAL guest page (`SiteBody`, the fixture invitation, its names carrying a Build in of their own),
 * loads it under the app's own compiled CSS with the hold's own inline script in `<head>` (`VEIL_HOLD_SCRIPT` — what
 * `RevealMount` writes wherever an opening is mounted), and reads every cover line's DRAWN opacity (its own times its
 * ancestors') and visibility:
 *   • veil closed — every line of the cover (`[data-cover-line]`) draws nothing, a second and a half in (long after any
 *     entrance would have finished), with no ground and over a ground;
 *   • the unveil (`__veilRelease`, what the tap and the swipe up call) — the lines ENTER: a line with no Build in is
 *     still faint just after (an entrance, not a pop), the later lines start later (reading order), and every one is
 *     fully drawn once the entrances end — the line with its own Build in, and the lines without one;
 *   • reduced motion — no hold at all: every line is there at once;
 *   • no veil — today's cover, byte for byte in behaviour: a line with no Build in is drawn at once.
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: the veil's own gesture (WebGL — held in `reveal/the-veil-opens-on-a-tap.test.ts`), and
 * WebKit (this suite is Chromium; the walk that shipped it measured both).
 */

const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const RENDER = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-veil-hides-the-cover-words.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as { pages: Record<string, string>; hold: string };

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

async function mount(page: Page, body: string, veiled: boolean) {
  const { sheets, htmlClass, bodyClass } = shell!;
  await page.goto('/api/health');
  const origin = new URL(page.url()).origin;
  await page.setContent(
    `<!doctype html><html class="${htmlClass}"><head><base href="${origin}/">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
      (veiled ? `<script>${RENDER.hold}</script>` : '') +
      sheets.map((s) => `<link rel="stylesheet" href="${s}">`).join('') +
      `</head><body class="${bodyClass}"><main><div data-page-column="">${body}</div></main></body></html>`,
    { waitUntil: 'load' },
  );
  await page.evaluate(() => document.fonts.ready);
  const styled = await page.$eval('header[data-pahina-first-screen]', (el) => getComputedStyle(el).display);
  expect(styled, 'the global stylesheet did not load — every measurement would be of unstyled markup').toBe('flex');
}

type Line = { own: boolean; tag: string; drawn: number; visible: boolean; delay: number };

/** Every cover line: is it the one with its own Build in, how much of it is DRAWN (its opacity × its ancestors'). */
async function lines(page: Page): Promise<Line[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('header[data-pahina-first-screen] [data-cover-line]')).map((el) => {
      let drawn = 1;
      for (let n: HTMLElement | null = el; n; n = n.parentElement) drawn *= Number(getComputedStyle(n).opacity);
      const cs = getComputedStyle(el);
      return {
        own: el.getAttribute('data-cover-line') === 'own',
        tag: el.tagName.toLowerCase() + (el.textContent ?? '').trim().slice(0, 18),
        drawn,
        visible: cs.visibility !== 'hidden' && cs.display !== 'none',
        delay: parseFloat(cs.animationDelay) || 0,
      };
    }),
  );
}

for (const [w, h] of [
  [375, 812],
  [390, 844],
] as const) {
  for (const ground of ['plain', 'ground']) {
    test(`${w}×${h} · ${ground}: behind the veil no cover line is drawn; after the unveil every line enters`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await mount(page, RENDER.pages[ground]!, true);
      await page.waitForTimeout(1500);
      const held = await lines(page);
      // Anti-vacuity: the cover has its lines, one with a Build in of its own and several without.
      expect(held.length, 'the cover lost its line marks — nothing below would be measured').toBeGreaterThanOrEqual(6);
      expect(held.filter((l) => l.own).length, 'no line with its own Build in on the fixture cover').toBeGreaterThanOrEqual(1);
      expect(held.filter((l) => !l.own).length, 'no line without a Build in on the fixture cover').toBeGreaterThanOrEqual(4);
      for (const l of held) expect(l.drawn, `behind the veil "${l.tag}" is drawn (opacity ${l.drawn})`).toBe(0);

      await page.evaluate(() => (window as unknown as { __veilRelease: () => void }).__veilRelease());
      await page.waitForTimeout(80);
      const entering = await lines(page);
      const plain = entering.filter((l) => !l.own);
      // An ENTRANCE, not a pop: just after the unveil the first default line is still faint…
      expect(plain[0]!.drawn, `"${plain[0]!.tag}" popped in instead of entering (${plain[0]!.drawn} at 80 ms)`).toBeLessThan(0.5);
      // …and the lines enter one after another, in reading order.
      for (let i = 1; i < plain.length; i++) {
        expect(plain[i]!.delay, `"${plain[i]!.tag}" does not enter after "${plain[i - 1]!.tag}"`).toBeGreaterThan(plain[i - 1]!.delay);
      }

      await page.waitForTimeout(3000);
      for (const l of await lines(page)) {
        expect(l.visible, `after the unveil "${l.tag}" is hidden`).toBe(true);
        expect(l.drawn, `after the unveil "${l.tag}" never fully entered (opacity ${l.drawn})`).toBeGreaterThan(0.99);
      }
    });
  }

  test(`${w}×${h}: reduced motion — no hold, every line is there at once`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: w, height: h });
    await mount(page, RENDER.pages.plain!, true);
    for (const l of await lines(page)) {
      expect(l.drawn, `under reduced motion "${l.tag}" is not drawn at once`).toBeGreaterThan(0.99);
    }
  });

  test(`${w}×${h}: no veil — a line with no Build in is drawn at once, as today`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await mount(page, RENDER.pages.plain!, false);
    expect(await page.$('style[data-veil-words]'), 'a page with no veil carries the veil’s marker').toBeNull();
    for (const l of (await lines(page)).filter((x) => !x.own)) {
      expect(l.drawn, `with no veil "${l.tag}" is held back`).toBeGreaterThan(0.99);
    }
  });
}
