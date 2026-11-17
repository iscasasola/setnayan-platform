import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fitChatPane, watchChatPane } from '../../app/dashboard/[eventId]/messages/_components/chat-pane-fit';

/**
 * ✍ THE CHAT'S MESSAGE BOX IS IN THE WINDOW, AND NOTHING DRAWS OVER IT — measured, in both frames the thread opens in.
 *
 * W1 on live f896598 (RW-330), after two fixes that each passed their source guards:
 *   1 · couple 768 × 1024 / 1280 × 800 — the composer's foot at 1093 / 869: the column was sized as if it stood at the
 *       pin line while the page's strip and title stood above it;
 *   2 · supplier 1280 × 800 — the box fit, but a message bubble (`relative z-10`) drew OVER the composer;
 *   3 · supplier phone 390 × 844 — the composer's foot at 879: a busy thread outgrew the screen and took it along.
 * A source guard can only say a rule is written; these are claims about boxes on a screen, so this mounts the REAL
 * thread (`the-chat-box-is-in-the-window.render.ts`) with the app's compiled CSS, runs the REAL `fitChatPane`, and
 * measures:
 *   · the composer's whole box lies inside the window;
 *   · at points across the composer the topmost element IS the composer (no bubble over it);
 * at load, with a strip and a title standing above the chat (the couple's page), and again after the page scrolls.
 *
 * Needs only a public page for the stylesheet — no sign-in — so it runs in CI's e2e job like every spec here.
 * Locally without a server: `CHAT_FIT_CSS=<compiled.css>` mounts that stylesheet instead.
 */
const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const MARKUP = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-chat-box-is-in-the-window.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
  }),
) as { panes: string; phone: string };

const LOCAL_CSS = process.env.CHAT_FIT_CSS;
/** The system's two columns (`.sn-cols`) are a route stylesheet — loaded by the Chats layouts, not by `/` — so the
 *  harness adds that file itself, as written (plain CSS, no Tailwind in it). */
const FRAME_CSS = `<style>${readFileSync(join(WEB, 'app/vendor-dashboard/_components/supplier-frame.css'), 'utf8')}</style>`;
type Shell = { head: string; htmlClass: string; bodyClass: string };
let shell: Shell | null = null;

test.beforeAll(async ({ browser }) => {
  if (LOCAL_CSS) {
    shell = { head: `<style>${readFileSync(LOCAL_CSS, 'utf8')}</style>`, htmlClass: '', bodyClass: 'bg-page text-ink' };
    return;
  }
  const page = await browser.newPage();
  await page.goto('/');
  const s = await page.evaluate(() => ({
    sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => (l as HTMLLinkElement).href),
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
  }));
  await page.close();
  expect(s.sheets.length, 'no stylesheet on / — the harness would measure unstyled markup').toBeGreaterThan(0);
  shell = { head: s.sheets.map((href) => `<link rel="stylesheet" href="${href}">`).join(''), ...s };
});

/** The pin line (the app's top bar), then what the couple's Chats page draws above the columns. */
const TOP_BAR = `<header style="position:sticky;top:0;height:61px;z-index:30" class="bg-page">SETNAYAN</header>`;
const ABOVE = (strip: boolean) =>
  (strip ? `<div style="height:56px" data-test-strip>Plan with peace of mind</div>` : '') +
  `<h1 style="height:56px">Chats</h1>`;

async function mount(page: Page, body: string) {
  const { head, htmlClass, bodyClass } = shell!;
  if (!LOCAL_CSS) await page.goto('/api/health');
  const base = LOCAL_CSS ? '' : `<base href="${new URL(page.url()).origin}/">`;
  await page.setContent(
    `<!doctype html><html class="${htmlClass}" style="--sn-pin-top:61px"><head>${base}${head}${FRAME_CSS}</head>` +
      `<body class="${bodyClass}">${body}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/**
 * Start the REAL watcher on every chat root, exactly as `ChatPanes` does on mount (`watchChatPane` — which fits at once
 * and re-fits on whatever moves the pane). Both functions go in as page script, so `watchChatPane` calls the shipped
 * `fitChatPane` by name, as in the module.
 */
async function watch(page: Page) {
  await page.addScriptTag({ content: `${fitChatPane.toString()}\n${watchChatPane.toString()}` });
  await page.evaluate(() => {
    const w = (window as unknown as { watchChatPane: (r: HTMLElement) => () => void }).watchChatPane;
    document.querySelectorAll<HTMLElement>('[data-chat-panes]').forEach((r) => w(r));
  });
  await frames(page);
}

/** Let the page paint a few frames — the watcher re-fits on the next animation frame, never synchronously. */
async function frames(page: Page, n = 3) {
  await page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count;
        const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}

type Reading = { bottom: number; top: number; height: number; covered: string[] };

async function readComposer(page: Page): Promise<Reading> {
  return page.evaluate(() => {
    const gutter = document.querySelector('[data-chat-composer-gutter]') as HTMLElement | null;
    if (!gutter) return { bottom: Infinity, top: Infinity, height: innerHeight, covered: ['no composer'] };
    const r = gutter.getBoundingClientRect();
    const covered: string[] = [];
    for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      for (const fy of [0.25, 0.5, 0.75]) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        const hit = document.elementFromPoint(x, y);
        if (!hit || !gutter.contains(hit)) {
          covered.push(`(${Math.round(x)},${Math.round(y)}) → ${hit ? hit.outerHTML.slice(0, 80) : 'nothing (off screen)'}`);
        }
      }
    }
    return { bottom: r.bottom, top: r.top, height: innerHeight, covered };
  });
}

function expectInWindow(where: string, r: Reading) {
  expect(r.bottom, `${where}: the composer's foot is at ${Math.round(r.bottom)} in a ${r.height} window`).toBeLessThanOrEqual(r.height + 0.5);
  expect(r.top, `${where}: the composer's top is off the screen`).toBeGreaterThanOrEqual(0);
  expect(r.covered, `${where}: something draws over the composer\n${r.covered.join('\n')}`).toEqual([]);
}

const WIDE = [
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

for (const vp of WIDE) {
  for (const strip of [true, false]) {
    const who = strip ? 'couple (strip + title above)' : 'supplier (title above)';
    test(`chat · beside the list · ${vp.width}×${vp.height} · ${who} — the composer is in the window and on top`, async ({ page }) => {
      await page.setViewportSize(vp);
      await mount(page, TOP_BAR + ABOVE(strip) + MARKUP.panes + `<div style="height:600px"></div>`);
      await watch(page);
      expectInWindow('at load', await readComposer(page));
      // Scrolled: the pane sticks under the pin line and grows to the window's foot (the watcher's scroll re-fit).
      await page.evaluate(() => window.scrollTo(0, 200));
      await frames(page);
      expectInWindow('scrolled 200', await readComposer(page));
      await page.screenshot({ path: `test-results/chat-box-panes-${vp.width}-${strip ? 'couple' : 'supplier'}.png` });
    });
  }
}

/**
 * 🕰 THE STRIP ARRIVES AFTER THE CHAT HAS PAINTED (W1 on live 1c8fe6b, after #7804). The couple's page draws the chat first;
 * ~0.7 s later the notice slot fills with "Plan with peace of mind" ABOVE the pane, and nothing resizes the window. The
 * fit was right but never re-ran: the pane moved 93 → 173 and the composer ended at 1093 / 869, the variable stayed 93
 * for 5 s+, and any resize fixed it — a re-fit waiting on an animation frame that a non-painting tab never runs. This
 * reproduces that load — render, paint, THEN insert the strip into the column above the chat, no resize — in a painting
 * tab and in one that runs no frames, and measures after it.
 * The column is the event layout's own shape (`dashboard/[eventId]/layout.tsx`: `.sn-ambient min-h-screen` › `<main>`
 * › `[data-shell-main]` › the padded column holding the top notice slot, then the page).
 */
const COLUMN = (inner: string) =>
  TOP_BAR +
  `<div class="sn-ambient min-h-screen"><main class="sn-vt-page"><div data-shell-main>` +
  `<div class="mx-auto w-full px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8">` +
  `<div data-test-slot></div>` +
  inner +
  `</div></div></main></div>`;

/** The notice slot fills — a node added above the pane; the window is not resized. */
async function insertStrip(page: Page) {
  await page.evaluate(() => {
    const strip = document.createElement('div');
    strip.className = 'mb-4';
    strip.setAttribute('data-notice-slot', 'top');
    strip.innerHTML = '<div style="height:80px">Plan with peace of mind</div>';
    document.querySelector('[data-test-slot]')!.appendChild(strip);
  });
}

const paneTop = (page: Page) =>
  page.evaluate(() => (document.querySelector('[data-supplier-cols-pane]') as HTMLElement).getBoundingClientRect().top);

/** Wait in the page by TIMER (not by frame), for the tab that runs no frames. */
const waitMs = (page: Page, ms: number) => page.evaluate((t) => new Promise<void>((done) => setTimeout(done, t)), ms);

for (const vp of WIDE) {
  for (const painting of [true, false]) {
    const tab = painting ? 'a painting tab' : 'a tab that runs no frames (background / hidden pane)';
    test(`chat · beside the list · ${vp.width}×${vp.height} · the strip arrives after paint, ${tab} — the composer is still in the window`, async ({ page }) => {
      await page.setViewportSize(vp);
      await mount(page, COLUMN(ABOVE(false) + MARKUP.panes));
      await watch(page);
      expectInWindow('before the strip', await readComposer(page));
      const before = await paneTop(page);
      // W1's live readings (after #7804) were taken where frames did not run: the variable stuck for 5 s+, any resize freed it.
      if (!painting) await page.evaluate(() => (window.requestAnimationFrame = () => 0));
      await insertStrip(page);
      if (painting) await frames(page);
      else await waitMs(page, 400);
      const after = await paneTop(page);
      expect(after, 'the strip did not move the pane — this test would prove nothing').toBeGreaterThan(before + 40);
      expectInWindow(`after the strip (pane ${Math.round(before)} → ${Math.round(after)})`, await readComposer(page));
      await page.screenshot({ path: `test-results/chat-box-late-strip-${vp.width}-${painting ? 'painting' : 'noframes'}.png` });
    });
  }
}

test('chat · phone 390×844 · a busy thread — the composer is in the window and on top', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(page, TOP_BAR + MARKUP.phone);
  expectInWindow('at load', await readComposer(page));
  // Scrolled half way through the thread: still there.
  await page.evaluate(() => {
    const box = document.querySelector('[data-chat-takeover]') as HTMLElement;
    box.scrollTop = box.scrollHeight / 2;
  });
  expectInWindow('scrolled', await readComposer(page));
  await page.screenshot({ path: 'test-results/chat-box-phone-390.png' });
});
