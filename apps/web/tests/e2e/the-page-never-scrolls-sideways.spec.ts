import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * EVERY PAGE FITS EVERY PHONE — no page scrolls sideways, measured in a browser.
 *
 * Owner, 2026-10-21: *"are they aligned for all mobile devices? resizes
 * properly?"* The fits-every-phone sweep measured 38 screens at 11 sizes in
 * WebKit and Chromium (320 → 1024×1366, phone landscape, iPad Split View). The
 * one page that scrolled sideways was the front door at 320 (iPhone SE, iPad
 * Slide Over): the Discover card's "Guest list only" pill is `nowrap` and was
 * wider than its 88px text column.
 *
 * 🔑 A PROPERTY, NOT A LIST OF CLASSES. Nothing here names the pill. It lays
 * pages out and asks two questions a phone user can feel:
 *   1. does the document scroll sideways (`scrollWidth > innerWidth`)?
 *   2. does any visible content stick out past the right or left edge, outside
 *      a box that scrolls or clips on purpose (a carousel, a chip rail)?
 * And for the rendered shelf, a third: does anything in a card stick out of
 * its own card? (that is how the fault starts, one column before it reaches
 * the screen edge).
 *
 * Three parts:
 *   • PUBLIC — the signed-out pages the CI build serves, at 320 · 375 · 430 and
 *     phone landscape 667×375.
 *   • SHELF — the REAL Discover shelf (`the-page-never-scrolls-sideways.render.ts`)
 *     under the front door's compiled CSS at 320 and 360, because in CI the
 *     front door has no database and draws no cards.
 *   • LABS — the signed-in screens' `/dev/*` labs. Production builds 404 them,
 *     so they run only against a dev server: `E2E_LABS=1 E2E_BASE_URL=… pnpm
 *     test:e2e the-page-never-scrolls-sideways` (the lab env, no database).
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: WebKit (CI is Chromium only — the live fault
 * was WebKit's wider text), real safe-area insets (0 in headless browsers), or
 * a real iPhone.
 */

const PUBLIC = ['/', '/login', '/signup', '/features', '/pricing', '/download', '/about', '/for-suppliers'];
const LABS = [
  '/dev/home-lab',
  '/dev/guests-lab?part=screen',
  '/dev/guests-lab?part=card',
  '/dev/suppliers-lab',
  '/dev/suppliers-lab?tab=build',
  '/dev/suppliers-lab?mode=booked',
  '/dev/budget-lab',
  '/dev/me-lab',
  '/dev/supplier-lab?s=today',
  '/dev/supplier-lab?s=people',
  '/dev/supplier-lab?s=money',
  '/dev/supplier-plan-lab?s=more',
  '/dev/maker-lab',
];
const SIZES = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
  { width: 667, height: 375 },
];

type Fit = { vw: number; docW: number; past: string[] };

/** Question 1 and 2, asked of whatever is on the page now. */
async function fit(page: Page): Promise<Fit> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const shown = (e: Element) => {
      for (let p: Element | null = e; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false;
        if (p.getAttribute('aria-hidden') === 'true' || p.hasAttribute('inert')) return false;
      }
      return true;
    };
    // A box that scrolls or clips sideways on purpose, and itself fits.
    const heldIn = (e: Element) => {
      for (let p = e.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        // A sideways SCROLLER (a carousel, a chip rail) holds what is past the edge on purpose — a finger
        // scrolls it — even when the strip itself bleeds to the screen edge.
        if (/(auto|scroll)/.test(ox)) return true;
        if (/(hidden|clip)/.test(ox)) {
          const r = p.getBoundingClientRect();
          return r.right <= vw + 1.5 && r.left >= -1.5;
        }
      }
      return false;
    };
    const past: string[] = [];
    for (const e of document.querySelectorAll('body *')) {
      if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // Partly past an edge. Wholly off-screen is a closed drawer, not a fault.
      const out = (r.right > vw + 1.5 && r.left < vw - 1) || (r.left < -1.5 && r.right > 1);
      if (!out || !shown(e) || heldIn(e)) continue;
      // Only what a person can see: own text, a control, a picture, or paint.
      const s = getComputedStyle(e);
      const text = [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
      const control = e.matches('a[href],button,input,select,textarea,[role=button],img,video,canvas');
      const paint = s.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor);
      if (!text && !control && (e.children.length > 0 || !paint)) continue;
      const cls = typeof e.className === 'string' ? e.className.split(/\s+/).slice(0, 2).join('.') : '';
      past.push(`${e.tagName.toLowerCase()}${cls ? '.' + cls : ''} “${(e.textContent ?? '').trim().slice(0, 30)}” ${Math.round(r.left)}→${Math.round(r.right)}`);
    }
    return { vw, docW: document.documentElement.scrollWidth, past: past.slice(0, 8) };
  });
}

/**
 * 💸 A PESO AMOUNT IS NEVER CUT. A one-line ellipsis (or a line clamp) that hides part of a line carrying ₱ shows a
 * wrong number, not a shorter one: the Budget's "Reception venue · ₱105,600 paid" lost its amount on every phone from
 * 320 to 414 (fits-every-phone 2026-10-21). A name may truncate; money wraps.
 */
async function cutMoney(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const e of document.querySelectorAll<HTMLElement>('body *')) {
      const t = e.textContent ?? '';
      if (!t.includes('₱') || e.children.length > 6) continue;
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      // Only what is shown: a peek card waiting off-stage (opacity 0, inert) is measured the moment it shows.
      let hidden = false;
      for (let p: Element | null = e; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (+ps.opacity < 0.05 || p.hasAttribute('inert') || p.getAttribute('aria-hidden') === 'true') hidden = true;
      }
      if (hidden) continue;
      const ell = s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1;
      const clamp = s.webkitLineClamp !== 'none' && s.webkitLineClamp !== '' && e.scrollHeight > e.clientHeight + 2;
      if (ell || clamp) out.push(`“${t.trim().slice(0, 40)}” ${e.clientWidth}/${e.scrollWidth}px`);
    }
    return out.slice(0, 6);
  });
}

function expectFits(where: string, f: Fit) {
  expect(f.docW, `${where}: the page scrolls sideways (${f.docW}px wide in a ${f.vw}px screen) — ${f.past.join(' · ')}`).toBeLessThanOrEqual(f.vw);
  expect(f.past, `${where}: content sticks out past the screen edge`).toEqual([]);
}

for (const path of PUBLIC) {
  for (const size of SIZES) {
    test(`${path} fits a ${size.width}×${size.height} screen with no sideways scroll`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      const res = await page.goto(path);
      expect(res?.status(), `${path} did not render — nothing would be measured`).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      // The precondition: the page's stylesheet loaded (an unstyled page wraps everything and passes).
      expect(await page.evaluate(() => document.styleSheets.length), `${path}: no stylesheet`).toBeGreaterThan(0);
      expectFits(`${path} @${size.width}`, await fit(page));
      expect(await cutMoney(page), `${path} @${size.width}: a peso amount is cut by an ellipsis`).toEqual([]);
      await ctx.close();
    });
  }
}

// ── SHELF — the real Discover cards, under the front door's own CSS ─────────
const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const SHELF = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-page-never-scrolls-sideways.render.ts')], { cwd: WEB, encoding: 'utf8' }),
) as { html: string; count: number };

for (const width of [320, 360]) {
  test(`the Discover shelf's cards fit their own column at ${width}px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 740 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto('/');
    const sheets = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => (l as HTMLLinkElement).href),
    );
    expect(sheets.length, 'no stylesheet on / — the shelf would be measured unstyled').toBeGreaterThan(0);
    const origin = new URL(page.url()).origin;
    await page.setContent(
      `<!doctype html><html><head><base href="${origin}/">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
        sheets.map((s) => `<link rel="stylesheet" href="${s}">`).join('') +
        `</head><body>${SHELF.html}</body></html>`,
      { waitUntil: 'load' },
    );
    await page.evaluate(() => document.fonts.ready);
    // Anchors: front-door.css styled the grid, and every card is on the page.
    expect(await page.$eval('.fd-grid', (g) => getComputedStyle(g).display)).toBe('grid');
    expect(await page.locator('[data-discover-card]').count()).toBe(SHELF.count);
    expect(await page.locator('.fd-ask').count(), 'the cards carry no action pill — the measure would be vacuous').toBe(SHELF.count);

    // Question 3: nothing in a card reaches past its own card.
    const spill = await page.evaluate(() => {
      const out: string[] = [];
      for (const card of document.querySelectorAll('[data-discover-card]')) {
        const c = card.getBoundingClientRect();
        for (const e of card.querySelectorAll('*')) {
          const r = e.getBoundingClientRect();
          if (r.width < 1) continue;
          if (r.right > c.right + 1 || r.left < c.left - 1) {
            out.push(`“${(e.textContent ?? '').trim().slice(0, 24)}” ${Math.round(r.left)}→${Math.round(r.right)} in a card ${Math.round(c.left)}→${Math.round(c.right)}`);
          }
        }
      }
      return out;
    });
    expect(spill, `@${width}: a card's content sticks out of its card`).toEqual([]);
    expectFits(`the shelf @${width}`, await fit(page));
    // The pill is still a press: ≥ 44px tall wherever it wraps.
    for (const h of await page.$$eval('.fd-ask', (els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(h).toBeGreaterThanOrEqual(44);
    }
    await ctx.close();
  });
}

// ── LABS — only against a dev server (production builds 404 every /dev route) ──
for (const path of LABS) {
  for (const size of SIZES) {
    test(`lab ${path} fits a ${size.width}×${size.height} screen with no sideways scroll`, async ({ browser }) => {
      test.skip(process.env.E2E_LABS !== '1', 'labs need a dev server: E2E_LABS=1 against `next dev` with the lab env');
      // ⚠ KNOWN OPEN, an owner call (fits-every-phone 2026-10-21): at 320 the Guest list's thumb row cannot hold the
      // owner's "search ≥ 60 % of the row" AND its three icons (Expand all · Select · Sort) — they need 317px of a
      // 288px row, so Sort is cut 7px past the edge. Marked as an expected failure so the day it is decided and
      // fixed, this line goes red and is removed.
      test.fail(path === '/dev/guests-lab?part=screen' && size.width === 320, 'Guest list thumb row at 320 — owner call');
      test.setTimeout(180_000);
      const ctx = await browser.newContext({ viewport: size, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: '' }));
      const res = await page.goto(path, { timeout: 170_000 });
      expect(res?.status(), `${path} did not render`).toBe(200);
      await page.waitForTimeout(path.includes('maker') ? 6000 : 1200);
      expectFits(`${path} @${size.width}`, await fit(page));
      expect(await cutMoney(page), `${path} @${size.width}: a peso amount is cut by an ellipsis`).toEqual([]);
      await ctx.close();
    });
  }
}
