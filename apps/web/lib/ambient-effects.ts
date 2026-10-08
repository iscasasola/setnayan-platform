/**
 * lib/ambient-effects.ts — THE SIX EFFECTS THAT LIE ON TOP OF THE BACKGROUND, UNDER THE WORDS.
 *
 * Owner, 2026-10-08 (DECISION_LOG "LOOK EFFECTS ROUND 4" · "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A "The effects — art direction", approved prototype
 * `background_sources_amend_2026-10-08_fable.html` `fxHTML` + `.fx-*`): *"improve the overall look of these
 * effect"* · *"i also want the gold shimmer and bokeh lights"* · *"the effects like lanters has a color on the
 * lantern, same petal color, sparkle color. so, show color choice"*.
 *
 *   Lanterns ◆ · Falling petals ◆ · Sparkles · Capiz glow ◆ · Gold shimmer ◆ · Bokeh lights
 *
 * ONE ENGINE, THREE PLACES — the guest's Event Hub, Studio › Look's sample screen, and the carousel's
 * miniatures all draw `ambientEffectSpec()` through ONE layer (`app/[slug]/_components/ambient-effect.tsx`).
 * Nothing else draws an effect.
 *
 * WHAT AN EFFECT IS: a handful of drawn shapes (`<i>`, CSS only — never an image, never an emoji), each animated
 * by CSS on `transform` · `translate` · `rotate` · `scale` · `opacity` and nothing else (the compositor's own
 * properties: no layout, no paint of the page). So:
 *   · ZERO REQUESTS — no image, no font, no script is fetched for an effect;
 *   · ZERO JAVASCRIPT on the guest page — the layer is plain HTML and one `<style>`;
 *   · REDUCE MOTION = A FINISHED STILL — every shape has a negative delay, so pausing the animation (never
 *     removing it) leaves each one mid-flight;
 *   · A READABLE BAND — the layer is masked to half strength across the middle, where the words sit;
 *   · LIGHT AND DARK GROUNDS — glows and blends swap (`data-ambient-ground`).
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
 * rule for rule), the page's own contrast maths (`lib/hub-legibility.ts`), and the palette's slot names.
 *
 * Pure. Held by `lib/the-effects-are-six-and-cost-nothing.test.ts`.
 */
import { HUB_MAIN_EFFECTS, type HubMainEffect, type HubMainEffectColour, type HubMainEffectIntensity, type HubMainEffectKind } from './hub-canvas';
import { compositeOver, contrastRatio, relativeLuminance } from './hub-legibility';

export const AMBIENT_EFFECT_LABEL: Readonly<Record<HubMainEffectKind, string>> = {
  lanterns: 'Lanterns',
  petals: 'Falling petals',
  sparkles: 'Sparkles',
  capiz: 'Capiz glow',
  shimmer: 'Gold shimmer',
  bokeh: 'Bokeh lights',
};

/** ◆ Event Hub Pro — the approved prototype's marks: Sparkles and Bokeh lights are free, the other four Pro. */
export const AMBIENT_EFFECT_IS_PRO: Readonly<Record<HubMainEffectKind, boolean>> = {
  lanterns: true,
  petals: true,
  sparkles: false,
  capiz: true,
  shimmer: true,
  bokeh: false,
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

/** Shapes on a 375-px phone at Standard — the art direction's table. A spec, capped: never more than `AMBIENT_COUNT_CAP`. */
export const AMBIENT_COUNT: Readonly<Record<HubMainEffectKind, number>> = { lanterns: 8, petals: 12, sparkles: 16, capiz: 9, shimmer: 14, bokeh: 9 };
export const AMBIENT_INTENSITY_SCALE: Readonly<Record<HubMainEffectIntensity, number>> = { subtle: 0.6, standard: 1, lavish: 1.5 };
export const AMBIENT_COUNT_CAP = 24;
/** A card's miniature draws fewer, smaller shapes — the same ones. */
const MINI_COUNT = 0.7;
const MINI_SIZE = 0.5;

/** One cycle, in seconds (± 30 %): nothing under 3 s but a twinkle. */
const PERIOD: Readonly<Record<HubMainEffectKind, number>> = { lanterns: 22, petals: 14, sparkles: 3.2, capiz: 5, shimmer: 9, bokeh: 18 };

export function ambientCount(kind: HubMainEffectKind, intensity: HubMainEffectIntensity, mini = false): number {
  return Math.min(AMBIENT_COUNT_CAP, Math.round(AMBIENT_COUNT[kind] * AMBIENT_INTENSITY_SCALE[intensity] * (mini ? MINI_COUNT : 1)));
}

/* ── colour ─────────────────────────────────────────────────────────────── */

/** An effect is decoration, not words — it must SHOW, not be read. */
export const AMBIENT_COLOUR_FLOOR = 2.4;

const mix = (a: string, b: string, t: number): string => compositeOver(b, t, a);
const rgba = (hex: string, a: number): string => {
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
 * The effect's own colours ("Original") — the prototype's: Lanterns a warm amber paper, Capiz a pearl shell,
 * Petals from the palette's Neutral and Accent 2, Sparkles cream on dark / Supporting on light, Bokeh warm
 * light, Gold shimmer gold. `bodies` are drawn from at random, shape by shape; `hi` · `deep` are shared.
 */
function original(kind: HubMainEffectKind, dark: boolean, five: readonly string[], ground: string): { bodies: string[]; hi: string; deep: string } {
  const [, sup = '#C5A059', , neu = '#C9A9A6', acc2 = '#D8C7B0'] = five;
  switch (kind) {
    case 'lanterns':
      return { bodies: ['#F6C97E'], hi: '#FFF1C9', deep: '#B8702A' };
    case 'capiz':
      return { bodies: ['#FFF6DC'], hi: '#FFFFFF', deep: '#E8D5B0' };
    case 'petals': {
      const a = mix(neu, '#FFFFFF', 0.5);
      const b = mix(neu, '#7A3D4E', 0.4);
      return { bodies: [a, b, mix(acc2, '#8A5A3A', 0.3)], hi: b, deep: mix(acc2, '#8A5A3A', 0.3) };
    }
    case 'sparkles':
      /* On a light page the star is the couple's Supporting — pulled like a picked colour, or a pale one would not show at all. */
      return { bodies: [dark ? '#FFF4D6' : ambientPull(sup, ground), dark ? '#FFFFFF' : ambientPull(sup, ground)], hi: '#FFFFFF', deep: mix(sup, '#000000', 0.35) };
    case 'shimmer':
      return { bodies: [dark ? '#F6DFA6' : '#C9A24E'], hi: '#FFF4D0', deep: '#8A6A22' };
    case 'bokeh':
      return { bodies: [dark ? '#FFE2B8' : '#E8C58F', '#FFF1D6', dark ? mix(acc2, '#FFE9B0', 0.5) : acc2], hi: '#FFF1D6', deep: '#B98D3C' };
  }
}

/** The swatch a Colour ▾ row shows for this effect as it would be drawn: the picked slot pulled, or the effect's own. */
export function ambientSwatch(effect: Pick<HubMainEffect, 'kind' | 'colour'>, ground: string, five: readonly string[]): string {
  const slot = effect.colour ? five[SLOT[effect.colour]] : null;
  if (slot) return ambientPull(slot, ground);
  return original(effect.kind, ambientGroundIsDark(ground), five, ground).bodies[0]!;
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

/** The prototype's generator — the same numbers from the same seed, so a still is the same still everywhere. */
function seeded(n: number): () => number {
  let x = n * 9301 + 49297;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

export type AmbientEffectSpec = {
  kind: HubMainEffectKind;
  ground: 'light' | 'dark';
  mini: boolean;
  /** The layer's CSS variables — the shared colours and their washes. */
  vars: Record<string, string>;
  /** One per shape — its place, depth (size · blur · opacity), period, negative delay and body colour. */
  particles: Record<string, string>[];
};

/**
 * THE ONE ANSWER to "what does this effect draw here?" — for the guest page, the sample screen and a card's
 * miniature alike. `ground` is `ambientGround(…)`; `five` the palette's five in slot order.
 */
export function ambientEffectSpec(effect: HubMainEffect, ground: string, five: readonly string[], mini = false): AmbientEffectSpec {
  const { kind, intensity } = effect;
  const dark = ambientGroundIsDark(ground);
  const slot = effect.colour ? five[SLOT[effect.colour]] : null;
  const picked = slot ? ambientTriad(ambientPull(slot, ground)) : null;
  const own = original(kind, dark, five, ground);
  const bodies = picked ? [picked[0]] : own.bodies;
  const hi = picked ? picked[1] : own.hi;
  const deep = picked ? picked[2] : own.deep;
  const n = ambientCount(kind, intensity, mini);
  const r = seeded((HUB_MAIN_EFFECTS.indexOf(kind) + 1) * 97 + n);
  const base = PERIOD[kind];
  const particles: Record<string, string>[] = [];
  for (let i = 0; i < n; i++) {
    const depth = r();
    const s = (0.55 + depth * 0.75) * (mini ? MINI_SIZE : 1);
    const x = r() * 96 + 2;
    const y = r() * 90 + 4;
    const d = base * (0.75 + r() * 0.6);
    const dl = -r() * base;
    const body = bodies.length > 1 ? bodies[Math.floor(r() * bodies.length)]! : bodies[0]!;
    particles.push({
      '--x': `${x.toFixed(1)}%`,
      '--y': `${y.toFixed(1)}%`,
      '--s': s.toFixed(2),
      '--b': depth < 0.25 ? '1.4px' : depth < 0.5 ? '.5px' : '0px',
      '--o': (0.5 + depth * 0.5).toFixed(2),
      '--d': `${d.toFixed(1)}s`,
      '--dl': `${dl.toFixed(1)}s`,
      ...(bodies.length > 1 ? { '--c1': body } : {}),
    });
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
      /* The washes a glow, a rim or a shell needs — worked out here, so the stylesheet needs no `color-mix()`. */
      '--c1-75': rgba(c1, 0.75),
      '--c1-45': rgba(c1, 0.45),
      '--c1-35': rgba(c1, 0.35),
      '--c1-12': rgba(c1, 0.12),
      '--c2-85': rgba(hi, 0.85),
      '--c2-55': rgba(hi, 0.55),
      '--c3-35': rgba(deep, 0.35),
      '--c3-20': rgba(deep, 0.2),
    },
    particles,
  };
}

/* ── the stylesheet ─────────────────────────────────────────────────────── */

/** The readable band: full strength at the edges, half across the middle, where the names, the date and the buttons sit. */
const BAND = 'linear-gradient(180deg,#000 0 12%,rgba(0,0,0,.5) 26%,rgba(0,0,0,.5) 82%,#000 94%)';
const A = '[data-ambient-effect]';
const K = (kind: HubMainEffectKind) => `${A}[data-ambient-effect="${kind}"] i`;
const LIGHT = (kind: HubMainEffectKind) => `${A}[data-ambient-effect="${kind}"][data-ambient-ground="light"] i`;

/**
 * Everything an effect needs, as ONE stylesheet string — drawn inline beside the layer, only where an effect is on.
 * 🔒 Held by the guard: every `@keyframes` here moves only transform · translate · rotate · scale · opacity; there
 * is no `url(`, no `@import`, no `@font-face`; the band's mask is present; reduce motion PAUSES (never removes).
 */
export const AMBIENT_EFFECT_CSS =
  /* The layer: its own size is the travel (`cqh`), with the viewport as the older browsers' stand-in. Where it
     sits (fixed behind the page, or filling a card) is its mount's own class — never set here. */
  `${A}{--T:125vh;overflow:hidden;pointer-events:none;container-type:size;-webkit-mask-image:${BAND};mask-image:${BAND}}` +
  `@supports (height:1cqh){${A}{--T:125cqh}}` +
  `${A}[data-ambient-mini]{-webkit-mask-image:none;mask-image:none}` +
  `${A} i{position:absolute;display:block;will-change:transform,opacity}` +
  /* Lanterns — a paper lantern with an inner glow, a cap and a string; rises on a slow tilt, swaying. */
  `${K('lanterns')}{left:var(--x);bottom:-14%;width:calc(26px*var(--s));height:calc(34px*var(--s));border-radius:46% 46% 44% 44%/38% 38% 62% 62%;background:radial-gradient(ellipse at 50% 58%,var(--c2) 0,var(--c1) 22%,var(--c3) 100%);box-shadow:0 0 calc(28px*var(--s)) var(--c1-75),0 0 calc(8px*var(--s)) var(--c2-55),inset 0 calc(-4px*var(--s)) calc(6px*var(--s)) var(--c3-35);filter:blur(var(--b));opacity:var(--o);animation:sn-fx-rise var(--d) linear infinite var(--dl),sn-fx-sway calc(var(--d)/2.6) ease-in-out infinite alternate var(--dl)}` +
  `${K('lanterns')}:before{content:"";position:absolute;left:50%;top:calc(-14px*var(--s));width:1px;height:calc(14px*var(--s));background:var(--c2-55)}` +
  `${K('lanterns')}:after{content:"";position:absolute;left:30%;right:30%;top:calc(-3px*var(--s));height:calc(5px*var(--s));border-radius:2px;background:var(--c3)}` +
  `${LIGHT('lanterns')}{box-shadow:0 0 calc(14px*var(--s)) var(--c3-35),inset 0 calc(-4px*var(--s)) calc(6px*var(--s)) var(--c3-35)}` +
  '@keyframes sn-fx-rise{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(calc(-1*var(--T))) rotate(2deg)}}' +
  '@keyframes sn-fx-sway{from{translate:calc(-8px*var(--s)) 0}to{translate:calc(8px*var(--s)) 0}}' +
  /* Falling petals — a leaf silhouette in two tones, falling on an S-shaped drift, turning with a flutter. */
  `${K('petals')}{left:var(--x);top:-10%;width:calc(19px*var(--s));height:calc(12px*var(--s));box-shadow:0 1px 2px rgba(0,0,0,.12);border-radius:100% 0 100% 0;background:linear-gradient(135deg,var(--c1),var(--c2));opacity:var(--o);filter:blur(var(--b));animation:sn-fx-fall var(--d) cubic-bezier(.4,.1,.6,.9) infinite var(--dl),sn-fx-turn calc(var(--d)/3) ease-in-out infinite alternate var(--dl)}` +
  '@keyframes sn-fx-fall{from{transform:translateY(0) translateX(0)}50%{transform:translateY(calc(.5*var(--T))) translateX(calc(18px*var(--s)))}to{transform:translateY(var(--T)) translateX(calc(-12px*var(--s)))}}' +
  '@keyframes sn-fx-turn{from{rotate:-40deg;scale:1 .7}to{rotate:50deg;scale:1 1}}' +
  /* Sparkles — a four-point star, twinkling in place. */
  `${K('sparkles')}{left:var(--x);top:var(--y);width:calc(10px*var(--s));height:calc(10px*var(--s));background:var(--c1);clip-path:polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%);filter:drop-shadow(0 0 calc(3px*var(--s)) var(--c1));animation:sn-fx-twinkle var(--d) ease-in-out infinite alternate var(--dl)}` +
  '@keyframes sn-fx-twinkle{from{opacity:.05;transform:scale(.4) rotate(0)}to{opacity:var(--o);transform:scale(1) rotate(25deg)}}' +
  /* Capiz glow — a translucent shell disc on a string, hanging from the top, swinging from its pivot. */
  `${K('capiz')}{left:var(--x);top:calc(-6% + var(--y));width:calc(22px*var(--s));height:calc(22px*var(--s));border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--c2-85),var(--c1-45) 55%,var(--c1-12) 100%);border:1px solid var(--c2-55);box-shadow:0 0 calc(10px*var(--s)) var(--c1-45);opacity:var(--o);transform-origin:50% calc(-40px*var(--s));animation:sn-fx-swing var(--d) ease-in-out infinite alternate var(--dl)}` +
  `${K('capiz')}:before{content:"";position:absolute;left:50%;top:calc(-40px*var(--s));width:1px;height:calc(40px*var(--s));background:var(--c2-55)}` +
  `${LIGHT('capiz')}{background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.95),var(--c1-35) 55%,var(--c1-12) 100%);border-color:var(--c3-35);box-shadow:0 1px calc(8px*var(--s)) var(--c3-20)}` +
  `${LIGHT('capiz')}:before{background:var(--c3-35)}` +
  '@keyframes sn-fx-swing{from{rotate:-6deg}to{rotate:6deg}}' +
  /* Bokeh lights — out-of-focus discs at three depths (the far ones biggest and softest), drifting slowly. */
  `${K('bokeh')}{left:var(--x);top:var(--y);width:calc(64px*var(--s));height:calc(64px*var(--s));border-radius:50%;background:radial-gradient(circle,var(--c1) 0,var(--c1) 55%,rgba(255,255,255,0) 72%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);filter:blur(calc(6px - 4px*var(--s)));opacity:calc(var(--o)*.7);mix-blend-mode:screen;animation:sn-fx-drift var(--d) ease-in-out infinite alternate var(--dl)}` +
  `${LIGHT('bokeh')}{mix-blend-mode:multiply;opacity:calc(var(--o)*.35)}` +
  '@keyframes sn-fx-drift{from{transform:translate(0,0) scale(.9)}to{transform:translate(calc(26px*var(--s)),calc(-18px*var(--s))) scale(1.1)}}' +
  /* Gold shimmer — a slender metallic glint gliding across and fading, like light on gold leaf. Never a burst. */
  `${K('shimmer')}{left:var(--x);top:var(--y);width:calc(70px*var(--s));height:1.5px;border-radius:1px;background:linear-gradient(90deg,transparent,var(--c1) 35%,var(--c2) 50%,var(--c1) 65%,transparent);transform:rotate(-32deg);opacity:0;animation:sn-fx-glint var(--d) ease-in-out infinite var(--dl)}` +
  `${K('shimmer')}:after{content:"";position:absolute;left:46%;top:-4px;width:8%;height:9px;border-radius:50%;background:radial-gradient(ellipse,var(--c2),transparent 70%)}` +
  `${LIGHT('shimmer')}{mix-blend-mode:multiply}` +
  '@keyframes sn-fx-glint{0%{opacity:0;transform:rotate(-32deg) translate(calc(-30px*var(--s)),calc(14px*var(--s)))}45%{opacity:var(--o)}100%{opacity:0;transform:rotate(-32deg) translate(calc(40px*var(--s)),calc(-18px*var(--s)))}}' +
  /* Reduce motion: every shape stops where its negative delay put it — a finished picture, never an empty one.
     🪤 `!important`, MEASURED IN A BROWSER: each shape's own rule is more specific than this one and its `animation`
     shorthand resets the play state to running — without it the query matched and every shape kept moving. */
  `@media (prefers-reduced-motion:reduce){${A} i{animation-play-state:paused!important}}`;
