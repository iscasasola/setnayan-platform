import { TeamScreen, type TeamSearch } from './_components/team-screen';

/**
 * /vendor-dashboard/team — Helpers. Its screen is `TeamScreen` (`_components/team-screen.tsx`), which the Shop ⚙'s
 * "Team" fold mounts too (2026-10-31, DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"); every old link still lands.
 * ADMIN-gated inside the screen: any admin of the store may manage the team; others are bounced.
 */
export const metadata = { title: 'Helpers · Supplier' };

export default async function VendorTeamPage({ searchParams }: { searchParams: Promise<TeamSearch> }) {
  return <TeamScreen search={await searchParams} />;
}
