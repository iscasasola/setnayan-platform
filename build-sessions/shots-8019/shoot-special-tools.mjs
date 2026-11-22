// §4 proof for #8019 (22 Nov) — special tools are Pro and Ultra only, and there is no Max plan:
//   · the locked Cake Maker demo's bar ("This special tool is available on Pro and Ultra" + Upgrade);
//   · the Plan page of a Supplier Plus shop (its "Specialized tools" row no longer says included).
// 1. In apps/web, start the lab with the dummy env (nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy pnpm exec next dev --port 3497
// 2. From the repo root: node build-sessions/shots-8019/shoot-special-tools.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const BASE = `http://localhost:${process.env.PORT ?? 3497}`;
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark-forced', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];
const ONLY = process.env.ONLY ?? null;
const PAGES = [
  { name: 'demo-bar', path: '/dev/cake-maker-lab?view=demo', wait: '[data-cake-demo-bar]', fullPage: false },
  { name: 'plus-plan-page', path: '/dev/supplier-plan-lab?s=plan&who=caterer', wait: 'main', fullPage: true, open: ['What Plus gives you', 'Pro'] },
];
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
for (const p of PAGES.filter((x) => !ONLY || x.name === ONLY)) {
  for (const m of MODES) {
    const ctx = await browser.newContext({ viewport: { width: m.w, height: m.h }, deviceScaleFactor: 2, colorScheme: m.dark ? 'dark' : 'light' });
    const page = await ctx.newPage();
    await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded', timeout: 900000 });
    await page.waitForSelector(p.wait, { timeout: 900000 });
    await page.waitForTimeout(2000);
    if (p.open) {
      // Open the folds that carry the "Specialized tools" row (the page's own buttons; closed by default).
      await page.evaluate((words) => {
        for (const b of document.querySelectorAll('button')) if (words.some((w) => b.textContent.trim().startsWith(w))) b.click();
      }, p.open);
      await page.waitForTimeout(1500);
    }
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    if (m.dark) {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${HERE}/special-tools-${p.name}-${m.tag}.png`, fullPage: p.fullPage });
    const facts = await page.evaluate(() => {
      const bar = document.querySelector('[data-cake-demo-bar]');
      const up = document.querySelector('[data-cake-demo-upgrade]');
      const r = bar?.getBoundingClientRect();
      const u = up?.getBoundingClientRect();
      return {
        bar: bar?.textContent?.trim() ?? null,
        gaps: r ? `L${Math.round(r.left)} R${Math.round(innerWidth - r.right)}` : null,
        upgrade: u ? `${Math.round(u.width)}x${Math.round(u.height)} → ${up.getAttribute('href')}` : null,
        max: /\bMax\b/.test(document.body.innerText),
        tools: [...document.querySelectorAll('li, tr, div')].filter((e) => e.children.length <= 3).map((e) => (e.textContent ?? '').trim()).filter((t) => /^Specialized tools/.test(t) && t.length < 120),
      };
    });
    console.log(p.name, m.tag, JSON.stringify(facts));
    await ctx.close();
  }
}
await browser.close();
