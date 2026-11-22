// node draw.mjs <drawing.html> <outDir> — the drawing half of each pair: Proposed, 390 light / 390 dark / 1280.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
const [file, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const PANES = ['find', 'build', 'book', 'when', 'where', 'guests'];
const SIZES = [
  { tag: '390-light', w: 'w390', scheme: 'light' },
  { tag: '390-dark', w: 'w390', scheme: 'dark' },
  { tag: '1280', w: 'w1280', scheme: 'light' },
];
const b = await chromium.launch();
for (const s of SIZES) {
  const ctx = await b.newContext({ viewport: { width: 1800, height: 1300 }, colorScheme: s.scheme, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('file://' + file);
  for (const pane of PANES) {
    await p.evaluate(([w, pane]) => {
      for (const id of [w, 'vnew', 'p-' + pane]) {
        const el = document.getElementById(id);
        if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    }, [s.w, pane]);
    await p.waitForTimeout(300);
    const box = p.locator('.stage .box.new').first();
    await box.screenshot({ path: `${out}/${pane}-${s.tag}-drawing.png` });
    console.log('drew', pane, s.tag);
  }
  await ctx.close();
}
await b.close();
