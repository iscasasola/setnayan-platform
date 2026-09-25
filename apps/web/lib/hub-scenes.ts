/**
 * apps/web/lib/hub-scenes.ts
 *
 * HOW A SECTION TRAVELS ON THE PAGE — Scroll · Scrub · Auto-scroll, per section.
 *
 * Owner, 2026-09-24: *"so we can set both and hybrid. some can scrub some can
 * page move."* — then *"hybrid perfect"* on the approved prototype
 * (`prototypes/scenes_hold_crossfade_hybrid_2026-09-24.html`), then the third
 * mode: *"1. Scroll 2. Scrub 3. Auto-scroll (can set the speed)"*.
 *
 * 🔑 EACH SECTION IS A SCENE, AND THE VALUE IS A TRANSITION BETWEEN TWO OF THEM.
 * Owner, 2026-09-24: *"from one scene to another there is a transition"*. So the
 * value stored on scene N means **the transition from scene N to scene N+1** —
 * an EDGE, not a property of the scene. The LAST scene's value has no next
 * scene and is ignored (it is the tail). An editor draws this control BETWEEN
 * two scenes; a control on the last scene would move nothing.
 *
 *   scroll — N scrolls away and N+1 scrolls in: the ordinary page. The default.
 *   scrub  — N and N+1 are both PINNED and truly CROSS-FADE, driven by the
 *            scroll; scrolling back reverses it exactly. A chain of scrub
 *            transitions is a RUN: its first scene scrolls in like a page and
 *            pins, its last un-pins and scrolls away like a page, and while a
 *            scene holds its parts arrive in turn under the reader's thumb.
 *   auto   — N and N+1 share ONE screen and cross-fade on a CLOCK
 *            (`prototypes/scenes_three_modes_std_2026-09-24.html`): a chain of
 *            auto transitions is an AUTO RUN, its scenes stacked in one cell and
 *            handed over every `HUB_AUTO_SCENE_SECONDS` × speed, the hand-off
 *            itself `HUB_AUTO_HANDOFF_SECONDS` long. It starts when the run is
 *            first seen, pauses when it leaves the screen, and STOPS for good
 *            the moment the guest touches, scrolls inside or presses a key in it
 *            (owner 2026-09-24: "guest can pause, stops auto-advancing on guest
 *            scroll/touch, reduced motion never auto-advances"). See
 *            `renderedTransition` and `autoRunTimings`.
 *
 * ── WHERE IT LIVES ─────────────────────────────────────────────────────────
 * `invitation_widgets.config_json.canvas.transition` (+ `autoSpeed`), beside
 * the rest of the canvas contract in `lib/hub-canvas.ts`. No migration.
 *
 * ⚠ "SCROLL" IS AN ABSENCE, the same rule as the canvas's Auto: the default is
 * never stored, so a section nobody touched carries no key at all.
 *
 * 🔑 THIS MODULE IS PURE AND KNOWS NOTHING ABOUT THE EVENT HUB. It takes a list
 * of transitions and answers "which sections pin together, and what does each
 * one's progress segment cover". The Save-the-Date sequence is meant to reuse
 * it as-is (owner, same message: the same system applies there).
 */

/* ── THE CLOSED SETS ───────────────────────────────────────────────────────
   Owner's own words, in his order. There are no aliases: the prototype's
   "hold"/"move" were never stored anywhere and are accepted nowhere. */
export const HUB_TRANSITIONS = ['scroll', 'scrub', 'auto'] as const;
export type HubTransition = (typeof HUB_TRANSITIONS)[number];
export const HUB_DEFAULT_TRANSITION: HubTransition = 'scroll';

export const HUB_TRANSITION_LABEL: Record<HubTransition, string> = {
  scroll: 'Scroll',
  scrub: 'Scrub',
  auto: 'Auto-scroll',
};

/** What a couple reads under each choice — one line, no jargon. */
export const HUB_TRANSITION_HINT: Record<HubTransition, string> = {
  scroll: 'This section scrolls away and the next one scrolls in, like any page.',
  scrub: 'This section holds while guests scroll, then blends into the next one.',
  auto: 'Moves on to the next section by itself, at the speed you choose.',
};

export const HUB_AUTO_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type HubAutoSpeed = (typeof HUB_AUTO_SPEEDS)[number];
export const HUB_DEFAULT_AUTO_SPEED: HubAutoSpeed = 'normal';

export const HUB_AUTO_SPEED_LABEL: Record<HubAutoSpeed, string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
};

const inSet = <T,>(list: readonly T[], v: unknown): v is T =>
  (list as readonly unknown[]).includes(v);

/** A stored transition, or null. Nothing is repaired: 'Scrub', 'hold' → null. */
export function hubTransition(value: unknown): HubTransition | null {
  return inSet(HUB_TRANSITIONS, value) ? value : null;
}

/** A stored speed, or null. Only meaningful beside `auto`; the caller decides. */
export function hubAutoSpeed(value: unknown): HubAutoSpeed | null {
  return inSet(HUB_AUTO_SPEEDS, value) ? value : null;
}

/** What the couple chose, with the absence read as the default. */
export function resolveTransition(canvas: { transition?: HubTransition }): HubTransition {
  return canvas.transition ?? HUB_DEFAULT_TRANSITION;
}

/**
 * WHAT THE GUEST PAGE ACTUALLY DRAWS for a section.
 *
 * ✅ `auto` NOW RENDERS AS `auto` (Event Hub Maker Phase 5, 2026-09-25). It
 * rendered as Scroll while its prototype was being drawn; the prototype is the
 * one the owner approved with the three modes, and its renderer is
 * `hub-auto-run.tsx`. `hub-scenes.test.ts` pinned the old line so that this
 * change had to be made on purpose — it was.
 *
 * ⛔ SCRUB AND AUTO RENDER AS SCROLL WITHOUT PRO. Both are Event Hub Pro (one
 * unlock covers every advanced feature — owner ruling). The writer refuses a
 * free couple; this is the renderer's half of the same rule, so a lapsed unlock
 * falls back to the plain page instead of keeping the look.
 */
export function renderedTransition(
  transition: HubTransition,
  proAllowed: boolean,
): RenderedTransition {
  if (!proAllowed) return 'scroll';
  return transition;
}
export type RenderedTransition = 'scroll' | 'scrub' | 'auto';

/**
 * THE WRITE — what the stored pair becomes after one editor tap, and whether
 * that tap needs Event Hub Pro. `setWidgetMotion` applies exactly this.
 *
 *   · an unrecognised value is IGNORED, never repaired (the stored pair stands);
 *   · Scroll and Normal are absences, so they come back as `null` (delete the key);
 *   · a speed survives only beside Auto — switching away from Auto drops it;
 *   · ⛔ Pro is needed for any tap that LANDS on Scrub or Auto-scroll and
 *     changes something. Going back to Scroll never needs it: a free couple may
 *     always take a look off (the same rule every other Pro look follows).
 */
export function nextTransition(
  current: { transition?: HubTransition; autoSpeed?: HubAutoSpeed },
  transitionRaw: unknown,
  autoSpeedRaw: unknown,
): { transition: 'scrub' | 'auto' | null; autoSpeed: HubAutoSpeed | null; needsPro: boolean } {
  const curT = resolveTransition(current);
  const curS = curT === 'auto' ? (current.autoSpeed ?? HUB_DEFAULT_AUTO_SPEED) : null;
  const nextT = hubTransition(transitionRaw) ?? curT;
  const nextS =
    nextT === 'auto' ? (hubAutoSpeed(autoSpeedRaw) ?? curS ?? HUB_DEFAULT_AUTO_SPEED) : null;
  const changed = nextT !== curT || nextS !== curS;
  return {
    transition: nextT === 'scroll' ? null : nextT,
    autoSpeed: nextS && nextS !== HUB_DEFAULT_AUTO_SPEED ? nextS : null,
    needsPro: nextT !== 'scroll' && changed,
  };
}

/* ── RUNS ──────────────────────────────────────────────────────────────── */

export type SceneItem<T> = {
  item: T;
  /** Position on the page, 0-based, across every section. Names its timeline. */
  index: number;
};

export type SceneSegment<T> =
  | { kind: 'scroll'; entry: SceneItem<T> }
  /** Scrub run (pinned, scroll-driven). The name predates Auto and stays. */
  | { kind: 'run'; entries: SceneItem<T>[] }
  /** Auto run (one screen, a clock). */
  | { kind: 'auto'; entries: SceneItem<T>[]; speed: HubAutoSpeed };

/**
 * GROUP SCENES JOINED BY A SCRUB TRANSITION INTO RUNS.
 *
 * `transitionOf(item)` is the transition from that scene to the NEXT one, so
 * scene N joins scene N+1 in a run exactly when N's transition scrubs. The
 * last scene's value is never read — there is no next scene for it to reach.
 * A scene joined to neither neighbour is an ordinary scroll scene.
 *
 * 🔑 A RUN IS THE UNIT THAT PINS. Every scene of a run is pinned inside one
 * wrapper, so the whole run un-pins together when its last scene is done — no
 * pin can outlive its run, and a scroll scene after it can never slide
 * underneath a scene that is still pinned. Neighbours inside a run cross-fade;
 * at a run's edges there is no fade: its first scene scrolls in like a page and
 * pins, its last un-pins and scrolls away like a page. A run therefore always
 * has at least TWO scenes — a transition needs somewhere to go.
 *
 * Order is preserved exactly; nothing is dropped.
 */
/*
 * 🔑 AUTO JOINS THE SAME WAY, AND A SCENE BELONGS TO ONE RUN. A scene whose
 * INCOMING edge put it in a run stays in that run; if its own outgoing edge is
 * of the OTHER kind (the last scene of a scrub run set to Auto, say), that edge
 * cannot also pin it into a second run — it hands over like a page instead.
 * First come wins, so a hybrid page never has one scene in two places.
 *
 * `speedOf` is read from a run's FIRST scene: one screen has one clock.
 */
export function groupSceneRuns<T>(
  items: readonly T[],
  transitionOf: (item: T) => RenderedTransition,
  speedOf: (item: T) => HubAutoSpeed = () => HUB_DEFAULT_AUTO_SPEED,
): SceneSegment<T>[] {
  const out: SceneSegment<T>[] = [];
  /** The kind of the edge INTO scene `index`, when it joins a run. */
  let joinedFrom: 'scrub' | 'auto' | null = null;
  items.forEach((item, index) => {
    const entry = { item, index };
    const isLast = index === items.length - 1;
    const t = isLast ? 'scroll' : transitionOf(item);
    const joinsNext: 'scrub' | 'auto' | null =
      t === 'scroll' ? null : joinedFrom === null || joinedFrom === t ? t : null;
    if (joinedFrom) {
      const run = out[out.length - 1];
      if (run && run.kind !== 'scroll') run.entries.push(entry);
    } else if (joinsNext === 'scrub') {
      out.push({ kind: 'run', entries: [entry] });
    } else if (joinsNext === 'auto') {
      out.push({ kind: 'auto', entries: [entry], speed: speedOf(item) });
    } else {
      out.push({ kind: 'scroll', entry });
    }
    joinedFrom = joinsNext;
  });
  return out;
}

/** Does any section on this page actually pin or play? If not, the page is untouched. */
export function hasScrubRun<T>(segments: readonly SceneSegment<T>[]): boolean {
  return segments.some((s) => s.kind !== 'scroll');
}

/* ── THE CLOCK ─────────────────────────────────────────────────────────────
   Read off the approved prototype (`scenes_three_modes_std_2026-09-24.html`):
   its Invitation copy hands over every 4.5 s (`--a:0.00;--b:4.50`,
   `--a:4.50;--b:9.00` …), the hand-off `--F` is 1.2 s, and speed multiplies
   every duration — Slow 1.4× · Normal 1× · Fast 0.6×. Inside a hand-off the
   incoming scene fades in over 15–75 % and the outgoing one out over 25–85 %:
   the same shape as Scrub, with time in place of scroll. */
export const HUB_AUTO_SCENE_SECONDS = 4.5;
export const HUB_AUTO_HANDOFF_SECONDS = 1.2;
export const HUB_AUTO_SPEED_FACTOR: Record<HubAutoSpeed, number> = { slow: 1.4, normal: 1, fast: 0.6 };

export type AutoSceneTiming = {
  /** When this scene starts fading IN, seconds after the run starts (none for the first). */
  inAt: number | null;
  /** When it starts fading OUT (none for the last — it stays). */
  outAt: number | null;
  /** How long each fade takes. */
  fade: number;
};

/**
 * WHEN EACH SCENE OF AN AUTO RUN ARRIVES AND LEAVES. Pure, so the blank-frame
 * check can sample it: at every instant at least one scene is fully or partly
 * visible, and during a hand-off both are (see `autoRunVisibleAt`).
 */
export function autoRunTimings(count: number, speed: HubAutoSpeed): AutoSceneTiming[] {
  const f = HUB_AUTO_SPEED_FACTOR[speed];
  const F = HUB_AUTO_HANDOFF_SECONDS * f;
  const step = HUB_AUTO_SCENE_SECONDS * f;
  return Array.from({ length: count }, (_, k) => ({
    inAt: k === 0 ? null : k * step + 0.15 * F,
    outAt: k === count - 1 ? null : (k + 1) * step + 0.25 * F,
    fade: 0.6 * F,
  }));
}

/** Opacity of each scene at time `t` — what the stylesheet will paint. */
export function autoRunVisibleAt(timings: readonly AutoSceneTiming[], t: number): number[] {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return timings.map(({ inAt, outAt, fade }) => {
    const inOp = inAt === null ? 1 : clamp((t - inAt) / fade);
    const outOp = outAt === null ? 1 : 1 - clamp((t - outAt) / fade);
    return Math.min(inOp, outOp);
  });
}

/**
 * THE TIMELINE NAME for the section at `index`. One per section, unique on the
 * page, and the ONLY thing that ties a pinned section to the spacer that
 * drives it and to its progress segment.
 */
export function sceneTimelineName(index: number): string {
  return `--hub-s${index}`;
}

/**
 * WHAT ONE PROGRESS SEGMENT COVERS, as an `animation-range`.
 *
 * A pinned page hides how much is left, so the approved prototype carries one
 * segment per section. The ranges are the prototype's, measured there:
 *   · a scrub section's segment follows its SPACER — from the moment it pins
 *     (first of a run) or mid-handoff (inside a run), to mid-handoff (not last)
 *     or half-way off the screen (last of a run);
 *   · a scroll section's segment follows its own box, mid-entry to mid-exit.
 */
export function sceneProgressRange(
  kind: 'scroll' | 'scrub',
  firstOfRun: boolean,
  lastOfRun: boolean,
): string {
  if (kind === 'scroll') return 'entry 50% exit 50%';
  const from = firstOfRun ? 'entry 0%' : 'entry 45%';
  const to = lastOfRun ? 'exit 50%' : 'exit 55%';
  return `${from} ${to}`;
}

/**
 * THE CLASS VOCABULARY the renderer emits — exported so the stylesheet guard
 * (`the-canvas-fails-visible.test.ts`) can hold "no rule branches on a class
 * nothing emits" for these too, instead of exempting them.
 */
export const HUB_SCENE_CLASSES = [
  'hub-scenes',
  'hub-run',
  'hub-scene',
  'hub-scroll',
  'hub-scrub',
  'hub-sp',
  'hub-prog',
  'hub-prog-bar',
  // Auto runs (hub-auto-run.tsx).
  'hub-arun',
  'hub-auto',
  'hub-auto-pp',
] as const;
