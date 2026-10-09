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
 *      every mark is gone.
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
execFileSync(esbuild, [`${WEB}/scripts/scrub-check-island.tsx`, '--bundle', '--minify', '--format=iife', '--jsx=automatic', '--define:process.env.NODE_ENV="production"', `--outfile=${scratch}/scrub-island.js`], { cwd: WEB, stdio: 'pipe' });
execFileSync(tsx, ['scripts/scrub-check-page.tsx', `${scratch}/scrub-real-maker.html`, `${scratch}/scrub-island.js`, 'maker'], { cwd: WEB, stdio: 'pipe' });

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
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); const cell = e.parentElement?.classList.contains('hub-stage') ? e.parentElement.parentElement : null;
    return { n: e.querySelector('[data-name]')?.getAttribute('data-name') ?? '?', o: cs.visibility === 'hidden' ? 0 : Number(cs.opacity), t: r.top, b: r.bottom, pout: Number(e.style.getPropertyValue('--hub-pout') || 0), pin: Number(e.style.getPropertyValue('--hub-pin') || 1), holds: Boolean(cell), pad: cell ? parseFloat(getComputedStyle(cell, '::after').height) || 0 : 0 };
  });
  const rows = [...document.querySelectorAll('[data-row]')].map((li) => Number(getComputedStyle(li).opacity));
  return { s: Math.round(scrollY), scenes, rows, max: document.documentElement.scrollHeight - innerHeight };
};
const SIZES = [[890, 1548], [940, 1608], [1280, 770], [375, 812], [375, 667]];
/* `SCRUB_ONLY_MAKER=1` plays case 7 alone (a re-run while working on the Maker's canvas) — never a pass for the rest. */
const PLAYED = process.env.SCRUB_ONLY_MAKER ? [] : SIZES;
const b = await chromium.launch();
let failed = 0;
const say = (ok, line) => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`); };

for (const [W, H] of PLAYED) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: W < 500, isMobile: W < 500 });
  await ctx.addInitScript(WATCH);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await p.goto(`file://${scratch}/scrub-real.html`); await p.waitForTimeout(500);
  const at = async (y) => { await p.evaluate((yy) => window.__go(yy), y); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return p.evaluate(SNAP); };
  const max = (await at(0)).max;
  const fwd = []; for (let y = 0; y < max; y += 16) fwd.push(await at(y)); fwd.push(await at(max));
  const back = [await at(max)]; for (let y = max - (max % 16); y >= 0; y -= 16) back.push(await at(y));
  const sig = (f) => JSON.stringify([f.scenes.map((e) => [e.n, e.o.toFixed(2), Math.round(e.t)]), f.rows.map((r) => r.toFixed(2))]);
  const same = fwd.every((f) => { const k = back.find((x) => x.s === f.s); return k && sig(k) === sig(f); });
  const faults = { overlap: [], readable: [], rowsOrder: [], leavesEarly: [], prevOnRows: [], early: [], box: [], moved: [] };
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
  const size = `${W}×${H}`;
  say(errs.length === 0, `${size} no page error${errs.length ? ' — ' + errs[0] : ''}`);
  say(same, `${size} back == down at every one of ${fwd.length} positions`);
  for (const [k, words] of Object.entries({ overlap: 'no overlap outside a pair', readable: 'never two readable at once', rowsOrder: 'rows in order', leavesEarly: 'every row complete before the list leaves', prevOnRows: 'nothing of the scene before once the rows begin', early: 'the scene before at its last 20 % before the list shows', box: 'the pair in one box', moved: 'the page stands still while a hand-over plays' })) say(faults[k].length === 0, `${size} ${words}${faults[k].length ? ` — ${faults[k].length} × e.g. ${faults[k][0]}` : ''}`);
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
      marks: [...document.querySelectorAll('.hub-scenes, .hub-scenes *')].filter((e) => /--hub-(?:len|top|up|pin|pout|o|rise|pp|end)\s*:/.test(e.getAttribute('style') ?? '') || [...e.attributes].some((a) => /^data-hub-(?:away|scrub-on)$/.test(a.name))).length,
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
await b.close();
console.log(failed ? `\n${failed} FAILED` : PLAYED.length ? '\nALL OK' : '\nTHE MAKER’S CANVAS ONLY — OK (the five sizes were not played)');
process.exit(failed ? 1 : 0);
