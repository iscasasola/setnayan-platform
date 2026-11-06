/**
 * lib/background-fade.ts — THE FADE BAR: ONE LINE FROM BLACK, THROUGH "AS IS", TO WHITE.
 *
 * Owner, 2026-10-08, on Studio › Look › Background (DECISION_LOG "LOOK › BACKGROUND, AMENDED"): *"when scene, video
 * or upload is picked: I want a line bar where it can fade to white or fade to black · fade to white drag line bar to
 * right · fade to black drag to left · snap to center"*. It replaces Shade ▾ (Darker · Dark · As is · Light ·
 * Lighter). Contract: `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A and § 3, prototype frames A04–A06.
 *
 * THE VALUE is a whole number, −100…100, stored where the Shade word was (`widgets.hero.main.shade`,
 * `lib/hub-canvas.ts`): left of 0 the page's ink is laid over the picture, right of 0 the page's paper; 0 is the
 * picture as it is and is never stored. WHAT IT DOES is the shipped rule, unchanged (`lib/main-ground-shade.ts`):
 * the veil starts at the bar's value and is RAISED — never lowered — until the words read; left of 0 the words turn
 * light. So the bar never refuses a position, and no position can take the words under the reading floor.
 *
 * This file is the bar's own arithmetic — where a finger is, where a release settles, what the value says — pure,
 * so the component (`background-fade-bar.tsx`) only draws and listens.
 */
import { HUB_MAIN_FADE_MAX, HUB_MAIN_FADE_MIN, hubMainFadeAt, sanitizeHubMainShade, type HubMainGround, type HubMainShadeValue } from './hub-canvas';

/** A release this close to the centre lands ON the centre (owner: *"snap to center"*). */
export const FADE_SNAP = 8;

/** What the bar's ⓘ says — the approved prototype's words. */
export const FADE_INFO =
  'Centre shows the picture as it is. Drag right to fade it toward white, left toward black; it snaps back to centre. Left of centre the words turn light. The fade never goes under the reading floor — if your words would not read, it is raised a little for you.';

/** A whole position inside the bar's range. */
export function fadeClamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(HUB_MAIN_FADE_MIN, Math.min(HUB_MAIN_FADE_MAX, Math.round(n)));
}

/**
 * The position under a finger: `x` along a track that starts at `left` and is `width` wide. The line itself is
 * inset by `pad` at each end (the thumb's half-width), so the ends are reachable.
 */
export function fadeAtPointer(x: number, left: number, width: number, pad = 0): number {
  const span = width - 2 * pad;
  if (!(span > 0)) return 0;
  return fadeClamp(((x - left - pad) / span) * 200 - 100);
}

/** Where a release settles: the centre when it is within the snap, else where it is. */
export function fadeSettled(n: number): number {
  const at = fadeClamp(n);
  return Math.abs(at) <= FADE_SNAP ? 0 : at;
}

/** A key's move along the bar — or null for a key that is not the bar's. */
export function fadeKey(key: string, at: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowUp') return fadeClamp(at + 1);
  if (key === 'ArrowLeft' || key === 'ArrowDown') return fadeClamp(at - 1);
  if (key === 'PageUp') return fadeClamp(at + 10);
  if (key === 'PageDown') return fadeClamp(at - 10);
  if (key === 'Home') return HUB_MAIN_FADE_MIN;
  if (key === 'End') return HUB_MAIN_FADE_MAX;
  return null;
}

/** The thumb's place along the track, 0…100 %. */
export function fadePercent(at: number): number {
  return (fadeClamp(at) + 100) / 2;
}

/** The value in words: "As is" · "Lighter 60%" · "Darker 70% · light words" (left of centre the words turn light). */
export function fadeWords(at: number): string {
  const n = fadeClamp(at);
  if (n === 0) return 'As is';
  return n < 0 ? `Darker ${-n}% · light words` : `Lighter ${n}%`;
}

/** Do the words turn light at this position? For every position left of the centre, and for none at or right of it. */
export function fadeFlipsWords(at: number): boolean {
  return fadeClamp(at) < 0;
}

/** The position the stored background reads at — a word from before the bar at its place, a number as it is. */
export function fadeOf(main: HubMainGround | null | undefined): number {
  const shade = sanitizeHubMainShade((main as { shade?: unknown } | null | undefined)?.shade);
  return hubMainFadeAt(shade as HubMainShadeValue | undefined);
}

/**
 * The main background with the bar at `at`: the number is stored, and the centre stores NOTHING (the key is taken
 * off — 0 is never written). Everything else of the background is as it was.
 */
export function fadeMain<T extends HubMainGround>(main: T, at: number): T {
  const { shade: _was, ...rest } = main as T & { shade?: unknown };
  const n = fadeClamp(at);
  return (n === 0 ? rest : { ...rest, shade: n }) as T;
}
