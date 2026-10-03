/**
 * ▶ EVERY LOGO PLAYS (owner 2026-09-29, pointing at the couple's mark drawn as
 * a still `<img src="data:image/svg+xml…">` on the RSVP card: *"can we also
 * animate this?"* → *"all logos should animate if animation is active"*).
 *
 * The rule: wherever the couple's logo is on a SCREEN, a saved logo that moves
 * (a layer with an In or a Drift) plays through THE one player
 * (`LayeredLogoPlayer`, via `CoupleLogo`) when the animation is on for the
 * event (owned, not "Use Static Image"). No motion, animation off, reduced
 * motion → the still, exactly as before. Prints, exports, the QR centre, icons
 * and emails stay still on purpose.
 *
 *   1 · the rule is one pure decision, and "moves" means what the player plays;
 *       every `<CoupleLogo` is handed it (`plays={coupleLogoPlays(svg, …)}`,
 *       the same svg), so `CoupleLogo` itself never imports `logo-layers`;
 *   2 · what the player puts on a page is allowlisted on the browser's parse;
 *   3 · ♿ reduced motion is the still, from the first paint;
 *   4 · 1️⃣ it plays ONCE — a re-render never replays it, a remount shows it arrived;
 *   5 · 👁 offscreen waits for the viewport;
 *   6 · the converted surfaces render the playing logo (rendered, not grepped);
 *   7 · THE SWEEP — every file in app/ that draws an SVG mark as a still image
 *       or markup is either routed through `CoupleLogo` or on the still-list
 *       with its reason. A new still logo on a screen fails here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import Module from 'node:module';
import { stripComments } from './strip-comments';
import {
  composeLogoSvg,
  logoAttributePlayable,
  logoElementPlayable,
  logoHasMotion,
  logoInSeconds,
  sanitizeLogoMotion,
  type LogoLayer,
} from './logo-layers';
import { coupleLogoPlays } from './couple-logo-plays';
import { arrivalMotion, coupleLogoPlayKey, createLogoArrivals, logoPhaseOnMount } from './couple-logo-arrival';

/* The components compile to classic `React.createElement` under this runner. */
(globalThis as unknown as { React: unknown }).React = React;

// `<EventPoster>`'s styles are a CSS module, which cannot load outside Next:
// each class name maps to itself (the same hook as the Discover card's test).
(Module as unknown as { _extensions: Record<string, (m: { exports: unknown }) => void> })._extensions['.css'] = (m) => {
  const classes = new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? k : undefined) });
  m.exports = { __esModule: true, default: classes };
};

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* A real composed logo, through the Maker's own composer. */
const BODY = { body: '<path d="M0 0H10V10H0Z"/>', w: 10, h: 10 };
const layer = (id: string, motion: LogoLayer['motion']): LogoLayer => ({
  id,
  kind: 'image',
  name: id,
  color: null,
  x: 500,
  y: 500,
  scale: 1,
  motion,
  ...BODY,
});
const MOVING = composeLogoSvg([layer('ia', { in: 'draw', during: 'still', delay: 0 }), layer('cb', { in: 'none', during: 'still', delay: 0 })])!;
const DRIFT_ONLY = composeLogoSvg([layer('ia', { in: 'none', during: 'drift', delay: 0 })])!;
const STILL_LAYERS = composeLogoSvg([layer('ia', { in: 'none', during: 'still', delay: 0 }), layer('cb', { in: 'none', during: 'still', delay: 0 })])!;
const PLAIN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0H10V10H0Z"/></svg>';

/* ═══ 1 · one rule ═══════════════════════════════════════════════════════ */

test('1 · a logo moves when a layer has an In or a Drift — and only a layered logo can', () => {
  assert.equal(logoHasMotion(MOVING), true, 'a Draw-on layer does not count as motion');
  assert.equal(logoHasMotion(DRIFT_ONLY), true, 'a Drift-only logo does not count as motion');
  assert.equal(logoHasMotion(STILL_LAYERS), false, 'None + Still on every layer is a still logo');
  assert.equal(logoHasMotion(PLAIN), false, 'an unlayered mark has nothing to play');
  assert.equal(logoHasMotion(null), false);
  // A layer with no data-in plays the player's default (Draw on) — "moves" agrees.
  const bare = MOVING.replace(/ data-in="[^"]*"/g, '');
  assert.equal(sanitizeLogoMotion({ in: null }).in, 'draw');
  assert.equal(logoHasMotion(bare), true, '"moves" and "plays" disagree about a layer with no data-in');
});

test('1 · it plays only when the animation is on AND the logo moves', () => {
  assert.equal(coupleLogoPlays(MOVING, true), true);
  assert.equal(coupleLogoPlays(MOVING, false), false, 'a couple without the animation sees their logo move');
  assert.equal(coupleLogoPlays(STILL_LAYERS, true), false);
  assert.equal(coupleLogoPlays(PLAIN, true), false);
  // The server gate asks the switch as well as ownership, and asks nothing for a still logo.
  const gate = code('lib/logo-plays.server.ts');
  assert.match(gate, /eventAnimatedMonogramActive\(/);
  assert.match(gate, /markAnimationSwitchedOff\(/, '"Use Static Image" is ignored');
  assert.match(gate, /if \(!coupleLogoPlays\(svg, true\)\) return false;\s*return animationOnFor\(/, 'a still logo pays for the ownership read');
  // …and it is the hero's gate, word for word — never a second one.
  assert.match(gate, /return owned && !markAnimationSwitchedOff\(studioConfig\);/);
});

/**
 * 📦 WHO ASKS "DOES IT MOVE" (2026-10-04). `CoupleLogo` is a client component
 * drawn on pages whose logos are almost always stills (every Discover card).
 * If it asked `logoHasMotion` itself, every such page would ship `logo-layers`
 * (~52 KB of source plus its fonts) to decide "no". So each SURFACE asks the
 * one rule — `plays={coupleLogoPlays(svg, animationOn)}`, with the SAME svg it
 * hands `CoupleLogo` — and `CoupleLogo` only obeys. Two properties hold it:
 * every `<CoupleLogo` call is handed the rule over its own svg, and
 * `CoupleLogo`'s static import graph never reaches `logo-layers`.
 */
function attrExpr(props: string, name: string): string | null {
  const at = props.search(new RegExp(`\\b${name}=\\{`));
  if (at < 0) return null;
  let depth = 0;
  const open = props.indexOf('{', at);
  for (let i = open; i < props.length; i++) {
    if (props[i] === '{') depth += 1;
    else if (props[i] === '}' && --depth === 0) return props.slice(open + 1, i).trim();
  }
  return null;
}

/** The `<CoupleLogo` calls in `src` whose `plays` is NOT `coupleLogoPlays(<its own svg>, …)`. */
function unruledCalls(src: string): string[] {
  const bad: string[] = [];
  for (const m of src.matchAll(/<CoupleLogo\b/g)) {
    const [a, b] = propsSpan(src, m.index!);
    const props = src.slice(a, b);
    const svg = attrExpr(props, 'svg');
    const plays = attrExpr(props, 'plays');
    const ruled =
      svg !== null &&
      plays !== null &&
      plays.startsWith('coupleLogoPlays(') &&
      plays.slice('coupleLogoPlays('.length).split(',')[0]!.trim() === svg;
    if (!ruled) bad.push(props.replace(/\s+/g, ' ').slice(0, 120));
  }
  return bad;
}

/** Every module `entry` imports STATICALLY (an `import(…)` is a lazy chunk, not the graph). */
function staticGraph(entry: string): string[] {
  const seen = new Set<string>();
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? join(from, '..', spec) : null;
    if (!base) return null;
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      try {
        if (statSync(base + ext).isFile()) return base + ext;
      } catch {
        /* not this one */
      }
    }
    return null;
  };
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?\sfrom\s+'([^']+)'/gm)) {
      if (/^\s*import\s+type\s/.test(m[0]) || /^\s*export\s+type\s/.test(m[0])) continue;
      const next = resolve(file, m[1]!);
      if (next && /\.tsx?$/.test(next)) visit(next);
    }
  };
  visit(join(WEB, entry));
  return [...seen].map((f) => relative(WEB, f));
}

test('1 · every <CoupleLogo is handed the one rule over its own svg — and CoupleLogo never imports logo-layers', () => {
  // The detector can see: a ruled call passes, the three ways to skip the rule fail.
  assert.deepEqual(unruledCalls(`<CoupleLogo svg={mark} plays={coupleLogoPlays(mark, plays)} place="x" still={<i/>} />`), []);
  assert.equal(unruledCalls(`<CoupleLogo svg={mark} plays={plays} place="x" still={<i/>} />`).length, 1);
  assert.equal(unruledCalls(`<CoupleLogo svg={mark} plays place="x" still={<i/>} />`).length, 1);
  assert.equal(unruledCalls(`<CoupleLogo svg={mark} plays={coupleLogoPlays(other, plays)} place="x" still={<i/>} />`).length, 1);

  const offenders: string[] = [];
  let calls = 0;
  for (const full of walk(join(WEB, 'app'))) {
    const rel = relative(WEB, full);
    if (rel === 'app/_components/couple-logo.tsx') continue;
    const src = stripComments(readFileSync(full, 'utf8'));
    calls += (src.match(/<CoupleLogo\b/g) ?? []).length;
    for (const bad of unruledCalls(src)) offenders.push(`${rel}: ${bad}`);
  }
  assert.deepEqual(
    offenders,
    [],
    'Hand CoupleLogo the rule: plays={coupleLogoPlays(svg, animationOn)} with the svg you pass it.\n' + offenders.join('\n'),
  );
  assert.ok(calls >= 8, `the sweep found only ${calls} <CoupleLogo calls — the detector went blind`);

  // CoupleLogo obeys `plays`; it never asks whether a logo moves.
  const logo = code('app/_components/couple-logo.tsx');
  assert.match(logo, /if \(!plays \|\| !svg\) return <>\{still\}<\/>;/);
  assert.doesNotMatch(logo, /\b(?:coupleLogoPlays|logoHasMotion)\b/, 'CoupleLogo asks "does it move" itself again');
  const graph = staticGraph('app/_components/couple-logo.tsx');
  assert.ok(graph.includes('lib/couple-logo-arrival.ts'), 'the graph walker cannot see CoupleLogo’s imports');
  for (const heavy of ['lib/logo-layers.ts', 'lib/couple-logo-plays.ts', 'app/_components/layered-logo-player.tsx']) {
    assert.ok(!graph.includes(heavy), `CoupleLogo statically imports ${heavy} — every page with a still logo ships it`);
  }
  // …while the walker does reach logo-layers where it really is imported.
  assert.ok(staticGraph('lib/couple-logo-plays.ts').includes('lib/logo-layers.ts'), 'the graph walker cannot see a real import');
});

/* ═══ 2 · what reaches the page ═══════════════════════════════════════════ */

test('2 · the player keeps only inert SVG — never a handler, a link, a script or an outside URL', () => {
  for (const ok of ['svg', 'g', 'path', 'rect', 'linearGradient', 'clipPath', 'mask', 'feGaussianBlur']) {
    assert.equal(logoElementPlayable(ok), true, `${ok} refused`);
  }
  for (const bad of ['script', 'foreignObject', 'iframe', 'image', 'use', 'a', 'style', 'animate', 'set', 'feImage', 'div']) {
    assert.equal(logoElementPlayable(bad), false, `${bad} allowed`);
  }
  assert.equal(logoAttributePlayable('fill', 'url(#g)'), true);
  assert.equal(logoAttributePlayable('data-in', 'draw'), true);
  assert.equal(logoAttributePlayable('onload', 'x()'), false);
  assert.equal(logoAttributePlayable('ONclick', 'x()'), false);
  assert.equal(logoAttributePlayable('xlink:href', '#a'), false);
  assert.equal(logoAttributePlayable('href', '#a'), false);
  assert.equal(logoAttributePlayable('style', 'fill:url(https://x.test/a)'), false);
  assert.equal(logoAttributePlayable('fill', 'javascript:x()'), false);
  assert.equal(logoAttributePlayable('fill', 'data:image/png;base64,AA'), false);
  const player = code('app/_components/layered-logo-player.tsx');
  assert.match(player, /const tree = inertLogoTree\(svg\);/);
  // The ONE place the markup is parsed is an inert <template>, never the page.
  const writes = player.match(/\b\w+\.innerHTML\s*=\s*svg\b/g) ?? [];
  assert.deepEqual(writes, ['t.innerHTML = svg'], 'the player writes the raw markup into the page again');
  assert.match(player, /const t = document\.createElement\('template'\);/);
  assert.match(player, /t\.innerHTML = svg;[\s\S]*?logoElementPlayable\(el\.localName\)[\s\S]*?logoAttributePlayable\(a\.name, a\.value\)/, 'the tree is not checked after the browser parsed it');
});

/* ═══ 3 · reduced motion ═════════════════════════════════════════════════ */

test('3 · ♿ reduced motion is the still — decided at mount, and visible from the server HTML', async () => {
  assert.equal(logoPhaseOnMount({ reducedMotion: true, canObserve: true }), 'still');
  assert.equal(logoPhaseOnMount({ reducedMotion: true, canObserve: false }), 'still');
  assert.equal(logoPhaseOnMount({ reducedMotion: false, canObserve: true }), 'wait');
  assert.equal(logoPhaseOnMount({ reducedMotion: false, canObserve: false }), 'play');
  const src = code('app/_components/couple-logo.tsx');
  assert.match(src, /reducedMotion: window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches/, 'CoupleLogo stopped asking for reduced motion');
  assert.match(code('app/_components/layered-logo-player.tsx'), /prefers-reduced-motion: reduce/, 'the player plays under reduced motion');
  // The still is in the server HTML, hidden ONLY while motion is allowed.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CoupleLogo } = await import('@/app/_components/couple-logo');
  const html = renderToStaticMarkup(
    React.createElement(CoupleLogo, { svg: MOVING, plays: true, place: 't', still: React.createElement('img', { alt: '', 'data-still': '' }) }),
  );
  assert.match(html, /data-couple-logo="pending"/);
  assert.match(html, /<span class="contents motion-safe:invisible"><img[^>]*data-still/, 'the still is hidden from reduced-motion viewers too');
  assert.doesNotMatch(html, /class="[^"]*(?<![:\w-])invisible/, 'the still is hidden unconditionally');
  assert.doesNotMatch(html, /<svg|<path/, 'the layers were injected on the server');
});

/* ═══ 4 · plays once ═════════════════════════════════════════════════════ */

test('4 · 1️⃣ it plays ONCE: a remount in the same place shows it arrived, with its Drift', () => {
  const arrivals = createLogoArrivals();
  const key = coupleLogoPlayKey('invite-seal', MOVING);
  assert.equal(arrivals.arrived(key), false, 'first arrival');
  arrivals.arrive(key);
  assert.equal(arrivals.arrived(key), true, 'a step change replays the entrance');
  assert.equal(arrivals.arrived(coupleLogoPlayKey('event-card', MOVING)), false, 'another place never gets to play');
  assert.equal(arrivals.arrived(coupleLogoPlayKey('invite-seal', DRIFT_ONLY)), false, 'a NEW logo does not play its entrance');
  const draw = { in: 'draw' as const, during: 'drift' as const, delay: 1.2 };
  const settled = arrivalMotion(draw, true);
  assert.equal(settled.in, 'none');
  assert.equal(settled.delay, 0);
  assert.equal(settled.during, 'drift', 'the Drift stops after the first arrival');
  assert.equal(logoInSeconds(settled), 0);
  assert.deepEqual(arrivalMotion(draw, false), draw, 'the first arrival lost its entrance');
  // Wiring: decided ONCE at mount; the player replays only for a new logo.
  const logo = code('app/_components/couple-logo.tsx');
  assert.match(logo, /const \[settled\] = useState\(\(\) => logoArrivals\.arrived\(key\)\);/);
  assert.match(logo, /<LayeredLogoPlayer svg=\{svg\} settled=\{settled\}/);
  const player = code('app/_components/layered-logo-player.tsx');
  assert.match(player, /arrivalMotion\(\s*sanitizeLogoMotion\(/, 'the player ignores `settled`');
  assert.match(player, /\}, \[svg, settled\]\);/, 'the player re-runs on something a re-render changes');
});

/* ═══ 5 · offscreen waits ════════════════════════════════════════════════ */

test('5 · 👁 an offscreen logo starts when it scrolls into view', () => {
  const src = code('app/_components/couple-logo.tsx');
  assert.match(src, /new IntersectionObserver\(/);
  assert.match(src, /if \(entries\.some\(\(e\) => e\.isIntersecting\)\) \{\s*io\.disconnect\(\);\s*start\(\);/);
  // It is only ever marked arrived when it actually starts.
  assert.equal((src.match(/logoArrivals\.arrive\(key\)/g) ?? []).length, 1);
  assert.match(src, /const start = \(\) => \{\s*logoArrivals\.arrive\(key\);\s*setPhase\('play'\);/);
});

/* ═══ 6 · the surfaces, rendered ═════════════════════════════════════════ */

test('6 · the door seals, the event chip and the hero render the PLAYING logo when it moves and is on', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const plays = (html: string) => /data-couple-logo="pending"/.test(html);
  const { SealMark } = await import('@/app/[slug]/invite/_components/themes/seal-mark');
  const seal = (p: Record<string, unknown>) =>
    renderToStaticMarkup(React.createElement(SealMark, { mark: MOVING, monogram: 'I & C', px: 46, ...p }));
  assert.equal(plays(seal({ plays: true })), true, 'the door seal draws a moving logo still');
  assert.equal(plays(seal({ plays: false })), false, 'the seal plays without the animation');
  assert.match(seal({ plays: false }), /<img[^>]*data:image\/svg\+xml/, 'the still seal changed');
  // "Moves" is asked by the surface now, not by CoupleLogo — a logo with no
  // motion stays still even with the animation on.
  assert.equal(plays(seal({ plays: true, mark: STILL_LAYERS })), false, 'the door seal plays a logo that does not move');


  const { EventMonogram } = await import('@/app/_components/event-monogram');
  const chip = (p: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(EventMonogram, {
        event: { display_name: 'Ice & Cale', monogram_text: 'I & C', monogram_color: null, monogram_custom_svg: MOVING },
        ...p,
      }),
    );
  assert.equal(plays(chip({ plays: true })), true, 'the event chip draws a moving logo still');
  assert.equal(plays(chip({})), false, 'the chip plays without being told the animation is on');
  const stillChip = renderToStaticMarkup(
    React.createElement(EventMonogram, {
      event: { display_name: 'Ice & Cale', monogram_text: 'I & C', monogram_color: null, monogram_custom_svg: STILL_LAYERS },
      plays: true,
    }),
  );
  assert.equal(plays(stillChip), false, 'the event chip plays a logo that does not move');

  const { HeroMonogram } = await import('@/app/_components/hero-monogram');
  const hero = (animatedMonogram: false | 'bloom', bespokeSvg = MOVING) =>
    renderToStaticMarkup(
      React.createElement(HeroMonogram, {
        event: {},
        monogram: { text: 'I & C', color: '#5C2542', fontFamily: 'serif', fontStyle: 'italic' } as never,
        animatedMonogram: animatedMonogram as never,
        bespokeSvg,
      }),
    );
  assert.equal(plays(hero('bloom')), true, 'the Event Hub hero draws a moving logo still');
  assert.equal(plays(hero(false)), false, 'the hero plays for a couple without the animation');
  assert.equal(plays(hero('bloom', STILL_LAYERS)), false, 'the hero plays a layered logo that does not move');

  const { EventPoster } = await import('@/app/_components/event-poster');
  const poster = (svg: string, markPlays: boolean) =>
    renderToStaticMarkup(
      React.createElement(EventPoster, {
        poster: { kind: 'invitation', names: { first: 'Ice', second: 'Cale' }, weekday: null, date: null } as never,
        markText: 'I & C',
        markSvg: svg,
        markSvgUri: 'data:image/svg+xml;base64,AA',
        markPlays,
      }),
    );
  assert.equal(plays(poster(MOVING, true)), true, 'the event poster draws a moving logo still');
  assert.equal(plays(poster(MOVING, false)), false, 'the poster plays without the animation');
  assert.equal(plays(poster(STILL_LAYERS, true)), false, 'the poster plays a logo that does not move');
});

test('6 · every page-level screen hands its "animation on" answer down', () => {
  const HANDS = {
    'app/dashboard/(launcher)/page.tsx': /markPlays=\{markPlays\}[\s\S]*plays=\{markPlays\}/,
    'app/dashboard/[eventId]/launch/_components/maker-made-once.tsx': /markPlays=\{markPlays\}/,
    'app/dashboard/[eventId]/layout.tsx': /plays: railMarkPlays,/,
    'app/dashboard/[eventId]/_components/event-rail-context.tsx': /plays=\{eventMonogram\.plays\}/,
    'app/dashboard/(account)/library/_components/album-shelf.tsx': /plays=\{album\.markPlays\}/,
    'app/dashboard/(account)/library/_components/photos-tab.tsx': /plays=\{album\.markPlays\}/,
    'app/[slug]/invite/_lib/load-invite-look.ts': /markPlays: await logoPlaysFor\(/,
    'app/vendor-dashboard/clients/[eventId]/page.tsx': /plays=\{coupleLogoPlays\(monogramSvg, monogramPlays\)\}/,
    'app/live/screen/screen-stage.tsx': /plays=\{coupleLogoPlays\(brand\.markSvg, brand\.markPlays\)\}/,
    'app/[slug]/_components/save-the-date-film.tsx': /plays=\{coupleLogoPlays\(svg, Boolean\(animatedMonogram\)\)\}/,
  } as const;
  for (const [file, re] of Object.entries(HANDS)) assert.match(code(file), re, `${file} no longer tells its logo whether to play`);
  for (const skin of ['abaca', 'capiz', 'velvet']) {
    assert.match(code(`app/[slug]/invite/_components/themes/${skin}.tsx`), /plays=\{markPlays\}/, `${skin}'s seal never plays`);
  }
});

/* ═══ 7 · THE SWEEP ══════════════════════════════════════════════════════ */

/**
 * The PROPERTY a still logo has, whatever it is called: an SVG turned into an
 * image (a `data:image/svg+xml` URI, `bespokeSvgToDataUri`, an `<img>` fed a
 * mark URI), the still renderer itself, or an SVG string injected as markup.
 */
const STILL_DRAWS: RegExp[] = [
  /bespokeSvgToDataUri\(/g,
  /data:image\/svg\+xml/g,
  /<BespokeMonogramMark\b/g,
  /src=\{[^}]*\bmark(?:DataUri|SvgUri)\b/g,
  /__html:\s*(?:[\w]+\.)*\w*(?:mark|monogram|logo)\w*(?:Svg|SVG)\b/g,
];

/** Still ON PURPOSE — each with the reason it is not a screen showing the saved logo. */
const STILL: Record<string, string> = {
  'app/_components/bespoke-monogram-mark.tsx': 'the still renderer itself — every playing surface hands it in as its `still`',
  'app/_components/gold-monogram-reveal.tsx': 'a reveal animation of its own; the mark is its mask',
  'app/[slug]/_components/reveal/wax-seal.tsx': 'the mark PRESSED INTO wax (a canvas/WebGL die) — a material impression inside the reveal',
  'app/[slug]/_components/reveal/veil-reveal.tsx': 'the SETNAYAN mark in a WebGL veil texture — not the couple’s logo',
  'app/dashboard/[eventId]/_components/reveal-preview.tsx': 'the reveal preview’s reduced-motion still',
  'app/dashboard/[eventId]/monogram/mark-everywhere.tsx': 'mock-ups of PRINTED, embossed and projected items in a 1.7s montage',
  'app/dashboard/[eventId]/monogram/draft-restore.tsx': 'a thumbnail of an UNSAVED studio draft — not the saved logo',
  'app/dashboard/[eventId]/monogram/animated-monogram-upgrade.tsx': 'the still "before" half of the before/after buy preview',
  'app/admin/studio/_surfaces/social-queue-surface.tsx': 'the preview of an EXPORTED social image',
  'app/panood/control/[eventId]/page.tsx': 'the broadcast corner mark — composited into the stream (the encoder canvas), an export',
  'app/panood/program/[eventId]/program-surface.tsx': 'the OBS program window — whatever it shows is broadcast, an export',
  'app/vendor-dashboard/_components/qr-section.tsx': 'a QR code, not the couple’s logo',
  'app/monogram/public-monogram-studio.tsx': 'the public monogram tool’s download (an export), not a couple’s saved logo',
  'app/dev/hero-lab/page.tsx': 'a dev-only lab',
  'app/papic/decorate/_components/kwento-decorator.tsx': 'a flat colour swatch beside each caption-colour option in a dropdown — not a logo',
};

/** A still draw OUTSIDE CoupleLogo that is correct, counted per file. */
const EXPLAINED_OUTSIDE: Record<string, { count: number; why: string }> = {
  'app/_components/hero-monogram.tsx': {
    count: 1,
    why: 'the bloom-in / static branch, reached only when the mark is NOT a layered logo or the animation is off — it cannot move',
  },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(full) && !/\.test\.tsx$/.test(full)) out.push(full);
  }
  return out;
}

/** The span of a JSX element's props, from `<Name` to its closing `>`/`/>` at brace depth 0. */
function propsSpan(src: string, at: number): [number, number] {
  let depth = 0;
  for (let i = at + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (depth === 0 && c === '>') return [at, i];
  }
  return [at, src.length];
}

/** Where a still draw is ROUTED: inside a `<CoupleLogo … still={…}>`, or in the
 *  props of an `<EventPoster>` that is also told `markPlays`. */
function routedRanges(src: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const m of src.matchAll(/<CoupleLogo\b/g)) {
    const [a, b] = propsSpan(src, m.index!);
    const props = src.slice(a, b);
    if (/\bplays[=\s]/.test(props) && /\bstill=\{/.test(props)) out.push([a, b]);
  }
  for (const m of src.matchAll(/<EventPoster\b/g)) {
    const [a, b] = propsSpan(src, m.index!);
    if (/\bmarkPlays=\{/.test(src.slice(a, b))) out.push([a, b]);
  }
  return out;
}

test('7 · the sweep can see — its detector and router hit what they claim to', () => {
  const routed = `<CoupleLogo svg={s} plays={p} place="x" still={<img src={bespokeSvgToDataUri(s)} alt="" />} />`;
  const bare = `<img src={bespokeSvgToDataUri(s)} alt="" />`;
  const hits = (s: string) => STILL_DRAWS.reduce((n, re) => n + (s.match(re) ?? []).length, 0);
  assert.equal(hits(routed), 1);
  assert.equal(hits(bare), 1);
  const at = routed.indexOf('bespokeSvgToDataUri');
  assert.ok(routedRanges(routed).some(([a, b]) => at >= a && at < b), 'the router cannot see a routed still');
  assert.equal(routedRanges(bare).length, 0);
  // A CoupleLogo with no `plays` is not routing anything.
  assert.equal(routedRanges(`<CoupleLogo svg={s} place="x" still={<img/>} />`).length, 0);
  assert.equal(hits(`<style dangerouslySetInnerHTML={{ __html: monogramStudioV2Enabled() ? A : B }} />`), 0, 'CSS reads as a logo');
  assert.equal(hits(`dangerouslySetInnerHTML={{ __html: markSvg }}`), 1);
});

test('7 · every still logo on a screen is routed through CoupleLogo — or is still on purpose, with its reason', () => {
  const found: string[] = [];
  const offenders: string[] = [];
  for (const full of walk(join(WEB, 'app'))) {
    const rel = relative(WEB, full);
    const src = stripComments(readFileSync(full, 'utf8'));
    const at: number[] = [];
    for (const re of STILL_DRAWS) for (const m of src.matchAll(re)) at.push(m.index!);
    if (!at.length) continue;
    found.push(rel);
    if (STILL[rel]) continue;
    const ranges = routedRanges(src);
    const outside = at.filter((i) => !ranges.some(([a, b]) => i >= a && i < b)).length;
    const allowed = EXPLAINED_OUTSIDE[rel]?.count ?? 0;
    if (outside !== allowed) {
      offenders.push(
        `${rel}: ${outside} still logo draw(s) outside CoupleLogo (expected ${allowed}). ` +
          'Route it: <CoupleLogo svg={…} plays={await logoPlaysFor(eventId, svg)} place="…" still={…the still you drew…} />, ' +
          'or — if this is a print, export, QR, icon, email or raster — add it to STILL with the reason.',
      );
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
  // Population floor: the sweep still finds the surfaces it was built on.
  for (const must of [
    'app/_components/event-monogram.tsx',
    'app/_components/event-poster.tsx',
    'app/[slug]/invite/_components/themes/seal-mark.tsx',
    'app/vendor-dashboard/clients/[eventId]/page.tsx',
    'app/live/screen/screen-stage.tsx',
  ]) {
    assert.ok(found.includes(must), `the sweep no longer sees ${must} — the detector went blind`);
  }
  // A still-list entry that no longer draws anything is a stale excuse.
  for (const rel of Object.keys(STILL)) assert.ok(found.includes(rel), `${rel} is on the still-list but draws no logo — remove it`);
});
