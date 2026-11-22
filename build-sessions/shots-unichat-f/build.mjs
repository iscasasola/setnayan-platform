// The BUILD half of Unichat F's §4 shots. Lab page only, fixture data, dummy database (nothing reaches production).
// 1. In apps/web: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-dummy-anon-key \
//    SUPABASE_SERVICE_ROLE_KEY=lab-dummy npx next dev --port 3481
// 2. From the repo root: node build-sessions/shots-unichat-f/build.mjs
//    Writes build-agenda-*.png, build-whole-*.png, build-time-*.png, pair-*.png (drawing left · build right) and prints
//    the measured gutters + what each scene says. The drawing-*.png beside them are the ship controller's shots of the
//    drawing (`unichat_live_v3_2026-11-20.html`, driven, not edited). The drawing has NO dark mode: its dark shots
//    render light, so a dark pair is the build's dark against the drawing's light.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(HERE + '/../../apps/web/package.json');
const { chromium } = require('@playwright/test');
const B = 'http://localhost:3481/dev/unichat-f-lab';
const MODES = [
  { tag: '375-light', w: 375, h: 812, dark: false },
  { tag: '375-dark', w: 375, h: 812, dark: true },
  { tag: 'desktop', w: 1280, h: 860, dark: false },
];
const browser = await chromium.launch();
async function open(mode, q, ready) {
  const ctx = await browser.newContext({ viewport: { width: mode.w, height: mode.h }, deviceScaleFactor: 2, colorScheme: mode.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(B + q, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForSelector(ready, { timeout: 600000 });
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  // The app's dark mode is the `dark` class on <html>. Set it AFTER the page has hydrated: set before, React puts the
  // server's class list back and the "dark" shot comes out light (the shots before 22 Nov did).
  await page.waitForTimeout(1500);
  if (mode.dark) {
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(600);
    if (!(await page.evaluate(() => document.documentElement.classList.contains('dark')))) throw new Error('dark mode did not hold');
  }
  return { ctx, page };
}
const measure = (page, sel) =>
  page.evaluate((s) => {
    const els = [...document.querySelectorAll(s)];
    const bad = els.map((e) => e.getBoundingClientRect()).filter((r) => Math.round(r.left) !== Math.round(innerWidth - r.right));
    return { n: els.length, unequal: bad.length, first: els[0] ? [Math.round(els[0].getBoundingClientRect().left), Math.round(innerWidth - els[0].getBoundingClientRect().right)] : null, scrollW: document.documentElement.scrollWidth, innerW: innerWidth };
  }, sel);

for (const mode of MODES) {
  for (const [q, tag] of [['?m=agenda', 'agenda'], ['?m=agenda&e=1', 'agenda-empty'], ['?m=agenda&u=1', 'agenda-unread']]) {
    if (tag !== 'agenda' && mode.tag !== '375-light') continue;
    const { ctx, page } = await open(mode, q, '[data-agenda]');
    const body = page.locator('[data-rise-screen="agenda"]');
    await page.screenshot({ path: `${HERE}/build-${tag}-${mode.tag}.png` });
    // The whole list, top to bottom, as one tall shot of the screen's own scroller.
    const tall = await page.evaluate(() => {
      const s = document.querySelector('[data-agenda]');
      let p = s;
      while (p && p.scrollHeight <= p.clientHeight + 1) p = p.parentElement;
      return p ? p.scrollHeight : 0;
    });
    if (tall > mode.h) {
      await page.setViewportSize({ width: mode.w, height: Math.min(tall + 140, 2400) });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${HERE}/build-${tag}-${mode.tag}-full.png` });
    }
    console.log(tag, mode.tag, 'rise:', await body.count(), 'gutters', JSON.stringify(await measure(page, '[data-agenda] > *')));
    if (tag === 'agenda' && mode.tag === '375-light') {
      console.log('  headings', JSON.stringify(await page.locator('[data-agenda] h4').allInnerTexts()));
      console.log('  set-by', JSON.stringify(await page.locator('[data-window-set-by]').allInnerTexts()));
      // A tap on one of your moments opens the shipped moment sheet in place.
      await page.locator('[data-agenda-moment="m2"]').click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${HERE}/build-agenda-moment-sheet-375-light.png` });
      console.log('  sheet open:', await page.locator('[role="dialog"]').count());
    }
    if (tag !== 'agenda') console.log('  says', JSON.stringify(await page.locator('[data-agenda]').innerText()));
    await ctx.close();
  }
  // The hosts' whole day, risen from their chat (⋯ › Schedule).
  for (const [q, tag] of [['?m=whole', 'whole'], ['?m=whole&u=1', 'whole-unread']]) {
    if (tag !== 'whole' && mode.tag !== '375-light') continue;
    const { ctx, page } = await open(mode, q, '[data-whole-day]');
    await page.screenshot({ path: `${HERE}/build-${tag}-${mode.tag}.png` });
    const tall = await page.evaluate(() => {
      let p = document.querySelector('[data-whole-day]');
      while (p && p.scrollHeight <= p.clientHeight + 1) p = p.parentElement;
      return p ? p.scrollHeight : 0;
    });
    if (tall > mode.h) {
      await page.setViewportSize({ width: mode.w, height: Math.min(tall + 140, 2400) });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${HERE}/build-${tag}-${mode.tag}-full.png` });
    }
    console.log(tag, mode.tag, 'gutters', JSON.stringify(await measure(page, '[data-whole-day] > *')));
    if (tag === 'whole' && mode.tag === '375-light') {
      console.log('  headings', JSON.stringify(await page.locator('[data-whole-day] h4').allInnerTexts()));
      console.log('  set-by', JSON.stringify(await page.locator('[data-window-set-by]').allInnerTexts()));
      console.log('  moments', JSON.stringify(await page.locator('[data-day-timeline] li').allInnerTexts()));
      await page.setViewportSize({ width: mode.w, height: mode.h });
      // A Lumina moment opens the shipped ask, Lumina already picked.
      await page.locator('[data-whole-day-moment="shop"]').nth(1).click();
      await page.locator('[data-moment-ask-form]').waitFor({ timeout: 15000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${HERE}/build-whole-ask-375-light.png` });
      console.log('  ask open:', await page.locator('[data-moment-ask-form]').count(), 'picked:', JSON.stringify(await page.locator('[data-moment-ask-form]').innerText().catch(() => '')));
    }
    if (tag !== 'whole') console.log('  says', JSON.stringify(await page.locator('[data-whole-day]').innerText()));
    await ctx.close();
  }
  for (const [q, tag] of [['?m=time', 'time'], ['?m=time&f=1', 'time-failed']]) {
    if (tag !== 'time' && mode.tag !== '375-light') continue;
    const { ctx, page } = await open(mode, q, '[data-lab-time]');
    if (q.includes('f=1')) await page.waitForTimeout(8000);
    await page.screenshot({ path: `${HERE}/build-${tag}-${mode.tag}.png`, fullPage: true });
    console.log(tag, mode.tag, 'gutters', JSON.stringify(await measure(page, '[data-lab-time]')));
    if (tag === 'time-failed') console.log('  says', JSON.stringify(await page.locator('[data-lab-time]').allInnerTexts()));
    if (tag === 'time' && mode.tag === '375-light') {
      // ⓘ opens the facts (asked by · note · who owns the Schedule); Decline asks for a reason before it sends.
      await page.locator('[data-lab-time="couple-move-open"] [data-time-ask-info-button]').click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${HERE}/build-time-info-375-light.png` });
      console.log('  info', JSON.stringify(await page.locator('[role="dialog"]').innerText().catch(() => '')));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      const coord = page.locator('[data-lab-time="coordinator-move-open"]');
      await coord.locator('[data-testid="time-ask-decline"]').click();
      await page.waitForTimeout(500);
      await coord.locator('[data-testid="time-ask-decline-send"]').click();
      await page.waitForTimeout(300);
      console.log('  no reason →', JSON.stringify(await coord.innerText()));
      // The Reason row is the house's press-to-type row: press it, type, keep.
      await coord.locator('[data-form-row="time-ask-reason"] [data-form-row-pill]').click();
      const box = coord.locator('[data-form-row="time-ask-reason"] textarea');
      await box.waitFor({ timeout: 15000 });
      await box.fill('The venue opens the hall at 2:30 PM.');
      await page.waitForTimeout(400);
      await coord.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${HERE}/build-time-decline-375-light.png` });
      await coord.locator('[data-testid="time-ask-decline-send"]').click();
      await page.waitForTimeout(800);
      console.log('  coordinator declined →', JSON.stringify(await coord.innerText()));
    }
    await ctx.close();
  }
}
// Pairs: the drawing (left) beside the build (right), per mode.
const PAIRS = [
  ['agenda', 'agenda', 'agenda'],
  ['whole', 'agenda-host', 'whole'],
  ['time', 'time', 'time'],
];
const pageCtx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
const pp = await pageCtx.newPage();
const uri = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
for (const mode of MODES) {
  for (const [name, drawing, build] of PAIRS) {
    let d = `${HERE}/drawing-${drawing}-${mode.tag}.png`;
    const note = existsSync(d) ? '' : ' (drawing: 375 light — it has no other)';
    if (!existsSync(d)) d = `${HERE}/drawing-${drawing}-375-light.png`;
    const b = `${HERE}/build-${build}-${mode.tag}.png`;
    if (!existsSync(d) || !existsSync(b)) continue;
    const bg = mode.dark ? '#121110' : '#F7F4EE', ink = mode.dark ? '#F7F4EE' : '#1B1A17';
    await pp.setContent(`<body style="margin:0;background:${bg};color:${ink};font:600 15px system-ui">
      <div id="x" style="display:flex;gap:24px;padding:16px;align-items:flex-start;width:max-content">
        <figure style="margin:0"><figcaption>DRAWING · ${name} · ${mode.tag}${note}</figcaption><img src="${uri(d)}" style="width:${mode.tag === 'desktop' && !note ? 620 : 372}px"></figure>
        <figure style="margin:0"><figcaption>BUILD · ${name} · ${mode.tag}</figcaption><img src="${uri(b)}" style="width:${mode.tag === 'desktop' ? 560 : 372}px"></figure>
      </div></body>`);
    await pp.locator('#x').screenshot({ path: `${HERE}/pair-${name}-${mode.tag}.png` });
  }
}
await browser.close();
console.log('done');
