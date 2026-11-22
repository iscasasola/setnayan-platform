// node shoot.mjs <outDir> <which...>   which ∈ find build book when where guests
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const [out, ...which] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

const APP = {
  find: '/dev/suppliers-lab?open=photo_booth&mall=real&savedfirst=1',
  build: '/dev/suppliers-lab?tab=build',
  book: '/dev/suppliers-lab?mode=booked',
};
// Wizard: the approved wedding flow; the step is reached by resuming a draft.
const WIZ = { when: 'date', where: 'w_area', guests: 'w_pax' };
const WIZ_URL = '/dev/onboarding-lab?type=wedding&flow=approved';
const DRAFT_KEY = 'setnayan_onboarding_wedding_draft_v1';
const HEAD = { when: /^when/i, where: /^where/i, guests: /how many guests/i };

const SIZES = [
  { tag: '375-light', vp: { width: 375, height: 812 }, scheme: 'light', dpr: 2 },
  { tag: '375-dark', vp: { width: 375, height: 812 }, scheme: 'dark', dpr: 2 },
  { tag: '1280', vp: { width: 1280, height: 900 }, scheme: 'light', dpr: 1 },
];

const browser = await chromium.launch();
for (const w of which) {
  for (const s of SIZES) {
    const ctx = await browser.newContext({ viewport: s.vp, colorScheme: s.scheme, deviceScaleFactor: s.dpr });
    const page = await ctx.newPage();
    page.setDefaultTimeout(600_000);
    if (APP[w]) {
      await page.goto(BASE + APP[w], { waitUntil: 'networkidle', timeout: 600_000 });
    } else {
      // Walk the draft's step index until the screen's heading matches (the sequence filters by state).
      let hit = false;
      for (let step = Number(process.env.FROM ?? 0); step <= 12 && !hit; step++) {
        await page.goto(BASE + WIZ_URL, { waitUntil: 'domcontentloaded', timeout: 600_000 });
        await page.evaluate(
          ([k, st]) => {
            localStorage.setItem(
              k,
              JSON.stringify({
                step: st,
                brideFirstName: 'Maria',
                groomFirstName: 'Jose',
                eventName: 'Maria & Jose',
                lastSavedAt: new Date().toISOString(),
                startedAt: Date.now(),
              }),
            );
          },
          [DRAFT_KEY, step],
        );
        await page.reload({ waitUntil: 'load', timeout: 120_000 });
        await page.waitForTimeout(2500);
        await page.waitForTimeout(800);
        const h = await page.evaluate(() => [...document.querySelectorAll('section.screen.active h1, section.screen.active h2')].map((e) => e.textContent.trim()).join(' | '));
        console.log(w, s.tag, 'step', step, '→', JSON.stringify(h.slice(0, 90)));
        if (h.split(' | ').some((t) => HEAD[w].test(t))) hit = true;
      }
      if (!hit) console.log('!! could not reach', w);
    }
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    await page.waitForTimeout(1500);
    const file = `${out}/${w}-${s.tag}.png`;
    await page.screenshot({ path: file });
    console.log('shot', file);
    if (w === 'find') {
      const card = page.locator('.fold.flat .vc.mall').first();
      if (await card.count()) {
        await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.evaluate(() => window.scrollBy(0, -140));
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/find-cards-${s.tag}.png` });
        console.log('shot cards', s.tag);
      } else console.log('!! no mall card on', s.tag);
    }
    await ctx.close();
  }
}
await browser.close();
