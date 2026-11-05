/**
 * lib/main-background-offered.ts — 🌄 IS STUDIO › LOOK › BACKGROUND'S SOURCE ▾ BUILT FOR THIS VIEWER?
 *
 * Owner, on his phone in the app 2026-10-26: *"i cannot see the different background options. upload, color, videos,
 * etc"*. The Maker's main-background row (`website/editor/page.tsx`, "Behind every scene" — `MainBackgroundPanel`,
 * whose Source ▾ is Colour · Scene ◆ · Video ◆ · Upload ◆ and its picture cards) was built ONLY outside the app-store
 * shell, since its first day (2c6a6018ce: a Pro control is hidden in the shell). Without it, Look › Background falls
 * back to the shell's rows (`details-look-pages.tsx` `sourceHolds`): Pattern · Focus · Blur · Shade and the page
 * colour — no way to pick a source. His event is Event Hub Pro, and an unlock belongs to the event (owner
 * 2026-10-15): a Pro event's couple is never shown less in the app than on the web.
 *
 * ✅ THE RULE: built on the web, and in the store shell for an event that OWNS Pro (`makerProUsable`'s own rule —
 * `owns || !storeShell`). A free event in the shell keeps the shell's rows (no Pro control, no price, no web link).
 * Pure; held by `the-look-background-offers-every-source.test.ts`.
 */
export function mainBackgroundRowOffered({ storeShell, ownsPro }: { storeShell: boolean; ownsPro: boolean }): boolean {
  return ownsPro || !storeShell;
}
