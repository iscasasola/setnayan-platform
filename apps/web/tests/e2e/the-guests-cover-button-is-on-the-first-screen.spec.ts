import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * THE GUEST'S REPLY BUTTON IS WHOLLY ON THE FIRST SCREEN — measured, on the real markup under the app's CSS.
 *
 * Owner, 2026-10-20 (DECISION_LOG "THE COVER'S REPLY BUTTON HAS THREE STATES"), verbatim: *"lift the button so it's
 * fully visible on first open."* Measured live that day on maria-and-jose (iPhone 13, WebKit): the cover's header was
 * 745 px tall in a 664-px screen and the button's box stood at y 644–688 — 24 px of it below the fold. The stranger's
 * door in the same foot had been fitted on 2026-10-18 (`FirstScreenDoor foot`); the guest's button was not.
 *
 * So this renders the REAL guest page (`SiteBody`, the fixture invitation) in each state the button draws — not replied,
 * coming and complete, coming with 2 answers owed — mounts the REAL fit as the cover does (`FirstScreenDoor foot rsvp`),
 * and measures at 375 × 667 (iPhone SE), 390 × 664 (iPhone 13 in Playwright, Safari's bars up), 430 × 739 (a Pro Max
 * with Safari's bars up) and 375 × 812, with and without the first-visit cookie notice, on no ground and a Full ground:
 *   • the whole button is on the first screen — its top ≥ 0, its bottom ≤ the screen less 16 px (or the notice's top
 *     less 8 px while it is up);
 *   • the button says its state ("Confirm attendance" · "You're coming ✓ · Change" · "You're coming ✓ · 2 more answers");
 *   • nothing on the cover overlaps the button or the next part (each box ≥ 2 px clear), the names never move, and the
 *     names and the date stay on the first screen;
 *   • a screen the cover already fits (375 × 812, no notice) is drawn as written: nothing is moved.
 *
 * 📷 And a PHOTO cover (a hero photo under the date, no Cover Scene ground), where the walk found the button 340–380 px
 * below the fold: the plate gives way below the whole foot, so the button is on the first screen and stands under the
 * date, and the plate is drawn below the hint.
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: WebKit (this suite is Chromium — the 2026-10-20 walk measured WebKit with Safari's
 * toolbar heights), a real device's safe area (Playwright reports none), and the couple's own logo image.
 */

const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const RENDER = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-guests-cover-button-is-on-the-first-screen.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
) as { pages: Record<string, string>; fit: string };

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

/** The page as a guest opens it: the cover's bars waiting (`CoverSceneMenuWaits`'s marker), the fit running. */
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
  await page.addScriptTag({ content: RENDER.fit });
  await page.waitForTimeout(600);
}

type Box = { key: string; top: number; bottom: number };

async function measure(page: Page) {
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
    const a = header.querySelector('[data-cover-foot] a[data-cover-rsvp]');
    const b = a?.getBoundingClientRect();
    const hint = document.querySelector('[data-cover-hint]')!.getBoundingClientRect();
    return {
      parts: out,
      button: b ? { key: 'button', top: b.top, bottom: b.bottom } : null,
      words: a ? (a.textContent ?? '').replace(/\s+/g, ' ').trim() : null,
      hint: { key: 'hint', top: hint.top, bottom: hint.bottom },
      vh: window.innerHeight,
    };
  });
}

const WORDS: Record<string, string> = {
  ask: 'Confirm attendance',
  going: 'You’re coming ✓ · Change',
  more: 'You’re coming ✓ · 2 more answers',
};

for (const [w, h] of [
  [375, 667],
  [390, 664],
  [430, 739],
  [375, 812],
] as const) {
  for (const ground of ['plain', 'full']) {
    for (const state of ['ask', 'going', 'more']) {
      for (const banner of [0, 133]) {
        test(`${w}×${h} · ${ground} · ${state} · ${banner ? 'notice up' : 'no notice'}: the guest’s reply button is wholly on the first screen`, async ({ page }) => {
          await page.setViewportSize({ width: w, height: h });
          await mount(page, RENDER.pages[`${ground}:${state}`]!, banner);
          const { parts, button, words, hint, vh } = await measure(page);
          expect(button, 'anti-vacuity: the guest’s cover has no reply button in its foot').not.toBeNull();
          expect(words, 'the button does not say its state').toBe(WORDS[state]);
          expect(parts.map((p) => p.key), 'anti-vacuity: the fixture cover lost a part').toEqual(expect.arrayContaining(['eyebrow', 'mark', 'names', 'date']));
          // THE WHOLE BUTTON, ON THE FIRST SCREEN.
          const limit = banner ? vh - banner - 8 : vh - 16;
          expect(button!.top, 'the button starts above the screen').toBeGreaterThanOrEqual(0);
          expect(button!.bottom, `the button is cut off (${button!.bottom.toFixed(1)} > ${limit})`).toBeLessThanOrEqual(limit + 0.5);
          // Nothing overlaps: the kept parts, the button, the hint, then what moved below — in order, ≥ 2 px apart.
          const kept = parts.filter((p) => p.top < button!.top);
          const given = parts.filter((p) => p.top >= button!.top);
          expect(given.map((p) => p.key), 'the names gave way').not.toContain('names');
          if (!banner && h >= 812) expect(given, 'a part moved on a screen the cover fits').toEqual([]);
          const drawn: Box[] = [...kept, button!, hint, ...given];
          for (let i = 1; i < drawn.length; i++) {
            const gap = drawn[i]!.top - drawn[i - 1]!.bottom;
            expect(gap, `"${drawn[i - 1]!.key}" and "${drawn[i]!.key}" overlap or touch (${gap.toFixed(1)}px)`).toBeGreaterThanOrEqual(2);
          }
          for (const k of ['names', 'date']) {
            const p = parts.find((x) => x.key === k)!;
            expect(p.top, `${k} is above the screen`).toBeGreaterThanOrEqual(0);
            expect(p.bottom, `${k} is below the first screen`).toBeLessThanOrEqual(limit + 0.5);
          }
          await page.screenshot({ path: test.info().outputPath(`guest-cover-${w}x${h}-${ground}-${state}-${banner ? 'notice' : 'clear'}.png`) });
        });
      }
    }
  }
}

for (const [w, h] of [
  [375, 667],
  [390, 664],
  [430, 739],
] as const) {
  for (const state of ['ask', 'going', 'more']) {
    for (const banner of [0, 133]) {
      test(`${w}×${h} · photo cover · ${state} · ${banner ? 'notice up' : 'no notice'}: the plate gives way, the button is on the first screen`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await mount(page, RENDER.pages[`photo:${state}`]!, banner);
        const m = await page.evaluate(() => {
          const header = document.querySelector<HTMLElement>('header[data-pahina-first-screen]')!;
          const r = (el: Element | null | undefined) => (el ? { top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom } : null);
          const a = header.querySelector('[data-cover-foot] a[data-cover-rsvp]');
          return {
            button: r(a),
            words: a ? (a.textContent ?? '').replace(/\s+/g, ' ').trim() : null,
            names: r(header.querySelector('h1')),
            date: r(header.querySelector('[data-motion="arrive-date"]')),
            plate: r(header.querySelector('figure')),
            mark: r(header.querySelector('[data-motion="arrive-mark"]')),
            hint: r(header.querySelector('[data-cover-hint]')),
            vh: window.innerHeight,
          };
        });
        expect(m.button, 'anti-vacuity: the photo cover has no reply button').not.toBeNull();
        expect(m.plate, 'anti-vacuity: the photo cover has no plate').not.toBeNull();
        expect(m.words).toBe(WORDS[state]);
        const limit = banner ? m.vh - banner - 8 : m.vh - 16;
        expect(m.button!.bottom, `the button is cut off (${m.button!.bottom.toFixed(1)} > ${limit})`).toBeLessThanOrEqual(limit + 0.5);
        expect(m.button!.top - m.date!.bottom, 'the button stands on the date').toBeGreaterThanOrEqual(2);
        expect(m.names!.top, 'the names are above the screen').toBeGreaterThanOrEqual(0);
        expect(m.plate!.top - m.hint!.bottom, 'the photo is drawn on the button or the hint').toBeGreaterThanOrEqual(2);
        // Only the photo gives way here: the mark stays above the names (the foot is the door's block, never a part).
        expect(m.mark, 'anti-vacuity: the photo cover has no mark').not.toBeNull();
        expect(m.names!.top - m.mark!.bottom, 'the mark gave way below the button — more than the photo moved').toBeGreaterThanOrEqual(2);
        await page.screenshot({ path: test.info().outputPath(`guest-photo-cover-${w}x${h}-${state}-${banner ? 'notice' : 'clear'}.png`) });
      });
    }
  }
}
