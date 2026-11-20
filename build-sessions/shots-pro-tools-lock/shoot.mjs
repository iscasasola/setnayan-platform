// §4 proof for #8077 — the two LockedFeature cards (below Pro) and the Pro line, 375 light + dark and desktop.
// 1. In apps/web, start the lab with the dummy env (nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy pnpm exec next dev --port 3481
// 2. From the repo root: node build-sessions/shots-pro-tools-lock/shoot.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const B = `http://localhost:${process.env.PORT ?? 3481}/dev/pro-tools-lock-lab`;
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];
const browser = await chromium.launch();
const gutters = [];
for (const [q, state] of [['', 'locked'], ['?pro=1', 'pro']]) {
  for (const m of MODES) {
    const ctx = await browser.newContext({ viewport: { width: m.w, height: m.h }, deviceScaleFactor: 2, colorScheme: m.dark ? 'dark' : 'light' });
    const page = await ctx.newPage();
    await page.goto(B + q, { waitUntil: 'domcontentloaded', timeout: 400000 });
    await page.waitForSelector('[data-lab-card="booth"]', { timeout: 400000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    if (m.dark) { await page.evaluate(() => document.documentElement.classList.add('dark')); await page.waitForTimeout(500); }
    await page.locator('[data-lab-cards]').screenshot({ path: `${HERE}/${state}-${m.tag}.png` });
    gutters.push([state, m.tag, await page.evaluate(() => [...document.querySelectorAll('[data-lab-card]')].map((e) => {
      const r = e.getBoundingClientRect(); return `${e.dataset.labCard} L${Math.round(r.left)} R${Math.round(innerWidth - r.right)}`;
    }))]);
    if (state === 'locked' && m.tag === '375-light') {
      // The 🔒 opens Problem → Solution → Upgrade on tap: shoot it opened.
      const btn = page.locator('[data-challenge-locked] button').first();
      if (await btn.count()) { await btn.click(); await page.waitForTimeout(600); await page.screenshot({ path: `${HERE}/locked-challenge-opened-375-light.png` }); }
    }
    await ctx.close();
    console.log('shot', state, m.tag);
  }
}
console.log('GUTTERS', JSON.stringify(gutters));
await browser.close();
