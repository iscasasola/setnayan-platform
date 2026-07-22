/**
 * Papic Games / Photo Challenge feature flag.
 *
 * Gates the whole Papic games feature — auto missions from event_vendors, the
 * guest capture-surface UI, leaderboard, custom vendor challenges, and the
 * per-photo consent tap. Spec:
 * ~/Documents/Claude/Projects/Setnayan/0012_papic/Papic_Games_and_Vendor_Missions_Spec_2026-07-21.md
 *
 * Also gates the "Photo Challenge" advertising copy on the guest landing page
 * (app/[slug]/page.tsx) so the feature is never SOLD before it is BUILT
 * (spec §1 / §5 #8 — "either build it or delete the copy").
 *
 * NEXT_PUBLIC_ so both server pages and client widgets agree on one value.
 * Off by default — nothing ships until the owner sets
 * NEXT_PUBLIC_PAPIC_GAMES_V1=true.
 */
export function papicGamesEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_PAPIC_GAMES_V1;
  return v === 'true' || v === '1' || v === 'TRUE';
}
