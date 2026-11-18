import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { followColumn } from '../../app/dashboard/[eventId]/guests/_components/dock-follows-column';

/**
 * 🎞 THE THUMB ROW SITS UNDER ITS COLUMN AFTER THE PAGE SLIDES IN — measured.
 *
 * W1 on live 979ed2c (RW-337, a regression from #7543): at 768 People's "Find or invite" bar sat 28 px right of its
 * column and touched the window's right edge — column 96→744, bar 124→768. `followColumn` read the column's box
 * (`getBoundingClientRect`, the box AS DRAWN) while the segment slid in (`translateX(28px) → 0`, 320 ms), and nothing
 * it watched changed when the slide ended (no size change, no resize), so the 28 px stayed. 1280 has the same flaw.
 *
 * This mounts the REAL row (`AccountThumbRow` — People, Memories; the Samahan chatroom's row calls the same
 * `followColumn` on its own host) with the app's compiled CSS, slides its column in exactly that way — as a CSS
 * animation, as a CSS transition, and as `element.animate` — starts the REAL `followColumn` WHILE it moves (as the page
 * does on mount), lets the move end, and measures: the row's left and right are the column's, to the pixel.
 *
 * Locally without a server: `CHAT_FIT_CSS=<compiled.css>` mounts that stylesheet instead (the same switch as the
 * chat-box spec).
 */
const WEB = join(__dirname, '..', '..');
const TSX_CLI = createRequire(join(WEB, '..', '..', 'package.json')).resolve('tsx/cli');
const { row: ROW } = JSON.parse(
  execFileSync(process.execPath, [TSX_CLI, join(__dirname, 'the-thumb-row-follows-a-sliding-column.render.ts')], {
    cwd: WEB,
    encoding: 'utf8',
  }),
) as { row: string };

const LOCAL_CSS = process.env.CHAT_FIT_CSS;
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

/** The account page: a 72 px rail, then the page column the segment slides in (`data-test-slide`). */
const PAGE = `<div style="display:grid;grid-template-columns:72px 1fr"><nav style="height:100vh"></nav>` +
  `<main data-test-slide style="padding:24px"><div style="height:1400px">People</div>${ROW}</main></div>`;

async function mount(page: Page) {
  const { head, htmlClass, bodyClass } = shell!;
  if (!LOCAL_CSS) await page.goto('/api/health');
  const base = LOCAL_CSS ? '' : `<base href="${new URL(page.url()).origin}/">`;
  await page.setContent(
    `<!doctype html><html class="${htmlClass}"><head>${base}${head}` +
      `<style>@keyframes test-seg-in{from{transform:translateX(28px)}to{transform:none}}</style></head>` +
      `<body class="${bodyClass}">${PAGE}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.addScriptTag({ content: `window.followColumn = ${followColumn.toString()};` });
}

const SLIDES = {
  'a CSS animation': `el.style.animation = 'test-seg-in 320ms cubic-bezier(.2,.8,.2,1)';`,
  'a CSS transition': `el.style.transform = 'translateX(28px)'; el.getBoundingClientRect(); el.style.transition = 'transform 320ms ease'; el.style.transform = 'none';`,
  'element.animate': `el.animate([{ transform: 'translateX(28px)' }, { transform: 'none' }], { duration: 320, easing: 'ease' });`,
} as const;

type Edges = { col: [number, number]; bar: [number, number] };
const edges = (page: Page): Promise<Edges> =>
  page.evaluate(() => {
    const c = (document.querySelector('[data-thumb-host]') as HTMLElement).getBoundingClientRect();
    const b = (document.querySelector('[data-one-thumb-row]') as HTMLElement).getBoundingClientRect();
    return { col: [c.left, c.right], bar: [b.left, b.right] };
  });

for (const width of [768, 1280] as const) {
  for (const [how, start] of Object.entries(SLIDES)) {
    test(`thumb row · ${width} · the column slides in by ${how} — the row's edges are the column's when it ends`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mount(page);
      // The slide starts, and the page mounts its row — followColumn reads the column WHILE it is 28 px out.
      const during = await page.evaluate(`(() => {
        const el = document.querySelector('[data-test-slide]');
        ${start}
        window.__stop = window.followColumn(document.querySelector('[data-thumb-host]'));
        return document.querySelector('[data-thumb-host]').getBoundingClientRect().left;
      })()`);
      const settled = await page.evaluate(() => new Promise<number>((done) => setTimeout(() => {
        done((document.querySelector('[data-thumb-host]') as HTMLElement).getBoundingClientRect().left);
      }, 600)));
      expect(during as number, 'the column was not moving when the row was mounted — this test would prove nothing').toBeGreaterThan(settled + 5);
      const e = await edges(page);
      await page.screenshot({ path: `test-results/thumb-row-slide-${width}-${how.replace(/\W+/g, '-')}.png` });
      expect(Math.abs(e.bar[0] - e.col[0]), `the row's left is ${Math.round(e.bar[0])}, its column's ${Math.round(e.col[0])}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(e.bar[1] - e.col[1]), `the row's right is ${Math.round(e.bar[1])}, its column's ${Math.round(e.col[1])}`).toBeLessThanOrEqual(0.5);
    });
  }
}
