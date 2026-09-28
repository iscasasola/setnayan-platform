import { chromium } from '@playwright/test';
const OUT = process.argv[2];
const BASE = 'http://localhost:3107/dev/details-lab';
const b = await chromium.launch();
const weights = {};
for (const [w, h] of [[375, 812], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  let bytes = 0, n = 0;
  p.on('response', async (r) => { try { const buf = await r.body(); bytes += buf.length; n += 1; } catch {} });
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForTimeout(1500);
  weights[w] = { requests: n, kb: Math.round(bytes / 1024) };
  await p.screenshot({ path: `${OUT}/${w}-theme.png` });
  // open the editor sheet
  await p.tap('[data-details-editor-handle]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${w}-theme-editor.png` });
  await p.tap('[data-details-editor-handle]');
  // pick the Invitation item in the strip
  await p.tap('[data-details-nav-item="invitation"]');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/${w}-invitation.png` });
  await p.tap('[data-details-editor-handle]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${w}-invitation-editor.png` });
  // full-screen preview + exit
  await p.tap('[data-details-editor-handle]');
  await p.tap('[data-details-nav-item="theme"]');
  await p.waitForTimeout(400);
  await p.tap('[data-theme-tile-expand="vintage"]');
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${w}-preview.png` });
  await p.goBack(); // the phone's back gesture
  await p.waitForTimeout(600);
  weights[`${w}-after-back`] = { overlayOpen: await p.$('[data-theme-preview]') !== null, url: p.url() };
  await p.screenshot({ path: `${OUT}/${w}-after-back.png` });
  await ctx.close();
}
console.log(JSON.stringify(weights));
await b.close();
