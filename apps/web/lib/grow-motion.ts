/**
 * grow-motion.ts — 🎞 THE APPROVED MOTION SYSTEM, ONE PLACE FOR SCRIPT (owner 2026-11-13, DECISION_LOG "Motion system
 * approved": *"motion approved"*; prototype `prototypes/approved_2026-11-13/grow-full-screen-fable.html`, artifact
 * CnEGqnNxRH9QcTsbgrFHNC v1). The CSS half is the `--sn-dur-*` / `--sn-ease-emph` block in `app/globals.css`; these
 * numbers mirror it (a test holds them equal), for the parts that move through the Web Animations API.
 *
 * ── THE GROW (a full-screen layer or a sheet opening out of the thing you pressed) ─────────────────────────────────
 * The prototype's timeline counts from touch-down: the press 0–120 ms, the shape 120–480, content in three steps from
 * 320 (40 ms apart, 180 each), ✕ and the bottom bar last at 440–640. In the app the press is the finger's own — it has
 * already played (`PressFeel`) by the time the click mounts the layer — so this timeline starts at the SHAPE: every
 * window below is the prototype's minus 120 ms. Nothing is added after a tap that the finger did not already cover.
 *
 * The close is the MIRROR at 80 %: each window [at, at+ms] of the open becomes [(TOTAL − at − ms) × .8, ms × .8] played
 * with `direction: 'reverse'` — the reverse of the emphasized curve in time IS the prototype's close curve
 * `cubic-bezier(1,0,.8,1)`, so no second curve is needed. The chrome leaves first, the shape last, into the same thing.
 *
 * Only transform and opacity move, plus the shape's clip on ONE layer. Reduced motion: a 120 ms cross-fade, nothing
 * travels, the page behind stays put. Pure numbers and frames are tested; `playGrow` does nothing on the server.
 * (Not `lib/motion.ts`: that mirrors three older tokens for the guest's Event Hub, which keeps its own motion.)
 * 🔒 lib/the-motion-system-is-shared.test.ts
 */

/** The timing table (§ 6 of the prototype). Mirrors `--sn-dur-*` in globals.css. */
export const TIMING = {
  pressMs: 100,
  releaseMs: 280,
  growPressMs: 120,
  openMs: 360,
  closeRatio: 0.8,
  stepMs: 40,
  rowOpenMs: 320,
  rowShutMs: 260,
  toggleMs: 260,
  chipMs: 220,
  chipOutMs: 180,
  fieldMs: 280,
  snapMs: 220,
  reducedMs: 120,
} as const;

/** Anything that travels or opens. */
export const EASE_EMPH = 'cubic-bezier(.2,0,0,1)';
/** Anything that lets go — the house spring (`--sn-pill-spring`). */
export const EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)';

/** A button dips to .97 on touch-down; a row (wide) only to .985. */
export const PRESS_SCALE = 0.97;
export const ROW_PRESS_SCALE = 0.985;
/** At or past this width a pressed thing is a row, not a button. */
export const ROW_MIN_WIDTH = 300;
/** The page behind steps back to .96 while a layer grows over it. */
export const BEHIND_SCALE = 0.96;
/** Each content step rises this far as it fades in. */
export const STEP_RISE_PX = 10;

export function pressScale(width: number, isRow = false): number {
  return isRow || width >= ROW_MIN_WIDTH ? ROW_PRESS_SCALE : PRESS_SCALE;
}

export type GrowPart = 'shape' | 'behind' | 'label' | 'step1' | 'step2' | 'step3' | 'chrome' | 'bar';

/** Each part's window, in ms from the moment the layer mounts (the prototype's, minus the 120-ms press). */
export const GROW_WINDOWS: Record<GrowPart, { at: number; ms: number }> = {
  shape: { at: 0, ms: TIMING.openMs },
  behind: { at: 0, ms: TIMING.openMs },
  label: { at: 0, ms: TIMING.openMs },
  step1: { at: 200, ms: 180 },
  step2: { at: 200 + TIMING.stepMs, ms: 180 },
  step3: { at: 200 + 2 * TIMING.stepMs, ms: 180 },
  chrome: { at: 320, ms: 160 },
  bar: { at: 320, ms: 200 },
};

/** Press-to-last-part of the open, from mount (prototype: 640 from touch-down). */
export const GROW_TOTAL_MS = Math.max(...Object.values(GROW_WINDOWS).map((w) => w.at + w.ms));

export type GrowTiming = { delay: number; duration: number; easing: string; direction: PlaybackDirection; fill: FillMode };

/** One part's timing — the open window, or its mirror at 80 % for the close. */
export function growTiming(part: GrowPart, close = false): GrowTiming {
  const { at, ms } = GROW_WINDOWS[part];
  // One curve for every part (the prototype's rule: the shape, the travelling label and the page behind read as one move).
  const easing = EASE_EMPH;
  if (!close) return { delay: at, duration: ms, easing, direction: 'normal', fill: 'backwards' };
  const k = TIMING.closeRatio;
  return {
    delay: Math.round((GROW_TOTAL_MS - at - ms) * k),
    duration: Math.round(ms * k),
    easing,
    direction: 'reverse',
    fill: 'forwards',
  };
}

/** The close as a whole: 80 % of the open. */
export const GROW_CLOSE_TOTAL_MS = Math.round(GROW_TOTAL_MS * TIMING.closeRatio);

export type Rect = { left: number; top: number; width: number; height: number };

/**
 * A sheet grows OUT OF the pressed thing: at frame 0 the panel is moved so its corner sits on the pressed thing's corner
 * and clipped to the pressed thing's size, so what shows is exactly that box; at rest it is in place, unclipped (the end
 * clip reaches past the panel, so its shadow is never cut and nothing changes when the clip is dropped). Transform + one
 * clip, on one layer.
 */
export function growFrames(from: Rect, to: Rect, radius = 14): Keyframe[] {
  const r = (n: number) => Math.round(n * 10) / 10;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const right = Math.max(0, to.width - from.width);
  const bottom = Math.max(0, to.height - from.height);
  return [
    { transform: `translate(${r(dx)}px, ${r(dy)}px)`, clipPath: `inset(0px ${r(right)}px ${r(bottom)}px 0px round ${radius}px)` },
    { transform: 'none', clipPath: 'inset(-120px -120px -120px -120px round 0px)' },
  ];
}

/** The label (the pressed thing's words) travelling into the layer's title: from where it was, to where it lands. */
export function labelFrames(from: Rect, to: Rect): Keyframe[] {
  const r = (n: number) => Math.round(n * 10) / 10;
  const dx = from.left - to.left;
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return [
    { transform: `translate(${r(dx)}px, ${r(dy)}px)`, opacity: 0.4 },
    { transform: 'none', opacity: 1 },
  ];
}

export const STEP_FRAMES: Keyframe[] = [
  { opacity: 0, transform: `translateY(${STEP_RISE_PX}px)` },
  { opacity: 1, transform: 'none' },
];
export const CHROME_FRAMES: Keyframe[] = [
  { opacity: 0, transform: 'scale(.8)' },
  { opacity: 1, transform: 'none' },
];
export const BAR_FRAMES: Keyframe[] = [{ transform: 'translateY(100%)' }, { transform: 'none' }];
export const BEHIND_FRAMES: Keyframe[] = [{ scale: '1' }, { scale: String(BEHIND_SCALE) }];
export const FADE_FRAMES: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
export const REDUCED_TIMING: KeyframeAnimationOptions = { duration: TIMING.reducedMs, easing: 'linear' };

// ── the client half ────────────────────────────────────────────────────────────────────────────────────────────────

export type GrowParts = {
  /** The one layer whose clip/transform IS the shape (already animated by its owner when null). */
  shape?: { el: HTMLElement; frames: Keyframe[] } | null;
  /** The words that travel into the title. */
  label?: { el: HTMLElement; frames: Keyframe[] } | null;
  step1?: Element[];
  step2?: Element[];
  step3?: Element[];
  /** ✕ and ⓘ — arrive last, leave first. */
  chrome?: Element[];
  /** The bottom bar — slides up last, down first. */
  bar?: Element[];
  /** Step the page behind back and dim it (a full-screen layer). Off for a sheet: its own scrim already dims. */
  behind?: boolean;
  /** Where the dim is drawn: just under this layer, in its parent. */
  layer?: HTMLElement | null;
};

const can = (el: Element | null | undefined): el is HTMLElement => !!el && typeof (el as HTMLElement).animate === 'function';

export function prefersReducedMotionNow(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/**
 * The page behind a full-screen layer: the page's <main> — only when it holds nothing pinned to the screen (`.fixed`),
 * since a scaled ancestor would carry a pinned thing with it for a frame (a jump is a bug). Then only the dim plays.
 */
export function pageBehind(layer: HTMLElement | null): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  for (const m of Array.from(document.querySelectorAll<HTMLElement>('main'))) {
    if (layer && (m.contains(layer) || layer.contains(m))) continue;
    if (m.closest('[role="dialog"]')) continue;
    if (m.querySelector('.fixed, [data-thumb-row]')) return null;
    return m;
  }
  return null;
}

/**
 * Play the grow's parts — the open, or (`close`) the mirror at 80 %. Resolves when the last part has played. Under
 * reduced motion only the shape cross-fades (120 ms); the parts and the page behind stay still.
 */
export function playGrow(parts: GrowParts, { close = false, reduced = prefersReducedMotionNow() }: { close?: boolean; reduced?: boolean } = {}): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const runs: Animation[] = [];
  const run = (el: Element | null | undefined, frames: Keyframe[], part: GrowPart) => {
    if (!can(el)) return;
    const t = growTiming(part, close);
    runs.push(el.animate(frames, t));
  };
  if (reduced) {
    if (can(parts.shape?.el)) runs.push(parts.shape!.el.animate(FADE_FRAMES, { ...REDUCED_TIMING, direction: close ? 'reverse' : 'normal', fill: close ? 'forwards' : 'none' }));
    return settle(runs);
  }
  if (parts.shape) run(parts.shape.el, parts.shape.frames, 'shape');
  if (parts.label) run(parts.label.el, parts.label.frames, 'label');
  for (const el of parts.step1 ?? []) run(el, STEP_FRAMES, 'step1');
  for (const el of parts.step2 ?? []) run(el, STEP_FRAMES, 'step2');
  for (const el of parts.step3 ?? []) run(el, STEP_FRAMES, 'step3');
  for (const el of parts.chrome ?? []) run(el, CHROME_FRAMES, 'chrome');
  for (const el of parts.bar ?? []) run(el, BAR_FRAMES, 'bar');
  if (parts.behind) {
    const page = pageBehind(parts.layer ?? null);
    if (page) {
      const r = page.getBoundingClientRect();
      const before = page.style.transformOrigin;
      page.style.transformOrigin = `${Math.round(window.innerWidth / 2 - r.left)}px ${Math.round(window.innerHeight / 2 - r.top)}px`;
      // No fill: at the end of the open the layer covers it, and it is back at 1 underneath — nothing stays scaled.
      const t = growTiming('behind', close);
      const a = page.animate(BEHIND_FRAMES, { ...t, fill: 'none' });
      const restore = () => {
        page.style.transformOrigin = before;
      };
      a.finished.then(restore, restore);
      runs.push(a);
    }
    const layer = parts.layer;
    if (layer?.parentElement) {
      // The dim: the house scrim's own look (`.sn-popup-dark`), marked as leaving so it is never counted as a scrim.
      const dim = document.createElement('div');
      dim.className = 'sn-popup-dark fixed inset-0';
      dim.setAttribute('aria-hidden', 'true');
      dim.setAttribute('data-scrim-leaving', '');
      dim.setAttribute('data-grow-dim', '');
      dim.style.pointerEvents = 'none';
      dim.style.zIndex = getComputedStyle(layer).zIndex;
      layer.parentElement.insertBefore(dim, layer);
      const t = growTiming('behind', close);
      const a = dim.animate(FADE_FRAMES, { ...t, easing: 'linear', fill: 'both' });
      const gone = () => dim.remove();
      a.finished.then(gone, gone);
      runs.push(a);
    }
  }
  return settle(runs);
}

function settle(runs: Animation[]): Promise<void> {
  return Promise.all(runs.map((a) => a.finished.catch(() => undefined))).then(() => undefined);
}

/** The first screenful of a body, split into the three steps: its head, its first block, the rest (at most eight). */
export function bodySteps(head: Element | null | undefined, body: Element | null | undefined): Pick<GrowParts, 'step1' | 'step2' | 'step3'> {
  const kids = body ? Array.from(body.children).filter((c) => !(c instanceof HTMLTemplateElement)) : [];
  return {
    step1: head ? [head] : [],
    step2: kids.slice(0, 1),
    step3: kids.slice(1, 9),
  };
}
