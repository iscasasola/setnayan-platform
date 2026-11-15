import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fitChatPane } from '../../app/dashboard/[eventId]/messages/_components/chat-pane-fit';

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

/** Run the REAL `fitChatPane` on every chat root, as `ChatPanes` does on load / resize / scroll. */
async function fit(page: Page) {
  await page.evaluate(`document.querySelectorAll('[data-chat-panes]').forEach((r) => (${fitChatPane.toString()})(r))`);
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
      await fit(page);
      expectInWindow('at load', await readComposer(page));
      // Scrolled: the pane sticks under the pin line and grows to the window's foot.
      await page.evaluate(() => window.scrollTo(0, 200));
      await fit(page);
      expectInWindow('scrolled 200', await readComposer(page));
      await page.screenshot({ path: `test-results/chat-box-panes-${vp.width}-${strip ? 'couple' : 'supplier'}.png` });
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
