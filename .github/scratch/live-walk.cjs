// TEMPORARY — see tmp-live-walk-418.yml.
const { chromium } = require('playwright');
const fs = require('fs');
const dir = process.argv[2]; fs.mkdirSync(dir, { recursive: true });
const BASE = 'https://www.setnayan.com';
const PATHS = ['/', '/testw2walkcakes', '/v/testw2walkcakes', '/login', '/explore'];
const ZONES = [['Asia/Manila', 'en-PH'], ['UTC', 'en-US']];
(async () => {
  const browser = await chromium.launch();
  const summary = [];
  for (const [tz, loc] of ZONES) for (const p of PATHS) for (const run of [1, 2]) {
    const tag = `${tz.replace('/', '_')}${p.replace(/\//g, '_') || '_root'}_${run}`;
    const ctx = await browser.newContext({ timezoneId: tz, locale: loc, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const out = { tag, path: p, tz, run, console: [], pageerrors: [], http4xx5xx: [], failed: [], abortedNonGet: [], status: null };
    await page.route('**/*', (route) => {
      const r = route.request();
      if (r.method() !== 'GET' && r.method() !== 'HEAD') {
        out.abortedNonGet.push({ method: r.method(), url: r.url(), body: (r.postData() || '').slice(0, 3000) });
        return route.abort();
      }
      return route.continue();
    });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') out.console.push(`${m.type()}: ${m.text().slice(0, 3000)}`); });
    page.on('pageerror', (e) => out.pageerrors.push(String(e.stack || e).slice(0, 3000)));
    page.on('response', (r) => { if (r.status() >= 400) out.http4xx5xx.push({ status: r.status(), url: r.url(), type: r.request().resourceType(), frame: r.frame()?.url() }); });
    page.on('requestfailed', (r) => { if (!/net::ERR_FAILED/.test(r.failure()?.errorText || '') || r.method() === 'GET') out.failed.push({ url: r.url(), err: r.failure()?.errorText, method: r.method() }); });
    // the raw server HTML, as the browser first receives it
    let raw = '';
    page.on('response', async (r) => { if (r.request().isNavigationRequest() && r.url().startsWith(BASE)) { try { raw = await r.text(); out.status = r.status(); } catch {} } });
    try { await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { out.nav = String(e); }
    await page.waitForTimeout(5000);
    // flush the page-hide beacons too (they are aborted, but we see their payload)
    try { await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); }); } catch {}
    await page.waitForTimeout(500);
    fs.writeFileSync(`${dir}/${tag}.server.html`, raw);
    try { fs.writeFileSync(`${dir}/${tag}.client.html`, await page.content()); } catch {}
    fs.writeFileSync(`${dir}/${tag}.json`, JSON.stringify(out, null, 1));
    summary.push({ tag, status: out.status, errors: out.console.length + out.pageerrors.length, bad: out.http4xx5xx.length });
    console.log(JSON.stringify(out, null, 1));
    await ctx.close();
  }
  console.log(JSON.stringify(summary, null, 1));
  await browser.close();
})();
