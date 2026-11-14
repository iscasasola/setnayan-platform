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
import { readFileSync, readdirSync } from 'node:fs';
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
