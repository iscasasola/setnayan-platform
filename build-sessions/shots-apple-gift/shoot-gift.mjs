// §4 proof for the Apple gift PR (22 Nov) — Shop › Promote › Your gifts inside the iPhone app: a ticket's sheet (Apple's
// prices, no web price, no BDO), then the store after "Add 1" and "Add 10 + 1" — its foot is the cart LINE BY LINE, each
// line its own Apple purchase. Plus the same sheet on the web (unchanged) for comparison.
// 1. In apps/web, start the lab with the dummy env (nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab SUPABASE_SERVICE_ROLE_KEY=lab \
//    npx next dev --port 3498
// 2. From the repo root: PORT=3498 node build-sessions/shots-apple-gift/shoot-gift.mjs
// StoreKit does not exist in a browser, so the app frames show Apple's honest "not answering" state — no price at all
// ("Price from Apple…", buttons off). On a phone each reads Apple's own price.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const BASE = `http://localhost:${process.env.PORT ?? 3498}`;
const MODES = [
  { tag: '375-light', w: 375, h: 1160, dark: false },
  { tag: '375-dark', w: 375, h: 1160, dark: true },
  { tag: 'desktop', w: 1280, h: 900, dark: false },
];
const TILE = '[data-gift-tile="PAPIC_GUEST_150"]';

const factsOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    const text = (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      found: Boolean(el),
      peso: /₱\s?\d/.test(text),
      rail: /BDO|GCash/.test(text),
      appleLines: el ? el.querySelectorAll('[data-iap-gift-buy]').length : 0,
      quantities: el ? [...el.querySelectorAll('[data-iap-gift-buy]')].map((x) => x.getAttribute('data-iap-gift-quantity')) : [],
      text: text.slice(0, 400),
      overflowX: document.documentElement.scrollWidth > innerWidth,
    };
  }, sel);

// The theme script repaints /dev routes light after a tap, so dark is applied right before each shot.
async function shoot(page, m, file) {
  if (m.dark) {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: file });
}

async function open(browser, m, path) {
  const ctx = await browser.newContext({ viewport: { width: m.w, height: m.h }, deviceScaleFactor: 2, colorScheme: m.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 900000 });
  await page.waitForSelector(TILE, { timeout: 900000 });
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  if (m.dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(1200);
  return { ctx, page };
}

const browser = await chromium.launch();
for (const m of MODES) {
  const { ctx, page } = await open(browser, m, '/dev/supplier-plan-lab?s=gifts&app=1');
  await page.locator(TILE).first().click();
  await page.waitForSelector('[data-gift-ticket-sheet]', { timeout: 120000 });
  await page.waitForTimeout(1500);
  await shoot(page, m, `${HERE}/app-gift-sheet-${m.tag}.png`);
  console.log('app sheet', m.tag, JSON.stringify(await factsOf(page, '[data-gift-ticket-sheet]')));

  // Add 1 → the store opens on that row; then a 10 + 1 bundle from its row's + → two lines, two Apple purchases.
  await page.locator('[data-testid="gift-sheet-add-1"]').click();
  await page.waitForSelector('[data-gift-cart-apple]', { timeout: 120000 });
  await page.waitForTimeout(2600);
  const more = page.locator('[data-store-row^="GIFT_BUNDLE_PAPIC_GUEST_150"] button[aria-label="One more"]');
  if (await more.count()) await more.first().click();
  await page.waitForTimeout(800);
  await shoot(page, m, `${HERE}/app-gift-store-${m.tag}.png`);
  console.log('app store', m.tag, JSON.stringify(await factsOf(page, '[data-gift-cart-apple]')));
  await ctx.close();
}
{
  const { ctx, page } = await open(browser, MODES[0], '/dev/supplier-plan-lab?s=gifts');
  await page.locator(TILE).first().click();
  await page.waitForSelector('[data-gift-ticket-sheet]', { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${HERE}/web-gift-sheet-375-light.png` });
  console.log('web sheet', JSON.stringify(await factsOf(page, '[data-gift-ticket-sheet]')));
  await ctx.close();
}
await browser.close();
