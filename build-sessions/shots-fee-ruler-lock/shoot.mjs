// §4 proof for #8061's ₱100,000 lock on the For Suppliers fee ruler (owner 20 Nov "show them the 100,000 lock").
// 1. In apps/web, start dev with the dummy env (nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy pnpm exec next dev --port 3484
// 2. From the repo root: PORT=3484 node build-sessions/shots-fee-ruler-lock/shoot.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const B = `http://localhost:${process.env.PORT ?? 3484}/dev/fee-rulings-lab?screen=ruler`;
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark-forced', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];
const browser = await chromium.launch();
const facts = [];
for (const m of MODES) {
  const ctx = await browser.newContext({ viewport: { width: m.w, height: m.h }, deviceScaleFactor: 2, colorScheme: m.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(B, { waitUntil: 'domcontentloaded', timeout: 400000 });
  await page.waitForSelector('[data-lab-ruler] [role="slider"]', { timeout: 400000 });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  if (m.dark) { await page.evaluate(() => document.documentElement.classList.add('dark')); await page.waitForTimeout(400); }
  const box = page.locator('[data-lab-ruler]');
  await box.screenshot({ path: `${HERE}/1-open-${m.tag}.png` });
  const bar = page.locator('[data-lab-ruler] [role="slider"]');
  await bar.focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(1500);
  // The lock stop (20 of 25), at a person's pace: presses during a glide 0 ms apart can land elsewhere (#8081's glide).
  for (let i = 0; i < 5; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(800); }
  await page.waitForTimeout(700);
  await box.screenshot({ path: `${HERE}/2-at-the-lock-${m.tag}.png` });
  facts.push([m.tag, 'at-lock', await bar.getAttribute('aria-valuetext')]);
  await page.keyboard.press('End');
  await page.waitForTimeout(1500);
  await box.screenshot({ path: `${HERE}/3-past-the-lock-${m.tag}.png` });
  facts.push([m.tag, 'end', await bar.getAttribute('aria-valuetext')]);
  await page.locator('[data-lab-ruler] input[role="switch"]').first().check({ force: true });
  await page.waitForTimeout(600);
  await box.screenshot({ path: `${HERE}/4-free-${m.tag}.png` });
  facts.push([m.tag, 'gutters', await page.evaluate(() => { const r = document.querySelector('[data-lab-ruler]').getBoundingClientRect(); return `L${Math.round(r.left)} R${Math.round(innerWidth - r.right)} scrollW=${document.documentElement.scrollWidth} vw=${innerWidth}`; })]);
  await ctx.close();
  console.log('shot', m.tag);
}
console.log('FACTS', JSON.stringify(facts));
await browser.close();
