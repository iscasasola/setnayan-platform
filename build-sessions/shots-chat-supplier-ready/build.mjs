// The chat supplier-ready walk's §4 shots (22–23 Nov). Lab page only, fixture data, dummy database (nothing reaches
// production).
// 1. In apps/web: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab \
//    SUPABASE_SERVICE_ROLE_KEY=lab npx next dev --port 3481
// 2. From the repo root: node build-sessions/shots-chat-supplier-ready/build.mjs
//    Writes refused-*.png (a refused send says why), mic-unverified-*.png (no mic) and mic-verified-*.png (the mic).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const B = 'http://localhost:3481/dev/chat-lab/t/00000000-0000-4000-8000-0000000000a1';
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];
const browser = await chromium.launch();
async function open(mode, q) {
  const ctx = await browser.newContext({ viewport: { width: mode.w, height: mode.h }, deviceScaleFactor: 2, colorScheme: mode.dark ? 'dark' : 'light', hasTouch: mode.w < 768 });
  // Headless Chromium records no audio type, so `canRecordVoice()` is false and NO mic is drawn for anyone. Say it can
  // (this browser only) so the shot shows what the page decides — the `voice` prop, verified or not.
  await ctx.addInitScript(() => {
    if (window.MediaRecorder) window.MediaRecorder.isTypeSupported = () => true;
  });
  const page = await ctx.newPage();
  await page.goto(B + q, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForSelector('textarea', { timeout: 600000 });
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.waitForTimeout(1500);
  if (mode.dark) {
    // The lab route is not on the theme's dark list, so the head script paints light back: answer "dark" for it here,
    // as it does on the real thread routes.
    await page.evaluate(() => {
      if (window.__snTheme) window.__snTheme.decide = () => true;
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(700);
    if (!(await page.evaluate(() => document.documentElement.classList.contains('dark')))) throw new Error('dark mode did not hold');
  }
  return { ctx, page };
}
const say = (...a) => console.log(...a);
for (const mode of MODES) {
  // 1 · a refused send says why, on the bubble.
  {
    const { ctx, page } = await open(mode, '?side=vendor&send=refused');
    await page.locator('textarea').first().fill('Here is our portfolio');
    await page.getByRole('button', { name: 'Send', exact: true }).click(); // a phone's Enter is a new line
    const line = page.locator('[data-chat-last-line="failed"]');
    await line.waitFor({ timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('.sd-overlay'), null, { timeout: 120000 });
    await page.waitForTimeout(500);
    say(`refused ${mode.tag}: "${(await line.innerText()).replace(/\s+/g, ' ')}" · scrollW ${await page.evaluate(() => document.documentElement.scrollWidth)}/${mode.w}`);
    await page.screenshot({ path: `${HERE}/refused-${mode.tag}.png` });
    await ctx.close();
  }
  // 2 · the mic: none for an unverified shop, there for a verified one.
  for (const [tag, q] of [['mic-unverified', '?side=vendor&unverified=1'], ['mic-verified', '?side=vendor']]) {
    const { ctx, page } = await open(mode, q);
    const mic = await page.locator('button[aria-label="Hold to record a voice note"]').count();
    say(`${tag} ${mode.tag}: mic buttons ${mic}`);
    await page.screenshot({ path: `${HERE}/${tag}-${mode.tag}.png` });
    await ctx.close();
  }
}
await browser.close();
