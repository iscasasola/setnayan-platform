// §4 shots for Unichat part E (whisper sides). Lab pages only, with fixture data and no database.
// 1. In apps/web, start the lab (dummy env, so nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy npx next dev --port 3477
// 2. From apps/web, run:
//    node ../../build-sessions/shots-unichat-e/shots.mjs "$(git rev-parse --show-toplevel)" '/dev/supplier-chat-lab?m=chats&pick=lab-c1&page=chat'
//    Writes 1-7 *.png beside this file, and prints the who-it-reaches text each one shows.
import { createRequire } from 'node:module';
const require = createRequire(process.argv[2] + '/apps/web/package.json');
const { chromium } = require('@playwright/test');
const OUT = process.argv[2] + '/build-sessions/shots-unichat-e';
const B = 'http://localhost:3477';
const HOST = '/dev/chat-lab?pick=00000000-0000-4000-8000-0000000000a1&page=chat';
const shots = [
  ['1-host-375-light', HOST + '&whisper=1', 375, 812, 'light'],
  ['2-host-375-dark', HOST + '&whisper=1', 375, 812, 'dark'],
  ['5-host-desktop', HOST + '&whisper=1', 1280, 860, 'light'],
  ['7-host-375-read-failed', HOST + '&whisper=fail', 375, 812, 'light', true],
];
const sup = process.argv[3];
if (sup) {
  shots.push(['3-team-375-light', sup + '&whisper=1', 375, 812, 'light']);
  shots.push(['4-team-375-dark', sup + '&whisper=1', 375, 812, 'dark']);
  shots.push(['6-team-desktop', sup + '&whisper=1', 1280, 860, 'light']);
}
const browser = await chromium.launch();
for (const [name, path, w, h, scheme, tryOn] of shots) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 400000 });
  await page.waitForTimeout(20000);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  if (tryOn) {
    await page.focus('[data-chat-whisper-switch]').catch(() => {});
    await page.click('[data-chat-whisper-switch]', { force: true }).catch((e) => console.log('click', e.message));
    await page.waitForTimeout(400);
  }
  const reach = await page.locator('[data-chat-whisper-reach], [data-chat-whisper-line]').allInnerTexts().catch(() => []);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, JSON.stringify(reach));
  await ctx.close();
}
await browser.close();
