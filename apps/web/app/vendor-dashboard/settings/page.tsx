import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { isStoreShellRequest } from '@/lib/request-platform';
import { countUnread } from '@/lib/notifications';
import { readSupplierPayoutReadiness } from '@/lib/vendor-payment-methods.server';
import { teamSeats } from '@/lib/vendor-free-helper';
import { isMusicToolCategory } from '@/lib/songs';
import { moodboardLibraryAccessForProfile } from '@/lib/moodboard-library-access';
import { settingsMoreTools } from './settings-rows';
import { SettingsView } from './settings-view';

export const metadata = { title: 'Settings · Supplier' };

/**
 * /vendor-dashboard/settings — SETTINGS, one list (simpler supplier dashboard step 6; owner-APPROVED 2026-10-14;
 * prototype SCREENS.settings — reached from More › Settings and the avatar sheet).
 *
 * Every row opens a page that ALREADY exists; this page decides nothing and owns no write:
 *   Account (/dashboard/profile) · Notifications ▾ (the shipped PushToggle · how email reaches you · Recent →
 *   /notifications) · Plan (/subscription, web only) · Getting paid (Shop › How clients pay you) · Helpers (/team) ·
 *   Details · page · collections (Shop) · More tools ▾ (the shop's tool shelves, grant-gated, as rows) · Help ·
 *   Switch shop.
 *
 * ⛔ NO SIGN OUT HERE, although the prototype draws one. Owner 2026-08-13: *"sign out lives under the avatar and
 * nowhere else"* — held by `app/_components/auth/seam-invariants.test.ts`. The avatar sheet (the account menu)
 * carries it, as the prototype's SHEETS.avatar also does. Flagged for the owner in the PR rather than weakening the
 * guard.
 *
 * ⚠ "SETTINGS IS NOT A ROW" (lib/vendor-more-rows.ts, 2026-10-01) WAS TRUE UNTIL THIS PAGE: there was no settings
 * page to open, so a Settings row would have pretended. Now there is one, and More lists it.
 *
 * Reads (each once): role · profile · tier · team roles · payout readiness (2) · unread count — 7 after sign-in. A
 * scoped team member (agent / viewer) sees only the rows that are theirs: Account · Notifications · Help · Switch
 * shop.
 */
export default async function VendorSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [role, profile, storeShell] = await Promise.all([
    resolveVendorRole(supabase, user.id),
    fetchOwnVendorProfile(supabase, user.id),
    isStoreShellRequest(),
  ]);
  const manager = !role || canManageVendor(role);

  const [unread, tierRow, teamRead, payout] = await Promise.all([
    countUnread(supabase, user.id),
    manager && profile
      ? supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle()
      : Promise.resolve(null),
    manager && profile
      ? supabase.from('vendor_team_members').select('user_id, role').eq('vendor_profile_id', profile.vendor_profile_id)
      : Promise.resolve(null),
    manager && profile
      ? readSupplierPayoutReadiness({
          adminClient: createAdminClient(),
          vendorProfileId: profile.vendor_profile_id,
          vendorUserId: profile.user_id,
        }).catch(() => 'unreadable' as const)
      : Promise.resolve('unreadable' as const),
  ]);
  // The Moodboard library gate, decided from the profile already read (the pure half — no second read).
  const moodboard = manager && moodboardLibraryAccessForProfile(profile).allowed;

  const tier = (tierRow?.data as { tier_state?: string | null } | null)?.tier_state ?? null;
  const team = teamRead && !teamRead.error ? ((teamRead.data ?? []) as { user_id: string; role: string }[]) : null;
  const helpers = team && profile ? teamSeats(team, profile.user_id).people : null;
  const tools = settingsMoreTools({
    hasMoodboardLibraryAccess: moodboard,
    hasMusicRepertoireAccess: isMusicToolCategory(profile?.services ?? null),
    storeShell,
  });

  return (
    <SettingsView
      unread={unread}
      manager={manager}
      storeShell={storeShell}
      tier={tier}
      payout={payout}
      helpers={helpers}
      tools={tools}
    />
  );
}
