// The BUILD half of Unichat F's §4 shots. Lab page only, fixture data, dummy database (nothing reaches production).
// 1. In apps/web: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy npx next dev --port 3481
// 2. From the repo root: node build-sessions/shots-unichat-f/build.mjs
//    Writes build-agenda-*.png, build-time-*.png and prints the measured gutters + what each scene says.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const B = 'http://localhost:3481/dev/unichat-f-lab';
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];
const browser = await chromium.launch();
async function open(mode, q, ready) {
  const ctx = await browser.newContext({ viewport: { width: mode.w, height: mode.h }, deviceScaleFactor: 2, colorScheme: mode.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(B + q, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForSelector(ready, { timeout: 600000 });
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  if (mode.dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const measure = (page, sel) =>
  page.evaluate((s) => {
    const els = [...document.querySelectorAll(s)];
    const bad = els.map((e) => e.getBoundingClientRect()).filter((r) => Math.round(r.left) !== Math.round(innerWidth - r.right));
    return { n: els.length, unequal: bad.length, first: els[0] ? [Math.round(els[0].getBoundingClientRect().left), Math.round(innerWidth - els[0].getBoundingClientRect().right)] : null, scrollW: document.documentElement.scrollWidth, innerW: innerWidth };
  }, sel);

for (const mode of MODES) {
  for (const [q, tag] of [['?m=agenda', 'agenda'], ['?m=agenda&e=1', 'agenda-empty'], ['?m=agenda&u=1', 'agenda-unread']]) {
    if (tag !== 'agenda' && mode.tag !== '375-light') continue;
    const { ctx, page } = await open(mode, q, '[data-agenda]');
    const body = page.locator('[data-rise-screen="agenda"]');
    await page.screenshot({ path: `${HERE}/build-${tag}-${mode.tag}.png` });
    // The whole list, top to bottom, as one tall shot of the screen's own scroller.
    const tall = await page.evaluate(() => {
      const s = document.querySelector('[data-agenda]');
      let p = s;
      while (p && p.scrollHeight <= p.clientHeight + 1) p = p.parentElement;
      return p ? p.scrollHeight : 0;
    });
    if (tall > mode.h) {
      await page.setViewportSize({ width: mode.w, height: Math.min(tall + 140, 2400) });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${HERE}/build-${tag}-${mode.tag}-full.png` });
    }
    console.log(tag, mode.tag, 'rise:', await body.count(), 'gutters', JSON.stringify(await measure(page, '[data-agenda] > *')));
    if (tag === 'agenda' && mode.tag === '375-light') {
      console.log('  headings', JSON.stringify(await page.locator('[data-agenda] h4').allInnerTexts()));
      console.log('  set-by', JSON.stringify(await page.locator('[data-window-set-by]').allInnerTexts()));
      // A tap on one of your moments opens the shipped moment sheet in place.
      await page.locator('[data-agenda-moment="m2"]').click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${HERE}/build-agenda-moment-sheet-375-light.png` });
      console.log('  sheet open:', await page.locator('[role="dialog"]').count());
    }
    if (tag !== 'agenda') console.log('  says', JSON.stringify(await page.locator('[data-agenda]').innerText()));
    await ctx.close();
  }
  for (const [q, tag] of [['?m=time', 'time'], ['?m=time&f=1', 'time-failed']]) {
    if (tag !== 'time' && mode.tag !== '375-light') continue;
    const { ctx, page } = await open(mode, q, '[data-lab-time]');
    if (q.includes('f=1')) await page.waitForTimeout(8000);
    await page.screenshot({ path: `${HERE}/build-${tag}-${mode.tag}.png`, fullPage: true });
    console.log(tag, mode.tag, 'gutters', JSON.stringify(await measure(page, '[data-lab-time]')));
    if (tag === 'time-failed') console.log('  says', JSON.stringify(await page.locator('[data-lab-time]').allInnerTexts()));
    await ctx.close();
  }
}
await browser.close();
console.log('done');
