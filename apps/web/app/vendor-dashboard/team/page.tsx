import { BackButton } from '@/app/_components/back-button';
import { BackWhenNotRisen } from '../_components/back-when-not-risen';
import { TeamScreen, type TeamSearch } from './_components/team-screen';

/**
 * /vendor-dashboard/team — Helpers. Its screen is `TeamScreen` (`_components/team-screen.tsx`), which the Shop ⚙'s
 * "Team" fold mounts too (2026-10-31, DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"); every old link still lands.
 * ADMIN-gated inside the screen: any admin of the store may manage the team; others are bounced.
 */
export const metadata = { title: 'Helpers · Supplier' };

export default async function VendorTeamPage({ searchParams }: { searchParams: Promise<TeamSearch> }) {
  return (
    <>
      <BackWhenNotRisen>
        <BackButton route="/vendor-dashboard/team" inPlace className="mx-4 mt-3 mb-0" />
      </BackWhenNotRisen>
      <TeamScreen search={await searchParams} />
    </>
  );
}
