// §4 proof for #8004 — the event plan cards (Free event, Plus event), 375 light + desktop + forced dark.
// 1. In apps/web, start the lab with the dummy env (nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy pnpm exec next dev --port 3481
// 2. From the repo root: node build-sessions/shots-event-plans-part2/shoot.mjs
// The figures are the lab's SAMPLE (₱2,990 / ₱5,490 / ₱9,990); the shipped page reads platform_retail_catalog_v2.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const B = `http://localhost:${process.env.PORT ?? 3481}/dev/pro-parts-lab?frame=`;
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark-forced', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];
const browser = await chromium.launch();
for (const frame of ['plans-free', 'plans-plus']) {
  for (const m of MODES) {
    const ctx = await browser.newContext({ viewport: { width: m.w, height: m.h }, deviceScaleFactor: 2, colorScheme: m.dark ? 'dark' : 'light' });
    const page = await ctx.newPage();
    await page.goto(B + frame, { waitUntil: 'domcontentloaded', timeout: 400000 });
    await page.waitForSelector('main, h1', { timeout: 400000 });
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    if (m.dark) { await page.evaluate(() => document.documentElement.classList.add('dark')); await page.waitForTimeout(500); }
    await page.screenshot({ path: `${HERE}/${frame}-${m.tag}.png`, fullPage: true });
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    console.log('shot', frame, m.tag, 'scrollWidth/innerWidth', sw.join('/'));
    await ctx.close();
  }
}
await browser.close();
