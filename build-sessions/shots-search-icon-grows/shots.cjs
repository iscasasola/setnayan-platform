// #8091 shots: the thumb-row search at rest (a round icon) and after one tap (grown to the row), on the dev lab
// (`/dev/thumb-row-lab`, no sign-in, fixture lists) — Today (supplier) and Discover — at 375 light, 375 dark, desktop.
// Run: next dev -p 3200 (in apps/web); node shots.cjs <outdir> [base]
const { chromium } = require('playwright');
const [out, base] = [process.argv[2], process.argv[3] || 'http://localhost:3200'];
const VIEWS = [
  ['375-light', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, false],
  ['375-dark', { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true],
  ['desktop', { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 }, false],
];
const measure = () => {
  const inp = [...document.querySelectorAll('[data-thumb-row] input[type="search"]')].find((i) => i.offsetParent !== null);
  if (!inp) return { found: false };
  const seat = inp.closest('[data-thumb-seat]') || inp.parentElement;
  const svg = seat.querySelector('svg');
  const s = seat.getBoundingClientRect(); const g = svg?.getBoundingClientRect();
  const row = seat.closest('[data-thumb-row]').getBoundingClientRect();
  return { found: true, seatW: Math.round(s.width), seatH: Math.round(s.height), rowW: Math.round(row.width),
    iconOffX: g ? +((g.left + g.width / 2) - (s.left + s.width / 2)).toFixed(1) : null,
    iconOffY: g ? +((g.top + g.height / 2) - (s.top + s.height / 2)).toFixed(1) : null,
    focused: document.activeElement === inp };
};
(async () => {
  const browser = await chromium.launch();
  for (const [tag, opts, dark] of VIEWS) {
    const ctx = await browser.newContext(opts);
    await ctx.addInitScript(() => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
    const page = await ctx.newPage();
    for (const screen of ['today', 'discover']) {
      await page.goto(`${base}/dev/thumb-row-lab?screen=${screen}`, { waitUntil: 'networkidle', timeout: 300000 });
      // No route here is in DARK_READY and the lab has no sign-in: the dark shots FORCE `.dark` to show the parts in dark.
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(1200);
      console.log(tag, screen, 'rest', JSON.stringify(await page.evaluate(measure)));
      await page.screenshot({ path: `${out}/${screen}-rest-${tag}.png` });
      const inp = page.locator('[data-thumb-row] input[type="search"] >> visible=true').first();
      if (opts.hasTouch) await inp.tap(); else await inp.click();
      await page.waitForTimeout(1400); // the hold lets go after Rise 700 with no keyboard (a headless browser has none)
      console.log(tag, screen, 'open', JSON.stringify(await page.evaluate(measure)));
      await page.screenshot({ path: `${out}/${screen}-open-${tag}.png` });
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
