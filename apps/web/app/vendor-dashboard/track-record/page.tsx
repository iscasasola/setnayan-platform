import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarHeart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  VendorTrackRecordPanel,
  fetchVendorTrackRecord,
} from '../_components/vendor-track-record-panel';

export const metadata = { title: 'Track record · Vendor' };

/**
 * /vendor-dashboard/track-record — "One profile, every life event."
 *
 * A standalone reputation surface that breaks a vendor's flat completed-events
 * count out by events.event_type: Weddings 12 · ★4.8 / Debuts 3 · ★4.6 / … .
 * Reachable from the My Shop group (the /more landing + mobile nav) via the
 * `track-record` sidebar entry. Owner/admin only — agents/viewers don't see the
 * aggregate reputation view (mirrors the reviews/analytics surfaces).
 */
export default async function VendorTrackRecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const role = await resolveVendorRole(supabase, user.id);
  if (!role || !canManageVendor(role)) {
    // Agents/viewers: no aggregate reputation view. Send them home.
    redirect('/vendor-dashboard');
  }

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Track record
        </h1>
        <p className="mt-4 text-base text-ink/65">
          Set up your vendor profile first — once couples mark your bookings
          delivered, your record across every kind of event shows up here.
        </p>
        <Link
          href="/vendor-dashboard/shop"
          className="mt-6 inline-flex items-center rounded-full px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          Go to my shop
        </Link>
      </div>
    );
  }

  const rows = await fetchVendorTrackRecord(
    supabase,
    profile.vendor_profile_id,
  );

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-6 space-y-1.5">
        <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
          One profile, every life event
        </p>
        <h1
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: 'var(--m-ink)' }}
        >
          Track record
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          How your reputation adds up across every kind of event you&rsquo;ve
          worked — weddings, debuts, christenings, and beyond.
        </p>
      </header>

      {rows.length > 0 ? (
        <VendorTrackRecordPanel
          supabase={supabase}
          vendorProfileId={profile.vendor_profile_id}
          rows={rows}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
          <CalendarHeart
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="text-sm font-medium text-ink/65">
            No completed events yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/45">
            Once a couple marks one of your bookings delivered, it lands here —
            grouped by the kind of event so your strengths across weddings,
            debuts, and every other celebration are clear at a glance.
          </p>
        </div>
      )}
    </div>
  );
}
