import { logoHasMotion } from '@/lib/logo-layers';

/**
 * ▶ THE ONE RULE FOR "DOES THE COUPLE'S LOGO PLAY HERE?" — pure, so it is
 * tested without a render (owner 2026-09-29: *"all logos should animate if
 * animation is active"*).
 *
 *   plays = the animation is on for the event (owned + not "Use Static Image")
 *           AND the saved logo moves (a layered logo with an In or a Drift).
 *
 * 📦 ASKED BY THE CALLER, NOT BY `CoupleLogo` (2026-10-04). Every surface that
 * hands `CoupleLogo` a logo hands it `plays={coupleLogoPlays(svg, animationOn)}`
 * with the SAME svg — so `CoupleLogo`'s own client graph never imports
 * `logo-layers` (~52 KB of source plus its fonts), and a page whose logos are
 * stills (a server component like `EventPoster` on Discover) ships none of it.
 * Still one rule in one place: this function. A surface never re-derives it,
 * and `every-logo-plays.test.ts` holds every `<CoupleLogo` to it.
 */
export function coupleLogoPlays(svg: string | null | undefined, animationOn: boolean): boolean {
  return animationOn === true && logoHasMotion(svg);
}
