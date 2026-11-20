// The BUILD half of the §4 pairs, and the pairs themselves. Lab page only, fixture data, no database.
// 1. In apps/web, start the lab (dummy env, so nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy npx next dev --port 3479
// 2. Run drawing.mjs first (it writes drawing-*.png), then from the repo root:
//    node build-sessions/shots-unichat-h2/build.mjs
//    Writes build-*.png, pair-*.png (drawing left · build right) and prints the measured gutters.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const B = 'http://localhost:3479/dev/chat-cards-c-lab?m=dealend';

// Each H2 piece on the hosts' side: how to find it in the lab (the hosts' column is drawn first).
const CARDS = {
  terms: '[data-quote-terms] >> xpath=..',
  receipt: 'section[data-chat-card="payment"]',
  crew: '[data-crew-day-card="ok"]',
  handover: 'section[data-chat-card="files"]',
  review: 'section[data-chat-card="decision"]',
};
const ONLY_FAILED = process.env.ONLY_FAILED === '1';
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];

const browser = await chromium.launch();
async function open(mode, q = '') {
  const ctx = await browser.newContext({ viewport: { width: mode.w, height: mode.h }, deviceScaleFactor: 2, colorScheme: mode.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(B + q, { waitUntil: 'domcontentloaded', timeout: 400000 });
  await page.waitForSelector('section[data-chat-card], [data-card-read]', { timeout: 400000 });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  // The app's dark mode is the `dark` class on <html>; /dev labs never set it, so a dark shot sets it itself.
  if (mode.dark) { await page.evaluate(() => document.documentElement.classList.add('dark')); await page.waitForTimeout(600); }
  return { ctx, page };
}

const gutters = [];
for (const mode of ONLY_FAILED ? [] : MODES) {
  const { ctx, page } = await open(mode);
  await page.screenshot({ path: `${HERE}/build-all-${mode.tag}.png`, fullPage: true });
  // Gutters: every hosts'-side card's left and right distance to the viewport edge.
  gutters.push([mode.tag, await page.evaluate(() => [...document.querySelectorAll('section[data-chat-card]')].slice(0, 5).map((e) => {
    const r = e.getBoundingClientRect(); return `${e.dataset.chatCard} L${Math.round(r.left)} R${Math.round(innerWidth - r.right)}`;
  }))]);
  await page.click('[data-crew-day-card="ok"] summary');
  await page.waitForTimeout(400);
  for (const [name, sel] of Object.entries(CARDS)) {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: `${HERE}/build-${name}-${mode.tag}.png` });
  }
  console.log('build', mode.tag);
  await ctx.close();
}
for (const [q, tag] of [['&e=1', 'empty-375-light'], ['&f=1', 'failed-375-light'], ['&f=1', 'failed-375-dark']]) {
  const mode = { w: 375, h: 812, dark: tag.endsWith('dark') };
  const { ctx, page } = await open(mode, q);
  // The refused reads must have ANSWERED (each card's "Couldn't load"), not merely be loading.
  if (q === '&f=1') await page.waitForFunction(() => document.querySelectorAll('[data-card-read="failed"]').length >= 4 && document.querySelector('[data-quote-terms="failed"]'), null, { timeout: 120000 }).catch((e) => console.log('failed-wait', e.message.slice(0, 120)));
  await page.screenshot({ path: `${HERE}/build-${tag}.png`, fullPage: true });
  if (q === '&f=1') console.log(tag, JSON.stringify(await page.locator('[data-card-read="failed"] [role="alert"], [data-quote-terms="failed"]').allInnerTexts()));
  await ctx.close();
}
console.log('GUTTERS', JSON.stringify(gutters, null, 1));

// Pairs: the drawing's scene (left) beside the build's card (right), per mode.
const SCENE = { terms: 'terms', receipt: 'receipt', crew: 'crew', handover: 'handover-review', review: 'handover-review' };
const pageCtx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
const pp = await pageCtx.newPage();
const uri = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
for (const mode of MODES) {
  for (const [name, scene] of Object.entries(SCENE)) {
    const d = `${HERE}/drawing-${scene}-${mode.tag}.png`, b = `${HERE}/build-${name}-${mode.tag}.png`;
    if (!existsSync(d) || !existsSync(b)) continue;
    const bg = mode.dark ? '#121110' : '#F7F4EE', ink = mode.dark ? '#F7F4EE' : '#1B1A17';
    await pp.setContent(`<body style="margin:0;background:${bg};color:${ink};font:600 15px system-ui">
      <div id="x" style="display:flex;gap:24px;padding:16px;align-items:flex-start;width:max-content">
        <figure style="margin:0"><figcaption>DRAWING · ${name} · ${mode.tag}</figcaption><img src="${uri(d)}" style="width:${mode.tag === 'desktop' ? 620 : 372}px"></figure>
        <figure style="margin:0"><figcaption>BUILD · ${name} · ${mode.tag}</figcaption><img src="${uri(b)}" style="width:${mode.tag === 'desktop' ? 560 : 372}px"></figure>
      </div></body>`);
    await pp.locator('#x').screenshot({ path: `${HERE}/pair-${name}-${mode.tag}.png` });
  }
}
await browser.close();
console.log('pairs done');
