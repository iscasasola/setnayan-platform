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
 *  15. 🧱 THE REAL INVITATION'S SHAPE: the cover is not a sibling of the rest of the page — it shares the page's FIRST
 *      GROUP with the reply card, and everything else is in LATER groups, outside the cover's own rest-of-the-page
 *      box. The reply card arrives where the cover leaves; the next group never lies over the cover while it can be
 *      seen, and stands right under the reply card once it has gone; a group that is not shown and a box the page
 *      pins itself are left alone; with no script every block is where today's page has it. And a page a tab,
 *      opened on ANOTHER tab: nothing is held for a cover that is not shown; the first tab shown (no reload), its
 *      hand-over is measured and plays; hidden again, every mark is off.
 *  16. 🧾 THE REAL GUEST PAGE (the fixture invitation drawn by the real `SiteBody`, `scripts/scrub-fixture-page.tsx`),
 *      with the app's own compiled stylesheet. With its cover wrapped to hand over and NO script: every box of today's
 *      page exactly where it stood, the page's rhythm kept in pixels, the scroll reveal's chapters the same and the
 *      first screen never hidden. Armed by the page's own island at three sizes: one page pair — the cover's; the
 *      cover where today's page has it at scroll 0; the page (and its pinned bar) standing still while it builds
 *      out; the reply row arriving by the hand-over's one fade; the next group never over the cover; back == down;
 *      reduce motion = the plain page. Under a closed Reveal nothing is held. And a page a tab: the cover's
 *      hand-over on the first tab only, measured again when that tab is shown.
 *  17. 🤝 TOGETHER (owner 2026-10-10: "Together."). When the block after the cover is the page's ACTION ROW (the
 *      reply row; the row that stands in its place; the stranger's door — by the page's own marks, never by height),
 *      the block after it arrives WITH it: one fade, one unit, centred as one, the page's own distance between the
 *      two kept. A long second block arrives with the row from the top of the room down and is scrolled through. A
 *      cover whose group holds nothing after it never fades to nothing: the next group's block arrives alone. (16
 *      plays the same on the real guest page: the RSVP button and "Until we say 'I do'" — and on THE STRANGER'S
 *      page, both of its covers: the door, "Get inside", and the Countdown.)
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
for (const m of ['cover', 'cover-tall', 'cover-block', 'cover-only', 'cover-noscript', 'cover-today', 'cover-margin', 'cover-groups', 'cover-groups-today', 'cover-groups-noscript', 'cover-groups-tab', 'cover-groups-row', 'cover-groups-row-today', 'cover-groups-row-noscript', 'cover-groups-row-long', 'cover-groups-row-long-today', 'cover-groups-norow', 'cover-groups-norow-today', 'cover-groups-norow-noscript']) execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-${m}.html`, `${scratch}/scrub-engine.js`, m], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-cover-reveal.html`, `${scratch}/scrub-island.js`, 'cover-reveal'], { cwd: WEB, stdio: 'pipe' });
/* (16) THE REAL GUEST PAGE, written out for the fixture invitation — and the app's own stylesheet compiled for those
   pages alone (the pages above link `globals.css` raw, which carries the hub's rules and none of the utilities the
   real page is spaced with). */
execFileSync(esbuild, [`${WEB}/scripts/scrub-check-door.tsx`, '--bundle', '--minify', '--format=iife', '--jsx=automatic', '--define:process.env.NODE_ENV="production"', `--outfile=${scratch}/scrub-door.js`], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-fixture-page.tsx', scratch, `${scratch}/scrub-island.js`, `${scratch}/scrub-door.js`], { cwd: WEB, stdio: 'pipe' });
execFileSync(`${WEB}/node_modules/.bin/tailwindcss`, ['-i', 'app/globals.css', '-o', `${scratch}/fixture.css`, '--content', `${scratch}/fixture-*.html`], { cwd: WEB, stdio: 'pipe' });

/* Before any page script: remember the browser's own scrolling, and count every way a script could take it over. */
const WATCH = () => {
  const real = window.scrollTo.bind(window);
  window.__go = (y) => real(0, y);
  /* `listeners`: every wheel / touch / key / non-passive scroll listener anything on the page adds — EXCEPT React's own
     event delegation on a React root's container (any React page has it: `createRoot` marks the container, then puts
     one listener per event on it). Those go to `delegated`, with whether each can hold the page back (not passive). */
  window.__took = { scrollSet: 0, prevented: 0, listeners: [], delegated: [] };
  for (const k of ['scrollTo', 'scroll', 'scrollBy']) window[k] = () => { window.__took.scrollSet++; };
  Element.prototype.scrollIntoView = function () { window.__took.scrollSet++; };
  for (const proto of [Element.prototype, HTMLElement.prototype]) for (const k of ['scrollTop', 'scrollLeft']) { const d = Object.getOwnPropertyDescriptor(Element.prototype, k); if (d?.set) Object.defineProperty(proto, k, { ...d, set(v) { window.__took.scrollSet++; d.set.call(this, v); } }); }
  const pd = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function () { if (/wheel|touch|scroll|pointer|key/.test(this.type)) window.__took.prevented++; return pd.call(this); };
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    const passive = Boolean(opt && typeof opt === 'object' && opt.passive);
    if (/^(wheel|mousewheel|touchstart|touchmove|touchend|keydown)$/.test(type) || (type === 'scroll' && !passive)) {
      const reactRoot = this instanceof Element && Object.keys(this).some((k) => k.startsWith('__reactContainer$'));
      if (reactRoot) window.__took.delegated.push(`${type}${passive ? '' : ' (not passive)'}`);
      else window.__took.listeners.push(type);
    }
    return add.call(this, type, fn, opt);
  };
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
/* `SCRUB_ONLY=15` plays that one numbered block alone — a re-run while working on it, a sabotage. The same rule. */
const ONLY = process.env.SCRUB_ONLY ?? null;
const PLAYED = process.env.SCRUB_ONLY_MAKER || ONLY ? [] : process.env.SCRUB_ONE_SIZE ? [SIZES[3]] : SIZES;
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
  say(took2.listeners.length === 0 && took2.delegated.length === 0, `${size} no wheel / touch / key / non-passive scroll listener (${[...took2.listeners, ...took2.delegated].join(',') || 'none'})`);
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
if (!ONLY) for (const [W, H] of [[375, 812], [1280, 770]]) {
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
if (!ONLY) for (const [W, H] of [[375, 812], [1280, 770]]) {
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
if (!ONLY) {
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
if (!ONLY) {
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
if (!ONLY) for (const [W, H] of [[375, 812], [375, 667], [441, 882], [1280, 770]]) {
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
if (!ONLY) {
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
if (!ONLY) {
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
  /* A COVER WHOSE LAST LINE HAS A BOTTOM MARGIN: the margin runs out through the cover's box and is added to the
     distance the engine sets — the arrival would stand that much below its line. The engine reads the distance back. */
  for (const [W, H] of [[375, 812], [1280, 770]]) {
    const { ctx, errs, at } = await open('scrub-cover-margin.html', W, H);
    const top = await at(0); const fwd = []; for (let y = 0; y <= Math.round(H * 0.55); y += 16) fwd.push(await at(y));
    const seen = fwd.filter((f) => f.zero && f.zero.o > 0.02 && f.pout < 1);
    say(errs.length === 0 && top.cover.o === 1 && top.pout === 0 && seen.length > 0 && seen.every((f) => Math.abs((f.zero.t + f.zero.b) / 2 - H / 2) < 1.5), `${W}x${H} a cover whose last line has a bottom margin: what comes next still arrives on the centred line (middle ${seen[0] ? r((seen[0].zero.t + seen[0].zero.b) / 2) : '—'} against ${H / 2}; the cover ends ${r(top.cover.b)})`);
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
    const gone = await state(); const open0 = await at(0); const half = await at(Math.round(H * 0.55 * 0.5)); await p.waitForTimeout(450); const named = await state();
    say(named.line === `Scrub: ON · hand-over 1 of 4 · The cover leaves ${Math.round(half.pout * 100)} % · Countdown arrives 0 %`, `${W}x${H} the badge counts and names hand-over zero ("${named.line}"; the page: the cover ${half.pout})`);
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
/* 15. 🧱 THE REAL INVITATION'S SHAPE (`cover-groups`): the cover is NOT a sibling of the rest of the page. It sits in
   the page's FIRST GROUP with the reply card; everything else is in LATER groups — outside the cover's own
   rest-of-the-page box. `today`: the same page with the cover NOT handing over and no script. */
if (!ONLY || ONLY === '15') {
  const SNAP15 = () => {
    const box = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { t: r.top, b: r.bottom, o: cs.visibility === 'hidden' ? 0 : Number(cs.opacity) }; };
    const cover = document.querySelector('.hub-cover') ?? document.querySelector('[data-cover]');
    const scene = (n) => { const e = document.querySelector(`[data-name="${n}"]`); return e ? (e.closest('.hub-scene') ?? e) : null; };
    const pin = document.querySelector('[data-pinned]');
    return {
      s: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight,
      cover: box(cover), words: box(document.querySelector('[data-cover] h1')), pout: Number(cover.style.getPropertyValue('--hub-pout') || 0),
      zero: box(document.querySelector('[data-hub-zero]')), zeroIs: document.querySelector('[data-hub-zero]')?.getAttribute('data-block') ?? document.querySelector('[data-hub-zero] [data-name]')?.getAttribute('data-name') ?? null,
      reply: box(document.querySelector('[data-block="Reply"]')), greeting: box(document.querySelector('[data-block="Greeting"]')), other: box(document.querySelector('[data-block="OtherTab"]')), foot: box(document.querySelector('[data-foot]')),
      cdOut: Number(scene('Countdown')?.style.getPropertyValue('--hub-pout') || 0),
      /* What the engine marked as "what follows the arrival", by the group (or block) it is. */
      lifted: [...document.querySelectorAll('[data-hub-zlift]')].map((e) => e.getAttribute('data-grp') ?? e.getAttribute('data-block') ?? e.className),
      pin: { marked: pin.hasAttribute('data-hub-zlift'), position: getComputedStyle(pin).position, top: getComputedStyle(pin).top },
      hiddenMarked: [...document.querySelectorAll('[hidden]')].filter((e) => [...e.attributes].some((a) => /^data-hub-z/.test(a.name))).length,
      all: [...document.querySelectorAll('[data-cover], [data-block], [data-name], [data-foot]')].filter((e) => e.getClientRects().length).map((e) => { const x = e.closest('.hub-scene') ?? e; const r = x.getBoundingClientRect(); const cs = getComputedStyle(x); return [e.getAttribute('data-block') ?? e.getAttribute('data-name') ?? (e.hasAttribute('data-cover') ? 'cover' : 'foot'), Math.round(r.top), (cs.visibility === 'hidden' ? 0 : Number(cs.opacity)).toFixed(2)]; }),
      holds: [...document.querySelectorAll('.hub-page-cell')].map((c) => parseFloat(getComputedStyle(c, '::after').height) || 0),
      on: document.querySelector('.hub-page-cell')?.hasAttribute('data-hub-page-on') ?? false,
      off: document.querySelector('.hub-page-cell')?.getAttribute('data-hub-scrub-off') ?? document.querySelector('.hub-scenes')?.getAttribute('data-hub-scrub-off') ?? null,
      sticky: [...document.querySelectorAll('.hub-page-stage, .hub-stage')].some((e) => getComputedStyle(e).position === 'sticky'),
    };
  };
  const open = async (file, W, H) => { const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140))); await p.goto(`file://${scratch}/${file}`); await p.waitForTimeout(500); const at = async (y) => { await p.evaluate((yy) => scrollTo(0, yy), y); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return p.evaluate(SNAP15); }; return { ctx, p, errs, at }; };
  const r = (n) => (n === null || n === undefined ? '—' : Math.round(n * 10) / 10);
  for (const [W, H] of [[375, 812], [375, 667], [441, 882], [1280, 770]]) {
    const size = `${W}x${H} the real invitation's shape`;
    const t = await open('scrub-cover-groups-today.html', W, H); const today = await t.at(0); await t.ctx.close();
    const { ctx, p, errs, at } = await open('scrub-cover-groups.html', W, H);
    const top = await at(0);
    say(errs.length === 0 && top.on && top.off === null && top.sticky && top.holds.length === 4 && top.holds.every((h) => h > 0), `${size}: armed, no page error, one page pair a hand-over — the cover's and the scenes' three (${top.holds.map(r).join(' · ')}${errs.length ? ` — ${errs[0]}` : ''}${top.off ? ` — off: ${top.off}` : ''})`);
    say(Math.abs(top.cover.t - today.cover.t) < 0.01 && Math.abs(top.cover.b - today.cover.b) < 0.01 && Math.abs(top.words.t - today.words.t) < 0.01 && top.cover.o === 1 && top.pout === 0 && top.zeroIs === 'Reply' && top.zero.o === 0, `${size}: at scroll 0 the cover is exactly where today's page has it, whole, 0 % built out, and what arrives (${top.zeroIs}) is not there yet (${r(top.cover.t)}–${r(top.cover.b)} against ${r(today.cover.t)}–${r(today.cover.b)})`);
    /* WHAT FOLLOWS, FOUND IN THE LATER GROUPS: every group after the cover's that has a box and is in the ordinary
       flow — not the one that is not shown, not the box the page pins itself. */
    say(JSON.stringify(top.lifted) === JSON.stringify(['greeting', 'scenes', 'foot']) && top.hiddenMarked === 0 && !top.pin.marked && top.pin.position === 'sticky' && top.pin.top === '8px', `${size}: what follows the arrival is found in the page's LATER groups (marked: ${top.lifted.join(' · ') || 'none'}); a group that is not shown and a box the page pins itself are left alone (the pill: ${top.pin.position}, top ${top.pin.top}${top.pin.marked ? ', MARKED' : ''})`);
    const fwd = []; for (let y = 0; y < top.max; y += 16) fwd.push(await at(y)); fwd.push(await at(top.max));
    const back = [await at(top.max)]; for (let y = top.max - (top.max % 16); y >= 0; y -= 16) back.push(await at(y));
    const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1);
    const out = Math.round(H * 0.55);
    say(hold.length > 3 && hold.every((f) => Math.abs(f.cover.t - today.cover.t) < 0.6) && hold.every((f) => Math.abs(f.pout - f.s / out) < 0.02) && fwd.some((f) => f.pout >= 1 && f.cover.o === 0), `${size}: the page stands still while the cover builds out over 55 % of a screen, and it completes (${hold.length} positions; moved at most ${r(Math.max(0, ...hold.map((f) => Math.abs(f.cover.t - today.cover.t))))}px)`);
    const seen = fwd.filter((f) => f.zero && f.zero.o > 0.02 && f.pout < 1);
    say(seen.length > 0 && fwd.every((f) => !(f.zero.o > 0.02 && f.pout < 0.79)) && seen.every((f) => Math.abs((f.zero.t + f.zero.b) / 2 - H / 2) < 1.5 && f.zero.t >= today.cover.t - 0.5), `${size}: the reply card arrives at the centred line, at the last 20 %, never above the cover (middle ${seen[0] ? r((seen[0].zero.t + seen[0].zero.b) / 2) : '—'} against ${H / 2}; first seen with the cover ${seen[0] ? Math.round(seen[0].pout * 100) : '—'} % out)`);
    /* 🧱 THE PROPERTY THIS SHAPE EXISTS FOR: the NEXT GROUP never lies over the cover while the cover can be seen. */
    const over = fwd.filter((f) => f.cover.o > 0.02 && f.pout < 1 && f.greeting && (f.greeting.t < f.cover.b - 1 || f.greeting.t < f.zero.b - 1));
    const lowest = Math.min(...fwd.filter((f) => f.cover.o > 0.02 && f.pout < 1).map((f) => f.greeting.t - f.cover.b));
    say(over.length === 0 && fwd.filter((f) => f.cover.o > 0.02 && f.pout < 1).length > 3, `${size}: the next group — outside the cover's own rest — never lies over the cover while it can be seen (nearest: ${r(lowest)}px below the cover's bottom${over.length ? `; OVER IT at ${over[0].s}: the group's top ${r(over[0].greeting.t)}, the cover ends ${r(over[0].cover.b)}` : ''})`);
    /* …and once the cover has gone it has risen to stand right under what arrived. */
    const done = fwd.find((f) => f.pout >= 1 && f.zero.o >= 0.99 && f.s >= Math.round(H * 0.66) + 16 && f.cdOut === 0);
    /* (Today's own distance between the two: the pill the page pins itself is in the flow between them.) */
    const apart = today.greeting.t - today.reply.b;
    say(Boolean(done) && Math.abs(done.greeting.t - done.zero.b - apart) < 0.1, `${size}: once the cover has gone the next group stands under what arrived, as far from it as on today's page (${done ? r(done.greeting.t - done.zero.b) : '—'}px; today ${r(apart)}px)`);
    const sig = (f) => JSON.stringify([f.all, f.pout.toFixed(3)]);
    say(fwd.every((f) => { const k = back.find((x) => x.s === f.s); return k && sig(k) === sig(f); }), `${size}: back == down at every one of ${fwd.length} positions`);
    say(fwd.some((f) => f.cdOut >= 1) && fwd.at(-1).all.at(-1)[2] === '1.00', `${size}: the scenes in a later group still hand over, to the end of the page`);
    if (pics) { for (const [name, pick] of [['0-opens', () => 0], ['1-half-out', () => fwd.find((f) => f.pout >= 0.5)?.s], ['2-reply-arrives', () => fwd.find((f) => f.pout >= 0.9)?.s], ['3-arrived', () => done?.s]]) { const y = pick(); if (y !== undefined) { await at(y); await p.screenshot({ path: `${pics}/c15-groups-${W}x${H}-${name}.png` }); } } }
    await ctx.close();
    /* With no script: the plain page — every block exactly where today's page has it. */
    const n = await open('scrub-cover-groups-noscript.html', W, H); const plain = await n.at(0); await n.ctx.close();
    say(!plain.sticky && !plain.on && plain.lifted.length === 0 && JSON.stringify(plain.all) === JSON.stringify(today.all) && plain.all.every((x) => x[2] === '1.00'), `${size}: with no script the page is the plain page — every block where today's page has it (${plain.all.map((x) => `${x[0]} ${x[1]}`).join(' · ')})`);
  }
  /* A PAGE A TAB — opened on ANOTHER tab: the cover's group has no box, nothing of it is held. Shown (the hub shell
     flips `hidden` on the groups — no reload), its hand-over is measured and plays; hidden again, every mark is off.
     The scenes are on BOTH tabs here, so the cover is the only watched box whose size changes with the tab. */
  {
    const [W, H] = [375, 812]; const { ctx, p, errs, at } = await open('scrub-cover-groups-tab.html', W, H);
    const show = async (lead) => { await p.evaluate((on) => { for (const g of document.querySelectorAll('[data-grp]')) { const n = g.getAttribute('data-grp'); if (n !== 'foot' && n !== 'scenes') g.hidden = n === 'other' ? on : !on; } scrollTo(0, 0); }, lead); await p.waitForTimeout(400); };
    const held = (f) => f.holds.filter((h) => h > 0).length;
    const away = await at(0);
    say(errs.length === 0 && away.on && away.off === null && away.cover === null && away.other?.o === 1 && held(away) === 3 && away.holds[3] === 0 && away.lifted.length === 0, `${W}x${H} a page a tab, opened on another tab: armed; the scenes' three hand-overs hold, and nothing is held or marked for a cover that is not shown (page pairs ${away.holds.map(r).join(' · ')}${away.off ? `; off: ${away.off}` : ''}${errs.length ? `; ${errs[0]}` : ''})`);
    await show(true);
    const first = await at(0); const half = await at(Math.round(H * 0.55 * 0.5));
    say(first.cover?.o === 1 && first.pout === 0 && held(first) === 4 && JSON.stringify(first.lifted) === JSON.stringify(['greeting', 'scenes', 'foot']) && half.pout > 0.45 && half.pout < 0.55 && Math.abs(half.cover.t - first.cover.t) < 0.6, `${W}x${H} …the first tab shown: the cover's hand-over is measured with no reload — whole at the top, then held and half out half-way (out ${first.pout} → ${half.pout}; the cover ${r(first.cover?.t)} → ${r(half.cover?.t)}; page pairs ${first.holds.map(r).join(' · ')})`);
    await show(false);
    const gone = await at(0);
    say(gone.cover === null && gone.other?.o === 1 && held(gone) === 3 && gone.lifted.length === 0 && gone.hiddenMarked === 0 && Math.abs(gone.foot.t - away.foot.t) < 0.6, `${W}x${H} …and the other tab again: nothing held for the cover, every mark of it off, the page as it opened (page pairs ${gone.holds.map(r).join(' · ')}; marked ${gone.lifted.length}; the foot ${r(gone.foot.t)} against ${r(away.foot.t)})`);
    await ctx.close();
  }
}
/* 16. 🧾 THE REAL GUEST PAGE — the fixture invitation, drawn by the real `SiteBody` (`scripts/scrub-fixture-page.tsx`):
   the cover as hand-over zero on the page's OWN markup — its groups (a page a tab), its chapters, its `space-y-12`,
   its pinned top bar. `today`: the same stored page while "Scrub out" is not offered — what a guest has now.
   ⚠ The document shell is the check's (no fonts, no layout chrome, no hydration): what is measured is the body. */
if (!ONLY || ONLY === '16') {
  /* Every box of the page, in page order — less the boxes a hand-over adds (`skip`), so the two pages line up. */
  const BOXES = () => {
    const ours = /^(?:hub-page-cell|hub-page-stage|hub-cover-cell|hub-cover|hub-cover-after)$/;
    return [...document.querySelectorAll('main, main *')].filter((e) => !(e instanceof SVGElement && e.tagName !== 'svg') && e.tagName !== 'SCRIPT' && !e.closest('[data-check-only]') && !ours.test(e.getAttribute('class') ?? '') && !/^hub-cover-after /.test(e.getAttribute('class') ?? '')).map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName.toLowerCase()} ${Math.round(r.left * 100) / 100} ${Math.round((r.top + scrollY) * 100) / 100} ${Math.round(r.width * 100) / 100} ${Math.round(r.height * 100) / 100}`; });
  };
  /* THE SCROLL REVEAL'S IDEA OF A CHAPTER — the observer's own selector (`pahina-motion.tsx`), read with the reveal's
     flag on and NOTHING revealed yet: which boxes it would watch, and which of them the stylesheet hides until then. */
  const CHAPTERS = () => {
    document.documentElement.classList.add('pahina-js');
    const name = (e) => (e.matches('.hub-cover-cell') ? 'the cover’s cell' : e.matches('header') ? 'the cover' : e.hasAttribute('data-arrival-action') ? 'the reply row' : e.id ? `#${e.id}` : e.hasAttribute('data-hub-tab') ? `group ${e.getAttribute('data-hub-tab')}` : `${e.tagName.toLowerCase()}${e.className ? `.${String(e.className).split(' ')[0]}` : ''}`);
    const lead = document.querySelector('[data-hub-tab]');
    const all = [...document.querySelectorAll('.sn-editorial [data-pahina-chapters] > *')];
    const row = (e) => `${name(e)}${e.hasAttribute('data-pahina-first-screen') ? ' (first screen)' : ''}: ${Number(getComputedStyle(e).opacity) === 0 ? 'HIDDEN until revealed' : 'shown'}`;
    const out = { total: all.length, inLead: all.filter((e) => lead.contains(e) && e !== lead).map(row), hiddenFirstScreen: [...document.querySelectorAll('header[data-pahina-first-screen], [data-arrival-action]')].filter((e) => { for (let n = e; n && n.tagName !== 'MAIN'; n = n.parentElement) if (Number(getComputedStyle(n).opacity) === 0) return true; return false; }).length, watched: all.filter((e) => e.matches('header[data-pahina-first-screen], [data-arrival-action]')).length };
    document.documentElement.classList.remove('pahina-js');
    return out;
  };
  const GAPS = () => {
    const cover = document.querySelector('main header[data-pahina-first-screen]'); const row = document.querySelector('[data-arrival-action]'); const groups = [...document.querySelectorAll('article > [data-hub-tab]')].filter((g) => g.getClientRects().length);
    const c = cover.getBoundingClientRect(); const a = row.getBoundingClientRect(); const g = groups[1].getBoundingClientRect();
    /* 🤝 The block after the reply row (the Countdown's card, in the next group) and the group after THAT. */
    const m = groups[1].querySelector('section').getBoundingClientRect(); const n = groups[2].getBoundingClientRect();
    return { coverToRow: a.top - c.bottom, rowToNext: g.top - a.bottom, coverH: c.height, rowH: a.height, rowToMate: m.top - a.bottom, mateToAfter: n.top - m.bottom, mateH: m.height };
  };
  const SNAP16 = () => {
    const box = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { t: r.top, b: r.bottom, o: cs.visibility === 'hidden' ? 0 : Number(cs.opacity) }; };
    const cover = document.querySelector('.hub-cover') ?? document.querySelector('main header[data-pahina-first-screen]');
    const groups = [...document.querySelectorAll('article > [data-hub-tab]')];
    const shown = groups.filter((g) => g.getClientRects().length);
    const bar = document.querySelector('[data-sticky-top]');
    const sched = document.querySelector('.hub-scene[data-hub-fx]');
    return {
      s: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight,
      cover: box(cover), names: box(document.querySelector('main header[data-pahina-first-screen] h1')), pout: Number(cover?.style.getPropertyValue('--hub-pout') || 0),
      /* 📐 (2026-10-12) the date, the stranger's door row (the button and the line under it) and whether it STAYS, what the fit wrote. */
      date: box(document.querySelector('main header[data-pahina-first-screen] [data-motion="arrive-date"]')),
      doorRow: (() => { const d = document.querySelector('main [data-get-inside]'); if (!d) return null; const row = [...d.parentElement.children].filter((e) => e.getClientRects().length); return { t: row[0].getBoundingClientRect().top, b: row.at(-1).getBoundingClientRect().bottom, o: Math.min(...row.map((e) => { let o = 1; for (let x = e; x && x.tagName !== 'HTML'; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.visibility === 'hidden') return 0; o *= Number(cs.opacity); } return o; })) }; })(),
      stays: document.querySelectorAll('[data-hub-stay]').length, zeroSays: document.querySelector('[data-hub-zero]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 22) ?? null,
      fitted: [...document.querySelectorAll('[data-first-screen-fit]')].some((e) => e.style.getPropertyValue('--fs-air') !== '') || document.querySelectorAll('[data-fs-shift]').length > 0,
      /* (What arrives first can be several boxes — a row that draws no box of its own: read from the first's top to
         the last-but-one's bottom; the block that arrives WITH the row is the LAST marked one.) */
      zero: (() => { const zs = [...document.querySelectorAll('[data-hub-zero]')].filter((e) => e.getClientRects().length); const z = box(zs[0] ?? null); if (z && zs.length > 2) z.b = zs[zs.length - 2].getBoundingClientRect().bottom; return z; })(), zeroVar: Number(document.querySelector('[data-hub-zero]')?.style.getPropertyValue('--hub-o') || 1), zeroIs: document.querySelector('[data-hub-zero]')?.hasAttribute('data-arrival-action') ? 'the reply row' : document.querySelector('[data-hub-zero]')?.matches('[data-get-inside]') || document.querySelector('[data-hub-zero]')?.querySelector('[data-get-inside]') ? 'the door' : (document.querySelector('[data-hub-zero]')?.tagName ?? null),
      row: box(document.querySelector('[data-arrival-action]')), next: box(shown[1] ?? null), nextIs: shown[1]?.getAttribute('data-hub-tab') ?? null,
      /* 🤝 What arrives WITH the row (the second marked block), and the first group after what arrives. */
      zeros: document.querySelectorAll('[data-hub-zero]').length, mate: box(document.querySelectorAll('[data-hub-zero]').length > 1 ? [...document.querySelectorAll('[data-hub-zero]')].at(-1) : null) ?? { t: NaN, b: NaN, o: -1 }, mateSays: [...document.querySelectorAll('[data-hub-zero]')].slice(1).at(-1)?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 22) ?? null,
      after: box([...document.querySelectorAll('[data-hub-zlift]')].find((e) => e.getClientRects().length) ?? null), zrest: [...document.querySelectorAll('[data-hub-zrest]')].map((e) => e.getAttribute('data-hub-tab') ?? e.tagName.toLowerCase()),
      lifted: [...document.querySelectorAll('[data-hub-zlift]')].map((e) => e.getAttribute('data-hub-tab') ?? e.tagName.toLowerCase()),
      hiddenMarked: [...document.querySelectorAll('[hidden]')].filter((e) => [...e.attributes].some((a) => /^data-hub-z/.test(a.name))).length,
      bar: { t: bar.getBoundingClientRect().top, b: bar.getBoundingClientRect().bottom, marked: bar.hasAttribute('data-hub-zlift') },
      schedOut: Number(sched?.style.getPropertyValue('--hub-pout') || 0), sched: box(sched),
      all: [...document.querySelectorAll('main header[data-pahina-first-screen], [data-arrival-action], article > [data-hub-tab]')].filter((e) => e.getClientRects().length).map((e) => { const x = e.closest('.hub-cover') ?? e; const r = e.getBoundingClientRect(); const cs = getComputedStyle(x); return [Math.round(r.top), (cs.visibility === 'hidden' ? 0 : Number(cs.opacity)).toFixed(2)]; }),
      holds: [...document.querySelectorAll('.hub-page-cell')].map((c) => parseFloat(getComputedStyle(c, '::after').height) || 0),
      cells: document.querySelectorAll('.hub-cover-cell').length, scenesBlocks: document.querySelectorAll('.hub-scenes').length,
      on: document.querySelector('.hub-page-cell')?.hasAttribute('data-hub-page-on') ?? false,
      off: document.querySelector('.hub-page-cell')?.getAttribute('data-hub-scrub-off') ?? document.querySelector('.hub-scenes')?.getAttribute('data-hub-scrub-off') ?? null,
      sticky: [...document.querySelectorAll('.hub-page-stage, .hub-stage')].some((e) => getComputedStyle(e).position === 'sticky'),
    };
  };
  const open = async (file, W, H, opts = {}) => { const ctx = await b.newContext({ viewport: { width: W, height: H }, ...opts }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140))); await p.goto(`file://${scratch}/${file}`); await p.waitForTimeout(opts.javaScriptEnabled === false ? 200 : 900); const at = async (y) => { await p.evaluate((yy) => scrollTo(0, yy), y); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return p.evaluate(SNAP16); }; return { ctx, p, errs, at }; };
  const r = (n) => (n === null || n === undefined ? '—' : Math.round(n * 10) / 10);
  for (const [W, H] of [[375, 812], [375, 667], [441, 882], [1280, 770]]) {
    const size = `${W}x${H} the real guest page`;
    /* (b) THE PLAIN PAGE IS TODAY'S PAGE — with no script at all (not the page's own either: nothing revealed, nothing
       moved), every box of today's page stands exactly where it stood. Then the two distances, in pixels. */
    const t0 = await open('fixture-today.html', W, H, { javaScriptEnabled: false }); const todayBoxes = await t0.p.evaluate(BOXES); const todayGaps = await t0.p.evaluate(GAPS); const todayCh = await t0.p.evaluate(CHAPTERS); await t0.ctx.close();
    const p0 = await open('fixture-cover-plain.html', W, H, { javaScriptEnabled: false }); const plainBoxes = await p0.p.evaluate(BOXES); const plainGaps = await p0.p.evaluate(GAPS); const plainCh = await p0.p.evaluate(CHAPTERS); const plainCells = await p0.p.evaluate(() => document.querySelectorAll('.hub-cover-cell').length); await p0.ctx.close();
    const moved = todayBoxes.findIndex((x, i) => x !== plainBoxes[i]);
    say(plainCells === 1 && todayBoxes.length > 150 && todayBoxes.length === plainBoxes.length && moved < 0, `${size}: with its cover wrapped to hand over and no script, every one of today's ${todayBoxes.length} boxes stands exactly where it stood${moved >= 0 ? ` — the first that moved: "${todayBoxes[moved]}" → "${plainBoxes[moved]}"` : ''}`);
    say(Math.abs(plainGaps.coverToRow - todayGaps.coverToRow) < 0.01 && Math.abs(plainGaps.rowToNext - todayGaps.rowToNext) < 0.01 && todayGaps.coverToRow > 40, `${size}: the page's rhythm is kept — the cover to the reply row ${r(todayGaps.coverToRow)}px → ${r(plainGaps.coverToRow)}px, the reply row to the next group ${r(todayGaps.rowToNext)}px → ${r(plainGaps.rowToNext)}px (the cover ${r(todayGaps.coverH)}px tall, the row ${r(todayGaps.rowH)}px)`);
    /* (a) THE CHAPTERS: what the scroll reveal watches, and hides until revealed, in the page's first group. */
    say(plainCh.hiddenFirstScreen === 0 && todayCh.hiddenFirstScreen === 0 && plainCh.watched === todayCh.watched && todayCh.watched === 2 && plainCh.total === todayCh.total + 1 && plainCh.inLead.filter((x) => !x.startsWith('the cover’s cell')).join(' | ') === todayCh.inLead.join(' | ') && plainCh.inLead.some((x) => x === 'the cover’s cell (first screen): shown'), `${size}: the scroll reveal still sees the same chapters — today [${todayCh.inLead.join(' | ')}]; wrapped [${plainCh.inLead.join(' | ')}] — ${todayCh.total} → ${plainCh.total} on the page (the one more is the cover's cell, never hidden), and nothing of the first screen is hidden before a reveal (${plainCh.hiddenFirstScreen})`);

    /* ARMED BY THE PAGE'S OWN ISLAND. `today` with the page's own scripts running, for where the cover stands. */
    const t1 = await open('fixture-today.html', W, H); const today = await t1.at(0); await t1.ctx.close();
    const { ctx, p, errs, at } = await open('fixture-cover.html', W, H);
    const top = await at(0);
    /* (d) ONE PAIR — the cover's — and no pair too many: the hero row is counted once, by the page's own count. */
    say(errs.length === 0 && top.on && top.off === null && top.sticky && top.cells === 1 && top.scenesBlocks === 0 && top.holds.length === 1 && top.holds[0] > 0, `${size}: armed by the page's own island, no page error; the page wraps ONE pair — the cover's — and it holds (${top.holds.map(r).join(' · ')}px; ${top.scenesBlocks} scenes blocks: the cover is this page's only Scrub${errs.length ? ` — ${errs[0]}` : ''}${top.off ? ` — off: ${top.off}` : ''})`);
    /* 🤝 TOGETHER (owner 2026-10-10): what arrives is the reply row AND the block after it — the Countdown — as one. */
    /* (RE-AIMED 2026-10-12, owner "option 2": the cover is FITTED before it is held — on a screen it does not fit, its
       air closes up and it is smaller than today's, never larger, never lower; where it fits as designed it is today's
       to the pixel. 16b holds the names and the date on that first screen.) */
    const same = Math.abs(top.cover.t - today.cover.t) < 0.01 && Math.abs(top.cover.b - today.cover.b) < 0.01 && Math.abs(top.names.t - today.names.t) < 0.01;
    const smaller = top.cover.t <= today.cover.t + 0.01 && top.cover.b < today.cover.b && top.cover.t >= 0;
    say((top.fitted ? smaller : same) && top.cover.o === 1 && top.pout === 0 && top.zeroIs === 'the reply row' && top.zeros === 2 && /Until we say/.test(top.mateSays ?? '') && top.zero.o === 0 && top.mate.o === 0, `${size}: at scroll 0 the cover is ${top.fitted ? 'today’s FITTED to the first screen (smaller, never lower)' : 'exactly where today’s page has it'}, whole, 0 % built out; what arrives is ${top.zeroIs} TOGETHER with the block after it ("${top.mateSays}…"), neither there yet (${r(top.cover.t)}–${r(top.cover.b)} against ${r(today.cover.t)}–${r(today.cover.b)})`);
    say(top.lifted.length >= 2 && top.lifted.every((x) => x === 'home') && top.hiddenMarked === 0 && !top.bar.marked && top.zrest.length === 0, `${size}: what follows the two is found in the page's later groups (${top.lifted.length} marked, all on this tab); a group on another tab and the pinned top bar are left alone`);
    const fwd = []; for (let y = 0; y < top.max; y += 16) fwd.push(await at(y)); fwd.push(await at(top.max));
    const back = [await at(top.max)]; for (let y = top.max - (top.max % 16); y >= 0; y -= 16) back.push(await at(y));
    const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1);
    const out = Math.round(H * 0.55);
    /* The owner's rule: held WHERE IT STANDS if all of it can be seen from there — else scrolled through first.
       (RE-AIMED 2026-10-12, "option 2": fitted first, what must be seen from there is its names and its date.) */
    const stands = top.cover.t >= 0 && Math.max(top.names.b, top.date?.b ?? top.cover.b) - top.cover.t <= H - 24 - top.cover.t;
    const heldAt = hold[0]?.cover.t;
    /* …and one that cannot is the ordinary hand-over (`hub-scrub-math.ts`): centred if it fits the room under the
       page's top line (the line is read from the page, as the engine reads it), else its bottom on the centre line. */
    const topLine = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.hub-cover-cell')).scrollPaddingTop));
    const coverH = today.cover.b - today.cover.t; const fits = coverH <= H - topLine - 24;
    const place = stands ? Math.abs(heldAt - top.cover.t) < 0.6 && hold.every((f) => Math.abs(f.pout - f.s / out) < 0.02) : fits ? Math.abs((hold[0].cover.t + hold[0].cover.b) / 2 - H / 2) < 1.5 : Math.abs(hold[0].cover.b - H / 2) < 1.5;
    say(hold.length > 3 && hold.every((f) => Math.abs(f.cover.t - heldAt) < 0.6) && place && fwd.some((f) => f.pout >= 1 && f.cover.o === 0), `${size}: the page stands still while the cover builds out, and it completes — ${stands ? `held where it stands (${r(heldAt)}px), over 55 % of a screen from the first thumb travel` : `it cannot be seen whole from where it stands (${r(today.cover.t)}–${r(today.cover.b)} on ${H}px), so it is scrolled to its line first: ${fits ? `centred (${r(hold[0]?.cover.t)}–${r(hold[0]?.cover.b)})` : `its bottom on the centre line (${r(hold[0]?.cover.b)})`}`} (${hold.length} positions)`);
    say(hold.every((f) => Math.abs(f.bar.t) < 0.01), `${size}: the pinned top bar never moves`);
    /* 🔝 THE NAMES ARE NEVER UNDER THE PINNED BAR (owner 2026-10-09, an open point: "the heading clipped at the top on
       iPhone"). While the page is held for the cover and the cover can still be seen, the couple's names — the cover's
       own heading — stand wholly below the bar. A cover too tall for the room is held by the ordinary rule (its bottom
       on the centre line), which can put its top under the bar: this row says whether it does, in pixels. */
    const clipped = hold.filter((f) => f.cover.o > 0.02 && f.names && f.names.t < f.bar.b - 0.5);
    say(clipped.length === 0 && hold.length > 0 && hold.every((f) => f.names), `${size}: while the cover is held its names are never under the pinned top bar${clipped.length ? ` — UNDER IT at ${clipped.length} of ${hold.length} held positions: the names' top ${r(clipped[0].names.t)}px, the bar ends ${r(clipped[0].bar.b)}px (the cover ${r(coverH)}px tall on a ${H}px screen)` : ` (nearest ${r(Math.min(...hold.map((f) => f.names.t - f.bar.b)))}px below it)`}`);
    /* ⏸ NO "STUCK" STRETCH (owner 2026-10-09, an open point: a still stretch that read as stuck). While the page is
       held for the cover, SOMETHING a guest can see changes at every sampled position: the cover's fade, or the
       arrival's. The longest run of positions at which nothing changed is reported in pixels of thumb travel. */
    const drawn = (f) => JSON.stringify([f.cover.o.toFixed(3), f.zero.o.toFixed(3), f.mate.o.toFixed(3), Math.round(f.cover.t), Math.round(f.after?.t ?? 0)]);
    let still = 0; let run = 0;
    for (let i = 1; i < fwd.length; i++) { const held = fwd[i].pout < 1 || fwd[i].zero.o < 0.99; if (held && fwd[i].pout > 0 && drawn(fwd[i]) === drawn(fwd[i - 1])) { run += fwd[i].s - fwd[i - 1].s; still = Math.max(still, run); } else run = 0; }
    say(still <= 16, `${size}: no still stretch while the page is held for the cover — the longest run with nothing changing is ${still}px of thumb travel (the hold is ${r(top.holds[0])}px long)`);
    const seen = fwd.filter((f) => f.zero && (f.zero.o > 0.02 || f.mate.o > 0.02) && f.pout < 1);
    /* ONE arrival: the two at the same number at every position, neither before the last 20 % — and placed as ONE
       unit (the row's top to the Countdown's bottom): centred when the cover is held where it stands. */
    const asOne = fwd.every((f) => Math.abs(f.zero.o - f.mate.o) < 0.011);
    say(seen.length > 0 && asOne && fwd.every((f) => !((f.zero.o > 0.02 || f.mate.o > 0.02) && f.pout < 0.79)) && seen.every((f) => Math.abs((f.zero.t + f.mate.b) / 2 - H / 2) < 1.5 || !stands), `${size}: the reply row and the Countdown arrive TOGETHER at the last 20 % of the Build out — one fade, one unit${stands ? `, centred as one (its middle ${seen[0] ? r((seen[0].zero.t + seen[0].mate.b) / 2) : '—'} against ${H / 2})` : ` (${seen[0] ? `${r(seen[0].zero.t)}–${r(seen[0].mate.b)}` : '—'}; the centre line ${H / 2})`}; first seen with the cover ${seen[0] ? Math.round(seen[0].pout * 100) : '—'} % out`);
    /* ONE FADE, on a chapter too: the scroll reveal has marked the reply row "shown" (opacity 1, by its own rule) —
       the row is still drawn at the hand-over's number while it arrives. */
    const fading = fwd.filter((f) => f.zero && f.pout < 1 && f.zeroVar > 0.02 && f.zeroVar < 0.98);
    const revealed = await p.evaluate(() => document.querySelector('[data-hub-zero]')?.classList.contains('pahina-in') ?? false);
    say(fading.length > 2 && revealed && fading.every((f) => Math.abs(f.zero.o - f.zeroVar) < 0.011 && Math.abs(f.mate.o - f.zeroVar) < 0.011), `${size}: the reply row FADES in under the thumb — drawn at the hand-over's own number although the scroll reveal has marked it shown (${fading.length} positions, e.g. drawn ${fading[0] ? fading[0].zero.o.toFixed(2) : '—'} for ${fading[0] ? fading[0].zeroVar.toFixed(2) : '—'}; marked by the reveal: ${revealed})`);
    const visible = fwd.filter((f) => f.cover.o > 0.02 && f.pout < 1 && f.pout > 0);
    const over = visible.filter((f) => f.after.t < f.cover.b - 1 || f.after.t < f.mate.b - 1);
    say(visible.length > 3 && over.length === 0, `${size}: the group after the two never lies over the cover, or over them, while the cover can be seen (nearest ${r(Math.min(...visible.map((f) => f.after.t - Math.max(f.cover.b, f.mate.b))))}px below the lower of the two${over.length ? `; OVER at ${over[0].s}: its top ${r(over[0].after.t)}, the cover ends ${r(over[0].cover.b)}, the Countdown ${r(over[0].mate.b)}` : ''})`);
    /* 🤝 THE ARRIVAL COMPLETE (the cover gone, the two fully in): both whole on the screen — under the pinned top bar,
       above whatever the page pins at its foot — and as far apart as the page lays them out. */
    const whole = fwd.find((f) => f.pout >= 1 && f.zero.o >= 0.99 && f.mate.o >= 0.99);
    const foot = await p.evaluate(() => Math.min(innerHeight, ...[...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none') return false; const q = e.getBoundingClientRect(); return q.width > innerWidth * 0.8 && q.height > 20 && q.height < 200 && q.bottom >= innerHeight - 1; }).map((e) => e.getBoundingClientRect().top)));
    const barEnd = await p.evaluate(() => document.querySelector('[data-sticky-top]').getBoundingClientRect().bottom);
    say(Boolean(whole) && whole.zero.t >= barEnd - 0.5 && whole.mate.b <= foot + 0.5 && Math.abs(whole.mate.t - whole.zero.b - todayGaps.rowToMate) < 0.1 && todayGaps.rowToMate > 40, `${size}: when the arrival completes the RSVP button and the Countdown are both whole on the screen (${whole ? `${r(whole.zero.t)}–${r(whole.mate.b)}` : '—'}; the top bar ends ${r(barEnd)}, the page's foot begins ${r(foot)}), as far apart as the page lays them out (${whole ? r(whole.mate.t - whole.zero.b) : '—'}px; today ${r(todayGaps.rowToMate)}px)`);
    say(fwd.every((f) => !(f.zero.o > 0.02) || f.zero.t >= barEnd - 0.5 || f.s > hold.at(-1).s + Math.round(H * 0.11)), `${size}: nothing of the arrival is ever under the pinned top bar while the page is held`);
    const done = fwd.find((f) => f.pout >= 1 && f.zero.o >= 0.99 && hold.length && f.s >= hold.at(-1).s + Math.round(H * 0.11) + 32);
    say(Boolean(done) && Math.abs(done.after.t - done.mate.b - todayGaps.mateToAfter) < 0.1 && Math.abs(done.mate.t - done.zero.b - todayGaps.rowToMate) < 0.1, `${size}: once the cover has gone the next group stands under the Countdown at the page's own distance (${done ? r(done.after.t - done.mate.b) : '—'}px; today ${r(todayGaps.mateToAfter)}px)`);
    const sig = (f) => JSON.stringify([f.all, f.pout.toFixed(3)]);
    say(fwd.every((f) => { const k = back.find((x) => x.s === f.s); return k && sig(k) === sig(f); }), `${size}: back == down at every one of ${fwd.length} positions`);
    if (pics) { for (const [name, pick] of [['0-opens', () => 0], ['1-half-out', () => fwd.find((f) => f.pout >= 0.5)?.s], ['2-reply-arrives', () => fwd.find((f) => f.pout >= 0.9)?.s], ['3-arrived', () => whole?.s]]) { const y = pick(); if (y !== undefined) { await at(y); await p.screenshot({ path: `${pics}/c16-real-${W}x${H}-${name}-together.png` }); } } }
    await ctx.close();
    /* Reduce motion: the plain page — nothing armed, nothing held, and it says why. */
    const c2 = await open('fixture-cover.html', W, H, { reducedMotion: 'reduce' }); const calm = await c2.at(0); const calmLow = await c2.at(200); await c2.ctx.close();
    say(!calm.on && !calm.sticky && calm.off === 'reduce motion' && calm.cover.o === 1 && calm.row.o === 1 && Math.abs(calmLow.cover.t - (calm.cover.t - 200)) < 0.6 && calmLow.pout === 0, `${size}: with reduce motion the page is the plain page — nothing held, the cover scrolls away, and it says why ("${calm.off}")`);
  }
  /* 👆 A PHONE, BY TOUCH (375 × 812, a touch screen, a phone's viewport): a real finger drag moves the real page —
     nothing prevented, the script never setting the scroll position, nothing listening that COULD hold the finger
     back — and that travel IS the cover's Build out: the cover stays where it stood while it fades under the finger,
     built out exactly as far as the finger moved the page (55 % of a screen = all of it). The drag is slow and the
     finger rests before it lifts — no fling — and it is SHORTER than the hold, so the cover is caught part-way. What
     the check's own React root delegates (any React page has it: one listener per event on the root's container) is
     read apart, and every touch / wheel one of those must be passive: a passive listener cannot stop a scroll. */
  {
    const [W, H] = [375, 812]; const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(WATCH);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
    await p.goto(`file://${scratch}/fixture-cover.html`); await p.waitForTimeout(900);
    const before = await p.evaluate(SNAP16);
    const out = Math.round(H * 0.55);
    const stands = before.cover.t >= 0 && before.cover.b <= H - 24;
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: H - 160 }] });
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: H - 160 - k * 20 }] }); await p.waitForTimeout(30); }
    await p.waitForTimeout(400); /* the finger rests: nothing left to fling */
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(700);
    const after = await p.evaluate(SNAP16); const took = await p.evaluate(() => window.__took);
    /* (A finger's scroll can be held back only from `touchstart` / `touchmove` (or a wheel's): `touchend` comes after
       the scroll it ends — React delegates it not passive, and it can cancel a tap's click, never a scroll.) */
    const canHold = took.delegated.filter((x) => /^(touchstart|touchmove|wheel|mousewheel) /.test(x) && x.endsWith('(not passive)'));
    say(errs.length === 0 && before.on && before.pout === 0 && stands && after.s > 120 && after.s < out && took.scrollSet === 0 && took.prevented === 0, `${W}x${H} the real guest page, by touch: a real finger drag of 240px moved the page ${after.s}px — inside the cover's ${out}px hold — with nothing prevented (${took.prevented}) and the scroll never set by a script (${took.scrollSet})${errs.length ? ` — ${errs[0]}` : ''}`);
    say(took.listeners.length === 0 && canHold.length === 0, `${W}x${H} the real guest page, by touch: nothing on the page listens to touch, wheel or keys (${took.listeners.join(',') || 'none'}), and of React's own delegation on its root none that could hold a finger back (${canHold.join(',') || 'none'}; delegated: ${took.delegated.length})`);
    say(Math.abs(after.pout - after.s / out) < 0.02 && Math.abs(after.cover.o - (1 - after.s / out)) < 0.02 && after.pout > 0.2 && after.pout < 0.95 && Math.abs(after.cover.t - before.cover.t) < 0.6, `${W}x${H} the real guest page, by touch: that travel IS the Build out — ${Math.round(after.pout * 100)} % out, drawn at ${after.cover.o.toFixed(2)}, for ${after.s}px of ${out}px (${Math.round((after.s / out) * 100)} %), the cover where it stood (${Math.round(before.cover.t)} → ${Math.round(after.cover.t)})`);
    if (pics) await p.screenshot({ path: `${pics}/c16-real-${W}x${H}-touch-drag-together.png` });
    await ctx.close();
  }
  /* 🚪 A GUEST WHOSE REPLY ROW DRAWS NOTHING (no reply status: the page has no action for them). The cover's group ends
     with the cover — and the cover must never fade to nothing: the block after the cover's group arrives, alone. */
  for (const [W, H] of [[375, 812], [1280, 770]]) {
    const size = `${W}x${H} the real guest page, no reply row`;
    const t0 = await open('fixture-norow-today.html', W, H, { javaScriptEnabled: false }); const todayBoxes = await t0.p.evaluate(BOXES); await t0.ctx.close();
    const p0 = await open('fixture-cover-norow-plain.html', W, H, { javaScriptEnabled: false }); const plainBoxes = await p0.p.evaluate(BOXES); await p0.ctx.close();
    const moved = todayBoxes.findIndex((x, i) => x !== plainBoxes[i]);
    say(todayBoxes.length > 150 && todayBoxes.length === plainBoxes.length && moved < 0, `${size}: wrapped and with no script, every one of today's ${todayBoxes.length} boxes stands exactly where it stood${moved >= 0 ? ` — the first that moved: "${todayBoxes[moved]}" → "${plainBoxes[moved]}"` : ''}`);
    const { ctx, p, errs, at } = await open('fixture-cover-norow.html', W, H);
    const top = await at(0); const fwd = []; for (let y = 0; y < top.max; y += 16) fwd.push(await at(y)); fwd.push(await at(top.max));
    const back = [await at(top.max)]; for (let y = top.max - (top.max % 16); y >= 0; y -= 16) back.push(await at(y));
    const says = await p.evaluate(() => document.querySelector('[data-hub-zero]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 22) ?? null);
    const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1);
    const whole = fwd.find((f) => f.pout >= 1 && f.zero && f.zero.o >= 0.99);
    say(errs.length === 0 && top.on && top.off === null && top.row === null && top.zeros === 1 && /Until we say/.test(says ?? '') && top.zrest.length === 1 && top.zrest[0] === 'home' && top.cover.o === 1 && top.pout === 0 && top.zero.o === 0, `${size}: no reply row is drawn; what arrives is the block after the cover's group, alone ("${says}…"), in the group the engine pulls up to the cover (${top.zrest.join(',') || 'none'})${errs.length ? ` — ${errs[0]}` : ''}${top.off ? ` — off: ${top.off}` : ''}`);
    say(hold.length > 3 && fwd.every((f) => !(f.zero.o > 0.02 && f.pout < 0.79)) && Boolean(whole) && whole.s <= hold[0].s + Math.round(H * 0.66) + 16, `${size}: the cover never fades to nothing — the Countdown enters at the last 20 % and is whole by the end of the hold (whole at ${whole?.s}px; the cover gone by ${fwd.find((f) => f.pout >= 1)?.s}px)`);
    const sig = (f) => JSON.stringify([f.all, f.pout.toFixed(3)]);
    say(fwd.every((f) => { const k = back.find((x) => x.s === f.s); return k && sig(k) === sig(f); }), `${size}: back == down at every one of ${fwd.length} positions`);
    if (pics && whole) { await at(whole.s); await p.screenshot({ path: `${pics}/c16-real-${W}x${H}-norow-arrived.png` }); }
    await ctx.close();
  }
  /* (e) UNDER A CLOSED REVEAL NOTHING IS HELD — the real page's cover is never built out unseen; armed when it goes. */
  {
    const [W, H] = [375, 812]; const { ctx, p, errs, at } = await open('fixture-cover-reveal.html', W, H);
    const under = await at(0); const moved = await at(300); await at(0);
    say(errs.length === 0 && !under.on && !under.sticky && under.off === 'the opening is still up' && moved.pout === 0 && moved.cover.o === 1 && Math.abs(moved.cover.t - (under.cover.t - 300)) < 0.6, `${W}x${H} the real guest page under a closed Reveal: nothing is held, the page scrolls as a plain page, and it says why ("${under.off}"; 300px down the cover is at ${r(moved.cover.t)}, shown ${moved.cover.o})`);
    await p.evaluate(() => document.documentElement.removeAttribute('data-reveal-up')); await p.waitForTimeout(900);
    const open0 = await at(0); const some = await at(120);
    say(open0.on && open0.off === null && open0.pout === 0 && open0.cover.o === 1 && some.pout > 0, `${W}x${H} …and the moment the Reveal goes the cover's hand-over is armed (out ${open0.pout} → ${r(some.pout * 100)} % after 120px)`);
    await ctx.close();
  }
  /* (c) A PAGE A TAB — the cover's hand-over on the first tab only. The Schedule (Details) is stored to leave by
     Scrub too, so the page wraps two pairs. The tabs are switched as the hub shell switches them: `hidden` on the
     groups, the page back at its top — no reload. */
  {
    const [W, H] = [375, 812];
    const tab = (p, key) => p.evaluate((k) => { for (const g of document.querySelectorAll('[data-hub-tab]')) g.hidden = g.getAttribute('data-hub-tab') !== k; scrollTo(0, 0); }, key).then(() => p.waitForTimeout(500));
    const play = async (at, max) => { let best = { pout: 0, schedOut: 0 }; for (let y = 0; y <= max; y += 24) { const f = await at(y); if (f.pout > best.pout) best = { ...best, pout: f.pout }; if (f.schedOut > best.schedOut) best = { ...best, schedOut: f.schedOut }; } return best; };
    {
      const { ctx, p, errs, at } = await open('fixture-cover-scene.html', W, H);
      const welcome = await at(0);
      say(errs.length === 0 && welcome.on && welcome.off === null && welcome.holds.length === 2 && welcome.holds[0] > 0 && welcome.holds[1] === 0 && welcome.cover?.o === 1, `${W}x${H} a page a tab, on Welcome: two pairs wrapped (the cover's and the Schedule's), the cover's holds and the other — for a scene on a tab that is not shown — holds nothing (${welcome.holds.map(r).join(' · ')}px${welcome.off ? `; off: ${welcome.off}` : ''}${errs.length ? `; ${errs[0]}` : ''})`);
      await tab(p, 'details');
      const details = await at(0); const played = await play(at, details.max);
      say(details.cover === null && details.lifted.length === 0 && details.holds.filter((h) => h > 0).length === 1 && played.pout === 0 && played.schedOut >= 1, `${W}x${H} …on Details: nothing of the cover is held or marked, and the Schedule's own hand-over plays to the end (page pairs ${details.holds.map(r).join(' · ')}px; the Schedule out ${played.schedOut})`);
      await tab(p, 'home');
      const again = await at(0); const half = await at(Math.round(H * 0.55 * 0.5));
      say(again.cover?.o === 1 && again.pout === 0 && again.holds[0] > 0 && half.pout > 0.2 && again.lifted.length >= 2, `${W}x${H} …and Welcome again: the cover's hand-over is measured again with no reload (out ${again.pout} → ${r(half.pout * 100)} % half-way through its length)`);
      await ctx.close();
    }
    {
      const { ctx, p, errs, at } = await open('fixture-cover-scene-details.html', W, H);
      const details = await at(0);
      say(errs.length === 0 && details.on && details.off === null && details.cover === null && details.holds.filter((h) => h > 0).length === 1, `${W}x${H} the same page OPENED on Details: armed, the cover not shown and nothing held for it (${details.holds.map(r).join(' · ')}px${details.off ? `; off: ${details.off}` : ''}${errs.length ? `; ${errs[0]}` : ''})`);
      await tab(p, 'home');
      const welcome = await at(0); const half = await at(Math.round(H * 0.55 * 0.5));
      say(welcome.cover?.o === 1 && welcome.pout === 0 && welcome.holds[0] > 0 && half.pout > 0.2 && Math.abs(half.cover.t - welcome.cover.t) < 0.6 === (welcome.cover.b <= H - 24), `${W}x${H} …then Welcome is shown: the cover's hand-over is measured although the page was armed without it (out ${welcome.pout} → ${r(half.pout * 100)} %)`);
      await ctx.close();
    }
  }
  /* 🚶 THE STRANGER'S TREE (the link and no key — `fixtureStranger`), the same rule: the DOOR ("Get inside") is the
     page's action row there, and the block after it — the Countdown — arrives WITH it. Its two mastheads: the
     text-only cover (in its first-screen wrapper, the door after it in the same box) and the photo cover (the last
     thing in the page's first group: the door is in the NEXT group, which the engine pulls up to the cover). */
  const GAPS_S = () => {
    const R = (e) => e.getBoundingClientRect();
    const cover = document.querySelector('main header[data-pahina-first-screen]'); /* (The door's row draws no box of its own since 2026-10-11 — `.sn-door-row`, `display: contents` — so the door is read itself.) */
    const row = [...document.querySelector('main [data-get-inside]').parentElement.children].filter((e) => e.getClientRects().length);
    const door = { getBoundingClientRect: () => ({ top: row[0].getBoundingClientRect().top, bottom: row.at(-1).getBoundingClientRect().bottom, height: row.at(-1).getBoundingClientRect().bottom - row[0].getBoundingClientRect().top }) };
    const [m, n] = document.querySelector('article .sn-hub-cards').querySelectorAll(':scope > section');
    document.documentElement.classList.add('pahina-js');
    const hidden = [cover, ...row].filter((e) => { for (let x = e; x && x.tagName !== 'MAIN'; x = x.parentElement) if (Number(getComputedStyle(x).opacity) === 0) return true; return false; }).length;
    const chapters = document.querySelectorAll('.sn-editorial [data-pahina-chapters] > *').length;
    document.documentElement.classList.remove('pahina-js');
    return { coverToDoor: R(door).top - R(cover).bottom, doorToMate: R(m).top - R(door).bottom, mateToAfter: R(n).top - R(m).bottom, coverH: R(cover).height, doorH: R(door).height, hidden, chapters };
  };
  for (const [kind, sizes] of [['text', [[375, 812], [375, 667], [441, 882], [1280, 770]]], ['photo', [[375, 812], [1280, 770]]]]) {
    const file = (name) => `fixture-stranger-${kind === 'photo' ? 'photo-' : ''}${name}.html`;
    for (const [W, H] of sizes) {
      const size = `${W}x${H} the stranger's page, ${kind === 'photo' ? 'the photo cover' : 'the text-only cover'}`;
      const t0 = await open(file('today'), W, H, { javaScriptEnabled: false }); const todayBoxes = await t0.p.evaluate(BOXES); const tg = await t0.p.evaluate(GAPS_S); await t0.ctx.close();
      const p0 = await open(file('cover-plain'), W, H, { javaScriptEnabled: false }); const plainBoxes = await p0.p.evaluate(BOXES); const pg = await p0.p.evaluate(GAPS_S); await p0.ctx.close();
      const moved = todayBoxes.findIndex((x, i) => x !== plainBoxes[i]);
      say(todayBoxes.length > 100 && todayBoxes.length === plainBoxes.length && moved < 0 && Math.abs(pg.coverToDoor - tg.coverToDoor) < 0.01 && Math.abs(pg.doorToMate - tg.doorToMate) < 0.01, `${size}: wrapped and with no script, every one of today's ${todayBoxes.length} boxes stands exactly where it stood (the cover to the door ${r(tg.coverToDoor)}px → ${r(pg.coverToDoor)}px; the door to the Countdown ${r(tg.doorToMate)}px → ${r(pg.doorToMate)}px)${moved >= 0 ? ` — the first that moved: "${todayBoxes[moved]}" → "${plainBoxes[moved]}"` : ''}`);
      say(tg.hidden === 0 && pg.hidden === 0 && pg.chapters === tg.chapters + (kind === 'photo' ? 1 : 0), `${size}: nothing of the first screen is hidden before a reveal (${pg.hidden}), and the scroll reveal watches ${tg.chapters} → ${pg.chapters} chapters${kind === 'photo' ? ' (the one more is the cover’s cell, marked the first screen)' : ' (the cover’s cell is inside the wrapper that is the chapter)'}`);
      /* (RE-AIMED 2026-10-12: armed on THE REAL STRANGER'S PAGE — every stranger's page runs the door's own first-screen
         fit (`first-screen-door.tsx`), so the armed rows play the page with it, against today's page with it.) */
      const t1 = await open(file('today-fit'), W, H); const today = await t1.at(0); await t1.ctx.close();
      const { ctx, p, errs, at } = await open(file('cover-fit'), W, H);
      const top = await at(0);
      /* 🚪 "GET INSIDE" STAYS ON THE FIRST SCREEN (owner 2026-10-12: "Keep it on first screen"). A door the fitted first
         screen holds is not handed over: it stays, and the block after it — the Countdown — arrives alone. A door that
         is NOT on the first screen (the photo cover: the photo is taller than the screen and nothing fits it) still
         arrives with the Countdown, as before (owner 2026-10-10, "Together."). */
      const stays = top.stays > 0;
      say(errs.length === 0 && top.on && top.off === null && top.sticky && top.cells === 1 && top.holds.length === 1 && top.holds[0] > 0 && (stays ? top.zeros === 1 && top.zeroIs === 'SECTION' && /Until we say/.test(top.zeroSays ?? '') && top.stays === 2 && top.doorRow.o === 1 && top.zrest.length === 1 && top.zrest[0] === 'home' : top.zeroIs === 'the door' && top.zeros === (kind === 'photo' ? 2 : 3) && /Until we say/.test(top.mateSays ?? '') && top.mate.o === 0 && (kind === 'photo' ? top.zrest.length === 1 && top.zrest[0] === 'home' : top.zrest.length === 0)) && top.zero.o === 0 && (kind === 'text') === stays && Math.abs(top.cover.t - today.cover.t) < 0.01 && Math.abs(top.cover.b - today.cover.b) < 0.01 && top.cover.o === 1 && top.pout === 0, `${size}: armed, one page pair; the cover where today's page has it (${r(top.cover.t)}–${r(top.cover.b)}), whole; ${stays ? `"Get inside" STAYS (${r(top.doorRow.t)}–${r(top.doorRow.b)}, shown) and what arrives is the block after it, alone ("${top.zeroSays}…"), not there yet, in the box after the door pulled up to the cover (${top.zrest.join(',') || 'NONE'})` : `what arrives is ${top.zeroIs} TOGETHER with the block after it ("${top.mateSays}…"), neither there yet${kind === 'photo' ? ` — the door's group is the box pulled up to the cover (${top.zrest.join(',') || 'NONE'})` : ''}`}${errs.length ? ` — ${errs[0]}` : ''}${top.off ? ` — off: ${top.off}` : ''}`);
      if (stays) say(Math.abs(top.doorRow.t - today.doorRow.t) < 0.6 && Math.abs(top.doorRow.b - today.doorRow.b) < 0.6, `${size}: the door stays exactly where today's fitted first screen has it (${r(top.doorRow.t)}–${r(top.doorRow.b)} against ${r(today.doorRow.t)}–${r(today.doorRow.b)})`);
      const fwd = []; for (let y = 0; y < top.max; y += 16) fwd.push(await at(y)); fwd.push(await at(top.max));
      const back = [await at(top.max)]; for (let y = top.max - (top.max % 16); y >= 0; y -= 16) back.push(await at(y));
      const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1);
      say(hold.length > 3 && hold.every((f) => Math.abs(f.cover.t - hold[0].cover.t) < 0.6 && Math.abs(f.bar.t) < 0.01) && fwd.some((f) => f.pout >= 1 && f.cover.o === 0), `${size}: the page (and its pinned bar) stands still while the cover builds out, and it completes (${hold.length} positions, the cover at ${r(hold[0]?.cover.t)}px)`);
      /* 🔝 The names never under the pinned bar while the cover is held (as on the guest's page, above). */
      const clipped = hold.filter((f) => f.cover.o > 0.02 && f.names && f.names.t < f.bar.b - 0.5);
      say(clipped.length === 0 && hold.length > 0 && hold.every((f) => f.names), `${size}: while the cover is held its names are never under the pinned top bar${clipped.length ? ` — UNDER IT at ${clipped.length} of ${hold.length} held positions: the names' top ${r(clipped[0].names.t)}px, the bar ends ${r(clipped[0].bar.b)}px (the cover ${r(today.cover.b - today.cover.t)}px tall on a ${H}px screen)` : ` (nearest ${r(Math.min(...hold.map((f) => f.names.t - f.bar.b)))}px below it)`}`);
      const seen = fwd.filter((f) => (f.zero.o > 0.02 || (!stays && f.mate.o > 0.02)) && f.pout < 1);
      const foot = await p.evaluate(() => Math.min(innerHeight, ...[...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none') return false; const q = e.getBoundingClientRect(); return q.width > innerWidth * 0.8 && q.height > 20 && q.height < 200 && q.bottom >= innerHeight - 1; }).map((e) => e.getBoundingClientRect().top)));
      const barEnd = await p.evaluate(() => document.querySelector('[data-sticky-top]').getBoundingClientRect().bottom);
      const visible = fwd.filter((f) => f.cover.o > 0.02 && f.pout < 1 && f.pout > 0);
      const done = fwd.find((f) => f.pout >= 1 && f.zero.o >= 0.99 && hold.length && f.s >= hold.at(-1).s + Math.round(H * 0.11) + 32) ?? (fwd.at(-1).pout >= 1 && fwd.at(-1).zero.o >= 0.99 ? fwd.at(-1) : undefined);
      if (stays) {
        /* The door stays: shown, unmoved, at every position the cover is held; the Countdown arrives alone, at the last
           20 %, ending above the door; what follows never lies over the cover, the Countdown or the door, and once the
           cover has gone it stands under the DOOR at the page's own distance after the Countdown. */
        const movedDoor = hold.filter((f) => !f.doorRow || f.doorRow.o < 0.999 || Math.abs(f.doorRow.t - top.doorRow.t) > 0.6);
        say(hold.length > 3 && movedDoor.length === 0, `${size}: "Get inside" stays, shown and unmoved, at every one of ${hold.length} held positions${movedDoor.length ? ` — NOT at ${movedDoor[0].s}px` : ''}`);
        say(seen.length > 0 && fwd.every((f) => !(f.zero.o > 0.02 && f.pout < 0.79)) && seen.every((f) => f.zero.b <= f.doorRow.t + 0.5 && f.zero.t >= barEnd - 0.5), `${size}: the Countdown arrives alone, not before the last 20 %, under the bar and ending above the door (first seen with the cover ${seen[0] ? Math.round(seen[0].pout * 100) : '—'} % out; ${seen[0] ? `${r(seen[0].zero.t)}–${r(seen[0].zero.b)}` : '—'}, the door from ${r(top.doorRow.t)})`);
        const whole = fwd.find((f) => f.pout >= 1 && f.zero.o >= 0.99);
        say(Boolean(whole) && whole.zero.t >= barEnd - 0.5 && whole.zero.b <= Math.min(foot, whole.doorRow.t) + 0.5, `${size}: when it has arrived the Countdown is whole on the screen, between the top bar (${r(barEnd)}) and the door (${whole ? `${r(whole.zero.t)}–${r(whole.zero.b)}` : '—'})`);
        say(visible.length > 3 && visible.every((f) => f.after.t >= Math.max(f.cover.b, f.zero.b, f.doorRow.b) - 1) && Boolean(done) && Math.abs(done.after.t - done.doorRow.b - tg.mateToAfter) < 0.6, `${size}: what follows never lies over the cover, the Countdown or the door, and once the cover has gone stands under the door at the page's own distance (${done ? r(done.after.t - done.doorRow.b) : '—'}px; today after the Countdown ${r(tg.mateToAfter)}px)`);
      } else {
        say(seen.length > 0 && fwd.every((f) => Math.abs(f.zero.o - f.mate.o) < 0.011) && fwd.every((f) => !((f.zero.o > 0.02 || f.mate.o > 0.02) && f.pout < 0.79)), `${size}: the door and the Countdown arrive TOGETHER — one fade at every one of ${fwd.length} positions, not before the last 20 % (first seen with the cover ${seen[0] ? Math.round(seen[0].pout * 100) : '—'} % out; the unit ${seen[0] ? `${r(seen[0].zero.t)}–${r(seen[0].mate.b)}` : '—'}, the centre line ${H / 2})`);
        const whole = fwd.find((f) => f.pout >= 1 && f.zero.o >= 0.99 && f.mate.o >= 0.99);
        say(Boolean(whole) && whole.zero.t >= barEnd - 0.5 && whole.mate.b <= foot + 0.5 && Math.abs(whole.mate.t - whole.zero.b - tg.doorToMate) < 0.1 && tg.doorToMate > 40 && seen.every((f) => f.zero.t >= barEnd - 0.5), `${size}: when the arrival completes the door and the Countdown are both whole on the screen (${whole ? `${r(whole.zero.t)}–${r(whole.mate.b)}` : '—'}; the top bar ends ${r(barEnd)}, the page's foot begins ${r(foot)}), as far apart as the page lays them out (${whole ? r(whole.mate.t - whole.zero.b) : '—'}px; today ${r(tg.doorToMate)}px)`);
        say(visible.length > 3 && visible.every((f) => f.after.t >= Math.max(f.cover.b, f.mate.b) - 1) && Boolean(done) && Math.abs(done.after.t - done.mate.b - tg.mateToAfter) < 0.1, `${size}: what follows the two never lies over the cover or over them, and stands under the Countdown at the page's own distance once the cover has gone (${done ? r(done.after.t - done.mate.b) : '—'}px; today ${r(tg.mateToAfter)}px)`);
      }
      const sig = (f) => JSON.stringify([f.all, f.pout.toFixed(3)]);
      say(fwd.every((f) => { const k = back.find((x) => x.s === f.s); return k && sig(k) === sig(f); }), `${size}: back == down at every one of ${fwd.length} positions`);
      const whole = fwd.find((f) => f.pout >= 1 && f.zero.o >= 0.99);
      if (pics) { for (const [name, pick] of [['0-opens', () => 0], ['2-door-arrives', () => fwd.find((f) => f.pout >= 0.9)?.s], ['3-arrived', () => whole?.s]]) { const y = pick(); if (y !== undefined) { await at(y); await p.screenshot({ path: `${pics}/c16-stranger-${kind === 'photo' ? 'photo-' : ''}${W}x${H}-${name}-together.png` }); } } }
      await ctx.close();
    }
  }
  /* 🚪📏 THE FIRST-SCREEN FIT AND A WRAPPED COVER, TOGETHER — main's fit (`first-screen-door.tsx`, a client island the
     other pages here do not run): on a short screen TODAY's stranger cover closes up its air, shrinks its mark and draws
     whole parts below "Get inside", so the door is whole on the first screen. Wrapped, the door is not in the cover's
     flow — it is the arrival, drawn by the hand-over — so nothing the fit could give moves it: the fit must stand
     aside, write nothing, and leave every box where the wrapped page draws it without the fit — and STAY still (a fit
     that answered the hand-over's re-measure fed a loop: the page changed length every ~120 ms at 375 × 560). With
     reduce motion the wrapped page is the plain page, the door back in the cover's flow: there the fit makes room
     exactly as it does today, box for box. Played at a short phone and a very short one (375 × 560: the fit's every
     lever in use today). */
  const FIT = () => {
    const door = document.querySelector('main details[data-get-inside]'); const scr = door.closest('[data-pahina-first-screen]'); const d = door.getBoundingClientRect();
    return { armed: scr.hasAttribute('data-first-screen-fit'), written: [scr.style.getPropertyValue('--fs-air'), scr.style.getPropertyValue('--fs-mark')].filter(Boolean).length + document.querySelectorAll('[data-fs-shift]').length, doorT: d.top, doorB: d.bottom, rest: parseFloat(getComputedStyle(door).scrollMarginBottom) || 0, plan: `air ${scr.style.getPropertyValue('--fs-air') || '1'} · mark ${scr.style.getPropertyValue('--fs-mark') || '1'} · ${[...document.querySelectorAll('[data-fs-shift]')].map((e) => e.style.getPropertyValue('--fs-shift')).join(' ') || 'nothing moved'}` };
  };
  for (const [W, H] of [[375, 667], [375, 560]]) {
    const size = `${W}x${H} the stranger's page with the first-screen fit running`;
    const t = await open('fixture-stranger-today-fit.html', W, H); const tf = await t.p.evaluate(FIT);
    if (pics) await t.p.screenshot({ path: `${pics}/c16-stranger-fit-${W}x${H}-today.png` });
    await t.ctx.close();
    say(t.errs.length === 0 && tf.armed && tf.written > 0 && tf.doorT >= 0 && tf.doorB <= H - tf.rest + 0.5, `${size}: TODAY the fit makes room — it writes its plan (${tf.written} values) and "Get inside" is whole on the first screen (${r(tf.doorT)}–${r(tf.doorB)}; the bottom bar's edge ${r(H - tf.rest)})${t.errs.length ? ` — ${t.errs[0]}` : ''}`);
    /* (RE-AIMED 2026-10-12, owner "option 2": the cover is FITTED ONCE BEFORE IT FADES — the door's fit no longer
       stands aside by taking its plan back. Wrapped and armed, the first screen carries TODAY'S fitted plan, value for
       value (made before the hold armed and made again by the hold, by the same rule), and it is never fitted again
       while the cover is held: the same plan at every position. The stillness row below is the loop's own check.) */
    const c = await open('fixture-stranger-cover-fit.html', W, H);
    const cf = await c.p.evaluate(FIT);
    const top = await c.at(0); let differ = null; let n = 0; let held = null;
    for (let y = 0; y <= top.max; y += 32) { const f = await c.at(y); if (held === null && f.pout > 0.05) held = y; const g = await c.p.evaluate(FIT); n++; if (g.plan !== cf.plan) { differ = `${y}px: "${g.plan}"`; break; } }
    say(c.errs.length === 0 && cf.armed && top.on && cf.written > 0 && cf.plan === tf.plan && differ === null && n > 10, `${size}: WRAPPED the cover is fitted ONCE before it is held — today's plan to the value ("${cf.plan}"; today "${tf.plan}"), and the same at all ${n} positions${differ ? ` — re-fitted at ${differ}` : ''}${c.errs.length ? ` — ${c.errs[0]}` : ''}`);
    await c.at(0); const lengths = new Set(); for (let i = 0; i < 20; i++) { lengths.add(await c.p.evaluate(() => `${Math.round(document.querySelector('main').getBoundingClientRect().height)} ${document.querySelectorAll('[data-fs-shift]').length}`)); await c.p.waitForTimeout(50); }
    say(lengths.size === 1, `${size}: …and it stays still — one page length over a second at rest (${[...lengths].join(' · ')})`);
    const tz = await open('fixture-stranger-today-fit.html', W, H, { reducedMotion: 'reduce' }); const todayCalm = await tz.p.evaluate(BOXES); await tz.ctx.close();
    const cz = await open('fixture-stranger-cover-fit.html', W, H, { reducedMotion: 'reduce' }); const calm = await cz.p.evaluate(BOXES); const calmFit = await cz.p.evaluate(FIT); const calmOff = await cz.p.evaluate(() => document.querySelector('.hub-page-cell')?.getAttribute('data-hub-scrub-off') ?? null); await cz.ctx.close();
    const k = todayCalm.findIndex((v, i) => v !== calm[i]);
    say(calmOff === 'reduce motion' && calmFit.written > 0 && calmFit.doorB <= H - calmFit.rest + 0.5 && todayCalm.length === calm.length && k < 0, `${size}: with reduce motion the wrapped page is today's fitted page — the fit writes its plan (${calmFit.written} values), "Get inside" whole on the first screen (${r(calmFit.doorT)}–${r(calmFit.doorB)}), every one of ${calm.length} boxes where today's has it${k >= 0 ? ` — the first that differs: "${todayCalm[k]}" → "${calm[k]}"` : ''}`);
    if (pics) { await c.at(0); await c.p.screenshot({ path: `${pics}/c16-stranger-fit-${W}x${H}-wrapped-0-opens.png` }); if (held !== null) { await c.at(held); await c.p.screenshot({ path: `${pics}/c16-stranger-fit-${W}x${H}-wrapped-1-held.png` }); } }
    await c.ctx.close();
  }
}
/* 16b. 📐 FITTED BEFORE IT FADES (owner 2026-10-12, DECISION_LOG "option 2" — and the same day, "Get inside" stays on
   the stranger's first screen). On the real page (the fixture invitation, drawn by the real `SiteBody`), at the six
   window sizes a phone or a laptop gives it — the short phones first — and for the four covers (the guest's and the
   stranger's, text and photo): at scroll 0 the couple's names and the date are on the first screen, under the pinned
   bar and above the bottom bar's line; on the stranger's page "Get inside" is there too, whole and shown; while the
   cover is held its names are on the screen at every position; on the stranger's page the door STAYS — shown and
   unmoved — for the whole hold; the cover is fitted ONCE (its fit the same at every position) and nothing moves at
   rest (one page length over a second, at the top and in the middle of the hold). And opening the door ends the hold:
   the plain page, nothing moved at the top, the page says why. */
if (!ONLY || ONLY === '16' || ONLY === '16b') {
  const KINDS = [
    ['the guest’s text cover', 'fixture-cover.html', false],
    ['the guest’s photo cover', 'fixture-photo-cover.html', false],
    ['the stranger’s text cover', 'fixture-stranger-cover-fit.html', true],
    ['the stranger’s photo cover', 'fixture-stranger-photo-cover-fit.html', true],
  ];
  const FIRST = [[375, 560], [375, 600], [375, 667], [320, 568], [375, 812], [1280, 770]];
  const SNAPF = () => {
    /* Drawn: every opacity up the tree multiplied, nothing hidden. */
    const drawn = (e) => { let o = 1; for (let x = e; x && x.tagName !== 'HTML'; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; o *= Number(cs.opacity); } return o; };
    const box = (e) => (e && e.getClientRects().length ? { t: e.getBoundingClientRect().top, b: e.getBoundingClientRect().bottom, o: drawn(e) } : null);
    const head = document.querySelector('main header[data-pahina-first-screen]');
    const cover = document.querySelector('.hub-cover') ?? head;
    const door = document.querySelector('main details[data-get-inside]');
    return {
      s: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight,
      bar: document.querySelector('[data-sticky-top]').getBoundingClientRect().bottom,
      cover: box(cover), pout: Number(cover?.style.getPropertyValue('--hub-pout') || 0),
      names: box(head?.querySelector('h1')), date: box(head?.querySelector('[data-motion="arrive-date"]')),
      door: box(door?.querySelector('summary')), dockLine: door ? parseFloat(getComputedStyle(door).scrollMarginBottom) || 0 : 0, stays: Boolean(door?.hasAttribute('data-hub-stay')),
      on: Boolean(document.querySelector('[data-hub-page-on]')), off: document.querySelector('.hub-page-cell')?.getAttribute('data-hub-scrub-off') ?? null,
      fit: `${[...document.querySelectorAll('[data-first-screen-fit]')].map((e) => `air ${e.style.getPropertyValue('--fs-air') || '1'} mark ${e.style.getPropertyValue('--fs-mark') || '1'}`).join(' ') || 'no fit'} · ${[...document.querySelectorAll('[data-fs-shift]')].map((e) => e.style.getPropertyValue('--fs-shift')).join(' ') || 'nothing moved'}`,
    };
  };
  const openF = async (file, W, H, opts = {}) => { const ctx = await b.newContext({ viewport: { width: W, height: H }, ...opts }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140))); await p.goto(`file://${scratch}/${file}`); await p.waitForTimeout(900); const at = async (y) => { await p.evaluate((yy) => scrollTo(0, yy), y); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return p.evaluate(SNAPF); }; return { ctx, p, errs, at }; };
  const r = (n) => (n === null || n === undefined ? '—' : Math.round(n * 10) / 10);
  for (const [kind, file, stranger] of KINDS) {
    for (const [W, H] of FIRST) {
      const size = `${W}x${H} ${kind}`;
      /* The bottom bar's line: the stylesheet's `--sn-door-rest` (4.75rem; from `xl` the bar is a side rail: 1rem). */
      const line = H - (W >= 1280 ? 16 : 76);
      const { ctx, p, errs, at } = await openF(file, W, H);
      const top = await at(0);
      say(errs.length === 0 && top.on && top.off === null && Boolean(top.names && top.date) && top.names.t >= top.bar - 0.5 && top.names.o === 1 && top.date.o === 1 && top.date.b <= line + 0.5, `${size}: the first screen holds the names and the date — the names ${r(top.names?.t)}–${r(top.names?.b)} under the bar (it ends ${r(top.bar)}), the date ending ${r(top.date?.b)} above the bottom bar's line ${line}${errs.length ? ` — ${errs[0]}` : ''}${top.off ? ` — off: ${top.off}` : ''}`);
      if (stranger) say(Boolean(top.door) && top.door.t >= top.bar - 0.5 && top.door.b <= H - top.dockLine + 0.5 && top.door.o === 1, `${size}: "Get inside" is on the first screen, whole and shown${top.door ? ` (${r(top.door.t)}–${r(top.door.b)}, drawn ${top.door.o.toFixed(2)}; its line ${r(H - top.dockLine)})` : ' (no door)'}${kind.includes('photo') ? ' — the photo cover: the door is under the photo on today’s page too; nothing fits a photo (owner’s call)' : ''}`);
      const fwd = []; for (let y = 0; y <= Math.min(top.max, Math.round(H * 1.3)); y += 16) fwd.push(await at(y));
      const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1);
      const bad = hold.filter((f) => f.cover.o > 0.02 && (!f.names || f.names.t < f.bar - 0.5 || f.names.b > H));
      say(hold.length > 3 && bad.length === 0, `${size}: while the cover is held (${hold.length} positions) its names are on the screen, under the pinned bar, at every one${bad.length ? ` — NOT at ${bad[0].s}px: ${r(bad[0].names?.t)}–${r(bad[0].names?.b)}` : ` (at ${r(hold[0]?.names.t)}px)`}`);
      if (stranger && !kind.includes('photo')) {
        const moved = hold.filter((f) => !f.door || f.door.o < 0.999 || Math.abs(f.door.t - top.door.t) > 0.6);
        say(top.stays && hold.length > 3 && moved.length === 0, `${size}: "Get inside" STAYS while the cover is held — shown and unmoved at every one of ${hold.length} positions${moved.length ? ` — NOT at ${moved[0].s}px (${moved[0].door ? `${r(moved[0].door.t)}, drawn ${moved[0].door.o.toFixed(2)}` : 'gone'})` : ''} (marked staying: ${top.stays})`);
      }
      const fits = [...new Set(fwd.map((f) => f.fit))];
      say(fits.length === 1, `${size}: fitted once — the fit is the same at every position (${fits.join(' / ')})`);
      const mid = hold[Math.floor(hold.length / 2)]?.s ?? 0;
      for (const [where, y] of [['at the top', 0], ['in the middle of the hold', mid]]) {
        await at(y);
        const lengths = new Set();
        for (let i = 0; i < 20; i++) { lengths.add(await p.evaluate(() => `${document.documentElement.scrollHeight} ${Math.round((document.querySelector('.hub-cover')?.getBoundingClientRect().height ?? 0) * 100) / 100}`)); await p.waitForTimeout(50); }
        say(lengths.size === 1, `${size}: no jitter ${where} (${y}px) — one page length and one cover height over a second at rest (${[...lengths].join(' · ')})`);
      }
      if (pics) { for (const [name, y] of [['0-opens', 0], ['1-held', mid]]) { await at(y); await p.screenshot({ path: `${pics}/c16b-${file.replace(/^fixture-|\.html$/g, '')}-${W}x${H}-${name}.png` }); } }
      await ctx.close();
    }
  }
  /* 🚪 OPENING THE DOOR ENDS THE HOLD: what opens is below the door on a page that does not move — so the hand-overs
     stand down for the visit, and at the top of the page nothing moves (the held page there IS the plain page). */
  for (const [W, H] of [[375, 667], [375, 560]]) {
    const size = `${W}x${H} the stranger’s text cover, the door opened at the top`;
    const { ctx, p, errs, at } = await openF('fixture-stranger-cover-fit.html', W, H);
    const before = await at(0);
    await p.click('main details[data-get-inside] > summary'); await p.waitForTimeout(900);
    const after = await p.evaluate(SNAPF);
    const opened = await p.evaluate(() => ({ open: document.querySelector('main details[data-get-inside]').open, signIn: document.querySelector('main details[data-get-inside] a[href^="/login"]').getBoundingClientRect().bottom, sticky: [...document.querySelectorAll('.hub-page-stage')].some((e) => getComputedStyle(e).position === 'sticky') }));
    const shift = after.s;
    say(errs.length === 0 && before.on && opened.open && !after.on && !opened.sticky && after.off === 'the door was opened' && Math.abs(after.names.t + shift - before.names.t) < 0.6 && Math.abs(after.cover.t + shift - before.cover.t) < 0.6 && after.cover.o === 1, `${size}: the door opens and the hold stands down — the plain page (${after.off}), the cover and the names where they were (the names ${r(before.names.t)} → ${r(after.names.t + shift)} on the page), drawn whole`);
    say(opened.signIn <= H - after.dockLine + 0.5, `${size}: …and what it opened is brought into view, clear of the bottom bar ("Sign in" ends ${r(opened.signIn)}; the line ${r(H - after.dockLine)}; the page scrolled ${shift}px)`);
    if (pics) await p.screenshot({ path: `${pics}/c16b-stranger-${W}x${H}-door-opened.png` });
    await ctx.close();
  }
}
/* 17. 🤝 TOGETHER (owner 2026-10-10, asked what should stand where the names built out — the RSVP button alone, or the
   button and the countdown: "Together."). On a generated page in the real invitation's shape: when the block after
   the cover is THE PAGE'S ACTION ROW (it carries the real rows' own mark), the block after it — in the NEXT group —
   arrives WITH it: one fade, one unit, the page's own 48 px between them kept. A long second block arrives with the
   row and is scrolled through, never shrunk. And a cover whose group holds nothing after it never fades to nothing:
   the next group's block arrives, alone. */
if (!ONLY || ONLY === '17') {
  const SNAP17 = () => {
    const box = (e) => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { t: r.top, b: r.bottom, o: cs.visibility === 'hidden' ? 0 : Number(cs.opacity) }; };
    const cover = document.querySelector('.hub-cover') ?? document.querySelector('[data-cover]');
    const scene = (n) => { const e = document.querySelector(`[data-name="${n}"]`); return e ? (e.closest('.hub-scene') ?? e) : null; };
    const named = (e) => e.getAttribute('data-grp') ?? e.getAttribute('data-block') ?? e.querySelector('[data-name]')?.getAttribute('data-name') ?? e.tagName.toLowerCase();
    const cell = document.querySelector('.hub-cover-cell');
    return {
      s: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight,
      cover: box(cover), words: box(document.querySelector('[data-cover] h1')), pout: Number(cover.style.getPropertyValue('--hub-pout') || 0),
      zeros: [...document.querySelectorAll('[data-hub-zero]')].map(named), zrest: [...document.querySelectorAll('[data-hub-zrest]')].map(named), lifted: [...document.querySelectorAll('[data-hub-zlift]')].map(named),
      reply: box(document.querySelector('[data-block="Reply"]')), greeting: box(document.querySelector('[data-block="Greeting"]')), scenes: box(document.querySelector('[data-grp="scenes"]')),
      cdOut: Number(scene('Countdown')?.style.getPropertyValue('--hub-pout') || 0),
      line: cell ? parseFloat(getComputedStyle(cell).scrollPaddingTop) || 0 : 0,
      all: [...document.querySelectorAll('[data-cover], [data-block], [data-name], [data-foot]')].filter((e) => e.getClientRects().length).map((e) => { const x = e.closest('.hub-scene') ?? e; const r = x.getBoundingClientRect(); const cs = getComputedStyle(x); return [e.getAttribute('data-block') ?? e.getAttribute('data-name') ?? (e.hasAttribute('data-cover') ? 'cover' : 'foot'), Math.round(r.top), (cs.visibility === 'hidden' ? 0 : Number(cs.opacity)).toFixed(2)]; }),
      holds: [...document.querySelectorAll('.hub-page-cell')].map((c) => parseFloat(getComputedStyle(c, '::after').height) || 0),
      on: document.querySelector('.hub-page-cell')?.hasAttribute('data-hub-page-on') ?? false, off: document.querySelector('.hub-page-cell')?.getAttribute('data-hub-scrub-off') ?? document.querySelector('.hub-scenes')?.getAttribute('data-hub-scrub-off') ?? null,
      sticky: [...document.querySelectorAll('.hub-page-stage, .hub-stage')].some((e) => getComputedStyle(e).position === 'sticky'),
    };
  };
  const open = async (file, W, H) => { const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140))); await p.goto(`file://${scratch}/${file}`); await p.waitForTimeout(500); const at = async (y) => { await p.evaluate((yy) => scrollTo(0, yy), y); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return p.evaluate(SNAP17); }; return { ctx, p, errs, at }; };
  const r = (n) => (n === null || n === undefined ? '—' : Math.round(n * 10) / 10);
  const sig = (f) => JSON.stringify([f.all, f.pout.toFixed(3)]);
  const play = async (at, top) => { const fwd = []; for (let y = 0; y < top.max; y += 16) fwd.push(await at(y)); fwd.push(await at(top.max)); const back = [await at(top.max)]; for (let y = top.max - (top.max % 16); y >= 0; y -= 16) back.push(await at(y)); return { fwd, same: fwd.every((f) => { const k = back.find((x) => x.s === f.s); return k && sig(k) === sig(f); }) }; };
  for (const [W, H] of [[375, 812], [375, 667], [441, 882], [1280, 770]]) {
    /* A · THE ACTION ROW AND THE BLOCK AFTER IT, AS ONE. */
    {
      const size = `${W}x${H} together`;
      const t = await open('scrub-cover-groups-row-today.html', W, H); const today = await t.at(0); await t.ctx.close();
      const gap = today.greeting.t - today.reply.b; const after = today.scenes.t - today.greeting.b;
      const { ctx, p, errs, at } = await open('scrub-cover-groups-row.html', W, H);
      const top = await at(0);
      say(errs.length === 0 && top.on && top.off === null && top.sticky && top.holds.length === 4 && top.holds.every((h) => h > 0) && JSON.stringify(top.zeros) === JSON.stringify(['Reply', 'Greeting']) && JSON.stringify(top.lifted) === JSON.stringify(['scenes', 'foot']) && top.zrest.length === 0, `${size}: armed, no page error; what arrives is the action row AND the block after it, in the next group (${top.zeros.join(' + ') || 'nothing'}); what follows is everything after the second (${top.lifted.join(' · ')})${errs.length ? ` — ${errs[0]}` : ''}${top.off ? ` — off: ${top.off}` : ''}`);
      say(Math.abs(top.cover.t - today.cover.t) < 0.01 && Math.abs(top.cover.b - today.cover.b) < 0.01 && top.cover.o === 1 && top.pout === 0 && top.reply.o === 0 && top.greeting.o === 0, `${size}: at scroll 0 the cover is exactly where today's page has it, whole, and neither of the two is there yet`);
      const { fwd, same } = await play(at, top);
      const hold = fwd.filter((f) => f.pout > 0 && f.pout < 1); const out = Math.round(H * 0.55);
      say(hold.length > 3 && hold.every((f) => Math.abs(f.cover.t - today.cover.t) < 0.6 && Math.abs(f.pout - f.s / out) < 0.02) && fwd.some((f) => f.pout >= 1 && f.cover.o === 0), `${size}: the owner's numbers are the same — the cover held where it stands, built out over 55 % of a screen (${out}px; done by ${fwd.find((f) => f.pout >= 1)?.s}px)`);
      const seen = fwd.filter((f) => (f.reply.o > 0.02 || f.greeting.o > 0.02) && f.pout < 1);
      say(seen.length > 0 && fwd.every((f) => Math.abs(f.reply.o - f.greeting.o) < 0.011) && fwd.every((f) => !((f.reply.o > 0.02 || f.greeting.o > 0.02) && f.pout < 0.79)), `${size}: ONE arrival — the two at the same number at every one of ${fwd.length} positions, and neither before the last 20 % (first seen with the cover ${seen[0] ? Math.round(seen[0].pout * 100) : '—'} % out)`);
      const whole = fwd.find((f) => f.pout >= 1 && f.reply.o >= 0.99 && f.greeting.o >= 0.99);
      /* (Centred while the page is held — the arrival's last step lands on the hold's last pixel, so the first
         position at which both are whole can already be a few pixels of ordinary scrolling on.) */
      say(Boolean(whole) && whole.reply.t >= 0 && whole.greeting.b <= H && Math.abs(whole.greeting.t - whole.reply.b - gap) < 0.1 && gap === 48 && seen.length > 0 && seen.every((f) => Math.abs((f.reply.t + f.greeting.b) / 2 - H / 2) < 1.5 && Math.abs(f.greeting.t - f.reply.b - gap) < 0.1), `${size}: the two are centred AS ONE while they arrive (${seen[0] ? `${r(seen[0].reply.t)}–${r(seen[0].greeting.b)}, middle ${r((seen[0].reply.t + seen[0].greeting.b) / 2)}` : '—'} against ${H / 2}), and when the arrival completes both are whole on the screen (${whole ? `${r(whole.reply.t)}–${r(whole.greeting.b)}` : '—'}), the page's own distance between them (${whole ? r(whole.greeting.t - whole.reply.b) : '—'}px; today ${r(gap)}px)`);
      const visible = fwd.filter((f) => f.cover.o > 0.02 && f.pout < 1);
      const over = visible.filter((f) => f.scenes.t < Math.max(f.cover.b, f.greeting.b) - 1);
      const done = fwd.find((f) => f.pout >= 1 && f.s >= Math.round(H * 0.66) + 32 && f.cdOut === 0);
      say(visible.length > 3 && over.length === 0 && Boolean(done) && Math.abs(done.scenes.t - done.greeting.b - after) < 0.1, `${size}: what follows the two never lies over the cover or over them, and stands under the second at the page's own distance once the cover has gone (${done ? r(done.scenes.t - done.greeting.b) : '—'}px; today ${r(after)}px${over.length ? `; OVER at ${over[0].s}` : ''})`);
      say(same && fwd.some((f) => f.cdOut >= 1) && fwd.at(-1).all.at(-1)[2] === '1.00', `${size}: back == down at every one of ${fwd.length} positions, and the scenes after still hand over to the end`);
      if (pics && whole) { await at(whole.s); await p.screenshot({ path: `${pics}/c17-together-${W}x${H}-arrived.png` }); }
      await ctx.close();
      const n = await open('scrub-cover-groups-row-noscript.html', W, H); const plain = await n.at(0); await n.ctx.close();
      say(!plain.sticky && !plain.on && plain.zeros.length === 0 && JSON.stringify(plain.all) === JSON.stringify(today.all), `${size}: with no script the page is the plain page — every block where today's page has it`);
    }
    /* B · A COVER WHOSE GROUP HOLDS NOTHING AFTER IT: the next group's block arrives, alone — never nothing. */
    {
      const size = `${W}x${H} nothing after the cover in its group`;
      const t = await open('scrub-cover-groups-norow-today.html', W, H); const today = await t.at(0); await t.ctx.close();
      const after = today.scenes.t - today.greeting.b;
      const { ctx, p, errs, at } = await open('scrub-cover-groups-norow.html', W, H);
      const top = await at(0);
      say(errs.length === 0 && top.on && top.off === null && top.reply === null && JSON.stringify(top.zeros) === JSON.stringify(['Greeting']) && JSON.stringify(top.zrest) === JSON.stringify(['greeting']) && JSON.stringify(top.lifted) === JSON.stringify(['scenes', 'foot']) && Math.abs(top.cover.t - today.cover.t) < 0.01 && top.cover.o === 1 && top.pout === 0 && top.greeting.o === 0, `${size}: armed; what arrives is the next group's block, alone (${top.zeros.join(' + ') || 'NOTHING'}), in the box the engine pulls up to the cover (${top.zrest.join(',') || 'none'})${errs.length ? ` — ${errs[0]}` : ''}${top.off ? ` — off: ${top.off}` : ''}`);
      const { fwd, same } = await play(at, top);
      const seen = fwd.filter((f) => f.greeting.o > 0.02 && f.pout < 1);
      const whole = fwd.find((f) => f.pout >= 1 && f.greeting.o >= 0.99);
      say(seen.length > 0 && fwd.every((f) => !(f.greeting.o > 0.02 && f.pout < 0.79)) && seen.every((f) => Math.abs((f.greeting.t + f.greeting.b) / 2 - H / 2) < 1.5 && f.greeting.t >= today.cover.t - 0.5) && Boolean(whole) && whole.s <= Math.round(H * 0.66) + 16, `${size}: the cover never fades to nothing — the block arrives on the centred line at the last 20 % and is whole by the end of the hold (middle ${seen[0] ? r((seen[0].greeting.t + seen[0].greeting.b) / 2) : '—'} against ${H / 2}; whole at ${whole?.s}px)`);
      const visible = fwd.filter((f) => f.cover.o > 0.02 && f.pout < 1);
      const done = fwd.find((f) => f.pout >= 1 && f.s >= Math.round(H * 0.66) + 32 && f.cdOut === 0);
      say(visible.length > 3 && visible.every((f) => f.scenes.t >= Math.max(f.cover.b, f.greeting.b) - 1) && Boolean(done) && Math.abs(done.scenes.t - done.greeting.b - after) < 0.1, `${size}: what follows never lies over the cover, and stands under the arrival at the page's own distance once the cover has gone (${done ? r(done.scenes.t - done.greeting.b) : '—'}px; today ${r(after)}px)`);
      say(same, `${size}: back == down at every one of ${fwd.length} positions`);
      await ctx.close();
      const n = await open('scrub-cover-groups-norow-noscript.html', W, H); const plain = await n.at(0); await n.ctx.close();
      say(!plain.sticky && !plain.on && plain.zrest.length === 0 && JSON.stringify(plain.all) === JSON.stringify(today.all), `${size}: with no script the page is the plain page — every block where today's page has it`);
    }
  }
  /* C · A LONG SECOND HALF: it arrives with the row — tops at the top of the room — and is scrolled through. */
  for (const [W, H] of [[375, 812], [1280, 770]]) {
    const size = `${W}x${H} together, the second block taller than the screen`;
    const t = await open('scrub-cover-groups-row-long-today.html', W, H); const today = await t.at(0); await t.ctx.close();
    const { ctx, p, errs, at } = await open('scrub-cover-groups-row-long.html', W, H);
    const top = await at(0); const fwd = []; for (let y = 0; y <= Math.round(H * 0.66) + 400; y += 16) fwd.push(await at(y));
    const whole = fwd.find((f) => f.pout >= 1 && f.reply.o >= 0.99 && f.greeting.o >= 0.99);
    const tall = today.greeting.b - today.greeting.t;
    const held = fwd.filter((f) => f.reply.o > 0.02 && f.pout < 1);
    say(errs.length === 0 && JSON.stringify(top.zeros) === JSON.stringify(['Reply', 'Greeting']) && tall > H && Boolean(whole) && held.length > 0 && held.every((f) => Math.abs(f.reply.t - top.line) < 1.5) && Math.abs(whole.greeting.t - whole.reply.b - 48) < 0.1 && Math.abs(whole.greeting.b - whole.greeting.t - tall) < 0.1 && whole.greeting.b > H && fwd.every((f) => Math.abs(f.reply.o - f.greeting.o) < 0.011), `${size}: the long block (${r(tall)}px on a ${H}px screen) arrives WITH the row, the two from the top of the room down (the row's top ${held[0] ? r(held[0].reply.t) : '—'} against the page's line ${r(top.line)}), 48 px apart, not shrunk or clipped (${whole ? r(whole.greeting.b - whole.greeting.t) : '—'}px)${errs.length ? ` — ${errs[0]}` : ''}`);
    const end = fwd.filter((f) => f.s >= Math.round(H * 0.66) + 16);
    say(end.length > 10 && end.every((f, i) => i === 0 || Math.abs(f.greeting.t - (end[0].greeting.t - (f.s - end[0].s))) < 0.6), `${size}: …and once the hold is over it scrolls through under the thumb (its top ${r(end[0]?.greeting.t)} → ${r(end.at(-1)?.greeting.t)} over ${end.at(-1).s - end[0].s}px)`);
    if (pics && whole) { await at(whole.s); await p.screenshot({ path: `${pics}/c17-together-long-${W}x${H}-arrived.png` }); }
    await ctx.close();
  }
}
await b.close();
console.log(failed ? `\n${failed} FAILED` : PLAYED.length === SIZES.length ? '\nALL OK' : ONLY ? `\nPART ONLY — OK (block ${ONLY} alone — not a pass for the rest)` : '\nPART ONLY — OK (not every size was played)');
process.exit(failed ? 1 : 0);
