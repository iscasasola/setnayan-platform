import { logoHasMotion } from '@/lib/logo-layers';

/**
 * ▶ THE ONE RULE FOR "DOES THE COUPLE'S LOGO PLAY HERE?" — pure, so it is
 * tested without a render (owner 2026-09-29: *"all logos should animate if
 * animation is active"*).
 *
 *   plays = the animation is on for the event (owned + not "Use Static Image")
 *           AND the saved logo moves (a layered logo with an In or a Drift).
 *
 * `CoupleLogo` asks exactly this; a surface never re-derives it.
 */
export function coupleLogoPlays(svg: string | null | undefined, animationOn: boolean): boolean {
  return animationOn === true && logoHasMotion(svg);
}

/**
 * The plays-once memory key: a place + the logo it showed. A short hash, so the
 * page keeps a few bytes per logo rather than a copy of every mark it drew. A
 * DIFFERENT logo in the same place (the couple saved a new one) is a new key,
 * so the new logo plays its entrance.
 */
export function coupleLogoPlayKey(place: string, svg: string): string {
  let h = 5381;
  for (let i = 0; i < svg.length; i++) h = ((h * 33) ^ svg.charCodeAt(i)) >>> 0;
  return `${place}:${svg.length}:${h.toString(36)}`;
}

/* ── the client's two decisions, pure (no DOM in `tsx --test`) ─────────── */

/**
 * ♿ What a playing logo does the moment it mounts in a browser:
 *   · reduced motion → 'still' — the still it drew on the server stays;
 *   · no IntersectionObserver → 'play' now (an old browser still sees it move);
 *   · otherwise → 'wait' until it scrolls into view, so a page of many cards
 *     animates only what is on screen.
 */
export function logoPhaseOnMount(env: { reducedMotion: boolean; canObserve: boolean }): 'still' | 'play' | 'wait' {
  if (env.reducedMotion) return 'still';
  return env.canObserve ? 'wait' : 'play';
}

/**
 * 1️⃣ PLAYS ONCE — the places where a logo has already made its entrance this
 * page session. A remount at a place it has already arrived is `settled`.
 */
export function createLogoArrivals() {
  const seen = new Set<string>();
  return {
    arrived: (key: string) => seen.has(key),
    arrive: (key: string) => {
      seen.add(key);
    },
    clear: () => seen.clear(),
  };
}
export const logoArrivals = createLogoArrivals();

/**
 * A layer's motion when the logo has ALREADY ARRIVED here: no entrance and no
 * wait — it is simply there — and its Drift, the part that never ends, kept.
 */
export function arrivalMotion<M extends { in: string; delay: number; during: string }>(motion: M, settled: boolean): M {
  return settled ? { ...motion, in: 'none', delay: 0 } : motion;
}
