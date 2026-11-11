// Portfolio group heading → Rise full screen: Now-beside-Proposed shots at 390 px, light + dark, with a mid-rise frame.
// Run against a /dev lab on a DUMMY env (no database): node shoot.mjs http://localhost:PORT
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3488';
const OUT = process.argv[3] ?? dirname(fileURLToPath(import.meta.url));
const URL = `${BASE}/dev/supplier-lab?s=portfolio-tab`;
const browser = await chromium.launch();

async function shoot(scheme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 180_000 });
  const head = page.locator('[data-portfolio-open="albums"]');
  // The Next dev overlay's badge is not the app — hidden from the shots.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  // The heading sits mid-screen, the way a supplier meets it after a short scroll.
  await page.evaluate(() => {
    const h = document.querySelector('[data-portfolio-open="albums"]');
    window.scrollTo(0, window.scrollY + h.getBoundingClientRect().top - 330);
  });
  await page.waitForTimeout(600);
  const now = await page.screenshot();
  // Press the heading, then freeze the rise mid-way (350 of 700 ms).
  await head.click();
  await page.waitForSelector('[data-rise-screen="portfolio-albums"]');
  await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 350; }));
  await page.waitForTimeout(100);
  const mid = await page.screenshot();
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await page.waitForTimeout(500);
  const risen = await page.screenshot();
  await ctx.close();
  return { now, mid, risen };
}

async function compose(scheme, shots) {
  const ctx = await browser.newContext({ viewport: { width: 1290, height: 960 }, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await ctx.newPage();
  const img = (b) => `data:image/png;base64,${b.toString('base64')}`;
  const bg = scheme === 'dark' ? '#16140f' : '#f4efe6';
  const fg = scheme === 'dark' ? '#efe9dd' : '#1d1a14';
  await page.setContent(`<body style="margin:0;background:${bg};color:${fg};font:600 15px system-ui;display:flex;gap:18px;padding:18px">
    ${[['NOW — › leaves for another page', shots.now], ['PROPOSED — mid-rise (0.35 s of 0.7 s)', shots.mid], ['PROPOSED — risen full screen', shots.risen]]
      .map(([t, b]) => `<figure style="margin:0;width:406px"><figcaption style="margin-bottom:8px">${t}</figcaption><img src="${img(b)}" style="width:390px;border-radius:14px;border:1px solid #8884"></figure>`)
      .join('')}</body>`);
  await page.screenshot({ path: join(OUT, `now-beside-proposed-${scheme}.png`), fullPage: true });
  await ctx.close();
}

for (const scheme of ['light', 'dark']) {
  const s = await shoot(scheme);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(OUT, `now-${scheme}.png`), s.now);
  writeFileSync(join(OUT, `proposed-mid-rise-${scheme}.png`), s.mid);
  writeFileSync(join(OUT, `proposed-risen-${scheme}.png`), s.risen);
  await compose(scheme, s);
}
await browser.close();
console.log('shots written to', OUT);
