#!/usr/bin/env node
/**
 * 🎚 scrub-browser-check.mjs — THE OWNER'S SEVEN PICTURES, AS A CHECK IN A REAL BROWSER.
 *
 * Plays the guest page's own Scrub (`scripts/scrub-check-page.tsx`: the real renderer, stylesheet and engine) in
 * Chromium at the five window sizes the owner tried it at, sampling every 16 px down, then back up, and reports:
 *
 *   1. back == down — the picture going up is the picture going down, at every position, to the end of the page;
 *   2. outside a hand-over pair no two scenes ever overlap; inside one, never two that can both be read;
 *   3. a list: its rows in order, all of them complete before it starts to leave; nothing of the scene before it
 *      once row 1 has begun; that scene at its last 20 % before the list shows; the pair's tops together;
 *   4. every hand-over finishes before the page ends; the page stands still while one plays;
 *   5. NATIVE SCROLLING — the engine never sets the scroll position, never prevents a default, and registers no
 *      wheel / touch listener; a real wheel and a real touch drag move the page;
 *   6. with the script missing, and with "reduce motion", the page is the plain page: every scene visible, no holds;
 *   7. THE MAKER'S CANVAS (a page with a section marker, the page's own island deciding): while editing nothing is
 *      held — the plain page, every scene the top thing at its own middle (it can be picked); shown as a guest
 *      (`data-maker-guest`, ▶ held) the hand-overs run, the scene that was mid-screen still there; back to editing,
 *      every mark is gone;
 *   8. AN EMPTY SCENE (a widget that drew nothing, set to Scrub out): it has no box and holds nothing, and the page
 *      never stands still on a blank — the longest stretch with no scene to read is no longer than on the full page;
 *   9. OFF IS NEVER SILENT, and the lab's badge says what the page says: on — which hand-over and how far, the same
 *      number the page carries; off — the reason: "reduce motion", "editing — hold ▶ to play it", and, when the
 *      engine is made to throw, "the script stopped: <what was thrown>" on a plain page with every mark gone;
 *  10. FRAMES THAT NEVER COME (a pane that scrolls a page but gives it no animation frames — seen 2026-10-09: armed at
 *      the top, then 2,600 px of white screen): with `requestAnimationFrame` silenced after arming, the page still
 *      shows the hand-over it is at within a second, and the badge says it.
 *  12. A LONG ARRIVAL UNDER THE PINNED TOP BAR (the invitation's own bar, `data-sticky-top`): a list hands over to a
 *      second long list, which is drawn from the top of the room down. At three phone sizes and a desktop one, the
 *      arrival stands ON the stylesheet's line (`--hub-pin` — the engine reads it, it has no number of its own) and
 *      clear of everything pinned at the top: the bar and the progress mark.
 *  13. THE HUB IS CARDS, FRAMED OR NOT: a scene with a motion setting and nothing else is drawn inside a frame that
 *      paints nothing — it wears the same card as a scene nobody arranged; "No background", a scene with a ground of
 *      its own and a template scene do not; and on the Scrub page every framed scene is a card too.
 *  14. 🎬 THE COVER AS HAND-OVER ZERO (the real `HubCoverHold`, the page's own hold) at five sizes: at scroll 0 the
 *      cover is exactly where today's page has it, whole, and nothing has begun; the page stands still while its
 *      Build out plays over 55 % of a screen and completes; what comes next arrives at the centred line, not before
 *      the Build out is 80 % done, and never above the cover; going back is going down; the scenes after it still
 *      hand over. And: a block that is not a scene arrives the same way and what follows it never lies over the
 *      cover; a page whose cover is its ONLY Scrub plays; a cover taller than the screen is scrolled through; with
 *      no script the page is the plain page. Under a closed Reveal (its mark on the page) nothing is held and the
 *      page says why; the hand-overs arm the moment it goes.
 *
 * Not part of the unit suite (it needs a browser): run it by hand, one job at a time.
 *   node scripts/scrub-browser-check.mjs <playwright-dir> <scratch-dir> [pictures-dir]
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , pwDir, scratch, pics] = process.argv;
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(pwDir.endsWith('/') ? pwDir : `${pwDir}/`);
const { chromium } = require('playwright');
const esbuild = execFileSync('sh', ['-c', `ls -d ${WEB}/../../node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild | tail -1`]).toString().trim();
execFileSync(esbuild, [`${WEB}/app/[slug]/_components/hub-scrub-engine.ts`, '--bundle', '--minify', '--format=iife', '--global-name=HubScrubEngine', `--outfile=${scratch}/scrub-engine.js`], { stdio: 'pipe' });
const tsx = `${WEB}/../../node_modules/.bin/tsx`;
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real.html`, `${scratch}/scrub-engine.js`], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-noscript.html`, `${scratch}/scrub-engine.js`, 'noscript'], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-page.html`, `${scratch}/scrub-engine.js`, 'page'], { cwd: WEB, stdio: 'pipe' });
execFileSync(esbuild, [`${WEB}/scripts/scrub-check-island.tsx`, '--bundle', '--minify', '--format=iife', '--jsx=automatic', '--define:process.env.NODE_ENV="production"', `--outfile=${scratch}/scrub-island.js`], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-empty.html`, `${scratch}/scrub-engine.js`, 'empty'], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-maker.html`, `${scratch}/scrub-island.js`, 'maker'], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-island.html`, `${scratch}/scrub-island.js`, 'island'], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-page-island.html`, `${scratch}/scrub-island.js`, 'page-island'], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-bar.html`, `${scratch}/scrub-engine.js`, 'bar'], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-cards.html`, '-', 'cards'], { cwd: WEB, stdio: 'pipe' });
for (const m of ['cover', 'cover-tall', 'cover-block', 'cover-only', 'cover-noscript', 'cover-today']) execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-${m}.html`, `${scratch}/scrub-engine.js`, m], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-cover-reveal.html`, `${scratch}/scrub-island.js`, 'cover-reveal'], { cwd: WEB, stdio: 'pipe' });

/* Before any page script: remember the browser's own scrolling, and count every way a script could take it over. */
const WATCH = () => {
  const real = window.scrollTo.bind(window);
  window.__go = (y) => real(0, y);
  window.__took = { scrollSet: 0, prevented: 0, listeners: [] };
  for (const k of ['scrollTo', 'scroll', 'scrollBy']) window[k] = () => { window.__took.scrollSet++; };
  Element.prototype.scrollIntoView = function () { window.__took.scrollSet++; };
  for (const proto of [Element.prototype, HTMLElement.prototype]) for (const k of ['scrollTop', 'scrollLeft']) { const d = Object.getOwnPropertyDescriptor(Element.prototype, k); if (d?.set) Object.defineProperty(proto, k, { ...d, set(v) { window.__took.scrollSet++; d.set.call(this, v); } }); }
  const pd = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () { if (/wheel|touch|scroll|pointer|key/.test(this.type)) window.__took.prevented++; return pd.call(this); };
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) { if (/^(wheel|mousewheel|touchstart|touchmove|touchend|keydown)$/.test(type) || (type === 'scroll' && !(opt && typeof opt === 'object' && opt.passive))) window.__took.listeners.push(type); return add.call(this, type, fn, opt); };
};
const SNAP = () => {
  const scenes = [...document.querySelectorAll('.hub-scene')].map((e) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); /* A scene HOLDS when it is the one right before its cell's rest-of-the-page (its stage may hold ordinary scenes before it). */
    const cell = e.nextElementSibling?.classList.contains('hub-after') ? e.closest('.hub-cell') : null;
    const bodyEl = e.querySelector(':scope > .hub-canvas > .hub-canvas-body');
    return { n: e.querySelector('[data-name]')?.getAttribute('data-name') ?? '?', body: bodyEl ? Number(getComputedStyle(bodyEl).opacity) : 1, o: cs.visibility === 'hidden' ? 0 : Number(cs.opacity), t: r.top, b: r.bottom, pout: Number(e.style.getPropertyValue('--hub-pout') || 0), pin: Number(e.style.getPropertyValue('--hub-pbin') || 1), holds: Boolean(cell), pad: cell ? parseFloat(getComputedStyle(cell, '::after').height) || 0 : 0 };
  });
  const rows = [...document.querySelectorAll('[data-row]')].map((li) => Number(getComputedStyle(li).opacity));
  const lead = document.querySelector('[data-lead]').getBoundingClientRect();
  /* Length nobody asked for: a hand-over's box that draws a hold it was not given (a length it inherited). */
  const stray = [...document.querySelectorAll('.hub-cell, .hub-page-cell')].filter((c) => (parseFloat(getComputedStyle(c, '::after').height) || 0) !== (parseFloat(c.style.getPropertyValue('--hub-len')) || 0)).length;
  const end = parseFloat([...document.querySelectorAll('.hub-scenes')].at(-1).style.getPropertyValue('--hub-end')) || 0;
  const gap = document.querySelector('[data-foot]').getBoundingClientRect().top - scenes.at(-1).b;
  return { s: Math.round(scrollY), scenes, rows, stray, gap, end, leadT: lead.top, leadB: lead.bottom, max: document.documentElement.scrollHeight - innerHeight };
};
/* The five sizes the owner tried the prototype at, and the shape of the browser pane he opened the real thing in (441 × 882). */
const SIZES = [[890, 1548], [940, 1608], [1280, 770], [375, 812], [375, 667], [441, 882]];
/* `SCRUB_ONLY_MAKER=1` plays the cases after the five sizes alone, `SCRUB_ONE_SIZE=1` one size (re-runs while working,
   a sabotage) — never a pass for the rest: the last line says so. */
const PLAYED = process.env.SCRUB_ONLY_MAKER ? [] : process.env.SCRUB_ONE_SIZE ? [SIZES[3]] : SIZES;
const b = await chromium.launch();
let failed = 0;
const say = (ok, line) => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`); };

/* THE PAGE'S OWN HOLD (what a real page draws: `HubPageHold` around its whole column) at every size — and the scenes
   block alone (a page with no hold of its own: the fallback) at a desktop and a phone size. */
const RUNS = [...PLAYED.map((size) => ({ size, file: 'scrub-real-page.html', tag: '' })), ...PLAYED.filter(([w, h]) => (w === 1280 && h === 770) || (w === 375 && h === 812)).map((size) => ({ size, file: 'scrub-real.html', tag: ' (the scenes block alone)' }))];
for (const { size: [W, H], file, tag } of RUNS) {
  const paged = file === 'scrub-real-page.html';
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 500, isMobile: W < 500 });
  await ctx.addInitScript(WATCH);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await p.goto(`file://${scratch}/${file}`); await p.waitForTimeout(500);
  const at = async (y) => { await p.evaluate((yy) => window.__go(yy), y); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return p.evaluate(SNAP); };
  const max = (await at(0)).max;
  const fwd = []; for (let y = 0; y < max; y += 16) fwd.push(await at(y)); fwd.push(await at(max));
  const back = [await at(max)]; for (let y = max - (max % 16); y >= 0; y -= 16) back.push(await at(y));
  const sig = (f) => JSON.stringify([f.scenes.map((e) => [e.n, e.o.toFixed(2), Math.round(e.t)]), f.rows.map((r) => r.toFixed(2))]);
  const same = fwd.every((f) => { const k = back.find((x) => x.s === f.s); return k && sig(k) === sig(f); });
  const faults = { overlap: [], readable: [], rowsOrder: [], leavesEarly: [], prevOnRows: [], early: [], box: [], moved: [], above: [], twice: [], page: [], length: [] };
  let watchedAbove = 0; let watchedPage = 0;
  let prev = null;
  for (const f of fwd) {
    const vis = f.scenes.filter((e) => e.o > 0.03 && e.b > 0 && e.t < H);
    const pairOf = (a, c) => { const i = f.scenes.findIndex((e) => e.n === a.n), j = f.scenes.findIndex((e) => e.n === c.n); const [x, y] = i < j ? [f.scenes[i], f.scenes[j]] : [f.scenes[j], f.scenes[i]]; return Math.abs(i - j) === 1 && x.holds && x.pout > 0 && (x.pout < 1 || y.pin < 1); };
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) { const ov = Math.min(vis[i].b, vis[j].b) - Math.max(vis[i].t, vis[j].t); if (ov <= 2) continue; if (!pairOf(vis[i], vis[j])) faults.overlap.push(`${f.s}: ${vis[i].n} × ${vis[j].n} by ${Math.round(ov)}`); else if (vis[i].o > 0.2 + 1e-6 && vis[j].o > 0.2 + 1e-6) faults.readable.push(`${f.s}: ${vis[i].n} ${vis[i].o.toFixed(2)} × ${vis[j].n} ${vis[j].o.toFixed(2)}`); }
    const sched = f.scenes.find((e) => e.n === 'Schedule'), cd = f.scenes.find((e) => e.n === 'Countdown');
    if (sched.o > 0.02) for (let k = 1; k < f.rows.length; k++) if (f.rows[k] > f.rows[k - 1] + 0.01) faults.rowsOrder.push(`${f.s}: row ${k + 1} ahead of row ${k}`);
    if (sched.pout > 0 && f.rows.some((r) => r < 0.99)) faults.leavesEarly.push(`${f.s}: leaving at ${sched.pout} with a row at ${Math.min(...f.rows).toFixed(2)}`);
    if (sched.o > 0.02 && f.rows[1] > 0.02 && cd.o > 0.02) faults.prevOnRows.push(`${f.s}: row 2 at ${f.rows[1].toFixed(2)} and Countdown at ${cd.o.toFixed(2)}`);
    if (sched.o > 0.02 && cd.pout < 0.79 && cd.pout > 0) faults.early.push(`${f.s}: Schedule at ${sched.o.toFixed(2)} with Countdown only ${Math.round(cd.pout * 100)} % out`);
    if (sched.o > 0.02 && cd.o > 0.02 && Math.abs(sched.t - cd.t) > 32) faults.box.push(`${f.s}: tops ${Math.round(cd.t)} and ${Math.round(sched.t)}`);
    /* the page stands still while a hand-over plays: the leaving scene does not move */
    if (prev) for (const e of f.scenes) { const was = prev.scenes.find((x) => x.n === e.n); if (e.holds && e.pout > 0 && e.pout < 1 && was.pout > 0 && was.pout < 1 && Math.abs(e.t - was.t) > 0.6) faults.moved.push(`${f.s}: ${e.n} moved ${(e.t - was.t).toFixed(1)}`); }
    /* NO LENGTH NOBODY ASKED FOR: no box draws a hold it was not given, and what the page draws after its scenes follows them. */
    if (f.stray) faults.length.push(`${f.s}: ${f.stray} box(es) draw a hold they were not given`);
    if (f === fwd.at(-1) && f.gap > f.end + 48) faults.length.push(`${f.s}: ${Math.round(f.gap)}px of nothing between the last scene and the page after it (${f.end}px asked for)`);
    /* THE WHOLE PAGE: what the page draws BEFORE its scenes stands still too while a hand-over plays. */
    if (paged && prev) { const k = f.scenes.findIndex((e) => e.holds && e.pout > 0 && e.pout < 1); if (k >= 0 && prev.scenes[k].pout > 0 && prev.scenes[k].pout < 1 && f.leadB > 0) { watchedPage++; if (Math.abs(f.leadT - prev.leadT) > 0.6) faults.page.push(`${f.s}: the page before the scenes moved ${(f.leadT - prev.leadT).toFixed(1)} during ${f.scenes[k].n}'s`); } }
    /* ONE FADE: a scene is drawn at its own number — its own keyframes never fade it a second time under the scene's. */
    for (const e of f.scenes) if (e.o > 0 && e.body < 0.999) faults.twice.push(`${f.s}: ${e.n} at ${e.o.toFixed(2)} × ${e.body.toFixed(2)}`);
    /* …and so does every scene a guest can see ABOVE it: during a hold the page does not move. */
    if (prev) { const k = f.scenes.findIndex((e) => e.holds && e.pout > 0 && e.pout < 1); const wasHeld = k >= 0 && prev.scenes[k].pout > 0 && prev.scenes[k].pout < 1;
      if (wasHeld) for (let i = 0; i < k; i++) { const e = f.scenes[i], was = prev.scenes[i]; if (e.o < 0.5 || e.b <= 0 || e.t >= H) continue; watchedAbove++; if (Math.abs(e.t - was.t) > 0.6) faults.above.push(`${f.s}: ${e.n}, above ${f.scenes[k].n}, moved ${(e.t - was.t).toFixed(1)}`); } }
    prev = f;
  }
  const end = fwd.at(-1);
  const finished = end.scenes.filter((e) => e.holds).every((e) => e.pout >= 1) && end.scenes.at(-1).o >= 0.99;
  const rowsDone = fwd.some((f) => f.rows.every((r) => r >= 0.99));
  const took = await p.evaluate(() => window.__took);
  /* a real wheel, and (on the phone sizes) a real touch drag, move the page — and nothing was prevented */
  await at(0); await p.mouse.move(W / 2, H / 2); await p.mouse.wheel(0, 600); await p.waitForTimeout(350); const wheel = await p.evaluate(() => scrollY);
  let touch = null;
  if (W < 500) { const cdp = await ctx.newCDPSession(p); await at(0); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: H - 120 }] }); for (let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: H - 120 - k * 40 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(500); touch = await p.evaluate(() => scrollY); }
  const took2 = await p.evaluate(() => window.__took);
  const size = `${W}×${H}${tag}`;
  say(errs.length === 0, `${size} no page error${errs.length ? ' — ' + errs[0] : ''}`);
  say(same, `${size} back == down at every one of ${fwd.length} positions`);
  for (const [k, words] of Object.entries({ overlap: 'no overlap outside a pair', readable: 'never two readable at once', rowsOrder: 'rows in order', leavesEarly: 'every row complete before the list leaves', prevOnRows: 'nothing of the scene before once the rows begin', early: 'the scene before at its last 20 % before the list shows', box: 'the pair in one box', moved: 'the page stands still while a hand-over plays', above: `what a guest can see above a held scene stands still too (${watchedAbove} positions watched)`, twice: 'a scene is drawn at its own number — one fade, never two multiplied', length: 'no length nobody asked for — no inherited hold, no gap before the page after the scenes', ...(paged ? { page: `the page before the scenes stands still during a hold (${watchedPage} positions watched)` } : {}) })) say(faults[k].length === 0, `${size} ${words}${faults[k].length ? ` — ${faults[k].length} × e.g. ${faults[k][0]}` : ''}`);
  say(rowsDone, `${size} all eight rows completed`);
  say(finished, `${size} every hand-over finished before the page ends (${end.scenes.filter((e) => e.holds).map((e) => `${e.n} ${e.pout}`).join(', ')}; last scene at ${end.scenes.at(-1).o})`);
  say(took.scrollSet === 0 && took2.scrollSet === 0, `${size} the script never set the scroll position (${took2.scrollSet})`);
  say(took2.prevented === 0, `${size} no default prevented (${took2.prevented})`);
  say(took2.listeners.length === 0, `${size} no wheel / touch / key / non-passive scroll listener (${took2.listeners.join(',') || 'none'})`);
  say(wheel > 300, `${size} a real wheel moved the page (${wheel}px)`);
  if (touch !== null) say(touch > 150, `${size} a real touch drag moved the page (${touch}px)`);
  if (pics) {
    const shot = async (y, name) => { await at(y); await p.screenshot({ path: `${pics}/c8c-${W}x${H}-${name}.png` }); };
    const find = (fn) => fwd.find(fn)?.s;
    const sc = (f, n) => f.scenes.find((e) => e.n === n);
    for (const [a, c, name] of [['Names', 'Countdown', '1-names-countdown'], ['Countdown', 'Schedule', '2-countdown-schedule'], ['Schedule', 'Note', '4-schedule-note'], ['Wear', 'Gifts', '6-wear-gifts']]) { const y = find((f) => sc(f, a).pout >= 0.86 && sc(f, a).pout < 1 && sc(f, c).pin > 0.1); if (y !== undefined) await shot(y, name); }
    const y3 = find((f) => f.rows[3] > 0.3 && f.rows[3] < 1); if (y3 !== undefined) await shot(y3, '3-through-rows');
    const y5 = find((f) => sc(f, 'Note').o >= 0.99 && sc(f, 'Wear').o > 0.3 && sc(f, 'Wear').pout === 0); if (y5 !== undefined) await shot(y5, '5-note-stays-wear-below');
    await shot(max, '7-end');
  }
  await ctx.close();

  /* THE PLAIN PAGE — no script at all, and reduce motion with the script. */
  for (const [label, file, opts] of [['with no script', 'scrub-real-noscript.html', {}], ['with reduce motion', 'scrub-real.html', { reducedMotion: 'reduce' }]]) {
    const c2 = await b.newContext({ viewport: { width: W, height: H }, ...opts }); const q = await c2.newPage();
    await q.goto(`file://${scratch}/${file}`); await q.waitForTimeout(350);
    const plain = await q.evaluate(() => ({ on: document.querySelector('.hub-scenes').hasAttribute('data-hub-scrub-on'), all: [...document.querySelectorAll('.hub-scene')].every((e) => { const cs = getComputedStyle(e); return Number(cs.opacity) === 1 && cs.visibility === 'visible'; }), rows: [...document.querySelectorAll('[data-row]')].every((li) => Number(getComputedStyle(li).opacity) === 1), pads: [...document.querySelectorAll('.hub-cell')].every((c) => getComputedStyle(c, '::after').content === 'none' && parseFloat(getComputedStyle(c).paddingBottom) === 0), sticky: [...document.querySelectorAll('.hub-stage')].every((s) => getComputedStyle(s).position === 'static'), order: [...document.querySelectorAll('.hub-scene')].map((e) => Math.round(e.getBoundingClientRect().top)) }));
    const inOrder = plain.order.every((t, i) => i === 0 || t > plain.order[i - 1]);
    say(!plain.on && plain.all && plain.rows && plain.pads && plain.sticky && inOrder, `${size} ${label}: the plain page — every scene and row visible, in order, nothing held`);
    await c2.close();
  }
}

/* 7. THE MAKER'S CANVAS — the island decides (no watcher here: putting the mid-screen scene back as the preview opens
   is the island's one legitimate scroll, on this canvas only). */
for (const [W, H] of [[375, 812], [1280, 770]]) {
  const size = `${W}x${H} maker's canvas`;
  const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage();
  await p.goto(`file://${scratch}/scrub-real-maker.html`); await p.waitForTimeout(500);
  const look = () => p.evaluate(() => {
    const scenes = [...document.querySelectorAll('.hub-scene')];
    const names = scenes.map((e) => e.querySelector('[data-name]').getAttribute('data-name'));
    const mid = innerHeight / 2;
    const at = scenes.findIndex((e) => { const r = e.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
    return {
      on: document.querySelector('.hub-scenes').hasAttribute('data-hub-scrub-on'),
      marks: [...document.querySelectorAll('.hub-scenes, .hub-scenes *')].filter((e) => /--hub-(?:len|top|up|pbin|pout|o|rise|pp|end)\s*:/.test(e.getAttribute('style') ?? '') || [...e.attributes].some((a) => /^data-hub-(?:away|scrub-on)$/.test(a.name))).length,
      sticky: getComputedStyle(document.querySelector('.hub-stage')).position,
      seen: scenes.every((e) => { const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && Number(cs.opacity) === 1; }),
      tops: scenes.map((e) => Math.round(e.getBoundingClientRect().top + scrollY)),
      mid: at < 0 ? null : names[at], midTop: at < 0 ? null : Math.round(scenes[at].getBoundingClientRect().top),
      midRead: at < 0 ? 0 : Math.min(...[scenes[at], scenes[at].querySelector('.hub-canvas-body')].filter(Boolean).map((e) => (getComputedStyle(e).visibility === 'hidden' ? 0 : Number(getComputedStyle(e).opacity)))),
      pouts: scenes.map((e) => Number(e.style.getPropertyValue('--hub-pout') || 0)),
    };
  });
  /* Every scene can be picked: scrolled to its own middle, it is the top thing there. */
  const pickable = () => p.evaluate(async () => {
    const out = [];
    for (const e of document.querySelectorAll('.hub-scene')) {
      const r0 = e.getBoundingClientRect(); scrollTo(0, scrollY + r0.top + r0.height / 2 - innerHeight / 2); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 2, Math.max(2, r.top + Math.min(r.height / 2, 40))));
      out.push(hit?.closest('.hub-scene') === e);
    }
    return out;
  });
  const editing = await look();
  const picks = await pickable();
  say(!editing.on && editing.marks === 0 && editing.sticky !== 'sticky' && editing.seen && editing.tops.every((t, i) => i === 0 || t > editing.tops[i - 1]), `${size}: while editing nothing is held — the plain page, every scene whole and in order (${editing.marks} marks)`);
  say(picks.every(Boolean), `${size}: while editing every scene is the top thing at its own place — it can be picked (${picks.map((x) => (x ? 'y' : 'N')).join('')})`);
  /* ▶ held, from the middle of the Schedule. */
  await p.evaluate(() => { const e = document.querySelector('[data-name="Schedule"]').closest('.hub-scene'); const r = e.getBoundingClientRect(); scrollTo(0, scrollY + r.top + r.height / 2 - innerHeight / 2); });
  await p.waitForTimeout(120);
  const before = await look();
  await p.evaluate(() => document.documentElement.setAttribute('data-maker-guest', '')); await p.waitForTimeout(1000);
  const held = await look();
  say(held.on && held.sticky === 'sticky' && held.marks > 0, `${size}: shown as a guest (▶ held) the hand-overs are armed (${held.marks} marks)`);
  say(held.mid === before.mid && held.midRead > 0.95, `${size}: the scene that was mid-screen is still mid-screen, and can be read (${before.mid} at ${before.midTop} → ${held.mid} at ${held.midTop}, shown ${held.midRead})`);
  let played = false;
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= max && !played; y += 40) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(20); played = (await look()).pouts.some((v) => v > 0.2 && v < 0.8); }
  say(played, `${size}: under ▶ held a hand-over plays as the page is scrolled`);
  if (pics) await p.screenshot({ path: `${pics}/c8c-maker-${W}x${H}-held.png` });
  const there = await look();
  await p.evaluate(() => document.documentElement.removeAttribute('data-maker-guest')); await p.waitForTimeout(700);
  const after = await look();
  say(after.mid === there.mid, `${size}: closing the preview keeps the place too (${there.mid} at ${there.midTop} → ${after.mid} at ${after.midTop})`);
  say(!after.on && after.marks === 0 && after.sticky !== 'sticky' && after.seen, `${size}: back to editing — every mark gone, the plain page again (${after.marks} marks)`);
  if (pics) await p.screenshot({ path: `${pics}/c8c-maker-${W}x${H}-editing.png` });
  await ctx.close();
}

/* 8. AN EMPTY SCENE — the second scene of the chain drew nothing. */
for (const [W, H] of [[375, 812], [1280, 770]]) {
  const size = `${W}x${H} an empty scene`;
  /* The longest stretch of scrolling, while the scenes are under the centre line, with NOTHING of any scene to read. */
  const blankest = async (file) => {
    const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage();
    await p.goto(`file://${scratch}/${file}`); await p.waitForTimeout(350);
    const info = await p.evaluate(() => { const e = document.querySelectorAll('.hub-scene')[1]; const cell = e.closest('.hub-cell'); return { on: document.querySelector('.hub-scenes').hasAttribute('data-hub-scrub-on'), cell: cell.classList.contains('hub-cell'), box: e.offsetHeight, len: cell.style.getPropertyValue('--hub-len'), max: document.documentElement.scrollHeight - innerHeight }; });
    let run = 0; let worst = 0;
    for (let y = 0; y <= info.max; y += 16) {
      const any = await p.evaluate(async (v) => {
        scrollTo(0, v); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const mid = innerHeight / 2; const all = document.querySelector('.hub-scenes').getBoundingClientRect();
        if (all.top > mid || all.bottom < mid) return true;
        return [...document.querySelectorAll('.hub-scene')].some((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.height > 0 && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05; });
      }, y);
      run = any ? 0 : run + 16; worst = Math.max(worst, run);
    }
    await ctx.close();
    return { ...info, worst };
  };
  const full = await blankest('scrub-real.html');
  const empty = await blankest('scrub-real-empty.html');
  say(empty.on && empty.cell && empty.box === 0 && !(parseFloat(empty.len) > 0), `${size}: it has no box and the page is not held for it (box ${empty.box}px, hold "${empty.len}"; the full page holds "${full.len}")`);
  say(empty.worst <= full.worst + 16, `${size}: no blank stands longer than on the full page (${empty.worst}px against ${full.worst}px)`);
}

/* 9. OFF IS NEVER SILENT — the page's own island and the lab's badge, in each state. */
{
  const [W, H] = [375, 812];
  const badge = (p) => p.evaluate(() => ({ line: document.querySelector('[data-lab-scrub-line]')?.textContent ?? null, off: document.querySelector('.hub-scenes').getAttribute('data-hub-scrub-off'), on: document.querySelector('.hub-scenes').hasAttribute('data-hub-scrub-on') }));
  /* ON — and the number in the badge is the number on the page. */
  let ctx = await b.newContext({ viewport: { width: W, height: H } }); let p = await ctx.newPage();
  await p.goto(`file://${scratch}/scrub-real-island.html`); await p.waitForTimeout(700);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  let met = null; let metY = 0;
  for (let y = 0; y <= max && !met; y += 24) { metY = y; await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(60); const v = await p.evaluate(() => { const s = [...document.querySelectorAll('.hub-scene')].find((e) => { const o = Number(e.style.getPropertyValue('--hub-pout') || 0); return o > 0.3 && o < 0.7; }); return s ? { name: s.querySelector('[data-name]').getAttribute('data-name'), pout: Number(s.style.getPropertyValue('--hub-pout')) } : null; }); if (v) met = v; }
  await p.waitForTimeout(150);
  const on = await badge(p);
  say(on.on && on.off === null && met && on.line === `Scrub: ON · hand-over 1 of 4 · ${met.name} leaves ${Math.round(met.pout * 100)} % · Countdown arrives 0 %`, `a guest's page, armed by its own island: the badge says what the page carries ("${on.line}"; the page: ${met?.name} ${met?.pout})`);
  /* The one that leaves is named — not an ordinary scene standing still in the same stage (the Note, above Wear). */
  let wear = null;
  for (let y = metY; y <= max && !wear; y += 24) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(40); wear = await p.evaluate(() => { const s = [...document.querySelectorAll('.hub-scene')].find((e) => e.querySelector('[data-name="Wear"]')); const o = Number(s.style.getPropertyValue('--hub-pout') || 0); return o > 0.3 && o < 0.7 ? o : null; }); }
  await p.waitForTimeout(450);
  const fourth = await badge(p);
  say(wear !== null && /^Scrub: ON · hand-over 4 of 4 · Wear leaves \d+ % · Gifts arrives \d+ %$/.test(fourth.line ?? ''), `the badge names the scene that leaves, not the one standing above it ("${fourth.line}")`);
  /* 10. FRAMES THAT NEVER COME: silence them, go back to the top, then to the middle of the first hand-over. */
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; scrollTo(0, 0); }); await p.waitForTimeout(700);
  await p.evaluate((v) => scrollTo(0, v), metY); await p.waitForTimeout(900);
  const starved = await p.evaluate(() => { const s = [...document.querySelectorAll('.hub-scene')].find((e) => e.querySelector('[data-name="Names"]')); return { pout: Number(s.style.getPropertyValue('--hub-pout') || 0), o: Number(getComputedStyle(s).opacity), line: document.querySelector('[data-lab-scrub-line]')?.textContent }; });
  say(Math.abs(starved.pout - met.pout) < 0.02 && starved.o > 0.2 && starved.line === `Scrub: ON · hand-over 1 of 4 · Names leaves ${Math.round(starved.pout * 100)} % · Countdown arrives 0 %`, `with no animation frames at all the page still shows where it is, and says so (Names ${starved.pout} against ${met?.pout} with frames; "${starved.line}")`);
  /* The engine made to throw: the plain page, and it says what stopped it. */
  await p.evaluate(() => { Element.prototype.getBoundingClientRect = () => { throw new Error('boom'); }; scrollBy(0, 40); }); await p.waitForTimeout(700);
  const thrown = await p.evaluate(() => ({ line: document.querySelector('[data-lab-scrub-line]')?.textContent, off: document.querySelector('.hub-scenes').getAttribute('data-hub-scrub-off'), on: document.querySelector('.hub-scenes').hasAttribute('data-hub-scrub-on'), left: [...document.querySelectorAll('.hub-scenes, .hub-scenes *')].filter((e) => /--hub-(?:len|top|up|pbin|pout|o|rise|pp|end)\s*:/.test(e.getAttribute('style') ?? '') || e.hasAttribute('data-hub-away')).length }));
  say(!thrown.on && thrown.left === 0 && thrown.off === 'the script stopped: boom' && thrown.line === 'Scrub: OFF — the script stopped: boom', `the engine made to throw: the plain page, every mark gone, and it says why ("${thrown.line}", ${thrown.left} marks left)`);
  await ctx.close();
  /* Reduce motion. */
  ctx = await b.newContext({ viewport: { width: W, height: H }, reducedMotion: 'reduce' }); p = await ctx.newPage();
  await p.goto(`file://${scratch}/scrub-real-island.html`); await p.waitForTimeout(700);
  const calm = await badge(p);
  say(!calm.on && calm.off === 'reduce motion' && calm.line === 'Scrub: OFF — reduce motion', `with reduce motion: off, and it says so ("${calm.line}")`);
  await ctx.close();
  /* The Maker's canvas: editing, then shown as a guest. */
  ctx = await b.newContext({ viewport: { width: W, height: H } }); p = await ctx.newPage();
  await p.goto(`file://${scratch}/scrub-real-maker.html`); await p.waitForTimeout(700);
  const editing = await badge(p);
  say(!editing.on && editing.line === 'Scrub: OFF — editing — hold ▶ to play it', `the Maker's canvas while editing: off, and it says how to play it ("${editing.line}")`);
  await p.evaluate(() => document.documentElement.setAttribute('data-maker-guest', '')); await p.waitForTimeout(1000);
  const held = await badge(p);
  say(held.on && held.off === null && /^Scrub: ON · hand-over \d of 4/.test(held.line ?? ''), `…and under ▶ held: on ("${held.line}")`);
  if (pics) await p.screenshot({ path: `${pics}/c8d-badge-${W}x${H}.png` });
  await p.evaluate(() => document.documentElement.removeAttribute('data-maker-guest')); await p.waitForTimeout(700);
  const back = await badge(p);
  say(!back.on && back.line === 'Scrub: OFF — editing — hold ▶ to play it', `…and back to editing ("${back.line}")`);
  await ctx.close();
}

/* 11. THE PAGE'S OWN HOLD UNDER `html { overflow-x: clip }` (the stylesheet sets it on a page with a full-width scene:
   `html:has(.hub-shape-full)`). A sticky box stops working inside anything that scrolls; `clip` must not be that. */
{
  const [W, H] = [375, 812]; const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage();
  await p.goto(`file://${scratch}/scrub-real-page.html`); await p.waitForTimeout(500);
  await p.evaluate(() => { const d = document.createElement('div'); d.className = 'hub-shape-full'; document.querySelector('[data-foot]').appendChild(d); });
  const clip = await p.evaluate(() => getComputedStyle(document.documentElement).overflowX);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); let seen = null;
  const read = () => p.evaluate(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const s = [...document.querySelectorAll('.hub-scene')][0]; return { pout: Number(s.style.getPropertyValue('--hub-pout') || 0), top: s.getBoundingClientRect().top, lead: document.querySelector('[data-lead]').getBoundingClientRect().top }; });
  for (let y = 0; y <= max && !seen; y += 24) { await p.evaluate((v) => scrollTo(0, v), y); const a = await read(); if (a.pout > 0.2 && a.pout < 0.5) { await p.evaluate((v) => scrollTo(0, v), y + 60); const c = await read(); seen = { a, c }; } }
  say(clip === 'clip' && seen && seen.c.pout > seen.a.pout && Math.abs(seen.c.top - seen.a.top) < 0.6 && Math.abs(seen.c.lead - seen.a.lead) < 0.6, `with html { overflow-x: ${clip} } the page still stands still during a hold (the scene ${seen?.a.top}→${seen?.c.top}, the page before it ${seen?.a.lead}→${seen?.c.lead}, ${seen?.a.pout}→${seen?.c.pout})`);
  /* …and the page's own ISLAND arms the page's hold (not the scenes block) when the page has one. */
  const q = await ctx.newPage(); await q.goto(`file://${scratch}/scrub-real-page-island.html`); await q.waitForTimeout(700);
  const armedAs = await q.evaluate(() => ({ page: document.querySelector('.hub-page-cell').hasAttribute('data-hub-page-on'), block: document.querySelector('.hub-scenes').hasAttribute('data-hub-scrub-on'), pairs: [...document.querySelectorAll('.hub-page-cell')].filter((c) => parseFloat(c.style.getPropertyValue('--hub-len')) > 0).length, inner: [...document.querySelectorAll('.hub-cell')].filter((c) => parseFloat(getComputedStyle(c, '::after').height) > 0).length }));
  say(armedAs.page && armedAs.block && armedAs.pairs === 4 && armedAs.inner === 0, `the page's own island arms the PAGE's hold: 4 page pairs hold, no cell of the scenes block does (${JSON.stringify(armedAs)})`);
  await ctx.close();
}

/* 12. A LONG ARRIVAL UNDER THE PINNED TOP BAR — the top of the room is ONE number, the stylesheet's (`--hub-pin`).
   (2026-10-09: the engine kept its own — 76 px, or 9 % — while the stylesheet's line under the invitation's bar is
   100 px; a long arrival began above the line, under the progress mark.) The page stands still while it arrives, so
   every position of the arrival is the same place: on the line, and below everything the page pins at its top. */
for (const [W, H] of [[375, 812], [375, 667], [441, 882], [1280, 770]]) {
  const size = `${W}x${H} a long arrival under the pinned top bar`;
  const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await p.goto(`file://${scratch}/scrub-real-bar.html`); await p.waitForTimeout(500);
  /* The stylesheet's line, resolved by the browser on a box of the check's own — never read from the engine. */
  const line = await p.evaluate(() => { const i = document.createElement('i'); i.style.cssText = 'position:absolute;visibility:hidden;height:var(--hub-pin)'; document.querySelector('.hub-scenes').appendChild(i); const h = i.getBoundingClientRect().height; i.remove(); return h; });
  const off = await p.evaluate(() => document.querySelector('.hub-scenes').getAttribute('data-hub-scrub-off'));
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const seen = [];
  for (let y = 0; y <= max; y += 16) {
    const f = await p.evaluate(async (v) => {
      scrollTo(0, v); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const scene = (n) => document.querySelector(`[data-name="${n}"]`).closest('.hub-scene');
      const march = scene('March'); const prog = document.querySelector('.hub-prog-bar');
      return { pout: Number(scene('Schedule').style.getPropertyValue('--hub-pout') || 0), pin: Number(march.style.getPropertyValue('--hub-pbin') || 1), top: march.getBoundingClientRect().top, first: march.querySelector('[data-name] > *').getBoundingClientRect().top, bar: document.querySelector('[data-sticky-top]').getBoundingClientRect().bottom, prog: prog && prog.getClientRects().length ? prog.getBoundingClientRect().bottom : 0 };
    }, y);
    /* The arrival, while it arrives: the list before it is leaving and this one is part-way in. */
    if (f.pout > 0 && f.pin > 0 && f.pin < 1) seen.push(f);
  }
  const at = seen[0]; const r = (n) => Math.round(n * 10) / 10;
  const pinned = at ? Math.max(at.bar, at.prog) : 0;
  say(errs.length === 0 && off === null && seen.length > 0, `${size}: the hand-over plays (${seen.length} positions of the arrival watched${off ? `; off: ${off}` : ''}${errs.length ? `; ${errs[0]}` : ''})`);
  say(seen.length > 0 && seen.every((f) => f.top >= Math.max(f.bar, f.prog) - 0.5), `${size}: it arrives clear of everything pinned at the top (the arrival's top ${at ? r(at.top) : '—'}, its first line ${at ? r(at.first) : '—'}; the bar ends at ${at ? r(at.bar) : '—'}, the progress mark at ${at ? r(at.prog) : '—'}${at && at.top < pinned ? ` — ${r(pinned - at.top)}px under` : ''})`);
  say(seen.length > 0 && seen.every((f) => Math.abs(f.top - line) <= 1), `${size}: it arrives ON the stylesheet's line (the arrival's top ${at ? r(at.top) : '—'}, the stylesheet's line ${r(line)})`);
  if (pics && at) { await p.evaluate((v) => scrollTo(0, v), 0); const mid = seen[Math.floor(seen.length * 0.8)]; for (let y = 0; y <= max; y += 16) { const v = await p.evaluate(async (yy) => { scrollTo(0, yy); await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2))); return Number(document.querySelector('[data-name="March"]').closest('.hub-scene').style.getPropertyValue('--hub-pbin') || 1); }, y); if (v >= mid.pin) break; } await p.screenshot({ path: `${pics}/c12-bar-${W}x${H}-long-arrival.png` }); }
  await ctx.close();
}

/* 13. THE HUB IS CARDS, FRAMED OR NOT (2026-10-09: the card rule only reached a section that was its wrapper's own
   child, so a scene given nothing but a Build in — drawn inside a frame — stood as bare words on the page). */
{
  const [W, H] = [375, 812]; const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage();
  /* The card, as the browser draws it on a section: its corners, hairline, paper, room and shadow. */
  const cardOf = (sel) => p.evaluate((q) => [...document.querySelectorAll(q)].map((e) => { const cs = getComputedStyle(e); return { name: e.getAttribute('data-name'), card: [cs.borderTopLeftRadius, cs.borderTopWidth, cs.backgroundColor, cs.paddingTop, cs.paddingLeft, cs.boxShadow].join(' | '), shadow: cs.boxShadow !== 'none' }; }), sel);
  await p.goto(`file://${scratch}/scrub-real-cards.html`); await p.waitForTimeout(400);
  const cards = Object.fromEntries((await cardOf('section[data-name]')).map((c) => [c.name, c]));
  say(cards.Plain?.shadow === true, `the hub is cards: a scene nobody arranged is a card (${cards.Plain?.card})`);
  say(cards.Motion?.card === cards.Plain?.card, `the hub is cards: a scene with a motion setting only — inside a frame that paints nothing — wears the SAME card (${cards.Motion?.card})`);
  say(cards.NoBackground?.shadow === false && cards.NoBackground?.card.startsWith('0px | 0px'), `the hub is cards: "No background" is no box at all (${cards.NoBackground?.card})`);
  say(cards.Colour?.shadow === false && cards.Colour?.card.startsWith('0px | 0px'), `the hub is cards: a scene with a ground of its own is its frame — no card inside it (${cards.Colour?.card})`);
  say(cards.Template?.shadow === false && cards.Template?.card.startsWith('0px | 0px'), `the hub is cards: a template scene keeps its own layout — no card (${cards.Template?.card})`);
  if (pics) await p.screenshot({ path: `${pics}/c13-cards-${W}x${H}.png` });
  /* …and on a page with a Scrub hand-over (the plain page, no script): every scene of the chain, framed or not. */
  await p.goto(`file://${scratch}/scrub-real-noscript.html`); await p.waitForTimeout(400);
  const chain = await cardOf('.hub-scene section[data-name]');
  say(chain.length === 6 && chain.every((c) => c.card === chain.at(-1).card && c.shadow), `the hub is cards: on the Scrub page every scene is a card, the five framed ones as the one nobody arranged (${chain.map((c) => `${c.name} ${c.shadow ? 'card' : 'BARE'}`).join(', ')})`);
  if (pics) await p.screenshot({ path: `${pics}/c13-scrub-page-cards-${W}x${H}.png`, fullPage: true });
  await ctx.close();
}

/* 14. 🎬 THE COVER AS HAND-OVER ZERO. `today`: the same page with the cover NOT handing over and no script — what a
   guest has now. Everything the cover's hand-over is measured against at scroll 0 is read from THAT page. */
{
  const COVER_SNAP = () => {
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { t: r.top, b: r.bottom, o: cs.visibility === 'hidden' ? 0 : Number(cs.opacity) }; };
    const cover = document.querySelector('.hub-cover') ?? document.querySelector('[data-cover]');
    const scene = (n) => { const e = document.querySelector(`[data-name="${n}"]`); return e ? (e.closest('.hub-scene') ?? e) : null; };
    return { s: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, cover: box(cover), words: box(document.querySelector('[data-cover] h1')), pout: Number(cover.style.getPropertyValue('--hub-pout') || 0), zero: box(document.querySelector('[data-hub-zero]')), zeroIs: document.querySelector('[data-hub-zero]')?.getAttribute('data-block') ?? document.querySelector('[data-hub-zero]')?.getAttribute('data-name') ?? document.querySelector('[data-hub-zero] [data-name]')?.getAttribute('data-name') ?? null, countdown: box(scene('Countdown')), cdOut: Number(scene('Countdown')?.style.getPropertyValue('--hub-pout') || 0), ticket: box(document.querySelector('[data-block="Ticket"]')), all: [...document.querySelectorAll('[data-cover], [data-block], [data-name]')].map((e) => { const x = e.closest('.hub-scene') ?? e; const r = x.getBoundingClientRect(); const cs = getComputedStyle(x); return [Math.round(r.top), (cs.visibility === 'hidden' ? 0 : Number(cs.opacity)).toFixed(2)]; }), off: document.querySelector('.hub-page-cell')?.getAttribute('data-hub-scrub-off') ?? document.querySelector('.hub-scenes')?.getAttribute('data-hub-scrub-off') ?? null, sticky: [...document.querySelectorAll('.hub-page-stage, .hub-stage')].some((e) => getComputedStyle(e).position === 'sticky') };
  };
  const open = async (file, W, H) => { const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140))); await p.goto(`file://${scratch}/${file}`); await p.waitForTimeout(500); const at = async (y) => { await p.evaluate((yy) => scrollTo(0, yy), y); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return p.evaluate(COVER_SNAP); }; return { ctx, p, errs, at }; };
  const r = (n) => (n === null || n === undefined ? '—' : Math.round(n * 10) / 10);
  for (const [W, H] of [[375, 812], [375, 667], [441, 882], [890, 1548], [1280, 770]]) {
    const size = `${W}x${H} the cover as hand-over zero`;
    const t = await open('scrub-cover-today.html', W, H); const today = await t.at(0); await t.ctx.close();
    const { ctx, p, errs, at } = await open('scrub-cover.html', W, H);
    const top = await at(0);
    say(errs.length === 0 && top.off === null && top.sticky, `${size}: armed, no page error${errs.length ? ` — ${errs[0]}` : ''}${top.off ? ` — off: ${top.off}` : ''}`);
    say(Math.abs(top.cover.t - today.cover.t) < 0.01 && Math.abs(top.cover.b - today.cover.b) < 0.01 && Math.abs(top.words.t - today.words.t) < 0.01 && top.cover.o === 1 && top.pout === 0, `${size}: at scroll 0 the cover is exactly where today's page has it, whole, 0 % built out (${r(top.cover.t)}–${r(top.cover.b)} against ${r(today.cover.t)}–${r(today.cover.b)}; shown ${top.cover.o}, out ${top.pout})`);
    const fwd = []; for (let y = 0; y < top.max; y += 16) fwd.push(await at(y)); fwd.push(await at(top.max));
    const back = [await at(top.max)]; for (let y = top.max - (top.max % 16); y >= 0; y -= 16) back.push(await at(y));
    const sig = (f) => JSON.stringify([f.all, f.pout.toFixed(3)]);
    const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1);
    const out = Math.round(H * 0.55);
    say(hold.length > 3 && hold.every((f) => Math.abs(f.cover.t - today.cover.t) < 0.6), `${size}: the page stands still while the cover builds out — it never leaves where it stood (${hold.length} positions; moved at most ${r(Math.max(0, ...hold.map((f) => Math.abs(f.cover.t - today.cover.t))))}px)`);
    say(hold.every((f) => Math.abs(f.pout - f.s / out) < 0.02) && fwd.some((f) => f.pout >= 1 && f.cover.o === 0) && fwd.find((f) => f.pout >= 1).s <= out + 16, `${size}: the Build out runs over 55 % of a screen from the first thumb travel, and completes (${out}px; done by ${fwd.find((f) => f.pout >= 1)?.s}px)`);
    const early = fwd.filter((f) => f.zero && f.zero.o > 0.02 && f.pout < 0.79);
    const entering = fwd.filter((f) => f.zero && f.zero.o > 0.02 && f.pout < 1);
    say(early.length === 0 && entering.length > 0 && top.zero.o === 0, `${size}: what comes next (${top.zeroIs}) enters at the last 20 % of the Build out, not before (first seen with the cover ${entering[0] ? Math.round(entering[0].pout * 100) : '—'} % out${early.length ? `; EARLY at ${Math.round(early[0].pout * 100)} %` : ''})`);
    const seen = fwd.filter((f) => f.zero && f.zero.o > 0.02 && f.pout > 0 && f.cdOut === 0 && Math.abs(f.cover.t - today.cover.t) < 0.6 && f.s <= out);
    say(seen.length > 0 && seen.every((f) => Math.abs((f.zero.t + f.zero.b) / 2 - H / 2) < 1.5 && f.zero.t >= today.cover.t - 0.5), `${size}: it arrives at the centred line, never above the cover (middle ${seen[0] ? r((seen[0].zero.t + seen[0].zero.b) / 2) : '—'} against ${H / 2}; the cover's own middle ${r((today.cover.t + today.cover.b) / 2)})`);
    say(fwd.every((f) => { const k = back.find((x) => x.s === f.s); return k && sig(k) === sig(f); }), `${size}: back == down at every one of ${fwd.length} positions`);
    say(fwd.some((f) => f.cdOut >= 1) && fwd.at(-1).all.at(-1)[1] === '1.00', `${size}: the scenes after the cover still hand over, to the end of the page`);
    if (pics) { for (const [name, pick] of [['0-opens', () => 0], ['1-half-out', () => fwd.find((f) => f.pout >= 0.5)?.s], ['2-next-arrives', () => fwd.find((f) => f.pout >= 0.9)?.s], ['3-arrived', () => fwd.find((f) => f.pout >= 1 && f.zero.o >= 0.99)?.s]]) { const y = pick(); if (y !== undefined) { await at(y); await p.screenshot({ path: `${pics}/c14-cover-${W}x${H}-${name}.png` }); } } }
    await ctx.close();
    /* With no script: the plain page — the cover and every scene whole, in order, nothing held. */
    const n = await open('scrub-cover-noscript.html', W, H); const plain = await n.at(0); await n.ctx.close();
    say(!plain.sticky && plain.all.every((x) => x[1] === '1.00') && plain.all.every((x, i) => i === 0 || x[0] > plain.all[i - 1][0]) && Math.abs(plain.cover.t - today.cover.t) < 0.01, `${size}: with no script the page is the plain page — the cover where today's page has it, every scene whole and in order`);
  }
  /* B — WHATEVER COMES NEXT ARRIVES: two plain blocks between the cover and the scenes. */
  for (const [W, H] of [[375, 812], [375, 667], [1280, 770]]) {
    const size = `${W}x${H} a block after the cover`;
    const { ctx, p, errs, at } = await open('scrub-cover-block.html', W, H);
    const top = await at(0); const fwd = []; for (let y = 0; y <= Math.round(H * 0.55) + 48; y += 16) fwd.push(await at(y));
    const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1);
    say(errs.length === 0 && top.zeroIs === 'Greeting' && top.zero.o === 0 && fwd.every((f) => !(f.zero.o > 0.02 && f.pout < 0.79)) && fwd.some((f) => f.zero.o > 0.02 && f.pout < 1) && fwd.at(-1).zero.o > 0.5, `${size}: the block that comes next is what arrives — not a scene further down — at the last 20 % (${top.zeroIs})`);
    say(hold.every((f) => f.zero.t >= f.cover.t - 0.5 && Math.abs((f.zero.t + f.zero.b) / 2 - H / 2) < 1.5), `${size}: it arrives at the centred line and nothing is pulled above the cover (middle ${r((top.zero.t + top.zero.b) / 2)} against ${H / 2}; the cover's top ${r(top.cover.t)})`);
    say(hold.length > 3 && hold.filter((f) => f.cover.o > 0.02).every((f) => f.ticket.t >= f.cover.b - 1 && f.ticket.t >= f.zero.b - 1), `${size}: what follows the arrival never lies over the cover while it can be seen (the next block's top ${r(top.ticket.t)}; the cover ends ${r(top.cover.b)}, the arrival ${r(top.zero.b)})`);
    if (pics) { for (const [name, y] of [['0-opens', 0], ['2-next-arrives', fwd.find((f) => f.pout >= 0.9)?.s]]) { if (y !== undefined) { await at(y); await p.screenshot({ path: `${pics}/c14-cover-block-${W}x${H}-${name}.png` }); } } }
    await ctx.close();
  }
  /* THE COVER IS THE PAGE'S ONLY SCRUB: no scenes block is armed — the page's hold is, and the cover still plays. */
  {
    const [W, H] = [375, 812]; const { ctx, p, errs, at } = await open('scrub-cover-only.html', W, H);
    const top = await at(0); const end = await at(Math.round(H * 0.55) + 200);
    const blocks = await p.evaluate(() => ({ scenes: document.querySelectorAll('.hub-scenes').length, page: document.querySelector('.hub-page-cell').hasAttribute('data-hub-page-on') }));
    say(errs.length === 0 && blocks.scenes === 0 && blocks.page && top.off === null && top.cover.o === 1 && top.pout === 0 && top.zero.o === 0 && end.pout === 1 && end.cover.o === 0 && end.zero.o === 1, `${W}x${H} the cover is the page's only Scrub: it plays with no scenes block on the page (out ${top.pout} → ${end.pout}; the next, ${top.zeroIs}, ${top.zero.o} → ${end.zero.o}${top.off ? `; off: ${top.off}` : ''}${errs.length ? `; ${errs[0]}` : ''})`);
    await ctx.close();
  }
  /* 🎭 UNDER A CLOSED REVEAL NOTHING IS HELD (the page's own island decides; the Reveal's mark is on the page before
     it mounts). The page scrolls as a plain page under the opening — the cover is never built out unseen — and the
     hand-overs arm the moment the mark comes off. */
  {
    const [W, H] = [375, 812]; const { ctx, p, errs, at } = await open('scrub-cover-reveal.html', W, H); await p.waitForTimeout(500);
    const state = () => p.evaluate(() => ({ page: document.querySelector('.hub-page-cell').hasAttribute('data-hub-page-on'), off: document.querySelector('.hub-scenes').getAttribute('data-hub-scrub-off'), line: document.querySelector('[data-lab-scrub-line]')?.textContent ?? null }));
    const under = await state(); const moved = await at(300); const top = await at(0);
    say(errs.length === 0 && !under.page && under.off === 'the opening is still up' && under.line === 'Scrub: OFF — the opening is still up' && moved.pout === 0 && moved.cover.o === 1 && Math.abs(moved.cover.t - (top.cover.t - 300)) < 0.6, `${W}x${H} under a closed Reveal nothing is held: the page scrolls as a plain page and the cover is not built out unseen, and it says why ("${under.line}"; 300px down the cover is at ${r(moved.cover.t)}, shown ${moved.cover.o})`);
    await p.evaluate(() => document.documentElement.removeAttribute('data-reveal-up')); await p.waitForTimeout(900);
    const gone = await state(); const open0 = await at(0); const half = await at(Math.round(H * 0.55 * 0.5));
    say(gone.page && gone.off === null && open0.pout === 0 && open0.cover.o === 1 && half.pout > 0.45 && half.pout < 0.55 && Math.abs(half.cover.t - open0.cover.t) < 0.6, `${W}x${H} …and the moment the Reveal goes the hand-overs are armed: the cover whole at the top, then held and half out half-way (out ${open0.pout} → ${half.pout}; "${gone.line}")`);
    await p.evaluate(() => document.documentElement.setAttribute('data-reveal-up', '')); await p.waitForTimeout(700);
    const again = await state();
    say(!again.page && again.off === 'the opening is still up', `${W}x${H} …and the Reveal back up (the film's return) takes them off again ("${again.line}")`);
    await ctx.close();
  }
  /* A COVER TALLER THAN THE SCREEN: the ordinary rule — scrolled through, held when its bottom is on the centre line. */
  for (const [W, H] of [[375, 667], [375, 812]]) {
    const size = `${W}x${H} a cover taller than the screen`;
    const { ctx, p, errs, at } = await open('scrub-cover-tall.html', W, H);
    const top = await at(0); const fwd = []; for (let y = 0; y <= Math.round(top.cover.b - H / 2 + H * 0.55 + 200); y += 16) fwd.push(await at(y));
    const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1);
    say(errs.length === 0 && top.cover.o === 1 && top.pout === 0 && top.cover.b > H && fwd.filter((f) => f.pout === 0 && f.s > 0 && f.cover.b > H / 2 + 1).every((f) => Math.abs(f.cover.t - (top.cover.t - f.s)) < 0.6), `${size}: it opens whole and scrolls like any page until its bottom reaches the centre line (${r(top.cover.t)}–${r(top.cover.b)} on a ${H}px screen)`);
    say(hold.length > 3 && hold.every((f) => Math.abs(f.cover.b - H / 2) < 1.5) && fwd.some((f) => f.pout >= 1), `${size}: then it is held with its bottom on the centre line, and builds out there (bottom ${hold[0] ? r(hold[0].cover.b) : '—'} against ${H / 2})`);
    if (pics) { for (const [name, y] of [['0-opens', 0], ['1-held', hold[Math.floor(hold.length / 3)]?.s], ['2-next-arrives', fwd.find((f) => f.pout >= 0.9)?.s]]) { if (y !== undefined) { await at(y); await p.screenshot({ path: `${pics}/c14-cover-tall-${W}x${H}-${name}.png` }); } } }
    await ctx.close();
  }
}
await b.close();
console.log(failed ? `\n${failed} FAILED` : PLAYED.length === SIZES.length ? '\nALL OK' : '\nPART ONLY — OK (not every size was played)');
process.exit(failed ? 1 : 0);
