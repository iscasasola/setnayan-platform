// The DRAWING half of the §4 pairs: drives build-sessions/UNICHAT-LIVE-2026-11-19.html (the approved three-phone
// prototype) to each H2 scene and photographs it — host phone at 375 light and dark, and the computer view.
// Run from the repo root:  node build-sessions/shots-unichat-h2/drawing.mjs <path-to-UNICHAT-LIVE-2026-11-19.html>
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const SRC = 'file://' + process.argv[2];

async function walk(p) {
  const click = async (side, act) => { await go(p, side); await p.click(`.phone[data-side="${side}"] [data-act="${act}"]`); };
  const shots = {};
  shots.terms = { side: 'host', sel: '[data-act="terms"]' };
  await snapAll(p, 'terms', shots.terms);
  await click('host', 'q-accept'); await p.waitForTimeout(400);
  await click('host', 'send'); await p.waitForTimeout(900);
  await go(p, 'supplier');
  await p.click('.phone[data-side="supplier"] [data-act="step"]:has-text("Ask payment")'); await p.waitForTimeout(500);
  await p.fill('.phone[data-side="supplier"] .tool input[name="amt"]', '15300');
  await click('supplier', 'send'); await p.waitForTimeout(800);
  await click('host', 'p-pay'); await p.waitForTimeout(600);
  await click('host', 'send'); await p.waitForTimeout(800);
  await click('supplier', 'p-confirm'); await p.waitForTimeout(800);
  await snapAll(p, 'receipt', { side: 'host', sel: '[data-act="rc-pdf"]' });
  await click('supplier', 'more'); await p.waitForTimeout(400);
  await click('supplier', 'mo-crew'); await p.waitForTimeout(700);
  await snapAll(p, 'crew-supplier-picker', { side: 'supplier', sel: null });
  await click('supplier', 'crew-save'); await p.waitForTimeout(800);
  await snapAll(p, 'crew', { side: 'host', sel: '.quiet:has-text("crew is set"), :text("crew is set")' });
  await p.click('#ffafter'); await p.waitForTimeout(900);
  await snapAll(p, 'handover-review', { side: 'host', sel: '[data-act="rv-write"]' });
}

let mode;
// The computer view shows one side at a time (the drawing's own side switch); the phone view shows all three.
async function go(p, side) {
  if (!p.__computer) return;
  await p.click(`#switch button[data-go="${side}"]`); await p.waitForTimeout(250);
}
async function snapAll(p, name, { side, sel }) {
  if (mode.view === 'computer') {
    // Walked in the phone view (every side on screen); photographed in the computer view, then back.
    await p.click('#viewsw button[data-view="computer"]'); await p.waitForTimeout(400); p.__computer = true;
  }
  await go(p, side);
  if (sel) {
    await p.evaluate(([s, q]) => {
      const ph = document.querySelector(`.phone[data-side="${s}"]`);
      let el = null; try { el = ph.querySelector(q.split(',')[0]); } catch {}
      if (!el) el = [...ph.querySelectorAll('*')].reverse().find((e) => /crew is set/.test(e.textContent) && e.children.length === 0) || null;
      el?.scrollIntoView({ block: 'center' });
    }, [side, sel]);
    await p.waitForTimeout(250);
  }
  const target = p.locator(`.phone[data-side="${side}"]`);
  await target.screenshot({ path: `${HERE}/drawing-${name}-${mode.tag}.png` });
  console.log('drawing', name, mode.tag);
  if (p.__computer) { p.__computer = false; await p.click('#viewsw button[data-view="phone"]'); await p.waitForTimeout(400); }
}

const browser = await chromium.launch();
for (const m of [
  { tag: '375-light', theme: 'light', view: 'phone', w: 1400, h: 900 },
  { tag: '375-dark', theme: 'dark', view: 'phone', w: 1400, h: 900 },
  { tag: 'desktop', theme: 'light', view: 'computer', w: 1280, h: 860 },
]) {
  mode = m;
  const ctx = await browser.newContext({ viewport: { width: m.w, height: m.h }, deviceScaleFactor: 2, colorScheme: m.theme });
  await ctx.addInitScript(([t, v]) => { try { localStorage.setItem('unichat-theme', t); localStorage.setItem('unichat-view', 'phone'); } catch {} }, [m.theme, m.view]);
  const p = await ctx.newPage();
  await p.goto(SRC); await p.waitForTimeout(900);
  await walk(p).catch((e) => console.log('walk', m.tag, e.message.slice(0, 300)));
  await ctx.close();
}
await browser.close();
