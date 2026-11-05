import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * A TAP ON THE COVER'S RSVP BUTTON REACHES THE RSVP PAGE — measured, on the real markup under the app's CSS.
 *
 * Owner 2026-10-26, verbatim: *"on rsvp when they get the invite link there is a button confirm attendance. instead of
 * jumping to will you join us? (REPLY) make it go directly to the RSVP Page."* The button used to take the reader to the
 * page's RSVP part (Me's "Will you join us? · Reply", or the card under the cover) with a glide — one more stop before
 * the form. Now it IS the door to the reply page (`inviteReplyPath`). This renders the REAL page for a guest with a key
 * and for the host on their own page (`SiteBody`, the fixture invitation, a full ground), TAPS the button at a phone
 * (375 × 812, touch) and a computer (1280 × 800), and measures that the browser went to the reply page — nothing laid
 * over the button's words stood between the finger and the link. The reply page itself is stubbed (it needs the
 * database); who it keeps is `replyEntry` / `readReplyIdentityForEvent`'s, held by their own tests.
 *
 * ⚠ NOT COVERED HERE: the veil and the kept drape (they need the live opening), and WebKit (this suite is Chromium).
 */

const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const RENDER = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-cover-rsvp-reaches-its-action.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as { pages: Record<string, string>; reply: string };

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
  await page.waitForTimeout(300);
}

for (const reader of ['guest', 'host'] as const) {
  for (const [w, h, touch] of [
    [375, 812, true],
    [1280, 800, false],
  ] as const) {
    test(`${reader} · ${w}×${h}: a tap on the cover's button lands on the RSVP page`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      const page = await ctx.newPage();
      await mount(page, RENDER.pages[reader]!);
      // The reply page needs the database: stub it, and record that the tap asked for it.
      let asked = '';
      await page.route(`**${RENDER.reply}`, (route) => {
        asked = new URL(route.request().url()).pathname;
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>reply</title><p data-stub-reply>reply</p>' });
      });
      const button = page.locator('header[data-pahina-first-screen] a[data-cover-rsvp]');
      await expect(button, 'anti-vacuity: no RSVP button on the cover').toHaveCount(1);
      await expect(button, 'the cover’s button is not the door to the reply page').toHaveAttribute('href', RENDER.reply);
      const box = (await button.boundingBox())!;
      if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForURL(`**${RENDER.reply}`, { timeout: 5000 });
      expect(asked, 'the tap did not reach the reply page').toBe(RENDER.reply);
      await expect(page.locator('[data-stub-reply]')).toHaveCount(1);
      await ctx.close();
    });
  }
}
