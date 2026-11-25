import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Store } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { routes } from '@/lib/routes';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, resolveVendorStanding, canManageVendor } from '@/lib/vendor-role';
import { RoleLock } from '@/app/vendor-dashboard/_components/role-lock';
import { ToolFail, ToolPage, ToolPin } from '../_components/tool-page';
import { fetchVendorTrackRecord } from '../_components/vendor-track-record-panel';
import { TrackRecordView } from './_components/track-record-view';

export const metadata = { title: 'Track record · Supplier' };

/**
 * /vendor-dashboard/track-record — "One profile, every life event."
 *
 * A standalone reputation surface that breaks a vendor's flat completed-events
 * count out by events.event_type: Weddings 12 · ★4.8 / Debuts 3 · ★4.6 / … .
 * Reachable from the /shop "More tools" card (SHOP_TOOLS) via the `track-record`
 * entry. Owner/admin only — agents/viewers don't see the
 * aggregate reputation view (mirrors the reviews/analytics surfaces).
 */
export default async function VendorTrackRecordPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const role = await resolveVendorRole(supabase, user.id);
  if (!role || !canManageVendor(role)) {
    // 🔒 Agents/viewers: no aggregate reputation view — said with the Problem and the Solution, never a silent bounce.
    return (
      <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-6 sm:px-6" data-role-locked-page="insights">
        <h1 className="sn-h1">Track record</h1>
        <RoleLock duty={(await resolveVendorStanding(supabase, user.id).catch(() => null))?.duty ?? null} capability="insights" className="mt-4" />
      </section>
    );
  }

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    // 🪪 A shop role was read above, so a missing profile here is a failed read — said, never "Set up your supplier
    // profile first" to a shop that has one (final check A5-G5-06).
    return (
      <ToolPage name="track-record">
        <ToolPin route="/vendor-dashboard/track-record" title="Track record" />
        <ToolFail
          data="track-record-shop"
          title="Couldn’t read your shop just now"
          line="Nothing was changed."
          retryHref={routes.vendorDashboard.trackRecord()}
        />
        <div className="mt-4">
          <ActionButton tone="neutral" icon={<Store aria-hidden />} label="Go to my shop" href="/vendor-dashboard/shop" />
        </div>
      </ToolPage>
    );
  }

  // null = the read was refused — said as such, never as "No completed events yet" (controller 21 Nov).
  const rows = await fetchVendorTrackRecord(
    supabase,
    profile.vendor_profile_id,
  );

  return <TrackRecordView rows={rows} />;
}
