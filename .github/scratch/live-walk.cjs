// TEMPORARY — round 4: name the node React #418 trips on, on /u/icecasa. Non-GET aborted.
const { chromium } = require('playwright');
const BASE = 'https://www.setnayan.com';
const INIT = () => {
  const ring = []; window.__snReads = ring; window.__snErr = [];
  const path = (el) => { const p = []; while (el && el.nodeType === 1 && el !== document.documentElement) { let s = el.tagName.toLowerCase(); const c = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'); if (c) s += '.' + c; for (const a of el.getAttributeNames()) if (a.startsWith('data-') || a === 'id') { s += `[${a}=${(el.getAttribute(a) || '').slice(0, 20)}]`; } p.unshift(s); el = el.parentElement; } return p.slice(-7).join('>'); };
  const wrap = (proto, prop) => { const d = Object.getOwnPropertyDescriptor(proto, prop); Object.defineProperty(proto, prop, { configurable: true, enumerable: d.enumerable, set: d.set, get() { const v = d.get.call(this); try { if (ring.length < 200000) ring.push([performance.now(), prop, this.nodeType === 3 ? 'TEXT in ' + path(this.parentElement) : path(this), String(v).slice(0, 160)]); } catch {} return v; } }); };
  wrap(Node.prototype, 'nodeValue'); wrap(Node.prototype, 'textContent');
  window.addEventListener('error', (e) => window.__snErr.push([performance.now(), String(e.error || e.message).slice(0, 160)]), true);
  const oe = console.error; console.error = function (...a) { try { window.__snErr.push([performance.now(), 'console.error ' + a.map((x) => (x && x.stack) ? x.stack.slice(0, 300) : String(x).slice(0, 300)).join(' | ')]); } catch {} return oe.apply(this, a); };
  window.addEventListener('DOMContentLoaded', () => { window.__snDcl = performance.now(); });
};
(async () => {
  const browser = await chromium.launch();
  for (const run of [1, 2]) {
    const ctx = await browser.newContext({ timezoneId: 'Asia/Manila', locale: 'en-PH', viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    await page.route('**/*', (r) => (['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : r.abort()));
    await page.goto(BASE + '/u/icecasa', { waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
    const res = await page.evaluate(() => {
      const errs = window.__snErr; const e418 = errs.find((e) => /418/.test(e[1]));
      const reads = window.__snReads;
      const before = e418 ? reads.filter((r) => r[0] <= e418[0]) : reads;
      return { errs, total: reads.length, last: before.slice(-25), firstReads: reads.slice(0, 5) };
    });
    console.log(`=== RUN ${run} reads=${res.total}`);
    for (const e of res.errs) console.log('ERR', e[0].toFixed(1), e[1]);
    for (const r of res.last) console.log('READ', r[0].toFixed(1), r[1], r[2], JSON.stringify(r[3]));
    await ctx.close();
  }
  await browser.close();
  console.log('ROUND4 DONE');
})();
