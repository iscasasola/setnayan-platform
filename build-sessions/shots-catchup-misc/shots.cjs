const { chromium } = require('playwright');
const crypto = require('crypto');
const b64u = (b) => Buffer.from(b).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const hdr = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const pay = b64u(JSON.stringify({ sub: '00000000-0000-4000-8000-000000000001', role: 'authenticated', aud: 'authenticated', email: 'walker@example.test', exp: now + 86400, iat: now, session_id: 's1' }));
const sig = b64u(crypto.createHmac('sha256', 'stub').update(hdr + '.' + pay).digest());
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'walker@example.test' };
const session = { access_token: `${hdr}.${pay}.${sig}`, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: now + 86400, user };
const val = 'base64-' + b64u(JSON.stringify(session));
const [out, base] = [process.argv[2], process.argv[3] || 'http://localhost:3100'];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: 'sb-127-auth-token', value: val, domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  await ctx.addInitScript(() => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
  for (const [name, path] of [['home', '/dashboard'], ['discover', '/']]) {
    const r = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 240000 });
    await page.waitForTimeout(2500);
    const skip = page.getByRole('button', { name: /^Skip/ });
    if (await skip.count()) { await skip.first().evaluate((b) => b.click()); await page.waitForTimeout(1200); }
    const done = page.getByRole('button', { name: /^Done$/ });
    if (await done.count()) { await done.first().evaluate((b) => b.click()); await page.waitForTimeout(1200); }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
    const info = await page.evaluate(() => ({ url: location.pathname, topbars: document.querySelectorAll('header.fd-topbar').length, mains: document.querySelectorAll('main').length, h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) }));
    console.log(name, r.status(), JSON.stringify(info));
    await page.screenshot({ path: `${out}/${name}-390.png` });
  }
  // the tap between them: is the top bar the SAME node?
  await page.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  await page.evaluate(() => { const h = document.querySelector('header.fd-topbar, header'); if (h) h.dataset.walkMark = '1'; });
  const link = page.locator('a[href="/"] >> visible=true').first();
  if (await link.count()) { await link.evaluate((a) => a.click()); await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 60000 }); await page.waitForTimeout(2000);
    console.log('after tap Home→Discover:', await page.evaluate(() => ({ url: location.pathname, barKept: !!document.querySelector('[data-walk-mark="1"]') })));
    await page.screenshot({ path: `${out}/discover-after-tap-from-home-390.png` }); }
  else console.log('no link to / found on Home');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
