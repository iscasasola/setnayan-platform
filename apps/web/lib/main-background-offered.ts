/**
 * lib/main-background-offered.ts — 🌄 STUDIO › LOOK › BACKGROUND'S SOURCE ▾, FOR EVERY EVENT, IN EVERY SHELL.
 *
 * Owner, in the app 2026-10-26: *"i cannot see the different background options. upload, color, videos, etc"* — and
 * again on a free test event (Debut 18) once #6970 built the row only for Pro events in the app: *"still none for the
 * background"*. The main-background row (`MainBackgroundPanel`: Source ▾ Colour · Scene ◆ · Video ◆ · Upload ◆ and
 * its picture cards) is now built for EVERY event, on the web and in the app (`website/editor/page.tsx`). What differs
 * is only how the ◆ sources open (`mainBackgroundProDoor`):
 *   · 'open'   — the web (tried free, named at ✓ Apply, as always), or an event that owns Event Hub Pro (usable);
 *   · 'apple'  — the iPhone app where Apple sells Event Hub Pro (`getIapGate().iap`): the ◆ cards are shown locked and
 *                Apple's sheet (`IapUnlockSheet`, `COUPLE_WEBSITE_PRO` — sold whole again, #6963) unlocks it in place;
 *   · 'locked' — the app where nothing can be sold: the ◆ cards are shown locked, with no price and no web link
 *                (App Store 3.1.1).
 * Colour is everyone's, everywhere. Pure; held by `the-look-background-offers-every-source.test.ts`.
 */
export type MainBackgroundProDoor = 'open' | 'apple' | 'locked';

export function mainBackgroundProDoor({ storeShell, iap, ownsPro }: { storeShell: boolean; iap: boolean; ownsPro: boolean }): MainBackgroundProDoor {
  if (ownsPro || !storeShell) return 'open';
  return iap ? 'apple' : 'locked';
}
