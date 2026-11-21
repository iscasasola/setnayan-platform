import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Store } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { ToolPage, ToolPin } from '../_components/tool-page';
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
    // Agents/viewers: no aggregate reputation view. Send them home.
    redirect('/vendor-dashboard');
  }

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    return (
      <ToolPage name="track-record">
        <ToolPin route="/vendor-dashboard/track-record" title="Track record" />
        <p className="mt-3 text-[15px] text-[color:var(--m-slate-2)]">
          Set up your supplier profile first — once couples mark your bookings
          delivered, your record across every kind of event shows up here.
        </p>
        <div className="mt-4">
          <ActionButton tone="brand" main icon={<Store aria-hidden />} label="Go to my shop" href="/vendor-dashboard/shop" />
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
