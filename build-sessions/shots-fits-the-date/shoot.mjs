// Renders harness.html (dummy data) into one Now-beside-Proposed PNG per section, 390 px frames.
// Run from the repo root: node build-sessions/shots-fits-the-date/shoot.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const names = { s1: '1-discover-list', s2: '2-discover-empty', s3: '3-find-empty', s4: '4-bench-badge' };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(path.join(dir, 'harness.html')).href);
for (const [id, name] of Object.entries(names)) {
  await page.locator(`#${id}`).screenshot({ path: path.join(dir, `${name}.png`) });
  console.log('wrote', `${name}.png`);
}
await browser.close();
