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
 * Pure: no DOM, no React.
 */
import { HUB_AUTO_SCENE_SECONDS } from './hub-scenes';

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
  keysInOrder: readonly string[],
  holdMs: number = STAGE_AUTO_HOLD_MS,
): StageStep[] {
  const seen = new Set<string>();
  const scenes: string[] = [];
  let hasFilm = false;
  for (const k of keysInOrder) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (k === 'f:film') hasFilm = true;
    else scenes.push(k);
  }
  const hold = Math.max(0, Math.round(holdMs));
  const steps: StageStep[] = [];
  if (hasFilm) steps.push({ kind: 'film', key: 'f:film', holdMs: hold });
  scenes.forEach((key, i) => steps.push({ kind: 'scene', key, holdMs: i === scenes.length - 1 ? 0 : hold }));
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
