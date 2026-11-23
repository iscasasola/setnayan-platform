// #7988 shots: Home + Discover, signed in, at 375 px light + dark and 1280 px desktop, against stub-backend.mjs.
// Run: node stub-backend.mjs & ; next dev -p 3100 (NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321); node shots.cjs <outdir>
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
const VIEWS = [
  ['375-light', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'light'],
  ['375-dark', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'dark'],
  ['desktop', { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 }, 'light'],
];
(async () => {
  const browser = await chromium.launch();
  for (const [tag, opts, theme] of VIEWS) {
    const ctx = await browser.newContext({ ...opts, colorScheme: theme });
    await ctx.addCookies([
      { name: 'sb-127-auth-token', value: val, domain: 'localhost', path: '/' },
      { name: 'sn-theme', value: theme, domain: 'localhost', path: '/' },
    ]);
    await ctx.addInitScript(() => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
    const page = await ctx.newPage();
    for (const [name, path] of [['home', '/dashboard'], ['discover', '/']]) {
      const r = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 300000 });
      await page.waitForTimeout(2500);
      for (const re of [/^Skip/, /^Done$/]) {
        const b = page.getByRole('button', { name: re });
        if (await b.count()) { await b.first().evaluate((x) => x.click()); await page.waitForTimeout(1200); }
      }
      // `/` and `/dashboard` are NOT in DARK_READY (lib/appearance.ts) yet, so the head script keeps them light for
      // everyone. The dark shots FORCE `.dark` to show how this PR's parts read in dark — not what a person sees today.
      if (theme === 'dark') { await page.evaluate(() => document.documentElement.classList.add('dark')); await page.waitForTimeout(600); }
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
      const info = await page.evaluate(() => {
        const pick = document.querySelector('[data-discover-pinned] [data-pinned-pick], [data-home-pinned] [data-pinned-pick]');
        const r = pick?.getBoundingClientRect();
        return { url: location.pathname, dark: document.documentElement.classList.contains('dark'),
          pinnedRows: document.querySelectorAll('[data-pinned-row]').length,
          pickLeft: r ? Math.round(r.left) : null, vw: innerWidth };
      });
      console.log(tag, name, r.status(), JSON.stringify(info));
      await page.screenshot({ path: `${out}/${name}-${tag}.png` });
    }
    if (tag === '375-light') {
      await page.goto(base + '/dashboard', { waitUntil: 'networkidle' });
      await page.evaluate(() => { const h = document.querySelector('.shell-topbar, header.fd-topbar'); if (h) h.dataset.walkMark = '1'; return h ? h.className.slice(0, 60) : null; }).then((c) => console.log('marked bar:', c));
      const link = page.locator('a[href="/"] >> visible=true').first();
      if (await link.count()) {
        await link.evaluate((a) => a.click());
        await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 60000 }); await page.waitForTimeout(2000);
        console.log('tap Home→Discover:', JSON.stringify(await page.evaluate(() => ({ url: location.pathname, bars: document.querySelectorAll('.shell-topbar, header.fd-topbar').length, barKept: !!document.querySelector('[data-walk-mark="1"]') }))));
      }
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
