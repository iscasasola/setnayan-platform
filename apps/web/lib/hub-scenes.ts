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
 *   auto   — STORED AND VALIDATED ONLY. It renders as `scroll` on the guest page
 *            until the owner approves the auto-scroll prototype (being drawn
 *            2026-09-24). See `renderedTransition`.
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
 * ⛔ `auto` RENDERS AS `scroll` — deliberately, for now. The owner added
 * Auto-scroll on 2026-09-24 and its prototype is still being drawn; the data
 * model and the editor choice ship now so nothing has to be migrated later,
 * and the auto renderer lands after he approves that prototype. Until then an
 * Auto section is an ordinary section, which is the honest resting state.
 * `hub-scenes.test.ts` pins this, so the day the renderer lands this line must
 * change on purpose.
 *
 * ⛔ AND SCRUB RENDERS AS SCROLL WITHOUT PRO. Scrub is an Event Hub Pro
 * feature (one unlock covers every advanced feature — owner ruling). The
 * writer refuses a free couple; this is the renderer's half of the same rule,
 * so a lapsed unlock falls back to the plain page instead of keeping the look.
 */
export function renderedTransition(
  transition: HubTransition,
  scrubAllowed: boolean,
): 'scroll' | 'scrub' {
  if (transition === 'scrub' && scrubAllowed) return 'scrub';
  return 'scroll';
}

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
  | { kind: 'run'; entries: SceneItem<T>[] };

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
export function groupSceneRuns<T>(
  items: readonly T[],
  transitionOf: (item: T) => 'scroll' | 'scrub',
): SceneSegment<T>[] {
  const out: SceneSegment<T>[] = [];
  /** Does the edge INTO scene `index` scrub? */
  let joinedFromPrevious = false;
  items.forEach((item, index) => {
    const entry = { item, index };
    const isLast = index === items.length - 1;
    const joinsNext = !isLast && transitionOf(item) === 'scrub';
    if (joinedFromPrevious) {
      const run = out[out.length - 1];
      if (run && run.kind === 'run') run.entries.push(entry);
    } else if (joinsNext) {
      out.push({ kind: 'run', entries: [entry] });
    } else {
      out.push({ kind: 'scroll', entry });
    }
    joinedFromPrevious = joinsNext;
  });
  return out;
}

/** Does any section on this page actually pin? If not, the page is untouched. */
export function hasScrubRun<T>(segments: readonly SceneSegment<T>[]): boolean {
  return segments.some((s) => s.kind === 'run');
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
] as const;
