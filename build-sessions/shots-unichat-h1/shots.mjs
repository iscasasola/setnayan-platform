// §4 shots for Unichat part H1 (edit/unsend, voice notes, reminders). Lab pages only, fixture data, no database.
// 1. In apps/web, start the lab (dummy env, so nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy npx next dev --port 3477
// 2. From apps/web: node ../../build-sessions/shots-unichat-h1/shots.mjs "$(git rev-parse --show-toplevel)"
//    Writes 1-4 *.png beside this file and prints what each one shows.
import { createRequire } from 'node:module';
const require = createRequire(process.argv[2] + '/apps/web/package.json');
const { chromium } = require('@playwright/test');
const OUT = process.argv[2] + '/build-sessions/shots-unichat-h1';
const B = 'http://localhost:3477';
const HOST = '/dev/chat-lab?pick=00000000-0000-4000-8000-0000000000a1&page=chat';
// [name, width, height, scheme, action]: 'menu' opens ⋯ on your own last message; 'play' presses Play on the voice
// note, whose file the lab cannot serve — the failed read must SAY it could not play.
const shots = [
  ['1-375-light', 375, 812, 'light', 'menu'],
  ['2-375-dark', 375, 812, 'dark', 'menu'],
  ['3-desktop', 1280, 860, 'light', 'menu'],
  ['4-375-read-failed', 375, 812, 'light', 'play'],
];
const browser = await chromium.launch();
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [name, w, h, scheme, action] of shots) {
  if (ONLY && !ONLY.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(B + HOST, { waitUntil: 'domcontentloaded', timeout: 400000 });
  await page.waitForTimeout(20000);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  // The app's dark mode is the `dark` class on <html>; /dev labs never set it, so a dark shot sets it itself.
  if (scheme === 'dark') {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(600);
  }
  let shows = [];
  if (action === 'menu') {
    // Your own message sent a minute ago: right-click opens its menu (the phone's hold does the same; ⋯ is desktop-only).
    const mine = page.getByText('Can we add a second shooter?').first();
    await mine.scrollIntoViewIfNeeded().catch(() => {});
    await mine.click({ button: 'right', force: true }).catch((e) => console.log('click', e.message));
    await page.waitForTimeout(500);
    shows = await page.locator('[data-chat-extras-menu]').allInnerTexts().catch(() => []);
  } else {
    const play = page.locator('[data-chat-voice-play]').first();
    await play.scrollIntoViewIfNeeded().catch(() => {});
    await play.click({ force: true }).catch((e) => console.log('click', e.message));
    await page.waitForTimeout(8000);
    shows = await page.locator('[data-chat-voice-failed]').allInnerTexts().catch(() => []);
  }
  const marks = await page.locator('text=/edited|unsent a message/').allInnerTexts().catch(() => []);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, JSON.stringify({ shows, marks }));
  await ctx.close();
}
await browser.close();
