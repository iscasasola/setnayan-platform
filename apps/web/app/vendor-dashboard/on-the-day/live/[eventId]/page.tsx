import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';
import { fetchReviewsForVendorWithCouple } from '@/lib/reviews';
import { resolveModules, type DayOfModuleId } from '@/lib/vendor-dayof-modules';
import { fetchDayOfOverride } from '@/lib/vendor-dayof-config';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import { FloorClock } from './_components/floor-clock';
import { LiveReviews } from '../../_components/live-reviews';

export const metadata = { title: 'Live · On the Day · Setnayan' };

/** PH wall-clock today (UTC+8) as 'YYYY-MM-DD'. */
function phToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Where each enabled module's tool lives — the launched console links out to
 *  the surface that already owns each tool (no duplicated data plumbing). */
function moduleHref(id: DayOfModuleId, eventId: string): string | null {
  switch (id) {
    case 'shot_list':
    case 'run_of_show':
    case 'pax_headcount':
    case 'delivery_handover':
    case 'issues_log':
      return `/vendor-dashboard/on-the-day`;
    case 'production_sheet':
      return `/vendor-dashboard/clients/${eventId}/production-sheet`;
    case 'setlist':
      return `/vendor-dashboard/repertoire`;
    case 'qr_scanner':
      return `/vendor-dashboard/clients/${eventId}`;
    case 'review_qr':
    case 'live_reviews':
      return null; // rendered inline below
    case 'vendor_papic':
      // Counsel-gated: the link is filtered out below unless the capability is
      // live (isVendorPapicCaptureEnabled); the page itself also fail-closes.
      return `/vendor-dashboard/on-the-day/live/${eventId}/papic`;
    case 'guest_delivery':
      return null; // counsel-gated — not launched here yet
  }
}

export default async function VendorOnTheDayLivePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/vendor-dashboard/on-the-day/live/${eventId}`);

  // Access resolution: the vendor owner/team-member opens their own console;
  // a GRANTED account (launcher step 3) opens the vendor's console for the one
  // event they were granted (current_vendor_dayof_grant_event_ids). We resolve
  // the effective vendor profile from whichever path the user came through.
  const ownProfile = await fetchOwnVendorProfile(supabase, user.id);
  // The page only needs the id + services from the profile — a minimal shape so
  // the grantee path (admin-loaded partial row) is assignable too.
  let profile: { vendor_profile_id: string; services: string[] } | null = ownProfile;
  let booking = ownProfile
    ? (await fetchVendorPoolBookings(supabase, ownProfile.vendor_profile_id)).find(
        (b) => b.eventId === eventId,
      ) ?? null
    : null;

  if (!booking) {
    // Not the owner (or not booked under their own profile) — check for a grant.
    const { data: grants } = await supabase.rpc('current_vendor_dayof_grant_event_ids');
    const grantedEvents = new Set((grants as string[] | null) ?? []);
    if (grantedEvents.has(eventId)) {
      // Resolve the granting vendor + booking via the admin client (the grant is
      // the authorization). One grantee → one vendor per event in practice.
      const admin = createAdminClient();
      const { data: grantRow } = await admin
        .from('vendor_event_access_grants')
        .select('vendor_profile_id')
        .eq('event_id', eventId)
        .eq('grantee_user_id', user.id)
        .is('revoked_at', null)
        .limit(1)
        .maybeSingle();
      const vpid = (grantRow as { vendor_profile_id: string } | null)?.vendor_profile_id ?? null;
      if (vpid) {
        const { data: vp } = await admin
          .from('vendor_profiles')
          .select('vendor_profile_id, business_name, business_slug, services')
          .eq('vendor_profile_id', vpid)
          .maybeSingle();
        if (vp) {
          profile = vp as { vendor_profile_id: string; services: string[] };
          booking =
            (await fetchVendorPoolBookings(admin, vpid)).find((b) => b.eventId === eventId) ?? null;
        }
      }
    }
  }

  if (!profile) redirect('/vendor-dashboard/verify');

  // Booked-today gate: the launched console only opens for a booking dated today.
  const today = phToday();
  if (!booking || booking.bookedDate !== today) {
    redirect('/vendor-dashboard/on-the-day');
  }

  // Brief (couple / pax / booked tiles), run-of-show, override, reviews.
  const { data: briefData } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  const brief = briefData as
    | {
        event: { display_name: string | null; venue_name: string | null };
        booked_categories: string[];
        pax: { invited: number; attending: number };
      }
    | null;

  const [blocksRaw, override, reviews] = await Promise.all([
    fetchRunOfShowBlocks(eventId),
    fetchDayOfOverride(supabase, profile.vendor_profile_id, eventId),
    fetchReviewsForVendorWithCouple(supabase, profile.vendor_profile_id, { limit: 20 }),
  ]);
  const blocks = blocksRaw ?? [];

  const eventTiles = brief?.booked_categories ?? null;
  const modules = resolveModules(profile.services, eventTiles, override).filter((m) => m.enabled);
  const has = (id: DayOfModuleId) => modules.some((m) => m.id === id);

  const coupleName = brief?.event.display_name ?? booking.eventName ?? 'Your event';
  const place = brief?.event.venue_name ?? null;
  const invited = brief?.pax.invited ?? 0;
  const attending = brief?.pax.attending ?? 0;

  // Quick-link tiles for enabled modules that route to their own surface. The
  // counsel-gated Papic capture tool only appears when its Data Privacy control
  // is approved; otherwise it stays dark (the module card shows "Needs setup").
  const papicEnabled = await isVendorPapicCaptureEnabled();
  const linkModules = modules
    .map((m) => ({ mod: m, href: moduleHref(m.id, eventId) }))
    .filter(
      (x): x is { mod: (typeof modules)[number]; href: string } =>
        x.href != null && !(x.mod.id === 'vendor_papic' && !papicEnabled),
    );

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      {/* Close / back to the console */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/vendor-dashboard/on-the-day"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'var(--m-slate-2)' }}
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Exit
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          Day-of · live
        </span>
      </div>

      {/* Obsidian focal — couple + live clock */}
      <div className="sn-tile-dark sn-bloom p-5 sm:p-6">
        <p className="truncate text-lg font-semibold" style={{ color: 'var(--m-paper)' }}>
          {coupleName}
          {place ? <span className="ml-2 text-sm font-normal" style={{ color: 'rgba(251,251,250,0.6)' }}>· {place}</span> : null}
        </p>
        <div className="mt-4">
          <FloorClock blocks={blocks} />
        </div>
      </div>

      {/* Run of show (reused realtime header) */}
      {has('run_of_show') ? (
        <div>
          <h2 className="sn-sec">Run of show</h2>
          <div className="mt-3">
            <RunOfShowHeader eventId={eventId} initial={blocks} />
          </div>
        </div>
      ) : null}

      {/* Headcount */}
      {has('pax_headcount') ? (
        <div className="sn-tile">
          <div className="flex items-center gap-2">
            <Users aria-hidden className="h-5 w-5" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
            <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
              Headcount
            </p>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold" style={{ color: 'var(--m-ink)' }}>
              {attending} / {invited}
            </span>
            <span className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
              attending · pulled live from RSVPs
            </span>
          </div>
        </div>
      ) : null}

      {/* Enabled-module quick links */}
      {linkModules.length > 0 ? (
        <div>
          <h2 className="sn-sec">Your tools</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {linkModules.map(({ mod, href }) => (
              <Link key={mod.id} href={href} className="sn-tile sn-press flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                    {mod.label}
                  </span>
                  <span className="mt-0.5 block text-xs" style={{ color: 'var(--m-slate-2)' }}>
                    {mod.blurb}
                  </span>
                </span>
                <ArrowRight aria-hidden className="h-5 w-5 shrink-0" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.75} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Live reviews */}
      {has('live_reviews') ? (
        <LiveReviews vendorProfileId={profile.vendor_profile_id} initial={reviews} />
      ) : null}
    </section>
  );
}
