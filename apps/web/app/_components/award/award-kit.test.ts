/**
 * 🏅 THE SHARED AWARD UI KIT, HELD ON ITS REAL MARKUP (controller build map 2026-11-15, slice K; approved prototype
 * `Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v35.html`).
 *
 *   1 · the reward ticket prints every kind of the owner's ladder, with no rainbow on any (v86);
 *   2 · the ticket is auto-claimed (never pressable) and says v86's copy verbatim; the frame-metal gap is off;
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

test('1 · every ticket kind prints — and NO RAINBOW on any ticket (owner 15 Nov: "no rainbow design on the tickets")', async () => {
  const { TICKET_SPECS, ticketSvg, ticketDataUri } = await import('./ticket-svg');
  assert.deepEqual(Object.keys(TICKET_SPECS).sort(), ['eplus', 'epro', 'eultra', 'papic1000', 'papic150', 'papic3000']);
  for (const [k, spec] of Object.entries(TICKET_SPECS)) {
    const svg = ticketSvg(k, spec);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.includes(`>${spec.n}</text>`), `${k} prints its number`);
    assert.ok(svg.includes(`SETNAYAN · ${spec.w}`), `${k} prints its word`);
    assert.ok(svg.includes('>REWARD</text>'), `${k} has the stub's REWARD`);
    assert.ok(svg.includes('feTurbulence'), `${k} has the paper grain`);
    // the holo strip was a rainbow gradient (#ff7ad9 → … ) on a 16-wide band: neither may appear on any plan
    assert.ok(!/width="16" height="150"/.test(svg), `${k}: no holographic strip`);
    assert.ok(!/#ff7ad9|#7affc4|#c77aff/i.test(svg), `${k}: no rainbow stop`);
    assert.ok(!('holo' in spec), `${k}: the spec carries no holo flag`);
    assert.ok(ticketDataUri(k, spec).startsWith('data:image/svg+xml'));
    assert.equal(ticketDataUri(k, spec), ticketDataUri(k, spec), 'drawn once per kind');
  }
  const src = stripComments(readFileSync(join(DIR, 'ticket-svg.ts'), 'utf8'));
  assert.ok(!/holo/i.test(src), 'no holo path left in the ticket drawing');
});

test('2 · auto-claimed: the ticket is never a button; v86 copy verbatim; the frame metal matches the tier', async () => {
  const { RewardTicket, TICKET_COPY } = await import('./reward-ticket');
  assert.equal(TICKET_COPY.locked, 'Reward · gift for a customer');
  assert.equal(TICKET_COPY.new, '✓ New · in your gifts');
  assert.equal(TICKET_COPY.inGifts, '✓ In your gifts');
  const locked = renderToStaticMarkup(h(RewardTicket, { kind: 'epro', label: 'Event Pro', state: 'locked', tier: 1 }));
  const fresh = renderToStaticMarkup(h(RewardTicket, { kind: 'papic150', label: 'Papic 150', state: 'new', tier: 1 }));
  const held = renderToStaticMarkup(h(RewardTicket, { kind: 'eultra', label: 'Event Ultra', state: 'in_gifts', tier: 1 }));
  assert.ok(locked.includes('Reward · gift for a customer'));
  assert.ok(fresh.includes('✓ New · in your gifts'));
  assert.ok(held.includes('✓ In your gifts'));
  for (const m of [locked, fresh, held]) {
    assert.ok(!m.includes('<button') && !/tap to claim/i.test(m) && !m.includes('role="button"'), 'nothing to tap: rewards claim themselves');
  }
  const src = stripComments(readFileSync(join(DIR, 'reward-ticket.tsx'), 'utf8'));
  assert.ok(!/onClaim|Tap to claim/.test(src), 'no claim path left in the ticket');
  // ✅ RULED 15 Nov (item 7): the frame metal matches the tier, Bronze → Black Diamond — seven metals, all different
  const { TIER_RIMS, rimForTier, ticketSvg, TICKET_SPECS } = await import('./ticket-svg');
  assert.deepEqual([...TIER_RIMS], ['bronze', 'silver', 'gold', 'plat', 'diamond', 'ruby', 'black']);
  assert.equal(rimForTier(0), 'bronze', 'below the ladder clamps to Bronze');
  assert.equal(rimForTier(9), 'black', 'above the ladder clamps to Black Diamond');
  const frames = TIER_RIMS.map((rim) => ticketSvg('t', { ...TICKET_SPECS.epro, rim }));
  assert.equal(new Set(frames).size, 7, 'each tier draws its own frame');
  const at = (tier: number) => renderToStaticMarkup(h(RewardTicket, { kind: 'epro', label: 'Event Pro', state: 'in_gifts', tier }));
  assert.notEqual(at(1), at(7), 'the same reward at Bronze and at Black Diamond wears a different frame');
  assert.equal(at(3), at(3));
  assert.ok(!/frameMetal/.test(stripComments(readFileSync(join(DIR, 'reward-ticket.tsx'), 'utf8'))), 'no unruled frame gap left');
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
  const proto = join(homedir(), 'Documents/Claude/Projects/Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v53.html');
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

test('16 · v53 one scene: the bare set stays UNDER the No. 1 plaque; the curtains leave over it', () => {
  const rig = stripComments(readFileSync(join(DIR, 'story-rig.ts'), 'utf8'));
  const b = rig.slice(rig.indexOf('function base('), rig.indexOf("fadeText('AWARDED TO'"));
  assert.match(b, /if \(ONLYSET\) return;\s*$/, 'the bare set stops right before the words');
  assert.match(rig, /ONLYSET = true;\s*base\(DUR - B0\);\s*ONLYSET = false;/, 'prep builds the bare set');
  const ex = rig.slice(rig.indexOf('rig.exit = '), rig.indexOf('rig.words = '));
  assert.doesNotMatch(ex, /SNAP/, 'the exit layer draws only the curtains and valance');
  assert.match(rig, /rig\.words = \(g, a\) => \{\s*if \(rig\.set\) g\.drawImage\(rig\.set, 0, 0, W, H\);/);
  const plaque = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  assert.match(plaque, /d\.insertBefore\(layer, d\.firstChild\);\s*d\.insertBefore\(st, d\.firstChild\);/, 'the set is the dialog\'s first child, under the plaque and the curtains layer');
  assert.match(plaque, /drawSet\(0\);\s*layer\.remove\(\);/, 'the set stays (words gone) when the curtains layer goes');
  assert.match(plaque, /st\.remove\(\);\s*d\.classList\.remove\(s\.staged!\);/, 'removed on close');
  assert.doesNotMatch(plaque, /g\.fillRect\(0, 0, OW, T\)/, 'no letter-box bars on the curtains layer any more');
  const hold = plaque.slice(plaque.indexOf("card.style.opacity = '0'"), plaque.indexOf("card.style.opacity = ''"));
  assert.match(hold, /for \(let i = 0; i < 3; i\+\+\)/, 'the card is unseen during the 3-frame hold');
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  const set = css.slice(css.indexOf('.sinSet {'), css.indexOf('}', css.indexOf('.sinSet {')));
  assert.ok(set.length > 0 && !/z-index/.test(set), 'the set layer has no z-index');
  assert.match(css, /\.awDlg\.staged::backdrop \{\s*background: #000;\s*backdrop-filter: none;/, 'a black backdrop, never the blurred app page');
  assert.match(css, /\.awDlg\.staged \.awShare \{\s*animation: awInShare 0\.5s 0\.75s/, 'the share button follows the plaque up');
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

test('11 · the No. 1 reveal: confetti is No. 1 only (v46) and ENDS when the seal lands (v86); 15 s reveal vs 10 s; no blur on the sheen', async () => {
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

test('10 · v86 No. 1 IS the Top 10 medal reading #1 RANK — Cinzel outlines, 34 diamonds, its year, its own ids', async () => {
  const { no1Seal, no1SealSvg } = await import('./no1-seal-svg');
  const card = no1Seal(2027);
  assert.match(card, /viewBox="-10\.25 0 320 304" width="200" height="190"/, 'the medal frame, centred (v86 DY 14)');
  assert.match(no1Seal(2027, 'arch'), /viewBox="-10\.25 0 320 304" width="372" height="354"/, 'fills the No. 1 niche');
  // the #1 is v86's own Cinzel Bold outline, and NOTHING is <text> (a picture cannot use the page's Cinzel → Georgia)
  assert.ok(card.includes('<path d="M40.85 46.8H42.56L38.38 70.6H36.67Z'), 'the #1 outline');
  assert.doesNotMatch(card, /<text\b|<textPath\b|Georgia/, 'no <text> anywhere: SETNAYAN, RANK and the year are outlines too');
  assert.ok(!card.includes('TOP 10') && !card.includes('SUPPLIER'), 'the medal reads #1 RANK, not TOP 10 SUPPLIER');
  assert.equal((card.match(/class="dmd"/g) || []).length, 34, '34 brilliant-cut diamonds round the rim');
  // the year it is given, on the ribbon, riding the 2.4× flow (a different year draws different digits)
  assert.notEqual(no1Seal(2027), no1Seal(2031));
  const yr = (y: string) => (no1Seal(y).match(/type="translate" values="[^"]*" keyTimes="0;\.34;\.68;1" dur="7\.4s"/g) || []).length;
  assert.equal(yr('2027') - yr(''), 4, 'one riding outline per digit of the year');
  // v86 ribbon movement 2.4× (95.9 → 96.45 becomes 95.9 → 97.22) and the swaying laurel
  assert.ok(card.includes('M12,97.22 C37.33,90.22 62.67,93.34 88,94.82'), 'the year ribbon flows 2.4× further');
  assert.ok(card.includes('type="rotate" values="0 40.93 111.29;-2.6 40.93 111.29;0.9 40.93 111.29;0 40.93 111.29"'), 'the wreath sways');
  // every def id is this copy's own: two copies on one screen share none
  const ids = (sv: string) => [...sv.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  const A = ids(no1Seal(2027, 'arch', 'pa_'));
  const B = ids(no1Seal(2027, 'arch', 'pb_'));
  assert.ok(A.length > 20 && A.every((i) => i.startsWith('pa_')) && B.every((i) => i.startsWith('pb_')));
  assert.equal(A.filter((i) => B.includes(i)).length, 0);
  assert.ok(!no1Seal(2027).includes('§') && !no1Seal(2027).includes('{{YEAR}}'));
  assert.ok(!no1SealSvg({ anim: false, year: 2027 }).includes('<animate'), 'still art without anim');
  // the trophy drawing is NOT built
  for (const f of KIT) assert.doesNotMatch(stripComments(readFileSync(join(DIR, f), 'utf8')), /trophySvg|awTro\b/, `${f}: no trophy`);
  // an option only: nothing outside the kit may name its art until the owner rules what earns it
  const { execFileSync } = await import('node:child_process');
  const WEB = join(DIR, '..', '..', '..');
  const hits = execFileSync('git', ['ls-files', '--', 'app', 'lib'], { cwd: WEB, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/_components/award/'))
    .filter((f) => /no1-seal-svg|no1-rank-art|no1Seal\b/.test(stripComments(readFileSync(join(WEB, f), 'utf8'))));
  assert.deepEqual(hits, []);
});

/* ── v86 · J1: the one ✕, the days line, Verified, the locked look ─────────────────────────────────── */

test('17 · ONE ✕ for every full screen: only award-close draws it; top LEFT, 44px, dark glass, ivory ring', () => {
  const draws = KIT.filter((f) => /from 'lucide-react'/.test(readFileSync(join(DIR, f), 'utf8')) && /\bX\b[,} ]/.test(readFileSync(join(DIR, f), 'utf8').match(/import \{([^}]*)\} from 'lucide-react'/)?.[1] ?? ''));
  // A POP-UP is not a full screen: v86's rules pop-up (#cbDlg .vrp) draws its own small ✕ top right, like the Verified
  // pop-up it copies. The one-✕ ruling is for full screens; this is the only pop-up in the kit, named so a second is seen.
  const POPUPS = ['card-badge-rules.tsx'];
  assert.deepEqual(draws.filter((f) => !POPUPS.includes(f)), ['award-close.tsx'], 'no full screen imports its own ✕');
  assert.match(stripComments(readFileSync(join(DIR, 'card-badge-congrats.tsx'), 'utf8')), /<AwardClose\b/, 'the card congratulations full screen uses the shared ✕');
  for (const f of ['badge-fullscreen.tsx', 'seal-plaque.tsx', 'verified-fullscreen.tsx']) {
    assert.match(stripComments(readFileSync(join(DIR, f), 'utf8')), /<AwardClose\b/, `${f} uses the shared ✕`);
  }
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  const block = css.slice(css.indexOf('.xClose {'), css.indexOf('}', css.indexOf('.xClose {')));
  for (const rule of ['left: max(12px, env(safe-area-inset-left))', 'width: 44px', 'height: 44px', 'border-radius: 50%', 'rgba(20, 14, 8, 0.55)', '1px solid rgba(255, 240, 215, 0.35)']) {
    assert.ok(block.includes(rule), `the ✕ keeps "${rule}"`);
  }
  assert.ok(!/\.(bzX|awX)\b/.test(css), 'no second ✕ style left');
});

test('18 · the days line is for TIERED badges only — never on a seal plaque or Setnayan Verified', async () => {
  const { achievedAfterLine } = await import('./award-copy');
  assert.equal(achievedAfterLine(1), 'You achieved this after 1 day');
  assert.equal(achievedAfterLine(1234), 'You achieved this after 1,234 days');
  assert.equal(achievedAfterLine(undefined), '', 'unknown is said as nothing, never 0');
  for (const f of ['seal-plaque.tsx', 'verified-fullscreen.tsx', 'award-copy.ts']) {
    const src = stripComments(readFileSync(join(DIR, f), 'utf8'));
    if (f === 'award-copy.ts') continue;
    assert.ok(!/achievedAfter|You achieved this/.test(src), `${f} carries no days line`);
  }
  assert.match(stripComments(readFileSync(join(DIR, 'badge-fullscreen.tsx'), 'utf8')), /achievedAfterLine\(achievedAfterDays\)/);
});

test('19 · Setnayan Verified: its own navy screen, v86 words verbatim, no plaque, no days line', async () => {
  const { VERIFIED_COPY } = await import('./verified-fullscreen');
  assert.equal(VERIFIED_COPY.to, 'AWARDED TO');
  assert.equal(VERIFIED_COPY.exclusive, 'AN EXCLUSIVE SETNAYAN SEAL');
  assert.equal(VERIFIED_COPY.tap, 'Tap anywhere to close');
  const src = stripComments(readFileSync(join(DIR, 'verified-fullscreen.tsx'), 'utf8'));
  assert.ok(!/awCard|SealPlaque|plaque/i.test(src.replace(/NO PLAQUE/g, '')), 'no plaque on Verified');
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  assert.ok(css.includes('radial-gradient(120% 72% at 50% 36%, #1c2d57 0, #0b1124 52%, #04060e 100%)'), 'the navy stage');
});

test('20 · the locked look: grey art under a lock, the group, the name, what it takes — v86 words', async () => {
  const { LockedTile, LOCKED_HOW, bronzeAtLine } = await import('./locked-tile');
  assert.equal(LOCKED_HOW.shield, 'Bronze when 1 supplier recommends you');
  assert.equal(bronzeAtLine('Bronze', 5, 'bookings'), 'Bronze at 5 bookings');
  const m = renderToStaticMarkup(h(LockedTile, { art: h('svg'), group: 'Seal', name: 'Top 10 Supplier', how: 'Top 10 of the year' }));
  assert.ok(m.includes('aria-label="Top 10 Supplier, locked. Top 10 of the year"'));
  assert.ok(m.includes('>Seal<') && m.includes('<b>Top 10 Supplier</b>'));
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  assert.ok(css.includes('filter: grayscale(1) contrast(0.75) brightness(1.08)'), 'the art is greyed');
});

/* ── v86 · the seals: No. 1's #1 RANK medal, the gold-ray stage, matte velvet, the smooth landing, the named gaps ── */

test('21 · confetti is No. 1 ONLY, and it ENDS when the seal lands (v86 awConfettiEnd supersedes "never stops")', () => {
  const plaque = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  // the only door to the confetti refuses every seal but No. 1
  const door = plaque.slice(plaque.indexOf('const confetti = ('), plaque.indexOf('const endConfetti = '));
  assert.match(door, /if \(!c \|\| dead \|\| variant !== 'no1'\) return;/);
  assert.match(door, /import\(\s*(?:\/\*.*?\*\/\s*)?'\.\/confetti'\)/, 'confetti only by import()');
  // it is started in exactly two places: the No. 1 hand-over, and the Reduce-Motion burst that ends at once
  const calls = [...plaque.matchAll(/(?<![.\w])confetti\(/g)].length;
  assert.equal(calls, 2, 'confetti() is called twice: the reveal hand-over and the reduced-motion burst');
  assert.match(plaque, /confetti\(\);\s*endConfetti\(\);/, 'without the show the burst ends at once (the seal is already home)');
  // the gold seals' landing starts NO confetti
  const goldLand = plaque.slice(plaque.indexOf('rig.hide = true;'), plaque.indexOf('} catch {', plaque.indexOf('rig.hide = true;')));
  assert.ok(goldLand.length > 0 && !/\bconfetti\(/.test(goldLand), 'no confetti on Top 10, Clients’ Choice, Most In-Demand or Verified Partner');
  // the end is wired to the landing: right after the flight finishes and the flyer is removed
  const rev = plaque.slice(plaque.indexOf('const an = fly.animate(arcFrames(0, po.fy * k'), plaque.indexOf('rig.hide = true;'));
  assert.match(rev, /await an\.finished[\s\S]*?fly\.remove\(\);\s*endConfetti\(\);/, 'the seal lands → the confetti ends');
  assert.match(plaque, /const endConfetti = \(\) => \{\s*cfEnd = true;\s*cfH\?\.end\(\);/);
  assert.match(plaque, /if \(cfEnd\) cfH\.end\(\);/, 'an end asked for before the chunk arrived still lands');
  // and the confetti honours it: nothing new falls, the last pieces finish, then it stops by itself
  const cf = stripComments(readFileSync(join(DIR, 'confetti.ts'), 'utf8'));
  assert.match(cf, /if \(ended && p\.rain && p\.y < -4\) \{\s*p\.gone = true;/, 'rain still above the top is dropped');
  assert.match(cf, /if \(p\.y > H \+ 30 && ended\) \{\s*p\.gone = true;/, 'a fallen piece does not come back once ended');
  assert.match(cf, /if \(ended && !live\) return clear\(\);/, 'when nothing is left, the loop stops');
  assert.match(cf, /end: \(\) => \{\s*ended = true;/);
});

test('22 · the four other seals stand on the gold-ray stage — rays and lines turning, motes drifting, NO glow', async () => {
  const { SealPlaque } = await import('./seal-plaque');
  const seal = h('svg', { viewBox: '0 0 100 100' }, h('circle', { cx: 50, cy: 50, r: 40 }));
  const base = { seal, title: 'Top 10 Supplier', shopName: 'Petal & Pine', onClose: () => {} };
  const gold = renderToStaticMarkup(h(SealPlaque, base));
  assert.ok(gold.includes('data-award-stage="rays"') && gold.includes('data-award-stage="lines"') && gold.includes('data-award-stage="motes"'));
  assert.equal((gold.match(/class="awMo"/g) || []).length, 16, 'v86 sixteen gold motes');
  assert.doesNotMatch(gold, /glow|halo/i, 'no glow element behind the plaque');
  const no1 = renderToStaticMarkup(h(SealPlaque, { ...base, variant: 'no1' }));
  assert.ok(!no1.includes('data-award-stage'), 'No. 1 keeps its curtain stage, not the rays');
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  const block = (sel: string) => css.slice(css.indexOf(`${sel} {`), css.indexOf('}', css.indexOf(`${sel} {`)));
  const sky = block('.awSky');
  assert.match(sky, /background: repeating-conic-gradient\(from 0deg, rgba\(242, 198, 96, 0\.17\) 0 5deg/, 'broad gold rays');
  assert.match(sky, /animation: awSky 90s linear infinite/);
  assert.doesNotMatch(sky.replace(/mask: radial-gradient\([^;]*;/g, ''), /radial-gradient/, 'the rays carry no glow of their own');
  assert.match(block('.awSky2'), /animation-direction: reverse/, 'fine lines turning the other way');
  // transform-only motion
  const kf = (n: string) => css.slice(css.indexOf(`@keyframes ${n} {`), css.indexOf('}\n}', css.indexOf(`@keyframes ${n} {`)));
  assert.doesNotMatch(kf('awSky').replace(/transform:[^;]*;/g, ''), /:\s/, 'the rays move by transform only');
  assert.doesNotMatch(kf('awMoDrift').replace(/transform:[^;]*;|opacity:[^;]*;/g, ''), /:\s/, 'the motes by transform + opacity');
  assert.match(css, /\.awDlg\[data-k='no1'\] \.awSky,\s*\.awDlg\[data-k='no1'\] \.awMos \{\s*display: none;/);
  assert.match(block('.awDlg::backdrop'), /radial-gradient\(85% 60% at 50% 40%, #3a2a10, #1a1208 45%, #080604 75%, #000\)/, 'the warm black stage');
});

test('23 · the velvet is MATTE: no pink crushed sheen, no highlight, no edge glow — niche, curtains and valance', () => {
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  const v41 = css.slice(css.indexOf('v41: the red velvet niche'), css.indexOf('No. 1 fills the arch'));
  assert.ok(v41.length > 0);
  assert.doesNotMatch(v41, /255, 90, 110|255, 120, 140|baseFrequency='\.012 \.03'/, 'no pink sheen, highlight or crushed layer on the niche');
  assert.match(v41, /\.awSeal::before \{\s*opacity: 0;\s*background: none;/, 'no edge glow');
  assert.match(v41, /#a3102b, #7a0920 45%, #4a0414 78%, #2a020b/, 'the deep crimson stays');
  assert.match(v41, /baseFrequency='\.85'/, 'the pile grain stays');
  const rig = stripComments(readFileSync(join(DIR, 'story-rig.ts'), 'utf8'));
  const curtain = rig.slice(rig.indexOf('function drawCurtain('), rig.indexOf('// v49 (owner 15 Nov: "The upper curtain'));
  assert.ok(curtain.length > 1000);
  assert.doesNotMatch(curtain, /\brim\b/, 'the curtains have no rim sheen');
  assert.match(curtain, /const sh = \(0\.3 \+ 0\.72 \* dif\) \* spot;/, 'lit softly');
  assert.match(curtain, /velvetOver\(mx - cu\.vx0\)/, 'the pile grain rides the cloth');
  const val = rig.slice(rig.indexOf('function drawValance('), rig.indexOf('// the gold band, riding the cloth'));
  assert.ok(val.length > 1000);
  assert.doesNotMatch(val, /\brm\b|Math\.pow\(1 - nz/, 'the valance has no rim sheen');
  assert.match(val, /velvetOver\(0\);/);
  const tiles = rig.slice(rig.indexOf('function velvetTiles('), rig.indexOf('function velvetOver('));
  assert.doesNotMatch(tiles, /crush|140|153/, 'the crushed-sheen tile is not made at all');
});

test('24 · the No. 1 #1 is outlines; the named gaps (logo watermark, No. 1 gift) default OFF', async () => {
  const { SealPlaque } = await import('./seal-plaque');
  const seal = h('svg', { viewBox: '0 0 100 100' });
  const base = { seal, title: 'No. 1 Supplier of the Year', shopName: 'Petal & Pine', onClose: () => {} };
  const off = renderToStaticMarkup(h(SealPlaque, { ...base, variant: 'no1', shopLogoUrl: '/l.svg' }));
  assert.ok(!off.includes('data-award-watermark'), 'no watermark unless showLogoWatermark');
  assert.ok(!off.includes('data-award-no1-gift'), 'no gift unless one is handed in');
  const noUrl = renderToStaticMarkup(h(SealPlaque, { ...base, variant: 'no1', showLogoWatermark: true }));
  assert.ok(!noUrl.includes('data-award-watermark'), 'no logo, no watermark (nothing invented)');
  const on = renderToStaticMarkup(h(SealPlaque, { ...base, variant: 'no1', showLogoWatermark: true, shopLogoUrl: '/l.svg', no1Gift: h('b', null, 'G') }));
  assert.ok(on.includes('data-award-watermark') && on.includes('url(&quot;/l.svg&quot;)'), 'drawn when asked for');
  assert.ok(on.includes('data-award-no1-gift') && on.includes('<b>G</b>'));
  const gold = renderToStaticMarkup(h(SealPlaque, { ...base, showLogoWatermark: true, shopLogoUrl: '/l.svg', no1Gift: h('b', null, 'G') }));
  assert.ok(!gold.includes('data-award-watermark') && !gold.includes('data-award-no1-gift'), 'both are No. 1 only');
  const { logoWatermarkRings } = await import('./plaque-art');
  assert.equal((logoWatermarkRings().match(/<circle /g) || []).length, 2, 'v86 shopLogoWatermark: two gold rings');
  // seals never carry the days line (still): the plaque has no prop for it
  assert.doesNotMatch(stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8')), /achievedAfter|You achieved this/);
});

test('25 · art is lazy: the No. 1 art, the story rig and the confetti load only by import(), never in a first load', () => {
  for (const f of KIT) {
    const src = stripComments(readFileSync(join(DIR, f), 'utf8'));
    const statics = [...src.matchAll(/^import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].filter((m) => !/^import\s+type\s/.test(m[0])).map((m) => m[1]);
    if (f !== 'no1-seal-svg.ts') assert.ok(!statics.includes('./no1-rank-art'), `${f} statically imports the No. 1 art`);
    assert.ok(!statics.includes('./no1-seal-svg'), `${f} statically imports the No. 1 builder`);
    assert.ok(!statics.includes('./confetti'), `${f} statically imports the confetti`);
    assert.doesNotMatch(src, /export\s*\{[^}]*\}\s*from\s*'\.\/no1-seal-svg'/, `${f} re-exports the No. 1 builder`);
  }
  const plaque = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  assert.match(plaque, /await import\(\s*(?:\/\*.*?\*\/\s*)?'\.\/no1-seal-svg'\)/, 'the plaque fetches No. 1 on its tap');
  const door = stripComments(readFileSync(join(DIR, 'no1-seal.ts'), 'utf8'));
  assert.match(door, /import\(\s*(?:\/\*.*?\*\/\s*)?'\.\/no1-seal-svg'\)/);
});

test('26 · the landing is ONE smooth curve onto the seal AT REST; the niche breathes 4%, never jumps to 108%', async () => {
  const { arcFrames } = await import('./fit');
  const F = arcFrames(0, 12, 1, 0.02, 300, -200, 0.5);
  assert.equal(F.length, 29, 'sampled densely');
  assert.equal(F[0]!.transform, 'translate(0.00px,12.00px) scale(1.0000) rotate(0.0200rad)', 'starts on the staged medal');
  assert.match(String(F[28]!.transform), /^translate\(300\.00px,-200\.00px\) scale\(0\.5000\) rotate\(-?0\.0000rad\)$/, 'ends exactly on the mounted seal, upright');
  // no corner: every step's direction changes gently
  const pts = F.map((f) => /translate\(([-\d.]+)px,([-\d.]+)px\)/.exec(String(f.transform))!.slice(1).map(Number));
  for (let i = 2; i < pts.length; i++) {
    const a = Math.atan2(pts[i - 1]![1]! - pts[i - 2]![1]!, pts[i - 1]![0]! - pts[i - 2]![0]!);
    const b = Math.atan2(pts[i]![1]! - pts[i - 1]![1]!, pts[i]![0]! - pts[i - 1]![0]!);
    assert.ok(Math.abs(b - a) < 0.25, `no corner at frame ${i}`);
  }
  const plaque = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  assert.equal((plaque.match(/fly\.animate\(arcFrames\(/g) || []).length, 2, 'No. 1 and the gold seals both fly the arc');
  assert.doesNotMatch(plaque, /offset: 0\.6/, 'the old two-segment flight (a corner at 60%) is gone');
  // measured at rest: the plaque's rise is set aside before the target is read
  assert.match(plaque, /if \(card\) card\.style\.animation = 'none';\s*const tb = tgt\.getBoundingClientRect\(\);/);
  assert.match(plaque, /if \(cd\) cd\.style\.animation = 'none';\s*const tb = tgt\.getBoundingClientRect\(\);/);
  const css = readFileSync(join(DIR, 'award.module.css'), 'utf8');
  assert.match(css, /\.landed \.awSeal \{\s*animation: slBind/, 'every seal binds with the breath');
  assert.match(css, /32% \{\s*transform: scale\(1\.04\);/);
  assert.doesNotMatch(css, /scale\(1\.08\)/, 'never a jump to 108%');
});

test('27 · sparkles: nothing fixed on the seal or velvet; a glint lands on a random diamond / stud; copies own their ids', async () => {
  const plaque = stripComments(readFileSync(join(DIR, 'seal-plaque.tsx'), 'utf8'));
  assert.doesNotMatch(plaque, /\bSPARKS\b/, 'the fixed sparkles are gone');
  assert.match(plaque, /querySelectorAll\('\.dfl'\)\.forEach\(\(x\) => x\.remove\(\)\)/, 'the drawn diamond flares come off the mounted seal');
  assert.match(plaque, /const pts = glintSpots\(mnt\);/);
  assert.match(plaque, /glT = window\.setTimeout\(glint, 180 \+ Math\.random\(\) \* 700\);/, 'at random moments');
  assert.match(plaque, /if \(prefersReducedMotion\(\)\) return;/);
  const { prefixSvgIds, BEAD_RING_SELECTOR } = await import('./plaque-art');
  assert.equal(BEAD_RING_SELECTOR, 'circle[stroke-dasharray][stroke="#e8c66c"]', 'the stud ring the prototype names');
  assert.equal(
    prefixSvgIds('<svg><defs><linearGradient id="g"/></defs><path fill="url(#g)"/><use href="#g"/><path fill="url(#other)"/></svg>', 'p_'),
    '<svg><defs><linearGradient id="p_g"/></defs><path fill="url(#p_g)"/><use href="#p_g"/><path fill="url(#other)"/></svg>',
  );
  const { SealPlaque } = await import('./seal-plaque');
  const svg = '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><circle r="4" fill="url(#g)"/></svg>';
  const m = renderToStaticMarkup(h(SealPlaque, { seal: svg, title: 'Top 10 Supplier', shopName: 'S', onClose: () => {} }));
  assert.ok(!m.includes('id="g"') && /id="pq[a-zA-Z0-9]*_g"/.test(m), 'the plaque copy has its own ids');
});

test('28 · No. 1 keeps its curtain stage: the teaser sits on a black-satin ribbon that unrolls like a real scroll', () => {
  const rig = stripComments(readFileSync(join(DIR, 'story-rig.ts'), 'utf8'));
  assert.match(rig, /function teaserBanner\(g: Ctx\)/);
  assert.match(rig, /function ribbonFlow\(g: Ctx, src: HTMLCanvasElement, t: number, oy: number\)/);
  assert.match(rig, /const IN0 = 0\.85;\s*const IN1 = 2\.15;\s*const OUT0 = 3\.05;\s*const OUT1 = 3\.75;/, 'unrolls, holds, rolls back up');
  const tz = rig.slice(rig.indexOf('function teaserBitmap('), rig.indexOf('function frame('));
  assert.match(tz, /teaserBanner\(g\);/, 'the words sit on the banner');
  assert.doesNotMatch(tz, /createRadialGradient/, 'the dark pool is gone');
  for (const w of ["'AND THE', 790", "'No. 1', 925", "'SUPPLIER OF THE YEAR', 1015", "'IS…', 1088"]) assert.ok(tz.includes(w), w);
  const fr = rig.slice(rig.indexOf('function frame('), rig.indexOf('function frame(') + 3000);
  assert.match(fr, /if \(t > 0\.9 && t < 3\.75\) ribbonFlow\(x, teaserBitmap\(\), t, 380\);/);
  // the 15 s No. 1 video vs 10 s, looping on its 0.5 s dip to dark
  assert.match(rig, /export const REVEAL_S = 15;/);
  assert.match(rig, /export const LOOP_DIP_S = 0\.5;/);
});
