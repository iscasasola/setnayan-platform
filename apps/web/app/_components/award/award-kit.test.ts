/**
 * 🏅 THE SHARED AWARD UI KIT, HELD ON ITS REAL MARKUP (controller build map 2026-11-15, slice K; approved prototype
 * `Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v35.html`).
 *
 *   1 · the reward ticket prints every kind of the owner's ladder, the holo strip only on the top plans;
 *   2 · the ticket's three states say the build map's copy verbatim, and only "ready" is pressable;
 *   3 · the full-screen badge stacks badge → caption → hallmark and NEVER overlaps, at every verified size;
 *   4 · the plaque scales down to fit (never up), share button included;
 *   5 · the full-screen badge names the shop, the tier it was GIVEN (never a hard-coded name), and the hallmark;
 *   6 · the plaque says "Awarded on {date}", carries the engraved mark, and its share sits UNDER the plaque;
 *   7 · the story recorder's codec order, and the plaque-only slots are stripped from the story;
 *   8 · zero server cost: no file in the kit fetches, writes, or reaches the server;
 *   9 · the recorder is lazy: nothing imports it statically except its own door.
 *
 * 🪤 Same harness as `every-palette-look-draws.test.ts`: `globalThis.React` before the DYNAMIC imports; `.css`
 * modules stubbed (each class name maps to itself).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request.endsWith('.css')) return new Proxy({}, { get: (_o, k) => (k === '__esModule' ? false : String(k)) });
    return load.call(this, request, ...rest);
  };
}

const h = React.createElement;
const DIR = __dirname;
const SIZES: Array<[number, number]> = [
  [375, 640],
  [390, 844],
  [768, 1024],
  [1440, 900],
];

test('1 · every ticket kind prints; the holo strip only on Event Pro and Event Ultra', async () => {
  const { TICKET_SPECS, ticketSvg, ticketDataUri } = await import('./ticket-svg');
  assert.deepEqual(Object.keys(TICKET_SPECS).sort(), ['eplus', 'epro', 'eultra', 'papic1000', 'papic150', 'papic3000']);
  for (const [k, spec] of Object.entries(TICKET_SPECS)) {
    const svg = ticketSvg(k, spec);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.includes(`>${spec.n}</text>`), `${k} prints its number`);
    assert.ok(svg.includes(`SETNAYAN · ${spec.w}`), `${k} prints its word`);
    assert.ok(svg.includes('>REWARD</text>'), `${k} has the stub's REWARD`);
    assert.ok(svg.includes('feTurbulence'), `${k} has the paper grain`);
    assert.equal(/width="16" height="150" fill="url\(#tq\w+h\)"/.test(svg), !!('holo' in spec && spec.holo), `${k} holo strip`);
    assert.ok(ticketDataUri(k, spec).startsWith('data:image/svg+xml'));
    assert.equal(ticketDataUri(k, spec), ticketDataUri(k, spec), 'drawn once per kind');
  }
});

test('2 · the ticket says the copy verbatim, and only "ready" is a button', async () => {
  const { RewardTicket, TICKET_COPY } = await import('./reward-ticket');
  assert.equal(TICKET_COPY.claimed, '✓ Claimed · in your gifts');
  assert.equal(TICKET_COPY.foot, 'A gift from Setnayan, for you to give.');
  assert.equal(TICKET_COPY.tap, 'Tap to claim');
  const ready = renderToStaticMarkup(h(RewardTicket, { kind: 'papic150', label: 'Papic 150', state: 'ready', onClaim: () => {} }));
  assert.match(ready, /^<button type="button"/);
  assert.ok(ready.includes('Tap to claim') && ready.includes('New reward'));
  assert.ok(ready.includes('aria-label="Claim your reward: Papic 150"'));
  const locked = renderToStaticMarkup(h(RewardTicket, { kind: 'epro', label: 'Event Pro', state: 'locked' }));
  assert.ok(!locked.includes('<button'));
  assert.ok(locked.includes('Reward · gift for a customer'));
  const got = renderToStaticMarkup(h(RewardTicket, { kind: 'eultra', label: 'Event Ultra', state: 'claimed' }));
  assert.ok(!got.includes('<button') && !got.includes('Tap to claim'));
  assert.ok(got.includes('✓ Claimed · in your gifts'));
  for (const m of [ready, locked, got]) assert.ok(m.includes('A gift from Setnayan, for you to give.'));
});

test('3 · badge → caption → hallmark never overlap, at every verified size', async () => {
  const { badgeStack } = await import('./fit');
  const HM = 78; // the hallmark's measured block (height + bottom inset)
  for (const [vw, vh] of SIZES) {
    for (const capH of [150, 196]) {
      const st = badgeStack(vw, vh, HM, capH);
      assert.ok(st.size <= 520 && st.size <= vw * 0.92 + 0.5 && st.size <= vh * 0.6 + 0.5, `${vw}×${vh} size ${st.size}`);
      assert.ok(st.cy - st.size / 2 >= 64 - 0.5, `${vw}×${vh}: badge clears the close control`);
      assert.ok(st.cy + st.size / 2 < st.capTop, `${vw}×${vh}: badge above caption`);
      assert.ok(st.capTop + capH <= vh - HM, `${vw}×${vh} cap ${capH}: caption clears the hallmark`);
    }
  }
});

test('4 · the plaque scales down to fit, never up', async () => {
  const { plaqueScale } = await import('./fit');
  assert.equal(plaqueScale(1440, 900, 440, 700), 1);
  const k = plaqueScale(375, 640, 440, 900);
  assert.ok(k < 1 && 900 * k <= 620 && 440 * k <= 359);
  for (const [vw, vh] of SIZES) {
    const s = plaqueScale(vw, vh, 440, 960);
    assert.ok(960 * s <= vh - 20 + 0.01 && 440 * s <= vw - 16 + 0.01, `${vw}×${vh}`);
  }
});

test('4b · owner "Stay full size": the plaque shrinks, its share button never does — under it, apart, on screen', async () => {
  const { plaqueLayout, SHARE_H, SHARE_GAP } = await import('./fit');
  assert.equal(SHARE_H, 44);
  // the plaque's real unscaled size (440 wide; gold ≈ 1090 tall, No. 1 ≈ 1180 tall) and a taller worst case
  for (const ch of [700, 1090, 1180, 1400])
    for (const [vw, vh] of SIZES) {
      const L = plaqueLayout(vw, vh, 440, ch, 44);
      const shareTop = L.shareTop!;
      assert.ok(L.k <= 1 && L.k > 0, `${vw}×${vh} k`);
      assert.ok(Math.abs(L.bottom - L.top - ch * L.k) < 0.01, 'the plaque box is its scaled height');
      assert.ok(L.top >= 10 - 0.01, `${vw}×${vh} plaque on screen (top)`);
      assert.ok(shareTop >= L.bottom + SHARE_GAP - 0.01, `${vw}×${vh} the button sits under the plaque, never on it`);
      assert.ok(shareTop + SHARE_H <= vh - 10 + 0.01, `${vw}×${vh} h=${ch} the full 44 px button is on screen`);
      assert.ok(440 * L.k <= vw - 16 + 0.01, `${vw}×${vh} plaque fits across`);
    }
  // the button's height is reserved at full size: a taller button pushes the plaque smaller, never off screen
  const a = plaqueLayout(375, 640, 440, 1180, 44);
  const b = plaqueLayout(375, 640, 440, 1180, 60);
  assert.ok(b.k < a.k && b.shareTop! + 60 <= 640 - 10 + 0.01);
  // no button → the plaque gets the whole height
  const n = plaqueLayout(375, 640, 440, 1180, null);
  assert.equal(n.shareTop, null);
  assert.ok(n.k > a.k);
  // the share button lives OUTSIDE the scaled box in the component
  const src = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  const fitBox = src.slice(src.indexOf('<div ref={fit}'), src.indexOf('{onShare ? ('));
  assert.ok(fitBox.length > 0 && !fitBox.includes('awShare'), 'the button is not inside the scaled plaque');
});

test('12 · the approved seal words: No. 1 has its own body, titles match the prototype, the year is a parameter', async () => {
  const { AWARD_COPY, SEAL_KINDS, sealPlaqueCopy } = await import('./award-copy');
  const c = AWARD_COPY(2031);
  assert.deepEqual([...SEAL_KINDS].sort(), Object.keys(c).sort());
  assert.notEqual(c.no1.body, c.medal.body, 'No. 1 never shows the Top 10 medal words');
  assert.doesNotMatch(c.no1.body, /ten best-rated/);
  assert.deepEqual(
    Object.fromEntries(SEAL_KINDS.map((k) => [k, c[k].title])),
    { no1: 'No. 1 Supplier of the Year', medal: 'Top 10 Supplier', heart: "Clients' Choice", crest: 'Most In-Demand', verified: 'Setnayan Verified', partner: 'Verified Partner' },
  );
  assert.equal(c.no1.eyebrow, 'Setnayan · 2031', 'the year is passed in, never typed');
  assert.equal(c.verified.eyebrow, 'Setnayan');
  assert.equal(c.partner.eyebrow, 'Setnayan · for life');
  const src = stripComments(readFileSync(join(DIR, 'award-copy.ts'), 'utf8'));
  assert.doesNotMatch(src, /\b20\d\d\b/, 'no typed year');
  assert.doesNotMatch(src, /4\.99|4\.96|236|214/, 'the demo record numbers stay out');
  assert.deepEqual(sealPlaqueCopy('no1', 2031).how, c.no1.how.map(([l]) => l));
  // verbatim against the prototype, when the corpus is on this machine (CI does not have it)
  const proto = join(homedir(), 'Documents/Claude/Projects/Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v48.html');
  if (existsSync(proto)) {
    const html = readFileSync(proto, 'utf8');
    const block = html.slice(html.indexOf('const AWARD_TXT={'), html.indexOf('function openSeal('));
    for (const k of SEAL_KINDS) {
      const row = new RegExp(`\\b${k}:\\{t:(['"])(.*?)\\1,e:'(.*?)',b:'(.*?)',\\s*h:\\[(.*?)\\],r:`, 's').exec(block);
      assert.ok(row, k);
      assert.equal(c[k].title, row![2], `${k} title`);
      assert.equal(c[k].eyebrow, row![3]!.replace('2026', '2031'), `${k} eyebrow`);
      assert.equal(c[k].body, row![4], `${k} body`);
      const how = [...row![5]!.matchAll(/\['(.*?)',([01])\]/g)].map((m) => [m[1], m[2] === '1']);
      assert.deepEqual(c[k].how, how, `${k} how`);
    }
  }
});

test('13 · v49 the reveal carries on: rail springs, exit timing, the flight target, confetti adoption', async () => {
  const rig = await import('./story-rig');
  // the rail: a knock at one point travels to its neighbours as a wave and dies away (damped), never grows
  const n = 61;
  const ry = new Float32Array(n);
  const rv = new Float32Array(n);
  rv[30] = 620;
  const energy = () => ry.reduce((e, y, i) => e + rig.RAIL_K * y * y + rv[i]! * rv[i]!, 0);
  for (let i = 0; i < 12; i++) rig.railSpringStep(ry, rv, 1 / 120);
  assert.ok(Math.abs(ry[35]!) > 0, 'the knock reached five points along');
  const e1 = energy();
  for (let i = 0; i < 1200; i++) rig.railSpringStep(ry, rv, 1 / 120);
  assert.ok(energy() < e1 * 0.01, 'damped: after 10 s the rail is still');
  assert.ok(ry.every((y) => Number.isFinite(y)), 'stable at the fixed 1/120 s step');
  // the exit cord: nothing before it starts, the full haul 1.25 s later, smooth in between
  assert.equal(rig.EXIT_LEAD_S, 0.35);
  const exc = rig.REVEAL_S - rig.EXIT_LEAD_S;
  assert.equal(rig.exitHaul(14, exc), 0);
  assert.equal(rig.exitHaul(exc + 1.25, exc), rig.EXIT_XOUT);
  assert.equal(rig.exitHaul(16, -1), 0, 'the video never hauls (no app)');
  const mid = rig.exitHaul(exc + 0.625, exc);
  assert.ok(Math.abs(mid - rig.EXIT_XOUT / 2) < 1e-9);
  // the house lights come up over 1.1 s; the video dips to dark over its last 0.5 s
  assert.equal(rig.houseDark(0), 0.94);
  assert.equal(rig.houseDark(rig.FADE_IN_S), 0);
  assert.equal(rig.loopDark(14.4, 15), 0);
  assert.ok(Math.abs(rig.loopDark(14.95, 15) - 0.94) < 1e-9);
  const { exitStageAlpha, flightTarget } = await import('./fit');
  assert.equal(exitStageAlpha(0), 1);
  assert.equal(exitStageAlpha(0.8), 0);
  // the flight lands on the centre of the award's viewBox inside the mounted svg (meet), at the mounted scale
  const L = flightTarget({ left: 100, top: 50, width: 266, height: 296 }, [17, 0, 266, 296], [17, 0, 266, 296], 532, 0.5, 266);
  assert.deepEqual(L, { x: 233, y: 198, scale: 1 });
  const L2 = flightTarget({ left: 0, top: 0, width: 200, height: 100 }, [], [0, 0, 1, 1], 100, 1, 100);
  assert.deepEqual(L2, { x: 100, y: 50, scale: 2 });
  // confetti: the plaque adopts every live piece of the reveal — one in, one out, mid-air, never restarted
  const { adoptRevealPieces } = await import('./confetti');
  const P = Array.from({ length: 250 }, (_, i) => ({ x: i, y: 100, vx: 60, vy: i % 2 ? 120 : -120, age: 1, f: 0.5, w: 0, spin: 3, r: 1, vr: 6, sw: 20, sh: 30, gold: i % 3 === 0, d: 0, rain: i > 200 }));
  const got = adoptRevealPieces({ P, k: 0.5, ox: 10, oy: 20 }, 1.5, () => 0);
  assert.equal(got.length, P.length);
  assert.deepEqual([got[4]!.x, got[4]!.y, got[4]!.vx, got[4]!.w], [(10 + 4 * 0.5) * 1.5, (20 + 100 * 0.5) * 1.5, (60 * 0.75) / 60, 20 * 0.75]);
  assert.ok(got.every((p) => p.delay === 0 && p.sd), 'already in the air');
  assert.equal(got[1]!.rain, true, 'a falling piece rains');
  assert.equal(got[2]!.rain, false, 'a rising piece is still the burst');
  // the plaque hands the reveal's pieces over (not a fresh burst) and keeps the old path for every other seal
  const plaque = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  assert.match(plaque, /confetti\(\{ P: rig\.confetti\(\), k, ox, oy \}\)/);
  assert.match(plaque, /Math\.min\(r\.width \/ STORY_W, r\.height \/ STORY_H\)/, 'letter-box fix for every seal');
});

test('14 · v50/v51 perf: nothing costly is drawn per frame; clamped clocks; the stage still is built early', () => {
  const rig = stripComments(readFileSync(join(DIR, 'story-rig.ts'), 'utf8'));
  // the body of a nested `function name(` up to its matching brace
  const body = (name: string) => {
    const a = rig.indexOf(`function ${name}(`);
    assert.ok(a >= 0, `${name} exists`);
    let i = rig.indexOf('{', a);
    let depth = 0;
    for (let j = i; j < rig.length; j++) {
      if (rig[j] === '{') depth++;
      else if (rig[j] === '}' && --depth === 0) return rig.slice(i, j + 1);
    }
    throw new Error(`${name} never closes`);
  };
  for (const f of ['base', 'frame', 'drawCurtain', 'drawValance']) {
    const b = body(f);
    assert.doesNotMatch(b, /shadowBlur/, `${f}: no shadowBlur per frame (the glows are pre-rendered)`);
    assert.doesNotMatch(b, /drawImage\(\s*im\b/, `${f}: the seal's SVG is never re-rasterised per frame`);
  }
  for (const f of ['drawCurtain', 'drawValance']) {
    const b = body(f);
    assert.equal((b.match(/=\s*vg\b/g) || []).length, 1, `${f}: the shade is filled once over the outline, not per strip`);
  }
  const dv = body('drawValance');
  assert.doesNotMatch(dv.slice(dv.indexOf('c += 2)'), dv.indexOf('fillStyle = vg')), /\.stroke\(\)/, 'valance strips are not stroked');
  assert.match(body('drawCurtain'), /new Float32Array\(n\)/, 'curtain point colours are numbers (Float32Array), not tuples');
  assert.match(body('drawValance'), /c \+= 2\)/, 'one valance strip per two columns');
  assert.match(rig, /c\.width = Math\.round\(W \* KS\)/, 'drawn at the size the screen shows');
  assert.match(rig, /rig\.prep = \(\) =>/);
  // v52: the warm-up builds the caches without running the cloth, then settles it ONCE
  assert.match(body('frame'), /if \(!WARM\) simTo\(t\)/, 'frame skips the cloth while warming');
  assert.match(rig, /WARM = true;\s*base\(4\);\s*frame\(2\);\s*WARM = false;\s*frame\(0\);/, 'one cloth settle in the warm-up');
  const plaque = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  assert.equal((plaque.match(/Math\.min\(0\.05, /g) || []).length, 2, 'both the reveal and the exit clocks are clamped');
  assert.match(plaque, /if \(rig\.prep && t > END - 1\.2\) rig\.prep\(\)/);
  assert.match(plaque, /scale: \(Math\.min\(window\.innerWidth/);
  // v52: the tap answers at once — the dark intro dialog opens BEFORE the rig is built, and paints for 2 frames first
  const open = plaque.indexOf('si.showModal()');
  const build = plaque.indexOf('await storyRig(');
  assert.ok(open > 0 && open < build, 'the intro dialog opens before the rig is built');
  assert.ok(/requestAnimationFrame\(\(\) => \{\s*raf = requestAnimationFrame/.test(plaque.slice(open, build)), 'two painted frames before the build');
  assert.ok(plaque.indexOf("tip.current.style.visibility = ''") > build, 'the hint appears once the rig is ready');
  const hold = plaque.indexOf('for (let i = 0; i < 3; i++)');
  assert.ok(hold > 0 && hold < plaque.indexOf('card.classList.add(s.awRise!)') && hold < plaque.indexOf('fly.animate('), 'the stage holds 3 frames before the rise and the flight');
  const vid = stripComments(readFileSync(join(DIR, 'story-video-impl.tsx'), 'utf8'));
  assert.doesNotMatch(vid, /scale:/, 'the story video stays full 1080×1920');
});

test('15 · v51 confetti meets the plaque: a third bounce, a third rest, the rest fall past; a resting piece lets go', async () => {
  const { ledgeDecide, ledgeRest } = await import('./confetti');
  type Piece = import('./confetti').Piece;
  const mk = (): Piece => ({ x: 100, y: 205, vx: 1, vy: 4, delay: 0, w: 8, h: 14, rot: 3.3, vr: 0.2, flip: 1, vf: 0.2, gold: true, strip: false, sway: 0, sw: 0.05, amp: 1, rain: true });
  const L = { y: 200, l: 0, r: 300 };
  const mid = (a: number, b: number) => (a + b) / 2;
  const b = mk();
  assert.equal(ledgeDecide(b, 195, L, 0, 0.1, 1, mid), 'bounce');
  assert.equal(b.y, 199);
  assert.ok(b.vy < 0, 'bounces up');
  assert.equal(b.vr, -0.2 * 1.4);
  assert.equal(ledgeDecide(b, 195, L, 0, 0.1, 1, mid), null, 'decides once per ledge');
  assert.equal(b.done, 1);
  const r = mk();
  assert.equal(ledgeDecide(r, 195, L, 1, 0.5, 1, mid), 'rest');
  assert.deepEqual([r.vx, r.vy, r.y, r.lg, r.st, r.done], [0, 0, 200, 1, 1600, 2]);
  assert.ok(Math.abs(r.r0! - (Math.PI + 0)) < 1e-9, 'settles flat (nearest half-turn)');
  assert.equal(ledgeDecide(mk(), 195, L, 0, 0.9, 1, mid), 'past');
  assert.equal(ledgeDecide(mk(), 206, L, 0, 0.1, 1, mid), null, 'already below: no crossing');
  assert.equal(ledgeDecide({ ...mk(), x: 1 }, 195, L, 0, 0.1, 1, mid), null, 'off the ledge end');
  assert.equal(ledgeDecide({ ...mk(), vy: -2 }, 195, L, 0, 0.1, 1, mid), null, 'rising pieces pass up through');
  // resting: it sits on the ledge's top, then lets go when its time is up, its ledge is gone, or it slides off
  assert.equal(ledgeRest(r, L, 1, 1, mid), false);
  assert.equal(r.y, 200 - 14 * 0.18);
  r.st = 10;
  assert.equal(ledgeRest(r, L, 1, 1, mid), true, 'time is up');
  assert.deepEqual([r.st, r.vy], [0, 0.6]);
  const g = mk();
  ledgeDecide(g, 195, L, 0, 0.5, 1, mid);
  assert.equal(ledgeRest(g, undefined, 1, 1, mid), true, 'its ledge is gone');
  const sl = mk();
  ledgeDecide(sl, 195, L, 0, 0.5, 1, mid);
  sl.x = 305;
  assert.equal(ledgeRest(sl, L, 1, 1, mid), true, 'slid off the end');
  const cf = stripComments(readFileSync(join(DIR, 'confetti.ts'), 'utf8'));
  assert.match(cf, /p\.done = 0;/, 'the bitmask resets when a piece re-enters at the top');
  assert.match(cf, /now - lgAt < 250/, 'ledges re-measured every 250 ms');
});

test('5 · the full-screen badge names the shop, the GIVEN tier, and signs with the hallmark', async () => {
  const { BadgeFullscreen } = await import('./badge-fullscreen');
  const art = h('svg', { viewBox: '0 0 100 100' }, h('circle', { cx: 50, cy: 50, r: 40 }));
  const base = { art, tier: { index: 5, name: 'Zircon' }, title: 'Completed bookings', shopName: 'Petal & Pine', awardedOn: '12 Jan 2026', onClose: () => {} };
  const m = renderToStaticMarkup(h(BadgeFullscreen, base));
  assert.match(m, /^<dialog/);
  assert.ok(m.includes('<em>Awarded to</em><b>Petal &amp; Pine</b>'));
  assert.ok(m.includes('Zircon · Completed bookings · Awarded 12 Jan 2026'), 'the tier name is the one passed in');
  assert.ok(m.includes('SETNAYAN') && m.includes('An exclusive Setnayan badge'));
  assert.ok(m.includes('aria-label="Close"'));
  assert.ok(!m.includes('Share to story'), 'no share without onShare');
  const withShare = renderToStaticMarkup(h(BadgeFullscreen, { ...base, onShare: () => {} }));
  const cap = withShare.indexOf('Share to story');
  assert.ok(cap > 0 && cap < withShare.indexOf('An exclusive Setnayan badge'), 'share lives in the caption, above the hallmark');
  for (const name of ['Platinum', 'Ruby', 'Emerald', 'Diamond']) assert.ok(!m.includes(name), `no hard-coded tier name ${name}`);
  const src = stripComments(readFileSync(join(DIR, 'badge-fullscreen.tsx'), 'utf8'));
  for (const name of ['Bronze', 'Silver', 'Gold', 'Ruby', 'Emerald', 'Diamond', 'Platinum']) assert.ok(!src.includes(`'${name}'`), name);
});

test('6 · the plaque: "Awarded on {date}", the engraved mark, the glass share UNDER it', async () => {
  const { SealPlaque } = await import('./seal-plaque');
  const seal = h('svg', { viewBox: '0 0 100 100' }, h('circle', { cx: 50, cy: 50, r: 40 }));
  const m = renderToStaticMarkup(
    h(SealPlaque, {
      seal,
      eyebrow: 'Setnayan',
      title: 'Setnayan Verified',
      shopName: 'Petal & Pine',
      awardedOn: '12 Jan 2026',
      how: ['Owner identity checked'],
      record: [['Checked', 'by Setnayan']],
      onShare: () => {},
      onClose: () => {},
    }),
  );
  assert.ok(m.includes('Awarded on 12 Jan 2026'));
  assert.ok(m.includes('data-k="gold"'), 'every seal gets the gold plaque by default (diamonds are No. 1 only)');
  const css0 = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  assert.match(css0, /\.awDlg:not\(\[data-k='no1'\]\) \.awSt \{/, 'gold studs off the No. 1 plaque');
  assert.ok(m.includes('Awarded to Petal &amp; Pine'));
  assert.ok(m.includes('AN EXCLUSIVE SETNAYAN SEAL'));
  const card = m.indexOf('class="awCard"');
  const share = m.indexOf('Share to story');
  assert.ok(card > 0 && share > m.indexOf('AN EXCLUSIVE SETNAYAN SEAL'), 'share comes after the whole plaque');
  assert.ok(m.includes('class="awShare"'), 'the glass share');
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  const shareRule = /\.awShare \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(shareRule, /background: rgba\(255, 255, 255, 0\.14\)/, 'plain glass');
  assert.doesNotMatch(shareRule, /gradient|#c24e25/i, 'never colourful');
  assert.doesNotMatch(css, /\bzoom\s*:/, 'transform scale, never zoom');
  const rig = stripComments(readFileSync(join(DIR, 'story-rig.ts'), 'utf8'));
  assert.doesNotMatch(rig, /neck/, 'no necklace ribbon');
});

test('7 · the recorder tries mp4 avc1 → mp4 → webm, else a picture; plaque slots stay off the story', async () => {
  const { pickStoryMime, STORY_MIME_ORDER, stripSlot, STORY_S, STORY_W, STORY_H } = await import('./story-rig');
  assert.deepEqual([...STORY_MIME_ORDER], ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']);
  assert.equal(pickStoryMime(() => true), 'video/mp4;codecs=avc1.42E01E');
  assert.equal(pickStoryMime((m) => m.startsWith('video/webm')), 'video/webm;codecs=vp9');
  assert.equal(pickStoryMime(() => false), null);
  assert.equal(pickStoryMime(null), null);
  assert.equal(STORY_S, 10);
  assert.deepEqual([STORY_W, STORY_H], [1080, 1920]);
  const sv = '<svg><g class="a"/><g class="sl-slot"><g><path/></g><rect/></g><circle/></svg>';
  assert.equal(stripSlot(sv), '<svg><g class="a"/><circle/></svg>');
  assert.equal(stripSlot('<svg/>'), '<svg/>');
});

test('11 · v46 the No. 1 reveal: confetti is No. 1 only and never stops; 15 s reveal vs 10 s; no blur on the sheen', async () => {
  const { REVEAL_S, STORY_S, INTRO_END } = await import('./story-rig');
  assert.equal(REVEAL_S, 15);
  assert.equal(STORY_S, 10);
  assert.equal(INTRO_END, 4.6);
  const rig = stripComments(readFileSync(join(DIR, 'story-rig.ts'), 'utf8'));
  assert.match(rig, /dur: REV \? REVEAL_S : STORY_S/, 'rig.dur is 15 with the reveal, else 10');
  assert.match(rig, /'SUPPLIER OF THE YEAR'/, 'the teaser line');
  const plaque = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  assert.match(plaque, /variant !== 'no1'\) return;/, 'confetti is gated to No. 1');
  assert.match(plaque, /reveal: variant === 'no1'/, 'only No. 1 opens on the reveal');
  assert.match(plaque, /const END = rig\.dur === REVEAL_S \? REVEAL_S : INTRO_END/);
  const vid = stripComments(readFileSync(join(DIR, 'story-video-impl.tsx'), 'utf8'));
  assert.match(vid, /reveal\?: boolean/);
  assert.match(vid, /durationS\?: number/);
  assert.doesNotMatch(vid, /STORY_S/, 'the recorder uses rig.dur, not a fixed 10 s');
  const cf = stripComments(readFileSync(join(DIR, 'confetti.ts'), 'utf8'));
  const { CONFETTI_PIECES } = await import('./confetti');
  assert.equal(CONFETTI_PIECES, 110);
  const { CONFETTI_RAIN } = await import('./confetti');
  assert.equal(CONFETTI_RAIN, 120, 'v48: the plaque rain set');
  assert.match(cf, /p\.rain \? -rnd\(10, 40\) \* dpr : -rnd\(20, H\)/, 'v48: rain re-enters at the top, burst across one screen');
  assert.match(rig, /length: 140|k < 140/, 'v48: the video rain set');
  assert.match(rig, /'700 124px Georgia,serif'/, 'v48: the larger outlined words');
  assert.match(rig, /strokeText/);
  // v47: the curtains are simulated cloth on a fixed step
  assert.match(rig, /const CC = 22;[\s\S]*const CR = 24;[\s\S]*const G = 2600;[\s\S]*const SUB = 1 \/ 120;/);
  assert.match(rig, /function simTo\(/);
  assert.match(cf, /Math\.min\(1\.5,/, 'dpr ≤ 1.5');
  assert.doesNotMatch(cf, /globalAlpha|save\(\)|restore\(\)/, 'no fade, setTransform only');
  assert.match(cf, /p\.y > H \+ 30/, 'pieces come back from the top');
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  const shB = /\.awShB \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.doesNotMatch(shB, /filter/, 'the second sheen has no blur');
  assert.match(shB, /opacity: 0\.6/);
});

const KIT = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'));

test('8 · zero server cost: nothing in the kit fetches, writes, or reaches the server', () => {
  assert.ok(KIT.length >= 9);
  for (const f of KIT) {
    const src = stripComments(readFileSync(join(DIR, f), 'utf8'));
    assert.doesNotMatch(src, /\bfetch\s*\(/, `${f} fetches`);
    assert.doesNotMatch(src, /XMLHttpRequest|sendBeacon|supabase|['"]use server['"]|server-only|\/api\//, `${f} reaches the server`);
    if (f.endsWith('.tsx')) assert.match(readFileSync(join(DIR, f), 'utf8'), /^'use client';/, `${f} is a client component`);
  }
});

test('9 · the recorder is lazy: only its door names it, and only by import()', () => {
  for (const f of KIT) {
    const src = stripComments(readFileSync(join(DIR, f), 'utf8'));
    const staticImports = [...src.matchAll(/^import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].filter((m) => !/^import\s+type\s/.test(m[0])).map((m) => m[1]);
    if (f !== 'story-video-impl.tsx') {
      assert.ok(!staticImports.includes('./story-rig'), `${f} statically imports the story scene`);
    }
    assert.ok(!staticImports.includes('./story-video-impl'), `${f} statically imports the recorder`);
  }
  const door = stripComments(readFileSync(join(DIR, 'story-video.tsx'), 'utf8'));
  assert.match(door, /lazy\(\(\) => import\(\s*(?:\/\*.*?\*\/\s*)?'\.\/story-video-impl'\)/);
});

test('10 · the No. 1 seal option draws, carries the year it is given, and stays out of the wiring', async () => {
  const { no1Seal, no1SealSvg } = await import('./no1-seal-svg');
  const svg = no1Seal(2027);
  assert.match(svg, /viewBox="14 0 272 296"/);
  assert.match(no1Seal(2027, 'arch'), /viewBox="17 0 266 296" width="372" height="414"/);
  assert.ok(svg.includes('OF THE YEAR · 2027') && !svg.includes('2026'));
  assert.ok(svg.includes('>SETNAYAN</textPath>'));
  assert.ok(!no1SealSvg({ anim: false, year: 2027 }).includes('<animate'), 'still art without anim');
  assert.ok(no1SealSvg({ anim: true, year: 2027 }).includes('<animate'));
  // an option only: nothing outside the kit may offer it until the owner rules what earns it
  const { execFileSync } = await import('node:child_process');
  const WEB = join(DIR, '..', '..', '..');
  const hits = execFileSync('git', ['ls-files', '--', 'app', 'lib'], { cwd: WEB, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/_components/award/'))
    .filter((f) => /no1-seal-svg|no1Seal/.test(stripComments(readFileSync(join(WEB, f), 'utf8'))));
  assert.deepEqual(hits, []);
});
