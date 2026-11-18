// TEMPORARY — round 3: (a) server-vs-hydrated TEXT diff on /u/icecasa (the page that throws #418 live);
// (b) every icon/manifest the live HTML names; (c) a headed pass. Non-GET aborted throughout.
const { chromium } = require('playwright');
const BASE = 'https://www.setnayan.com';
const textNodes = () => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const path = (el) => { const p = []; while (el && el !== document.body) { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.'); if (c) s += '.' + c; for (const a of el.getAttributeNames()) if (a.startsWith('data-')) { s += `[${a}]`; break; } p.unshift(s); el = el.parentElement; } return p.join('>'); };
  let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (!t) continue; const pe = n.parentElement; if (!pe || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(pe.tagName)) continue; out.push([path(pe), t.slice(0, 200)]); }
  return out;
};
const block = (r) => (['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : r.abort());
(async () => {
  const browser = await chromium.launch();
  for (const p of ['/u/icecasa']) for (const tz of ['Asia/Manila', 'UTC']) {
    const opts = { timezoneId: tz, locale: tz === 'UTC' ? 'en-US' : 'en-PH', viewport: { width: 1440, height: 900 } };
    const c1 = await browser.newContext({ ...opts, javaScriptEnabled: false });
    const a = await c1.newPage(); await a.route('**/*', block);
    await a.goto(BASE + p, { waitUntil: 'load' }); const server = await a.evaluate(textNodes); await c1.close();
    const c2 = await browser.newContext(opts);
    const b = await c2.newPage(); await b.route('**/*', block);
    const errs = []; b.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await b.goto(BASE + p, { waitUntil: 'networkidle' }); await b.waitForTimeout(3000); const client = await b.evaluate(textNodes); await c2.close();
    console.log(`=== DIFF ${p} tz=${tz} server=${server.length} client=${client.length} errors=${JSON.stringify(errs)}`);
    const key = (x) => x[0] + ' :: ' + x[1];
    const sset = new Map(); for (const x of server) sset.set(key(x), (sset.get(key(x)) || 0) + 1);
    const cset = new Map(); for (const x of client) cset.set(key(x), (cset.get(key(x)) || 0) + 1);
    for (const [k, v] of sset) if ((cset.get(k) || 0) < v) console.log('ONLY-SERVER  ' + k);
    for (const [k, v] of cset) if ((sset.get(k) || 0) < v) console.log('ONLY-CLIENT  ' + k);
  }
  // (b) head-linked icons + manifest
  const seen = new Map();
  const get = async (u) => { if (seen.has(u)) return seen.get(u); let s; try { s = (await fetch(u, { redirect: 'manual' })).status; } catch (e) { s = 'ERR ' + e.message; } seen.set(u, s); return s; };
  for (const p of ['/', '/testw2walkcakes', '/v/testw2walkcakes', '/login', '/explore', '/u/icecasa']) {
    const html = await (await fetch(BASE + p)).text();
    for (const l of [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0])) {
      const rel = (l.match(/rel="([^"]+)"/) || [])[1] || ''; const href = ((l.match(/href="([^"]+)"/) || [])[1] || '').replace(/&amp;/g, '&');
      if (!/icon|manifest|apple/.test(rel) || !href) continue;
      const u = new URL(href, BASE).href; const s = await get(u); console.log(`LINK ${p} rel=${rel} ${s} ${u}`);
      if (rel === 'manifest' && s === 200) { const m = await (await fetch(u)).json().catch(() => null); for (const i of (m && m.icons) || []) { const iu = new URL(i.src, u).href; console.log(`MANIFEST-ICON ${p} ${await get(iu)} ${iu}`); } }
    }
  }
  await browser.close();
  // (c) headed
  const hb = await chromium.launch({ headless: false });
  for (const p of ['/', '/testw2walkcakes', '/v/testw2walkcakes', '/login', '/explore']) {
    const ctx = await hb.newContext({ timezoneId: 'Asia/Manila', locale: 'en-PH', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage(); await page.route('**/*', block);
    page.on('pageerror', (e) => console.log(`HEADED-PAGEERROR ${p} ${String(e).slice(0, 300)}`));
    page.on('response', (r) => { if (r.status() >= 400) console.log(`HEADED-HTTP ${p} ${r.status()} ${r.request().resourceType()} ${r.url()}`); });
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await page.waitForTimeout(3000);
    await ctx.close();
  }
  await hb.close();
  console.log('ROUND3 DONE');
})();
