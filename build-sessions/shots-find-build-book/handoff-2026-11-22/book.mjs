import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2];
const b = await chromium.launch();
for (const s of [{ t: '375-light', w: 375, h: 812, c: 'light', d: 2 }, { t: '375-dark', w: 375, h: 812, c: 'dark', d: 2 }, { t: '1280', w: 1280, h: 900, c: 'light', d: 1 }]) {
  const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: s.c, deviceScaleFactor: s.d });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/dev/suppliers-lab?mode=booked', { waitUntil: 'networkidle', timeout: 300000 });
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  const nn = p.getByRole('button', { name: /not now/i }).first();
  if (await nn.count()) { await nn.click(); await p.waitForTimeout(1200); }
  await p.screenshot({ path: `${out}/book-${s.t}.png` });
  console.log('shot', s.t);
  await ctx.close();
}
await b.close();
