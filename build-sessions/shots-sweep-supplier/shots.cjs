const { chromium } = require('playwright');
const OUT = '/home/user/setnayan-platform/build-sessions/shots-sweep-supplier/';
const CSS = 'nextjs-portal{display:none!important} :root{--sn-page-bg:247 245 244 !important;--sn-frame-shadow:var(--m-shadow-md) !important}';
const shots = [
  ['01-shop-tab-makers', '/dev/supplier-lab?s=shop-tab', '[data-shop-makers], button.sn-press'],
  ['02-offers-rows', '/dev/offer-maker-lab', null],
  ['03-hub-post-an-update-sheet', '/dev/supplier-lab?s=hub&ev=ic', '[data-post-an-update-open]', true],
  ['04-your-page-verify', '/dev/supplier-lab?s=page', null],
  ['05-portfolio-tab', '/dev/supplier-lab?s=portfolio-tab', null],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, url, sel, open] of shots) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    try {
      await p.goto('http://localhost:3100' + url, { waitUntil: 'networkidle', timeout: 300000 });
      await p.addStyleTag({ content: CSS });
      if (sel) { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {}); if (open) { await el.click(); await p.waitForTimeout(900); } }
      await p.waitForTimeout(700);
      await p.screenshot({ path: OUT + name + '.png', fullPage: !open });
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      console.log(name, 'ok', 'scrollWidth', sw);
    } catch (e) { console.log(name, 'FAIL', e.message.split('\n')[0]); }
    await p.close();
  }
  await b.close();
})();
