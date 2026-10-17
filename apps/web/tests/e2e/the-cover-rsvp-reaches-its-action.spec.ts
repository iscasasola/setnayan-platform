import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * A TAP ON THE COVER'S RSVP BUTTON REACHES ITS ACTION — measured, on the real markup under the app's CSS.
 *
 * Live on `/cale-ice`, 2026-10-17 (owner, as its host: *"confirm attendance is not doing anything?"* · *"it is not going
 * to the RSVP part?"*): the tap went to the reply page, which sends a reader with no guest pass straight back (307), so
 * the cover reloaded under the finger. Now the button takes the reader to the page's RSVP part — the Reply card under
 * the cover — with a glide (`CoverRsvpGoes`). This renders the REAL page for a guest with a key and for the host
 * (`SiteBody`, the fixture invitation, a full ground), mounts the REAL glide, TAPS the button at a phone (375 × 812,
 * touch) and a computer (1280 × 800), and measures: the address did not change page, the RSVP part is on the screen
 * clear of the top, the cover's button is gone above it, and the part holds its own way into the Reply.
 *
 * ⚠ NOT COVERED HERE: the veil and the kept drape (they need the live opening; walked in the lab,
 * `/dev/maker-lab/guest?veil=1` with `lab_kit=vintage` — the tap reached the link with `defaultPrevented` false), and
 * WebKit (this suite is Chromium; the walk used both).
 */

const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const RENDER = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-cover-rsvp-reaches-its-action.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as { pages: Record<string, string>; glide: string };

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
      `<style data-cover-menu="wait"></style></head><body class="${bodyClass}"><main><div data-page-column="">${body}</div></main></body></html>`,
    { waitUntil: 'load' },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: RENDER.glide });
  await page.waitForTimeout(300);
}

for (const reader of ['guest', 'host'] as const) {
  for (const [w, h, touch] of [
    [375, 812, true],
    [1280, 800, false],
  ] as const) {
    test(`${reader} · ${w}×${h}: a tap on the cover's button lands on the RSVP part`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      const page = await ctx.newPage();
      await mount(page, RENDER.pages[reader]!);
      const before = page.url();
      const button = page.locator('header[data-pahina-first-screen] a[data-cover-rsvp]');
      await expect(button, 'anti-vacuity: no RSVP button on the cover').toHaveCount(1);
      const box = (await button.boundingBox())!;
      if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1500);
      expect(page.url(), 'the tap left the page (or wrote an address)').toBe(before);
      const m = await page.evaluate(() => {
        const part = document.getElementById('site-reply')!;
        const r = part.getBoundingClientRect();
        const b = document.querySelector('header[data-pahina-first-screen] a[data-cover-rsvp]')!.getBoundingClientRect();
        return { top: r.top, vh: innerHeight, button: b.bottom, into: part.querySelector('a')?.getAttribute('href') ?? null };
      });
      expect(m.top, 'the RSVP part is not on the screen after the tap').toBeGreaterThanOrEqual(0);
      expect(m.top, 'the RSVP part is not near the top of the screen after the tap').toBeLessThan(m.vh / 2);
      expect(m.button, 'the cover’s button is still on the screen — the cover did not lift away').toBeLessThanOrEqual(0);
      expect(m.into, 'the RSVP part holds no way into the Reply').toMatch(/\/invite\/reply/);
      await page.screenshot({ path: test.info().outputPath(`rsvp-part-${reader}-${w}.png`) });
      await ctx.close();
    });
  }
}
