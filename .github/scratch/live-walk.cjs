// TEMPORARY — see tmp-live-walk-418.yml. Round 2: desktop + phone, scroll, SW-controlled reload.
const { chromium } = require('playwright');
const BASE = 'https://www.setnayan.com';
const PATHS = ['/', '/testw2walkcakes', '/v/testw2walkcakes', '/login', '/signup', '/explore', '/features', '/start', '/suppliers', '/u/icecasa'];
const VIEWS = [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]];
(async () => {
  const browser = await chromium.launch();
  const hits = [];
  for (const [vn, vp] of VIEWS) for (const p of PATHS) {
    const ctx = await browser.newContext({ timezoneId: 'Asia/Manila', locale: 'en-PH', viewport: vp, isMobile: vn === 'phone', hasTouch: vn === 'phone' });
    const page = await ctx.newPage();
    let load = 0;
    const rec = (kind, detail) => { const h = { view: vn, path: p, load, kind, detail }; hits.push(h); console.log(JSON.stringify(h)); };
    await page.route('**/*', (route) => {
      const r = route.request();
      if (r.method() !== 'GET' && r.method() !== 'HEAD') { rec('aborted-' + r.method(), r.url() + ' ' + (r.postData() || '').slice(0, 400)); return route.abort(); }
      return route.continue();
    });
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_FAILED/.test(m.text())) rec('console-' + m.type(), m.text().slice(0, 4000) + ' @ ' + JSON.stringify(m.location())); });
    page.on('pageerror', (e) => rec('pageerror', String(e.stack || e).slice(0, 4000)));
    page.on('response', (r) => { if (r.status() >= 400) rec('http-' + r.status(), r.request().resourceType() + ' ' + r.url() + ' from=' + (r.request().headers()['referer'] || '') + ' sw=' + r.fromServiceWorker()); });
    page.on('requestfailed', (r) => { if (r.method() === 'GET' && !/ERR_ABORTED/.test(r.failure()?.errorText || '')) rec('failed', r.url() + ' ' + r.failure()?.errorText); });
    for (load = 1; load <= 3; load++) {
      try {
        if (load === 1) await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 });
        else await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
      } catch (e) { rec('nav', String(e).slice(0, 300)); }
      const sw = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)).catch(() => null);
      const bar = await page.evaluate(() => !!document.getElementById('sn-css-failed')).catch(() => null);
      rec('state', `sw=${sw} cssFailBar=${bar}`);
      // scroll to the bottom so lazy images / sections load
      try { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } }); } catch {}
      await page.waitForTimeout(2500);
    }
    await ctx.close();
  }
  const sig = hits.filter((h) => !/^aborted-|^state$/.test(h.kind));
  console.log('=== SIGNIFICANT ===');
  for (const h of sig) console.log(JSON.stringify(h));
  console.log('=== STATES ===');
  for (const h of hits.filter((h) => h.kind === 'state')) console.log(h.view, h.path, h.load, h.detail);
  await browser.close();
})();
