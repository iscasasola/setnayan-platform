/**
 * lib/cover-entrance.ts — 🎬 THE COVER SCENE'S ONE ENTRANCE.
 *
 * Owner-approved 2026-10-16 on `Setnayan/prototypes/cover_scene_edit_animate_2026-10-16.html` (DECISION_LOG "APPROVED —
 * THE COVER SCENE'S OWN EDIT · STYLE (OPENING) · ANIMATE, WITH SHIMMER AND 'CONFIRM ATTENDANCE'", amended the same evening
 * by "THE COVER: WORDS IN THE UPPER PART, AN RSVP BUTTON AND A 'SWIPE UP' HINT AT THE FOOT" and "SHIMMER IS AN ANIMATE
 * EFFECT FOR ANY TEXT · 'CONFIRM ATTENDANCE' IS THE RSVP").
 *
 * ── THE ENTRANCE ────────────────────────────────────────────────────────────────────────────────────────────────
 * Cover Scene › Animate › Entrance ▾ — ONE pick for the whole cover. Each entrance sets every word's Build in (the
 * shipped four effects, `MotionFx`) and its Delay — and a Delay has three steps (None · Short 0.3 s · Long 0.8 s,
 * `HUB_EL_DELAY`), so an entrance has at most THREE BEATS: nothing new is invented. Movement ◆ sets every word's speed
 * (Quick · Calm · Cinematic — the shipped `speed`).
 *
 * 🔑 STORED AS ONE VALUE, RESOLVED AT READ TIME (the prototype's own rule): `canvas.entrance` on the hero row
 * (`HubSectionCanvas.entrance`), never written into seven elements. `resolveCoverEntrance` lays it on each word that
 * stores NO Build in of its own — a word's own Build in wins, and a later entrance pick still reaches every word that
 * follows. Absent = The theme's own: nothing is laid (with a veil the shipped default plays — `lib/hub-veil.ts`).
 * "Still" = no entrance at all (after an unveil the words appear together).
 *
 * The RSVP button enters LAST in every entrance (the owner: *"Both enter last, after the unveil"*).
 *
 * Pure. No I/O, no React. Held by `lib/the-cover-scene-has-its-own-animate.test.ts`.
 */
import type { HubElSpeed, HubElementMotion, HubElementStyles, HubHeroElementKey } from './element-style';
import type { MotionFx } from './motion-effects';

export const COVER_ENTRANCE_KEYS = ['names', 'top', 'once', 'soft', 'sides', 'still'] as const;
export type CoverEntranceKey = (typeof COVER_ENTRANCE_KEYS)[number];
/** The Animate dropdown's choices — 'theme' is the absence (nothing stored). */
export type CoverEntranceChoice = CoverEntranceKey | 'theme';
/** What the hero row stores (`HubSectionCanvas.entrance`). */
export type HubCoverEntrance = { key: CoverEntranceKey; speed?: HubElSpeed };

type Beat = 'none' | 'short' | 'long';
type WordIn = { fx: MotionFx; d: Beat };

const FADE: MotionFx = { fade: true };
const RISE: MotionFx = { fade: true, move: 'below' };
const BLUR: MotionFx = { fade: true, blur: true };
/** 🔘 The RSVP button enters last, in every entrance that moves (the prototype's `FOOT_LAST`). */
const FOOT_LAST: WordIn = { fx: RISE, d: 'long' };

/** Each entrance, word by word — the prototype's `ENTRANCES`, on the hero's element keys. */
export const COVER_ENTRANCES: ReadonlyArray<{ key: CoverEntranceChoice; label: string; sub: string; set: Partial<Record<HubHeroElementKey, WordIn>> }> = [
  { key: 'theme', label: 'The theme’s own', sub: 'Each word as the look plays it today — nothing stored', set: {} },
  {
    key: 'names',
    label: 'Event title first',
    sub: 'The names rise alone, then the top line and the mark, then the day',
    set: { names: { fx: RISE, d: 'none' }, mark: { fx: FADE, d: 'short' }, eyebrow: { fx: FADE, d: 'short' }, line: { fx: RISE, d: 'long' }, date: { fx: RISE, d: 'long' }, time: { fx: RISE, d: 'long' }, venue: { fx: RISE, d: 'long' }, caption: { fx: RISE, d: 'long' }, link: { fx: FADE, d: 'long' }, rsvp: FOOT_LAST },
  },
  {
    key: 'top',
    label: 'Top to bottom',
    sub: 'Top line and mark, then the names, then the day',
    set: { eyebrow: { fx: FADE, d: 'none' }, mark: { fx: FADE, d: 'none' }, names: { fx: RISE, d: 'short' }, line: { fx: RISE, d: 'long' }, date: { fx: RISE, d: 'long' }, time: { fx: RISE, d: 'long' }, venue: { fx: RISE, d: 'long' }, caption: { fx: RISE, d: 'long' }, link: { fx: RISE, d: 'long' }, rsvp: FOOT_LAST },
  },
  {
    key: 'once',
    label: 'All together',
    sub: 'Every word fades in at once — the RSVP button last',
    set: { eyebrow: { fx: FADE, d: 'none' }, mark: { fx: FADE, d: 'none' }, names: { fx: FADE, d: 'none' }, line: { fx: FADE, d: 'none' }, date: { fx: FADE, d: 'none' }, time: { fx: FADE, d: 'none' }, venue: { fx: FADE, d: 'none' }, caption: { fx: FADE, d: 'none' }, link: { fx: FADE, d: 'none' }, rsvp: FOOT_LAST },
  },
  {
    key: 'soft',
    label: 'Soft focus',
    sub: 'Blur clears on the names first, then on the rest',
    set: { names: { fx: BLUR, d: 'none' }, eyebrow: { fx: BLUR, d: 'short' }, mark: { fx: BLUR, d: 'short' }, line: { fx: BLUR, d: 'long' }, date: { fx: BLUR, d: 'long' }, time: { fx: BLUR, d: 'long' }, venue: { fx: BLUR, d: 'long' }, caption: { fx: BLUR, d: 'long' }, link: { fx: BLUR, d: 'long' }, rsvp: FOOT_LAST },
  },
  {
    key: 'sides',
    label: 'From the sides',
    sub: 'The names grow in; the lines come from left and right',
    set: {
      names: { fx: { fade: true, size: 'grow' }, d: 'none' },
      mark: { fx: { fade: true, move: 'above' }, d: 'short' },
      eyebrow: { fx: { fade: true, move: 'above' }, d: 'short' },
      line: { fx: { fade: true, move: 'left' }, d: 'long' },
      date: { fx: { fade: true, move: 'left' }, d: 'long' },
      time: { fx: { fade: true, move: 'right' }, d: 'long' },
      venue: { fx: { fade: true, move: 'right' }, d: 'long' },
      caption: { fx: { fade: true, move: 'right' }, d: 'long' },
      link: { fx: FADE, d: 'long' },
      rsvp: FOOT_LAST,
    },
  },
  { key: 'still', label: 'Still', sub: 'No entrance — the words are simply there (after an unveil, they appear together)', set: {} },
];

const isKey = (v: unknown): v is CoverEntranceKey => typeof v === 'string' && (COVER_ENTRANCE_KEYS as readonly string[]).includes(v);

/** Anything → the stored entrance, or null (The theme's own). A speed is kept only beside an entrance that moves. */
export function sanitizeCoverEntrance(raw: unknown): HubCoverEntrance | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  if (!isKey(src.key)) return null;
  const out: HubCoverEntrance = { key: src.key };
  if (src.key !== 'still' && (src.speed === 'fast' || src.speed === 'gentle')) out.speed = src.speed;
  return out;
}

/** The dropdown's value for a stored entrance. */
export function coverEntranceChoice(e: HubCoverEntrance | null | undefined): CoverEntranceChoice {
  return e?.key ?? 'theme';
}

/** One word's Build in from the cover's entrance — null where the entrance lays nothing on it. */
export function coverEntranceFor(e: HubCoverEntrance | null | undefined, key: HubHeroElementKey): HubElementMotion | null {
  if (!e || e.key === 'still') return null;
  const w = COVER_ENTRANCES.find((x) => x.key === e.key)?.set[key];
  if (!w) return null;
  return { in: { ...w.fx }, ...(w.d !== 'none' ? { delay: w.d } : {}), ...(e.speed ? { speed: e.speed } : {}) };
}

/** Does this word store a Build in of its own (and so leave the cover's entrance)? */
export function coverWordIsOwn(elements: HubElementStyles | null | undefined, key: HubHeroElementKey): boolean {
  return Boolean(elements?.[key]?.motion?.in);
}

/**
 * 🔑 THE RESOLVER: the hero's elements with the cover's entrance laid on every word that stores no Build in of its own.
 * A word's own Build in wins (its Delay and its speed with it); a word's own Action, Build out and look stay. Nothing
 * stored, or Still → the elements as they are.
 */
export function resolveCoverEntrance(
  entrance: HubCoverEntrance | null | undefined,
  elements: HubElementStyles | null | undefined,
): HubElementStyles | null {
  if (!entrance || entrance.key === 'still') return elements ?? null;
  const set = COVER_ENTRANCES.find((x) => x.key === entrance.key)?.set ?? {};
  const out: HubElementStyles = { ...(elements ?? {}) };
  for (const key of Object.keys(set) as HubHeroElementKey[]) {
    if (coverWordIsOwn(elements, key)) continue;
    const laid = coverEntranceFor(entrance, key);
    if (!laid) continue;
    const style = elements?.[key] ?? {};
    /* A word that follows the scroll keeps its drive; a Delay never rides beside a scroll (the sanitiser's own rule). */
    const motion: HubElementMotion = { ...(style.motion ?? {}), ...laid };
    if (motion.timeline === 'scroll') delete motion.delay;
    out[key] = { ...style, motion };
  }
  return out;
}

/** "Still" — no word enters: after an unveil the lines appear together (the masthead marks every line its own). */
export function coverEntranceIsStill(e: HubCoverEntrance | null | undefined): boolean {
  return e?.key === 'still';
}

/** 🥁 THE BEATS (Animate's row 3): which shown words arrive on each of the three beats, in reading order. */
export function coverEntranceBeats(
  entrance: HubCoverEntrance | null | undefined,
  elements: HubElementStyles | null | undefined,
  words: ReadonlyArray<{ key: HubHeroElementKey; label: string }>,
): string[][] {
  const resolved = resolveCoverEntrance(entrance, elements);
  const beats: string[][] = [[], [], []];
  for (const w of words) {
    const m = resolved?.[w.key]?.motion;
    if (!m?.in || resolved?.[w.key]?.hidden) continue;
    beats[m.delay === 'long' ? 2 : m.delay === 'short' ? 1 : 0]!.push(w.label);
  }
  return beats.filter((b) => b.length > 0);
}

/** ↺ "Reset to the cover's entrance ›": the words' own Build in (with its Delay and speed) taken off. */
export function withoutOwnEntrance(elements: HubElementStyles | null | undefined, keys: readonly HubHeroElementKey[]): HubElementStyles | null {
  if (!elements) return null;
  const out: HubElementStyles = { ...elements };
  for (const key of keys) {
    const style = out[key];
    if (!style?.motion?.in) continue;
    const { in: _in, delay: _delay, speed: _speed, ...rest } = style.motion;
    void _in;
    void _delay;
    void _speed;
    const next = { ...style };
    if (Object.keys(rest).length > 0) next.motion = rest;
    else delete next.motion;
    if (Object.keys(next).length > 0) out[key] = next;
    else delete out[key];
  }
  return Object.keys(out).length > 0 ? out : null;
}

