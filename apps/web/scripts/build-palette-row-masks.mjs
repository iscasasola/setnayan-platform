// node scripts/build-palette-row-masks.mjs  (from apps/web) — writes public/palette/wc-edge-{1,2,3}.png
//
// 🎨 THE WATERCOLOUR LOOK'S ROUGH EDGE, PRE-RENDERED (2026-10-17, owner: "why do they have different palette icon?").
// A role's row draws its colours at 20 px. The full-size dots get their bled edge from ONE live SVG filter
// (`#sn-pal-wc`, dress-code-palette-looks.tsx); per row dot that filter cost ~7x the raster time (60 dots, 375 px,
// DPR 2: 5.9 ms vs 0.8 ms). So the SAME filter — same turbulence, same displacement — is run here once per seed, on a
// 60 px dot, and saved as an alpha mask the row dots wear (`mask-image`, globals.css "ROW SIZE"). Re-run only if the
// filter in `WatercolourEdge` changes.
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'public/palette';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 140 }, deviceScaleFactor: 1 });
// Three seeds so neighbouring row dots are not stamped from one blob (the full size gets variety from each dot's place in the noise).
await p.setContent(`<html><body style="margin:0;background:transparent">
<svg width="0" height="0" style="position:absolute"><defs>
${[11, 23, 37].map((s) => `<filter id="f${s}" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="3" seed="${s}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G"/></filter>`).join('')}
</defs></svg>
${[11, 23, 37].map((s, i) => `<div id="d${s}" style="position:absolute;left:${10 + i * 120}px;top:10px;width:80px;height:80px;padding:10px;box-sizing:content-box"><div style="width:60px;height:60px;margin:10px;border-radius:50%;background:#000;filter:url(#f${s})"></div></div>`).join('')}
</body></html>`);
await p.waitForTimeout(300);
for (const s of [11, 23, 37]) {
  await p.locator(`#d${s}`).screenshot({ path: `${out}/wc-edge-${[11, 23, 37].indexOf(s) + 1}.png`, omitBackground: true });
}
await b.close();
console.log('ok');
