/**
 * lib/ambient-effects.ts — THE EIGHT EFFECTS THAT LIE ON TOP OF THE BACKGROUND, UNDER THE WORDS.
 *
 * Owner, 2026-10-14 (DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"; approved prototype
 * `prototypes/maker_effects_and_attire_2026-10-14_fable.html`, its "Proposed" `p-*` kinds and `spawn()`): *"effects
 * does not look professional and premium"* — so the set was redrawn restrained: slow, few, soft-edged, fading in and
 * out at both ends of a cycle, depth by blur, palette-tinted:
 *
 *   Soft haze · Bokeh lights · Gold dust ◆ · Petal drift ◆ · Lanterns ◆ · Gold shimmer ◆ · Light leak ◆ · Film grain ◆
 *
 * (Capiz glow and Sparkles are gone; a stored one is read as Soft haze / Gold dust — `HUB_MAIN_EFFECT_RETIRED`.)
 * The 2026-10-08 rules all stand (DECISION_LOG "LOOK EFFECTS ROUND 4" · "LOOK ROUNDS 4–5"): one at a time, How much ▾,
 * Colour ▾, the readable band, the finished still under reduce motion.
 *
 * ONE ENGINE, THREE PLACES — the guest's Event Hub, Studio › Look's sample screen, and the carousel's
 * miniatures all draw `ambientEffectSpec()` through ONE layer (`app/[slug]/_components/ambient-effect.tsx`).
 * Nothing else draws an effect.
 *
 * WHAT AN EFFECT IS: a handful of drawn shapes (`<i>`, CSS only — never an image, never an emoji), each animated
 * by CSS on `transform` · `translate` · `rotate` · `scale` · `opacity` and nothing else (the compositor's own
 * properties: no layout, no paint of the page). Film grain is the one drawn by an in-page SVG noise filter — three
 * still frames, shown in turn by their opacity; it fetches nothing. So:
 *   · ZERO REQUESTS — no image, no font, no script is fetched for an effect;
 *   · ZERO JAVASCRIPT on the guest page — the layer is plain HTML and one `<style>`;
 *   · REDUCE MOTION = A FINISHED STILL — the animation is taken off and each shape is drawn, in plain CSS, where it
 *     would stand part-way through its cycle (never hidden, never left at its start off the page);
 *   · A READABLE BAND — the layer is masked to half strength across the middle, where the words sit;
 *   · LIGHT AND DARK GROUNDS — glows and blends swap (`data-ambient-ground`).
 *
 * ✨ GOLD SHIMMER LIVES ON THE NAMES (the approved drawing): light passes over the couple's names, plus two faint
 * glints in the frame. The glint on the names is the shipped FOIL NAMES technique (`globals.css`, `[data-hub-foil]`:
 * a gradient clipped to the type, its position swept) — the ONE animation here that is not a compositor property,
 * on one heading only, and plain names under reduce motion. It reaches the names as the layer's later sibling
 * (`[data-ambient-effect="shimmer"] ~ * [data-hub-names]`), so it needs no script and no attribute on the page.
 *
 * THE COLOUR RULE (the note's two lines): the picked palette colour is the effect's BODY; its highlight is the
 * body lifted 40 % toward white and its deep is the body dropped 35 % toward black — one colour in, three out.
 * The body is first pulled — deepened on a light ground, lightened on a dark one — until it stands at least
 * `AMBIENT_COLOUR_FLOOR` (2.4:1) off the ground's average, so a pale colour still shows. An effect is decoration,
 * not words: 2.4, not 4.5.
 *
 * REUSE, said plainly (Rule 0): the three shipped engines were read first and none of their CODE is reused —
 * `celebration-engine.ts` (`sysPetals`) is a canvas driven by requestAnimationFrame for a timed moment,
 * `reveal-particles.tsx` an opening flourish, `spatial-backdrop.ts` 1024² images. Each would put a script, a
 * canvas or image requests on every guest page. What IS reused: the approved prototype's engine (translated
 * rule for rule — its `spawn()` numbers and its seeded generator), the page's own contrast maths
 * (`lib/hub-legibility.ts`), and the palette's slot names.
 *
 * Pure. Held by `lib/the-effects-are-eight-and-cost-nothing.test.ts`.
 */
import { HUB_MAIN_EFFECTS, type HubMainEffect, type HubMainEffectColour, type HubMainEffectIntensity, type HubMainEffectKind } from './hub-canvas';
import { compositeOver, contrastRatio, relativeLuminance } from './hub-legibility';

export const AMBIENT_EFFECT_LABEL: Readonly<Record<HubMainEffectKind, string>> = {
  haze: 'Soft haze',
  bokeh: 'Bokeh lights',
  dust: 'Gold dust',
  petals: 'Petal drift',
  lanterns: 'Lanterns',
  shimmer: 'Gold shimmer',
  leak: 'Light leak',
  grain: 'Film grain',
};

/** ◆ Event Hub Pro — the approved prototype's marks: Soft haze and Bokeh lights are free, the other six Pro. */
export const AMBIENT_EFFECT_IS_PRO: Readonly<Record<HubMainEffectKind, boolean>> = {
  haze: false,
  bokeh: false,
  dust: true,
  petals: true,
  lanterns: true,
  shimmer: true,
  leak: true,
  grain: true,
};

export const AMBIENT_INTENSITY_LABEL: Readonly<Record<HubMainEffectIntensity, string>> = { subtle: 'Subtle', standard: 'Standard', lavish: 'Lavish' };

/** The five, by the names the couple reads (`MAIN_COLOUR_SLOTS`, lib/colour-access.ts) — in slot order. */
export const AMBIENT_COLOUR_LABEL: Readonly<Record<HubMainEffectColour, string>> = {
  dominant: 'Dominant',
  supporting: 'Supporting',
  accent: 'Accent',
  neutral: 'Neutral',
  accent2: 'Accent 2',
};
const SLOT: Readonly<Record<HubMainEffectColour, number>> = { dominant: 0, supporting: 1, accent: 2, neutral: 3, accent2: 4 };

/**
 * Shapes on a 375-px phone at Standard — the approved prototype's `count`s: fewer, larger, slower. A spec, capped:
 * never more than `AMBIENT_COUNT_CAP`. Film grain draws no shapes — one layer of noise (`ambientCount` answers 1).
 */
export const AMBIENT_COUNT: Readonly<Record<HubMainEffectKind, number>> = { haze: 3, bokeh: 6, dust: 18, petals: 7, lanterns: 4, shimmer: 2, leak: 1, grain: 0 };
export const AMBIENT_INTENSITY_SCALE: Readonly<Record<HubMainEffectIntensity, number>> = { subtle: 0.6, standard: 1, lavish: 1.5 };
export const AMBIENT_COUNT_CAP = 24;
/** A card's miniature draws fewer, smaller shapes — the same ones (the prototype's `mini`). */
const MINI_COUNT = 0.6;
const MINI_SIZE = 0.5;

/** One cycle, in seconds (−25 % … +35 %): slow — nothing under 10 s but the grain's own step. */
const PERIOD: Readonly<Record<HubMainEffectKind, number>> = { haze: 48, bokeh: 30, dust: 14, petals: 26, lanterns: 52, shimmer: 11, leak: 16, grain: 1.2 };

/** Film grain's strength at each How much (the layer's opacity) — the prototype's `--go`. */
export const AMBIENT_GRAIN_STRENGTH: Readonly<Record<HubMainEffectIntensity, number>> = { subtle: 0.05, standard: 0.085, lavish: 0.13 };

export function ambientCount(kind: HubMainEffectKind, intensity: HubMainEffectIntensity, mini = false): number {
  if (kind === 'grain') return 1;
  return Math.min(AMBIENT_COUNT_CAP, Math.max(1, Math.round(AMBIENT_COUNT[kind] * AMBIENT_INTENSITY_SCALE[intensity] * (mini ? MINI_COUNT : 1))));
}

/* ── colour ─────────────────────────────────────────────────────────────── */

/** An effect is decoration, not words — it must SHOW, not be read. */
export const AMBIENT_COLOUR_FLOOR = 2.4;

const mix = (a: string, b: string, t: number): string => compositeOver(b, t, a);
/** A colour at a strength, as CSS — a wash, a veil. */
export const ambientWash = (hex: string, a: number): string => {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgba(${n(1)},${n(3)},${n(5)},${a})`;
};

/** Is light the colour that shows on this ground? (the page's own "which ink reads" question) */
export function ambientGroundIsDark(ground: string): boolean {
  return contrastRatio('#FFFFFF', ground) > contrastRatio('#000000', ground);
}

/**
 * The colour pulled until it stands `floor`:1 off the ground — toward black on a light ground, toward white on a
 * dark one, 8 % a step (the prototype's `pullTo`). A colour that already stands off is returned as it is.
 * 🪤 On a mid ground one direction can run out before the floor (white tops out at 2.33:1 over luminance 0.4): the
 * other direction is then taken, so the floor is ALWAYS met — a sweep in the guard holds it.
 */
export function ambientPull(hex: string, ground: string, floor = AMBIENT_COLOUR_FLOOR): string {
  const toward = (to: string) => {
    let x = hex;
    for (let i = 0; i < 40 && contrastRatio(x, ground) < floor; i++) x = mix(x, to, 0.08);
    return x;
  };
  const first = toward(relativeLuminance(ground) > 0.4 ? '#000000' : '#FFFFFF');
  if (contrastRatio(first, ground) >= floor) return first;
  const other = toward(relativeLuminance(ground) > 0.4 ? '#FFFFFF' : '#000000');
  return contrastRatio(other, ground) > contrastRatio(first, ground) ? other : first;
}

/** One colour in, three out: the body · its highlight (40 % toward white) · its deep (35 % toward black). */
export function ambientTriad(body: string): [string, string, string] {
  return [body, mix(body, '#FFFFFF', 0.4), mix(body, '#000000', 0.35)];
}

/**
 * The effect's own colours ("Original") — the approved prototype's `orig(dark, five)`: the haze a warm cream on dark
 * and the couple's Dominant on light; bokeh warm light on dark and their Accent 2 on light; gold for the dust and the
 * shimmer; petals from their Neutral and Accent 2; lanterns a warm amber paper; the light leak warm. `bodies` are
 * drawn from at random, shape by shape; `hi` · `deep` are shared.
 */
function original(kind: HubMainEffectKind, dark: boolean, five: readonly string[]): { bodies: string[]; hi: string; deep: string } {
  const [dom = '#7A1F2B', , , neu = '#F3EBE1', acc2 = '#B88A6A'] = five;
  switch (kind) {
    case 'haze':
      return { bodies: [dark ? '#F3E6CF' : dom], hi: '#FFFFFF', deep: dark ? '#C9B58F' : mix(dom, '#000000', 0.35) };
    case 'bokeh':
      return { bodies: [dark ? '#FFD9A0' : acc2], hi: '#FFF6E3', deep: dark ? '#B88A4B' : mix(acc2, '#000000', 0.35) };
    case 'dust':
      return { bodies: ['#D4AF37'], hi: '#FFF1B8', deep: '#8A6D1E' };
    case 'petals':
      return { bodies: [neu, mix(acc2, neu, 0.5)], hi: '#FFFFFF', deep: mix(acc2, '#000000', 0.25) };
    case 'lanterns':
      return { bodies: ['#F2B25A'], hi: '#FFE9B8', deep: '#8C5A2A' };
    case 'shimmer':
      return { bodies: ['#D4AF37'], hi: '#FFF4CC', deep: '#8A6D1E' };
    case 'leak':
      return { bodies: [dark ? '#F4B37C' : acc2], hi: '#FFE6C4', deep: '#9C5A2A' };
    case 'grain':
      return { bodies: ['#FFFFFF'], hi: '#FFFFFF', deep: '#000000' };
  }
}

/** The swatch a Colour ▾ row shows for this effect as it would be drawn: the picked slot pulled, or the effect's own. */
export function ambientSwatch(effect: Pick<HubMainEffect, 'kind' | 'colour'>, ground: string, five: readonly string[]): string {
  const slot = effect.colour ? five[SLOT[effect.colour]] : null;
  if (slot) return ambientPull(slot, ground);
  return original(effect.kind, ambientGroundIsDark(ground), five).bodies[0]!;
}

/* ── the ground it lies over ────────────────────────────────────────────── */

/**
 * The average colour of what the effect lies on, AS THE PAGE DRAWS IT: a picture's measured samples under its
 * veil (a Fade's ink or paper) or the page's own paper scrim; a blend's ramp; else the page colour. Every input
 * is something the page already measured — nothing is read from a picture here.
 */
export function ambientGround(input: {
  /** The picture's measured colours (`tint.frame`, a loop's samples) — empty / null: no picture. */
  frame: readonly string[] | null;
  /** The Fade's veil over the picture. */
  veil: { color: string; opacity: number } | null;
  /** The page's own paper over the picture, 0…1 (no Fade). */
  scrim: number | null;
  /** The page colour. */
  paper: string;
  /** A blend's stops, veiled as the page veils them. */
  ramp?: readonly string[] | null;
}): string {
  const average = (list: readonly string[]) => {
    const sum = [0, 0, 0];
    for (const hex of list) for (let i = 0; i < 3; i++) sum[i]! += parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) || 0;
    return `#${sum.map((v) => Math.round(v / list.length).toString(16).padStart(2, '0')).join('')}`;
  };
  if (input.frame && input.frame.length > 0) {
    const under = average(input.frame);
    if (input.veil) return compositeOver(input.veil.color, input.veil.opacity, under);
    return input.scrim ? compositeOver(input.paper, input.scrim, under) : under;
  }
  if (input.ramp && input.ramp.length > 0) return average(input.ramp);
  return input.paper;
}

/* ── the shapes ─────────────────────────────────────────────────────────── */

/** The prototype's generator (`seeded`, a 32-bit integer hash) — the same numbers from the same seed, so a still is the same still everywhere. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type AmbientEffectSpec = {
  kind: HubMainEffectKind;
  ground: 'light' | 'dark';
  mini: boolean;
  /** The layer's CSS variables — the shared colours and their washes. */
  vars: Record<string, string>;
  /** One per shape — its place, depth (size · blur · opacity), period, negative delay and body colour. Film grain: one, its strength. */
  particles: Record<string, string>[];
};

/** Where a shape stands in its cycle when its negative delay starts it — the still's `--p`. */
const stillOf = (d: number, dl: number) => (((-dl / d) % 1) + 1) % 1;

/**
 * THE ONE ANSWER to "what does this effect draw here?" — for the guest page, the sample screen and a card's
 * miniature alike. `ground` is `ambientGround(…)`; `five` the palette's five in slot order. The numbers are the
 * approved prototype's `spawn()`, kind for kind (its seed: the effect's place after the six that shipped before).
 */
export function ambientEffectSpec(effect: HubMainEffect, ground: string, five: readonly string[], mini = false): AmbientEffectSpec {
  const { kind, intensity } = effect;
  const dark = ambientGroundIsDark(ground);
  const slot = effect.colour ? five[SLOT[effect.colour]] : null;
  const picked = slot ? ambientTriad(ambientPull(slot, ground)) : null;
  const own = original(kind, dark, five);
  const bodies = picked ? [picked[0]] : own.bodies;
  const hi = picked ? picked[1] : own.hi;
  const deep = picked ? picked[2] : own.deep;
  const n = ambientCount(kind, intensity, mini);
  const particles: Record<string, string>[] = [];
  if (kind === 'grain') {
    particles.push({ '--go': (AMBIENT_GRAIN_STRENGTH[intensity] * (mini ? 0.8 : 1)).toFixed(3) });
  } else {
    const r = seeded((HUB_MAIN_EFFECTS.indexOf(kind) + 7) * 97 + n);
    const base = PERIOD[kind];
    for (let i = 0; i < n; i++) {
      const depth = r();
      let s = (0.55 + depth * 0.75) * (mini ? MINI_SIZE : 1);
      const x = r() * 96 + 2;
      const y = r() * 90 + 4;
      const d = base * (0.75 + r() * 0.6);
      const dl = -r() * base;
      const still = stillOf(d, dl);
      const body = bodies.length > 1 ? bodies[Math.floor(r() * bodies.length)]! : null;
      let o = 0.5 + depth * 0.5;
      let b = depth < 0.25 ? '1.4px' : depth < 0.5 ? '.5px' : '0px';
      /* The proposed kinds hold back: lower ceilings, more blur on the far ones. */
      if (kind === 'haze') {
        s = (0.8 + depth * 0.5) * (mini ? 0.7 : 1);
        o = dark ? 0.55 : 0.5;
      }
      if (kind === 'bokeh') {
        o = 0.35 + depth * 0.35;
        b = depth < 0.4 ? '6px' : depth < 0.7 ? '2px' : '0px';
      }
      if (kind === 'dust') {
        o = 0.45 + depth * 0.5;
        b = '0px';
      }
      if (kind === 'petals') {
        o = 0.55 + depth * 0.4;
        b = depth < 0.3 ? '1.6px' : depth < 0.55 ? '.6px' : '0px';
      }
      if (kind === 'lanterns') {
        s = (0.55 + depth * 0.9) * (mini ? MINI_SIZE : 1);
        o = 0.55 + depth * 0.45;
        b = depth < 0.3 ? '1.8px' : depth < 0.6 ? '.7px' : '0px';
      }
      if (kind === 'shimmer') {
        o = 0.7;
        b = '0px';
      }
      if (kind === 'leak') {
        o = dark ? 0.5 : 0.38;
        s = 1;
      }
      particles.push({
        '--x': `${x.toFixed(1)}%`,
        '--y': `${y.toFixed(1)}%`,
        '--s': s.toFixed(2),
        '--b': b,
        '--o': o.toFixed(2),
        '--d': `${d.toFixed(1)}s`,
        '--dl': `${dl.toFixed(1)}s`,
        /* The STILL (reduce motion): how far through its cycle the shape stands — the place its negative delay starts it. */
        '--p': still.toFixed(3),
        /* A shape that fades in and out: how bright it is at that place (a glint, a mote of dust). */
        ...(kind === 'shimmer' || kind === 'dust' ? { '--g': (still < 0.45 ? still / 0.45 : (1 - still) / 0.55).toFixed(3) } : {}),
        ...(body ? { '--c1': body } : {}),
      });
    }
  }
  const c1 = bodies[0]!;
  return {
    kind,
    ground: dark ? 'dark' : 'light',
    mini,
    vars: {
      '--c1': c1,
      '--c2': hi,
      '--c3': deep,
      /* The washes a glow, a rim or a veil needs — worked out here, so the stylesheet needs no `color-mix()`. */
      '--c1-75': ambientWash(c1, 0.75),
      '--c1-45': ambientWash(c1, 0.45),
      '--c1-35': ambientWash(c1, 0.35),
      '--c1-12': ambientWash(c1, 0.12),
      '--c2-85': ambientWash(hi, 0.85),
      '--c2-55': ambientWash(hi, 0.55),
      '--c3-35': ambientWash(deep, 0.35),
      '--c3-20': ambientWash(deep, 0.2),
    },
    particles,
  };
}

/**
 * 🎞 FILM GRAIN'S THREE FRAMES — fine static noise drawn by an in-page SVG filter (`feTurbulence`), no image. Each frame
 * is its own small `<svg>` so the browser draws it once and only its OPACITY steps (`sn-fx-grain`). The filter is
 * referenced by an id in the same page (`url(#…)`) — never an address. `id` makes the ids unique per layer.
 */
export const AMBIENT_GRAIN_SEEDS = [3, 11, 29] as const;
/** The noise each frame draws (the prototype's `GRAIN_SVG`): fine fractal noise, grey, nine-tenths opaque. */
export const AMBIENT_GRAIN_NOISE = { baseFrequency: '.9', numOctaves: 2, matrix: '0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .9 0' } as const;

/* ── the stylesheet ─────────────────────────────────────────────────────── */

/** The readable band: full strength at the edges, half across the middle, where the names, the date and the buttons sit. */
const BAND = 'linear-gradient(180deg,#000 0 12%,rgba(0,0,0,.5) 26%,rgba(0,0,0,.5) 82%,#000 94%)';
const A = '[data-ambient-effect]';
const K = (kind: HubMainEffectKind) => `${A}[data-ambient-effect="${kind}"] i`;
const LIGHT = (kind: HubMainEffectKind) => `${A}[data-ambient-effect="${kind}"][data-ambient-ground="light"] i`;
/** The names a gold shimmer passes over: the page's own (`data-hub-names`) and a card's (`data-ambient-names`) — the layer's later siblings. */
const NAMES = `${A}[data-ambient-effect="shimmer"]~* [data-hub-names],${A}[data-ambient-effect="shimmer"]~* [data-ambient-names]`;
const NAMES_ON_LIGHT = `${A}[data-ambient-effect="shimmer"][data-ambient-ground="light"]~* [data-hub-names],${A}[data-ambient-effect="shimmer"][data-ambient-ground="light"]~* [data-ambient-names]`;

/**
 * Everything an effect needs, as ONE stylesheet string — drawn inline beside the layer, only where an effect is on.
 * The approved prototype's "Proposed" CSS (`p-*`), rule for rule, under the layer's own attribute.
 * 🔒 Held by the guard: every `@keyframes` here moves only transform · translate · rotate · scale · opacity — but ONE,
 * `sn-fx-sweep`, the names' glint (the shipped foil technique, see the docblock); there is no address (`url(` only in
 * the grain's own in-page filter, which is markup, not this sheet), no `@import`, no `@font-face`; the band's mask is
 * present; reduce motion draws a still (never removes).
 */
export const AMBIENT_EFFECT_CSS =
  /* The layer: its own size is the travel (`cqh`), with the viewport as the older browsers' stand-in. Where it
     sits (fixed behind the page, or filling a card) is its mount's own class — never set here. */
  `${A}{--T:125vh;overflow:hidden;pointer-events:none;container-type:size;-webkit-mask-image:${BAND};mask-image:${BAND}}` +
  `@supports (height:1cqh){${A}{--T:125cqh}}` +
  `${A}[data-ambient-mini]{-webkit-mask-image:none;mask-image:none}` +
  `${A} i{position:absolute;display:block;will-change:transform,opacity}` +
  /* Soft haze — three large veils of light drifting, barely there. Free. */
  `${K('haze')}{left:var(--x);top:var(--y);width:calc(70%*var(--s));height:calc(42%*var(--s));border-radius:50%;background:radial-gradient(ellipse,var(--c1-75) 0,var(--c1-35) 45%,transparent 70%);filter:blur(calc(22px*var(--s)));opacity:var(--o);mix-blend-mode:screen;animation:sn-fx-veil var(--d) ease-in-out infinite alternate var(--dl)}` +
  `${LIGHT('haze')}{mix-blend-mode:multiply;opacity:calc(var(--o)*.55)}` +
  '@keyframes sn-fx-veil{from{transform:translate(-6%,-3%) scale(.94)}to{transform:translate(6%,4%) scale(1.06)}}' +
  /* Bokeh lights — out-of-focus discs with the bright RIM a real lens draws, three depths, breathing. Free. */
  `${K('bokeh')}{left:var(--x);top:var(--y);width:calc(96px*var(--s));height:calc(96px*var(--s));border-radius:50%;background:radial-gradient(circle,var(--c1-35) 0,var(--c1-45) 58%,var(--c2-85) 70%,transparent 73%);filter:blur(calc(8px - 6px*var(--s)));opacity:0;mix-blend-mode:screen;animation:sn-fx-bdrift var(--d) ease-in-out infinite alternate var(--dl),sn-fx-breathe calc(var(--d)/3) ease-in-out infinite var(--dl)}` +
  `${LIGHT('bokeh')}{mix-blend-mode:multiply;background:radial-gradient(circle,var(--c1-12) 0,var(--c1-35) 58%,var(--c3-35) 70%,transparent 73%)}` +
  '@keyframes sn-fx-bdrift{from{transform:translate(0,0) scale(.96)}to{transform:translate(calc(22px*var(--s)),calc(-14px*var(--s))) scale(1.04)}}' +
  '@keyframes sn-fx-breathe{0%,100%{opacity:calc(var(--o)*.45)}50%{opacity:var(--o)}}' +
  /* Gold dust — tiny luminous points rising and fading; never a star, never a rotation. ◆ */
  `${K('dust')}{left:var(--x);top:var(--y);width:calc(3px*var(--s));height:calc(3px*var(--s));border-radius:50%;background:var(--c2);box-shadow:0 0 calc(5px*var(--s)) var(--c1),0 0 calc(10px*var(--s)) var(--c1-45);opacity:0;animation:sn-fx-dust var(--d) ease-in-out infinite var(--dl)}` +
  `${LIGHT('dust')}{background:var(--c3);box-shadow:0 0 calc(4px*var(--s)) var(--c1-75)}` +
  '@keyframes sn-fx-dust{0%{opacity:0;transform:translate(0,0)}25%{opacity:var(--o)}70%{opacity:calc(var(--o)*.6)}100%{opacity:0;transform:translate(calc(10px*var(--s)),calc(-48px*var(--s)))}}' +
  /* Petal drift — a few petals, a real petal shape in two tones, falling on a slow S with a soft turn; fading in and out. ◆ */
  `${K('petals')}{left:var(--x);top:-8%;width:calc(16px*var(--s));height:calc(24px*var(--s));border-radius:80% 20% 60% 40%/60% 40% 70% 30%;background:linear-gradient(160deg,var(--c2) 0,var(--c1) 55%,var(--c3) 100%);box-shadow:inset calc(2px*var(--s)) calc(-2px*var(--s)) calc(4px*var(--s)) rgba(255,255,255,.18),0 calc(2px*var(--s)) calc(4px*var(--s)) rgba(0,0,0,.14);filter:blur(var(--b));opacity:0;animation:sn-fx-fall var(--d) linear infinite var(--dl),sn-fx-sway calc(var(--d)/4) ease-in-out infinite alternate var(--dl)}` +
  '@keyframes sn-fx-fall{0%{opacity:0;transform:translateY(0)}8%{opacity:var(--o)}88%{opacity:var(--o)}100%{opacity:0;transform:translateY(var(--T))}}' +
  '@keyframes sn-fx-sway{from{translate:calc(-14px*var(--s)) 0;rotate:-28deg;scale:1 .92}to{translate:calc(14px*var(--s)) 0;rotate:32deg;scale:1 1}}' +
  /* Lanterns — four, large and far apart: a ribbed paper body, a cap, a base and a tassel, a warm halo, a slow rise. ◆ */
  `${K('lanterns')}{left:var(--x);bottom:-20%;width:calc(34px*var(--s));height:calc(46px*var(--s));border-radius:48% 48% 46% 46%/34% 34% 66% 66%;background:repeating-linear-gradient(90deg,rgba(0,0,0,0) 0 calc(5px*var(--s)),rgba(0,0,0,.07) calc(5px*var(--s)) calc(6px*var(--s))),radial-gradient(ellipse at 50% 62%,var(--c2) 0,var(--c1) 34%,var(--c3) 100%);box-shadow:0 0 calc(40px*var(--s)) var(--c1-45),0 0 calc(90px*var(--s)) var(--c1-12);filter:blur(var(--b));opacity:0;animation:sn-fx-lrise var(--d) linear infinite var(--dl),sn-fx-lsway calc(var(--d)/5) ease-in-out infinite alternate var(--dl)}` +
  `${K('lanterns')}:before{content:"";position:absolute;left:28%;right:28%;top:calc(-4px*var(--s));height:calc(6px*var(--s));border-radius:3px 3px 1px 1px;background:var(--c3);box-shadow:0 calc(1px*var(--s)) 0 var(--c3-35)}` +
  `${K('lanterns')}:after{content:"";position:absolute;left:50%;bottom:calc(-16px*var(--s));width:calc(2px*var(--s));height:calc(16px*var(--s));margin-left:calc(-1px*var(--s));background:linear-gradient(180deg,var(--c3) 0 35%,var(--c1) 35% 100%);border-radius:0 0 2px 2px}` +
  `${LIGHT('lanterns')}{box-shadow:0 0 calc(22px*var(--s)) var(--c1-35),0 calc(6px*var(--s)) calc(14px*var(--s)) var(--c3-20)}` +
  '@keyframes sn-fx-lrise{0%{opacity:0;transform:translateY(0) rotate(-1deg)}10%{opacity:var(--o)}90%{opacity:var(--o)}100%{opacity:0;transform:translateY(calc(-1*var(--T))) rotate(1deg)}}' +
  '@keyframes sn-fx-lsway{from{translate:calc(-10px*var(--s)) 0}to{translate:calc(10px*var(--s)) 0}}' +
  /* Gold shimmer — two faint glints in the frame… ◆ */
  `${K('shimmer')}{left:var(--x);top:var(--y);width:calc(110px*var(--s));height:1px;background:linear-gradient(90deg,transparent,var(--c1-45) 40%,var(--c2-85) 50%,var(--c1-45) 60%,transparent);transform:rotate(-24deg);opacity:0;animation:sn-fx-glint var(--d) ease-in-out infinite var(--dl)}` +
  `${LIGHT('shimmer')}{mix-blend-mode:multiply}` +
  '@keyframes sn-fx-glint{0%{opacity:0;transform:rotate(-24deg) translate(calc(-40px*var(--s)),calc(16px*var(--s)))}50%{opacity:var(--o)}100%{opacity:0;transform:rotate(-24deg) translate(calc(50px*var(--s)),calc(-20px*var(--s)))}}' +
  /* …and the light passing over the NAMES (light on gold type): the shipped foil technique, one heading. On a light
     ground the light is gold, not cream — a cream glint on dark ink over cream paper would read as the name vanishing. */
  `${NAMES}{background-image:linear-gradient(100deg,currentColor 0 38%,#FFF4CC 50%,currentColor 62% 100%);background-size:260% 100%;background-position:120% 0;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:sn-fx-sweep 7.5s ease-in-out infinite}` +
  `${NAMES_ON_LIGHT}{background-image:linear-gradient(100deg,currentColor 0 38%,#C9A24B 50%,currentColor 62% 100%)}` +
  '@keyframes sn-fx-sweep{0%,55%{background-position:120% 0}100%{background-position:-60% 0}}' +
  /* Light leak — one warm band of light breathing across the frame, like film. ◆ */
  `${K('leak')}{left:-30%;top:-40%;width:160%;height:180%;background:linear-gradient(100deg,transparent 30%,var(--c1-35) 46%,var(--c2-55) 52%,var(--c1-35) 58%,transparent 72%);transform:rotate(-18deg);opacity:0;mix-blend-mode:screen;filter:blur(calc(10px*var(--s)));animation:sn-fx-leak var(--d) ease-in-out infinite var(--dl)}` +
  `${LIGHT('leak')}{mix-blend-mode:multiply}` +
  '@keyframes sn-fx-leak{0%{opacity:0;transform:rotate(-18deg) translateX(-22%)}40%{opacity:var(--o)}100%{opacity:0;transform:rotate(-18deg) translateX(22%)}}' +
  /* Film grain — fine static noise, three frames stepping (each its own drawn SVG; only its opacity changes). ◆ */
  `${K('grain')}{inset:0;opacity:var(--go)}` +
  `${A}[data-ambient-effect="grain"] svg{position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:overlay;opacity:0;will-change:opacity;animation:sn-fx-grain 1.2s steps(1) infinite}` +
  `${A}[data-ambient-effect="grain"] svg:nth-of-type(2){animation-delay:-.4s}${A}[data-ambient-effect="grain"] svg:nth-of-type(3){animation-delay:-.8s}` +
  '@keyframes sn-fx-grain{0%,33%{opacity:1}34%,100%{opacity:0}}' +
  /* REDUCE MOTION = A FINISHED STILL, DRAWN WITHOUT ANY ANIMATION. Each shape stands where it would be `--p` of the way
     through its cycle (`--g`: a glint's or a mote's brightness there) — a static pose, per effect; the grain shows its
     first frame; the names are plain.
     🪤 TWICE MEASURED IN A BROWSER (2026-10-08), twice wrong before this:
       1 · a plain `animation-play-state:paused` lost to each shape's own rule (596 animations kept running);
       2 · pausing with `!important` worked on a bare page and NOT in the app: `globals.css` (`@layer base`) answers
           reduce motion for every element with `animation-duration:.001ms · animation-delay:.001ms · iteration-count:1`,
           all `!important` — and an important declaration in a layer outranks any unlayered one. So every animation
           ended at once at its START.
     So the still asks nothing of the animation machinery: the animation is taken off and the pose is plain CSS. */
  `@media (prefers-reduced-motion:reduce){${A} i,${A} svg,${NAMES}{animation-name:none!important}` +
  `${K('haze')}{transform:translate(calc(12%*var(--p) - 6%),calc(7%*var(--p) - 3%))}` +
  `${K('bokeh')}{opacity:calc(var(--o)*.75);transform:translate(calc(22px*var(--s)*var(--p)),calc(-14px*var(--s)*var(--p)))}` +
  `${K('dust')}{opacity:calc(var(--o)*var(--g));transform:translate(calc(10px*var(--s)*var(--p)),calc(-48px*var(--s)*var(--p)))}` +
  `${K('petals')}{opacity:var(--o);transform:translateY(calc(var(--p)*var(--T)));rotate:calc(60deg*var(--p) - 28deg)}` +
  `${K('lanterns')}{opacity:var(--o);transform:translateY(calc(-1*var(--p)*var(--T)))}` +
  `${K('shimmer')}{opacity:calc(var(--o)*var(--g));transform:rotate(-24deg) translate(calc((90px*var(--p) - 40px)*var(--s)),calc((16px - 36px*var(--p))*var(--s)))}` +
  `${K('leak')}{opacity:calc(var(--o)*.7);transform:rotate(-18deg) translateX(calc(44%*var(--p) - 22%))}` +
  `${A}[data-ambient-effect="grain"] svg:nth-of-type(1){opacity:1}` +
  `${NAMES},${NAMES_ON_LIGHT}{background-image:none;-webkit-text-fill-color:currentColor}` +
  '}';
