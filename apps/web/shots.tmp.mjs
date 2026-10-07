import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const OUT = process.env.OUT, BASE = 'http://localhost:3417/dev/home-lab?proto=1';
const b = await chromium.launch();
const measure = () => {
  const r = (s) => [...document.querySelectorAll(s)].map((e) => { const b = e.getBoundingClientRect(); return { s, top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width), cls: e.className.toString().slice(0, 40) }; });
  return [...r('[data-home-cover]'), ...r('[data-home-next]'), ...r('.home-doors'), ...r('.home-doors > .ab'), ...r('.home-nums'), ...r('.home-nums > *'), ...r('[data-home-money]'), ...r('[data-home-whats-next]'), ...r('[data-home-services]')];
};
const log = {};
for (const [w, h] of [[375, 812], [1280, 900]]) for (const fail of [0, 1]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 768, isMobile: w < 768 });
  await p.goto(BASE + (fail ? '&fail=1' : ''), { waitUntil: 'networkidle', timeout: 240000 });
  await p.waitForTimeout(2000);
  const name = `build-home${fail ? '-fail' : ''}-${w}`;
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  log[name] = await p.evaluate(measure);
  if (!fail && w === 375) {
    await p.click('[data-home-whats-next] .home-bar');
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/build-home-whatsnext-open-375.png`, fullPage: true });
    log['whatsnext-open-375'] = await p.evaluate(() => { const e = document.querySelector('.home-fold'); const r = e.getBoundingClientRect(); return { foldH: Math.round(r.height), url: location.search }; });
  }
  await p.close();
}
console.log(JSON.stringify(log, null, 1));
// side-by-sides
for (const [w] of [[375], [1280]]) for (const fail of [0, 1]) {
  const sfx = `${fail ? '-fail' : ''}-${w}`;
  const img = (f) => 'data:image/png;base64,' + readFileSync(`${OUT}/${f}`).toString('base64');
  const html = `<body style="margin:0;background:#ddd;font:14px system-ui"><div style="display:flex;gap:24px;padding:16px;align-items:flex-start"><div><p>Prototype</p><img src="${img(`proto-home${sfx}.png`)}" style="width:${w}px;border:1px solid #999"></div><div><p>Build (/dev/home-lab?proto=1${fail ? '&fail=1' : ''})</p><img src="${img(`build-home${sfx}.png`)}" style="width:${w}px;border:1px solid #999"></div></div></body>`;
  const p = await b.newPage({ viewport: { width: w * 2 + 80, height: 900 } });
  await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/side-by-side-home${sfx}.png`, fullPage: true });
  await p.close();
}
await b.close();
