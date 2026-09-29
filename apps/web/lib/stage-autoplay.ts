/**
 * AUTO ON A STAGE — the scenes play one after another, in the navigator's order
 * (owner 2026-09-26, verbatim: *"i am looking at cale-ice save the date. the
 * sequence created on their save the date has a sequence. all is on autoplay.
 * but the slides do not follow."*).
 *
 * 🔴 ROOT CAUSE, MEASURED. The Save the Date stage is three scenes — the film,
 * the names & date, the entourage (`makerStageList`, held by
 * `the-navigator-follows-the-page.test.ts`). Only the FIRST ever played:
 *   · the film's last beat (`close`, Add to calendar) has `dur: Infinity`, so
 *     the film ran its beats and then stood still, full screen, over the page;
 *   · nothing listened for that end — the page beneath (names, entourage) was
 *     reachable only by pressing "See our page". "Auto" was a word on the
 *     scene panels (the theme's default motion), never a clock between scenes;
 *   · in the Maker's canvas the film covered the whole frame, so choosing
 *     "Names & date" in the navigator scrolled a page nobody could see.
 *
 * ✅ WHAT AUTO NOW MEANS HERE. When the film reaches its close, the close is held
 * for one Auto beat, the film lifts, and each following scene is brought into
 * view and held for one Auto beat, in the stage's order — the same clock the
 * page's own Auto-scroll uses (`HUB_AUTO_SCENE_SECONDS`, not a new number).
 * Any touch, wheel or key hands the page to the viewer and the clock stops.
 *
 * The order is the DOCUMENT's order, which is the navigator's order by
 * construction (the navigator is built from the same plan the page draws, and
 * that equality is test-held). This module turns an ordered list of scene keys
 * into timed steps; `app/[slug]/_components/stage-autoplay.tsx` runs them.
 *
 * 🧩 AND EVERY SCENE, NOT ONLY THE FIXED ONES (owner 2026-09-29: *"Save the
 * Date auto-play walks the widget scenes too"*). The runner used to read only
 * the fixed anchors (`STAGE_SCENE_ANCHOR`), so the couple's own scenes on the
 * stage — countdown, Love Story, their own scenes — were scrolled past as if
 * they were not there: the navigator listed `w:countdown` and Auto never
 * stopped on it. Every scene the page draws now carries a hidden stage marker
 * (`STAGE_SCENE_ATTR`, stamped by `HubScenes` from the SAME list it renders —
 * no second order), with its own clock from its canvas (`stageSceneHoldMs`).
 * An Auto run is ONE stop that plays all its scenes on its own clock
 * (`HubAutoRun`); a Scrub scene is reached by scrolling its spacer, so its
 * cross-fade still plays under the scroll exactly as a guest's thumb plays it.
 * A scene that drew nothing is skipped (`stageStops`).
 *
 * Pure: no DOM, no React.
 */
import {
  HUB_AUTO_SCENE_SECONDS,
  HUB_AUTO_SPEED_FACTOR,
  type HubAutoSpeed,
  type RenderedTransition,
} from './hub-scenes';

/** One Auto beat — the page's own Auto-scroll clock (`lib/hub-scenes.ts`). */
export const STAGE_AUTO_HOLD_MS = Math.round(HUB_AUTO_SCENE_SECONDS * 1000);

/**
 * Where each FIXED scene sits on the guest page — the ids the page already
 * renders for its menu (`SITE_MENU_ANCHORS`) and the entourage. The film is not
 * here: it is not scrolled to, it plays and then lifts.
 */
export const STAGE_SCENE_ANCHOR: Readonly<Record<string, string>> = {
  'f:hero': 'site-home',
  'f:entourage': 'site-entourage',
  'f:story': 'site-story',
};

/** Reverse of `STAGE_SCENE_ANCHOR` — what the runner reads off the page. */
export function stageKeyForAnchor(id: string): string | null {
  for (const [key, anchor] of Object.entries(STAGE_SCENE_ANCHOR)) if (anchor === id) return key;
  return null;
}

/**
 * 🧭 THE STAGE MARKER — a hidden attribute on each scene the page draws, whose
 * value is the navigator's key (`w:<widget_type>`, `lib/maker-scene-list.ts`),
 * beside `STAGE_HOLD_ATTR`, that scene's own hold in ms. Stamped by `HubScenes`
 * only on the Save the Date for guests and the preview tab — never in the
 * Maker's canvas, and never on another stage (those pages stay byte-identical).
 */
export const STAGE_SCENE_ATTR = 'data-stage-scene';
export const STAGE_HOLD_ATTR = 'data-stage-hold';

/** The navigator's key for a scene row — the same `w:<type>` the Maker lists. */
export function stageSceneKey(widgetType: string): string {
  return `w:${widgetType}`;
}

/**
 * HOW LONG ONE SCENE HOLDS — its own canvas's motion setting. A scene set to
 * Auto keeps the clock it keeps in an Auto run (`HUB_AUTO_SCENE_SECONDS` ×
 * its speed, the same product `autoRunTimings` steps by); Scroll and Scrub
 * hold one ordinary Auto beat. Never a new number.
 */
export function stageSceneHoldMs(motion: { transition: RenderedTransition; speed: HubAutoSpeed }): number {
  if (motion.transition !== 'auto') return STAGE_AUTO_HOLD_MS;
  return Math.round(HUB_AUTO_SCENE_SECONDS * HUB_AUTO_SPEED_FACTOR[motion.speed] * 1000);
}

/** One scene as the runner found it on the page, in document order. */
export type StageFound<E> = {
  key: string;
  /** What to bring into view. */
  el: E;
  /** It drew something a guest can see (a scene can render nothing). */
  drew: boolean;
  /** Its own hold (`STAGE_HOLD_ATTR`); absent → one Auto beat. */
  holdMs?: number;
  /**
   * It sits in an ARMED Auto run: the run is one screen with one clock, so it
   * is one stop — brought into view once, and held while every scene in it
   * that drew plays (`live`) at the run's clock (its FIRST scene's hold, as
   * `groupSceneRuns` reads a run's speed from its first scene).
   */
  run?: { el: E; live: number } | null;
};

/**
 * The page's scenes → the stops Auto makes, in the order found. A scene that
 * drew nothing is dropped (a stop on it would be a blank screen); an Auto run
 * collapses into one stop; a key seen twice plays once.
 */
export function stageStops<E>(found: readonly StageFound<E>[]): Array<{ key: string; el: E; holdMs: number }> {
  const out: Array<{ key: string; el: E; holdMs: number }> = [];
  const keys = new Set<string>();
  const runs = new Set<E>();
  for (const f of found) {
    if (!f.drew || keys.has(f.key)) continue;
    const hold = f.holdMs !== undefined && Number.isFinite(f.holdMs) && f.holdMs > 0 ? f.holdMs : STAGE_AUTO_HOLD_MS;
    if (f.run) {
      if (runs.has(f.run.el)) continue;
      runs.add(f.run.el);
      keys.add(f.key);
      out.push({ key: f.key, el: f.run.el, holdMs: hold * Math.max(1, f.run.live) });
      continue;
    }
    keys.add(f.key);
    out.push({ key: f.key, el: f.el, holdMs: hold });
  }
  return out;
}

export type StageStep =
  | { kind: 'film'; key: 'f:film'; /** How long the film's close is held before it lifts. */ holdMs: number }
  | { kind: 'scene'; key: string; /** How long this scene is held before the next. */ holdMs: number };

/**
 * The stage's Auto steps, in order.
 *
 *   · the film leads when the stage has one (it always plays first — it is
 *     the opening of the Save the Date, and nothing is scrolled until it lifts);
 *   · every other scene follows in the order given, once each;
 *   · the LAST scene is where the stage comes to rest, so it carries no hold.
 */
export function stageAutoplaySteps(
  keysInOrder: ReadonlyArray<string | { key: string; holdMs?: number }>,
  holdMs: number = STAGE_AUTO_HOLD_MS,
): StageStep[] {
  const seen = new Set<string>();
  const scenes: Array<{ key: string; holdMs: number }> = [];
  let hasFilm = false;
  const hold = Math.max(0, Math.round(holdMs));
  for (const item of keysInOrder) {
    const k = typeof item === 'string' ? item : item.key;
    if (seen.has(k)) continue;
    seen.add(k);
    if (k === 'f:film') hasFilm = true;
    else {
      // A scene's own hold (its canvas clock) when it carries one.
      const own = typeof item === 'string' ? undefined : item.holdMs;
      scenes.push({ key: k, holdMs: own !== undefined && Number.isFinite(own) ? Math.max(0, Math.round(own)) : hold });
    }
  }
  const steps: StageStep[] = [];
  if (hasFilm) steps.push({ kind: 'film', key: 'f:film', holdMs: hold });
  scenes.forEach((s, i) => steps.push({ kind: 'scene', key: s.key, holdMs: i === scenes.length - 1 ? 0 : s.holdMs }));
  return steps;
}

/**
 * When each step starts, counted from the moment the film reaches its close
 * (ms). The film's step starts at 0 and lifts at its hold; each scene starts
 * where the one before it ended.
 */
export function stageAutoplaySchedule(steps: readonly StageStep[]): Array<{ key: string; at: number }> {
  let at = 0;
  return steps.map((s) => {
    const start = at;
    at += s.holdMs;
    return { key: s.key, at: start };
  });
}
