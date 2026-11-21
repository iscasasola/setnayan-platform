// §4 shots for Unichat parts B + D (+ Part E's Private chip folded into D's). Lab pages only — fixture data, no database.
// 1. In apps/web, start the lab (dummy env, so nothing can reach production):
//    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy npx next dev --port 3477
// 2. From apps/web:  node ../../build-sessions/shots-unichat-bd/shots.mjs "$(git rev-parse --show-toplevel)"
//    ONLY=name1,name2 limits the run. Prints what each shot shows (the count, the line under Private, …).
import { createRequire } from 'node:module';
const require = createRequire(process.argv[2] + '/apps/web/package.json');
const { chromium } = require('@playwright/test');
const OUT = process.argv[2] + '/build-sessions/shots-unichat-bd';
const B = 'http://localhost:3477';
const SUP = '/dev/supplier-chat-lab?m=chats&pick=lab-c1&page=chat&one=booked';
const TOOLS = '/dev/supplier-chat-lab?m=tools&booked=1';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const PHONE = [375, 812];
const DESK = [1280, 860];

async function open(browser, path, [w, h], scheme) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 400000 });
  await page.waitForSelector('[data-chat-one-box]', { timeout: 400000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  // The app's dark mode is the `dark` class on <html> (theme-bootstrap-script, signed-in + dark-ready routes only).
  // /dev labs are neither, so a dark shot sets the same class itself.
  if (scheme === 'dark') {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(500);
  }
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const text = (page, sel) => page.locator(sel).allInnerTexts().catch(() => []);

const SCENES = {
  // B — (+) tiles, then a tile grows the box into its editor; ＋ turns to ←.
  async tools(page, tag) {
    await page.click('[data-thread-tools-open]', { timeout: 10000 });
    await page.waitForTimeout(700);
    await shot(page, `b1-plus-tiles-${tag}`);
    let picked = null;
    for (const name of ['Meeting', 'Poll', 'Decision', 'Ask a question', 'Quote']) {
      const t = page.getByRole('button', { name: new RegExp('^' + name) }).first();
      if (!(await t.count())) continue;
      await t.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(900);
      if (await page.locator('[data-chat-tool], [data-chat-tool-row], [data-chat-col3-pane="tool"]').count()) { picked = name; break; }
    }
    await shot(page, `b2-tool-in-box-${tag}`);
    return { tilePicked: picked, toolLabel: await text(page, '[data-chat-tool-label]') };
  },
  // D — the sliders raise the chips; then one chip filters.
  async chips(page, tag) {
    await page.click('[data-chat-kind-open]');
    await page.waitForTimeout(700);
    await shot(page, `d1-chips-${tag}`);
    await page.click('[data-chat-kind-chip="money"]');
    await page.waitForTimeout(700);
    await shot(page, `d2-chip-money-${tag}`);
    return { filterLine: await text(page, '[data-chat-filter-line]') };
  },
  // D + E — Private in whisper mode: the ONE Private chip (lock, sky) and who it reaches.
  async private(page, tag) {
    await page.click('[data-chat-kind-open]');
    await page.waitForTimeout(600);
    await page.click('[data-chat-kind-chip="private"]');
    await page.waitForTimeout(900);
    await shot(page, `d3-private-row-open-${tag}`);
    await page.click('[data-chat-kind-open]');
    await page.waitForTimeout(700);
    await shot(page, `d4-private-row-shut-${tag}`);
    return { reach: await text(page, '[data-chat-whisper-reach]'), chips: await page.locator('[data-chat-private-chip]:visible').count() };
  },
  // D — search inside the chat: "N of M" and "No matches".
  async search(page, tag) {
    await page.click('[data-chat-search-open]');
    await page.waitForTimeout(400);
    const box = page.locator('[data-chat-search] input');
    // The fixture is fixed: find a word with 7 matches (else the one nearest 7, at least 3), then step to the 3rd.
    let best = null;
    let bestN = 0;
    for (const q of ['Payment', 'the', 'you', 'a', 'e', 'o', 'n', 'i', 'Ma', 'ing', 'ou', 'ay', 'ent', 'we', 'to']) {
      await box.fill(q);
      await page.waitForTimeout(450);
      const m = /of ([\d,]+)/.exec((await text(page, '[data-chat-search-count]')).join(' '));
      const n = m ? Number(m[1].replace(/,/g, '')) : 0;
      if (n === 7) { best = q; bestN = 7; break; }
      if (n >= 3 && (bestN === 0 || Math.abs(n - 7) < Math.abs(bestN - 7))) { best = q; bestN = n; }
    }
    await box.fill(best ?? 'Payment');
    await page.waitForTimeout(450);
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-chat-search] button[aria-label="Next match"]').click();
      await page.waitForTimeout(300);
    }
    const count = (await text(page, '[data-chat-search-count]')).join(' ');
    await shot(page, `d5-search-count-${tag}`);
    await box.fill('zzqx');
    await page.waitForTimeout(500);
    const none = (await text(page, '[data-chat-search-count], [data-chat-search]')).join(' | ');
    await shot(page, `d6-search-none-${tag}`);
    return { query: best, count, none };
  },
  // A send that fails says so and offers Try again (the server action is refused at the network).
  async failsend(page, tag) {
    await page.route('**/*', (route) => (route.request().method() === 'POST' ? route.abort('failed') : route.continue()));
    const ta = page.locator('[data-chat-one-box] textarea');
    await ta.click();
    await ta.fill('Can we move the ingress to 1 PM?');
    await ta.press('Enter');
    await page.waitForSelector('[data-chat-last-line="failed"]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, `x1-send-failed-retry-${tag}`);
    return { line: await text(page, '[data-chat-last-line]') };
  },
  // The read of who a whisper reaches FAILED: Private picked says "Couldn't load…", never "no one".
  async readfail(page, tag) {
    await page.click('[data-chat-kind-open]');
    await page.waitForTimeout(600);
    await page.click('[data-chat-kind-chip="private"]');
    await page.waitForTimeout(800);
    await page.click('[data-chat-kind-open]');
    await page.waitForTimeout(700);
    await shot(page, `e1-private-read-failed-${tag}`);
    return { line: await text(page, '[data-chat-whisper-line]') };
  },
  // Presence: the last own line ("Delivered" / "Seen" / seen-by names when readers announce on the live channel).
  async seen(page, tag) {
    await shot(page, `p1-last-line-${tag}`);
    return { last: await text(page, '[data-chat-last-line]') };
  },
};

const RUNS = [];
for (const [scene, path] of [
  ['tools', TOOLS],
  ['chips', SUP],
  ['private', SUP + '&whisper=1'],
  ['search', SUP],
  ['failsend', SUP],
  ['readfail', SUP + '&whisper=fail'],
  ['seen', SUP],
]) {
  RUNS.push([scene, path, PHONE, 'light', '375-light']);
  RUNS.push([scene, path, PHONE, 'dark', '375-dark']);
  if (['tools', 'chips', 'private', 'search'].includes(scene)) RUNS.push([scene, path, DESK, 'light', 'desktop']);
}

const browser = await chromium.launch();
for (const [scene, path, size, scheme, tag] of RUNS) {
  if (ONLY && !ONLY.includes(scene) && !ONLY.includes(`${scene}-${tag}`)) continue;
  const { ctx, page } = await open(browser, path, size, scheme);
  try {
    const r = await SCENES[scene](page, tag);
    console.log(scene, tag, JSON.stringify(r));
  } catch (e) {
    console.log(scene, tag, 'ERROR', e.message.split('\n')[0]);
    await shot(page, `zz-error-${scene}-${tag}`).catch(() => {});
  }
  await ctx.close();
}
await browser.close();
