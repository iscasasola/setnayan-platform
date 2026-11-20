// §4 proof for #8019 round 3 — the Plan page's Ultra Add-on rows: "Add one" + each held add-on with its own Renew.
// 1. In apps/web, start the lab with the dummy env (nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy pnpm exec next dev --port 3483
// 2. From the repo root: node build-sessions/shots-plan-numbers/shoot-renew.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const URL = `http://localhost:${process.env.PORT ?? 3483}/dev/supplier-plan-lab?s=plan&who=agency`;
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark-forced', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];
const browser = await chromium.launch();
for (const m of MODES) {
  const ctx = await browser.newContext({ viewport: { width: m.w, height: m.h }, deviceScaleFactor: 2, colorScheme: m.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 400000 });
  await page.waitForSelector('[data-ultra-addon-buy]', { timeout: 400000 });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  if (m.dark) { await page.evaluate(() => document.documentElement.classList.add('dark')); await page.waitForTimeout(500); }
  await page.screenshot({ path: `${HERE}/renew-plan-page-${m.tag}.png`, fullPage: true });
  // The add-on block: from the "Add one" row through the last held row, with a margin.
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-ultra-addon-buy]')].map((f) => f.closest('li, [data-dates-row], div'));
    const rs = els.filter(Boolean).map((e) => e.getBoundingClientRect());
    const top = Math.min(...rs.map((r) => r.top)) + scrollY, bottom = Math.max(...rs.map((r) => r.bottom)) + scrollY;
    return { top, bottom, renew: document.querySelectorAll('[data-ultra-addon-buy="renew"]').length,
      gut: [...document.querySelectorAll('[data-ultra-addon-buy]')].map((f) => { const r = f.getBoundingClientRect(); return `R${Math.round(innerWidth - r.right)}`; }) };
  });
  await page.screenshot({ path: `${HERE}/renew-rows-${m.tag}.png`, fullPage: true, clip: { x: 0, y: Math.max(0, box.top - 120), width: m.w, height: box.bottom - box.top + 200 } });
  console.log('shot', m.tag, 'renew buttons', box.renew, 'right gaps', box.gut.join(' '));
  await ctx.close();
}
await browser.close();
