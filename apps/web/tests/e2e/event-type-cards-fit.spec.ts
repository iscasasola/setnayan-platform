import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * THE EVENT NAME IS INSIDE ITS CARD — measured, in both frames the picker lives in.
 *
 * Owner, 2026-09-30, on the "What kind of event are you planning?" grid:
 * *"cannot see the event names"*. Every card's name sat ABOVE the card's top
 * edge and was cut off; only the bottom sliver of the letters showed.
 *
 * 🔑 WHY NO SOURCE GUARD COULD HAVE SEEN IT. The picker is one component in
 * two frames: the full `/dashboard/create-event` page, and the board's add-flow
 * side panel (44rem), which imports that page whole. The grid's columns were
 * VIEWPORT breakpoints (`xl:grid-cols-5`), so a 1280px window put five columns
 * into a 44rem panel — cards ~107px wide and ~134px tall, shorter than the
 * name + tagline + Begin stack pinned to their bottom. The stack grew upward
 * past the card and `overflow-hidden` clipped the name. Every class was valid
 * and the full page looked right; only a measurement in the panel is wrong.
 *
 * So this renders the REAL component (`renderToStaticMarkup`, never a copy of
 * its markup) with the app's own compiled CSS, in both frames, at the four
 * widths the owner checks, and measures boxes:
 *   • every name box lies inside its card box, and its glyphs do not overflow
 *     sideways (scrollWidth ≤ clientWidth);
 *   • every tagline lies inside its card and shows at least two full lines
 *     (or all of itself, when it is shorter than that).
 *
 * ⚠ WHAT A PASS DOES NOT PROVE: contrast over the photo (the screenshots in
 * `test-results/` are for a human), or the real rail's width on the full page —
 * the full-page frame here is WIDER than the real one, so the panel frame is
 * the stressful case and the one this file exists for.
 *
 * It needs only a public page for the stylesheet — no sign-in — so it runs in
 * CI's e2e job against the production build like every other spec here.
 */

/**
 * The REAL component's markup. Playwright's own transform turns JSX in an
 * imported `.tsx` into component-testing objects that `react-dom/server` cannot
 * render, so the render happens in a `tsx` child process (the same runner the
 * unit suite uses) — see `event-type-cards-fit.render.ts` for the roster.
 */
const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const { html: GRID, count: CARD_COUNT } = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'event-type-cards-fit.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
  }),
) as { html: string; count: number };

/** The page wrapper `create-event/page.tsx` renders around the picker. */
const PAGE = (inner: string) =>
  `<div class="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">${inner}</div>`;

/** Both frames. The panel is `CreateEventPanel` → `SidePanel size="wide"`. */
const FRAMES = {
  page: PAGE(GRID),
  panel:
    `<div class="sn-side-panel" data-size="wide" data-phone="sheet">` +
    `<div class="sn-side-panel-body">${PAGE(GRID)}</div></div>`,
} as const;

const WIDTHS = [390, 768, 1280, 1440] as const;

/** The app's compiled CSS + the font classes `<html>`/`<body>` carry — read once. */
type Shell = { sheets: string[]; htmlClass: string; bodyClass: string };
let shell: Shell | null = null;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  // Any public page carries the app's compiled global stylesheet.
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
  // A same-origin page that runs NO app script (the fonts are same-origin only,
  // and a live app page keeps painting its own overlays into whatever we set).
  await page.goto('/api/health');
  const origin = new URL(page.url()).origin;
  await page.setContent(
    `<!doctype html><html class="${htmlClass}"><head><base href="${origin}/">` +
      sheets.map((h) => `<link rel="stylesheet" href="${h}">`).join('') +
      `</head><body class="${bodyClass} sn-ambient">${html}</body></html>`,
    { waitUntil: 'load' },
  );
  // The names are measured in the REAL face — a fallback serif is narrower.
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Photos are for the human-read screenshot only — the boxes do not depend on
    // them (`fill` images are absolutely positioned) — so they get a bounded wait.
    for (const img of document.images) img.loading = 'eager';
    await Promise.race([
      Promise.all([...document.images].map((i) => i.decode().catch(() => null))),
      new Promise((r) => setTimeout(r, 10_000)),
    ]);
  });
}

type Miss = { card: string; what: string };

for (const [frame, html] of Object.entries(FRAMES)) {
  for (const width of WIDTHS) {
    test(`event-type cards · ${frame} · ${width}px — every name and tagline sits inside its card`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      await mount(page, html);

      const cards = page.locator('[role="option"]');
      await expect(cards).toHaveCount(CARD_COUNT);

      const misses: Miss[] = await page.$$eval('[role="option"]', (els) => {
        const out: { card: string; what: string }[] = [];
        const EPS = 0.5;
        for (const el of els) {
          const card = el.getBoundingClientRect();
          const name = el.querySelector('[data-type-name]') as HTMLElement | null;
          const tag = el.querySelector('[data-type-tagline]') as HTMLElement | null;
          const label = name?.textContent ?? '?';
          if (!name || !tag) {
            out.push({ card: label, what: 'no [data-type-name] / [data-type-tagline] to measure' });
            continue;
          }
          const inside = (r: DOMRect) =>
            r.top >= card.top - EPS &&
            r.bottom <= card.bottom + EPS &&
            r.left >= card.left - EPS &&
            r.right <= card.right + EPS;
          const n = name.getBoundingClientRect();
          if (!inside(n))
            out.push({
              card: label,
              what: `name box ${Math.round(n.top - card.top)}px from the card top (card ${Math.round(card.width)}×${Math.round(card.height)})`,
            });
          if (name.scrollWidth > name.clientWidth + 1)
            out.push({ card: label, what: `name is ${name.scrollWidth}px wide in a ${name.clientWidth}px line` });
          const t = tag.getBoundingClientRect();
          if (!inside(t)) out.push({ card: label, what: 'tagline box leaves the card' });
          const lh = parseFloat(getComputedStyle(tag).lineHeight);
          const wholeTextShown = tag.scrollHeight <= tag.clientHeight + 1;
          if (!wholeTextShown && tag.clientHeight < 2 * lh - 1)
            out.push({ card: label, what: `tagline shows ${(tag.clientHeight / lh).toFixed(1)} lines (< 2)` });
        }
        return out;
      });

      await page.screenshot({ path: `test-results/event-type-cards-${frame}-${width}.png`, fullPage: true });
      expect(misses, JSON.stringify(misses, null, 2)).toEqual([]);
    });
  }
}
