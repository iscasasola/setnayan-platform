import { isHubMainFollow, type HubMainGround } from './hub-canvas';

/**
 * 🎞 WHEN THE HERO'S COLOURS MAY BE WRITTEN INTO THE DRAFT (`HeroFrameSync`,
 * `main-background-panel.tsx`).
 *
 * The Main background follows the hero photo: its colours are read in the
 * browser and saved into the DRAFT as `{ follow: 'hero', of, tint }`. That save
 * used to fire whenever the stored value did not follow the hero on screen —
 * including on merely OPENING the Maker: every editor in Details stays mounted,
 * so an event whose hero was set before the Maker existed (or at onboarding)
 * had its hero measured and drafted with no tap at all, and Apply wore a "1"
 * the couple never made (owner, live phone test 2026-10-02: *"Apply showed 1
 * before I did anything"*).
 *
 * ✅ THE RULE: a measurement may RIDE ALONG with the couple's own change, never
 * BE the change. It is written only when the draft already holds one of theirs
 * for it — a hero photo they put in this draft (not the live one), or a Main
 * background choice that differs from live (they pressed "Same as my hero").
 * With neither, guests see today's page and nothing is written.
 * 🛡 `lib/opening-the-maker-counts-zero-waiting.test.ts`.
 */

/** Does the stored Main background still need the hero's photo measured? */
export function heroNeedsMeasuring(current: HubMainGround | null, heroRef: string | null): boolean {
  if (!heroRef) return false;
  if (current && !isHubMainFollow(current)) return false; // an override is in charge
  return !current || current.of !== heroRef;
}

/** May the hero's measurement be written now — is there a change of the couple's own for it to ride with? */
export function heroFrameMayWrite(input: {
  /** The hero photo shown (the draft over live). */
  heroRef: string | null;
  /** The hero photo guests see today. */
  liveHeroRef: string | null;
  /** The Main background in the draft differs from live (the couple chose it). */
  mainDrafted: boolean;
}): boolean {
  return input.mainDrafted || (input.heroRef ?? null) !== (input.liveHeroRef ?? null);
}

/** Both: the measurement is needed AND it would ride with the couple's own change. */
export function heroFrameWrites(input: {
  current: HubMainGround | null;
  heroRef: string | null;
  liveHeroRef: string | null;
  mainDrafted: boolean;
}): boolean {
  return heroNeedsMeasuring(input.current, input.heroRef) && heroFrameMayWrite(input);
}
