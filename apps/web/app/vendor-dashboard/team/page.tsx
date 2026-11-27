import { BackButton } from '@/app/_components/back-button';
import { BackWhenNotRisen } from '../_components/back-when-not-risen';
import { TeamScreen, type TeamSearch } from './_components/team-screen';
import { RolesSection } from './_components/roles-section';
import { InquiriesSection } from './_components/inquiries-section';
import { teamSectionOf } from '@/lib/team-sections';

/**
 * /vendor-dashboard/team — Helpers. Its screen is `TeamScreen` (`_components/team-screen.tsx`), which the Shop ⚙'s
 * "Team" fold mounts too (2026-10-31, DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"); every old link still lands.
 * ADMIN-gated inside the screen: any admin of the store may manage the team; others are bounced.
 */
export const metadata = { title: 'Team · Supplier' };

export default async function VendorTeamPage({
  searchParams,
}: {
  searchParams: Promise<TeamSearch & { section?: string; saved?: string; branch?: string; adjust?: string; type?: string }>;
}) {
  const search = await searchParams;
  // ‹ Roles, and Who gets new inquiries under it, open IN PLACE inside the Team layer (final check B13 · B14): the same
  // address, a section — so the risen layer stays up and only its body changes.
  const section = teamSectionOf(search.section);
  if (section === 'roles') return <RolesSection search={{ saved: search.saved, error: search.error }} />;
  if (section === 'inquiries') {
    return <InquiriesSection search={{ branch: search.branch, adjust: search.adjust, type: search.type, saved: search.saved, error: search.error }} />;
  }
  return (
    <>
      <BackWhenNotRisen>
        <BackButton route="/vendor-dashboard/team" inPlace className="mx-4 mt-3 mb-0" />
      </BackWhenNotRisen>
      <TeamScreen search={search} />
    </>
  );
}
