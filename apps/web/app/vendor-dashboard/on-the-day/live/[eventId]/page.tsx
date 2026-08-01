import Link from 'next/link';
import { eventTilesForBooking } from '@/lib/vendor-event-roles';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';
import { fetchReviewsForVendorWithCouple } from '@/lib/reviews';
import { resolveModules, type DayOfModuleId } from '@/lib/vendor-dayof-modules';
import { fetchDayOfOverride } from '@/lib/vendor-dayof-config';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { resolveVendorSpecializationAccessForVendor } from '@/lib/vendor-specialization-gate.server';
import { buildDayOfFrame } from '@/lib/vendor-dayof-frame';
import { RunOfShowHeader } from '@/app/_components/run-of-show-header';
import { FloorClock } from './_components/floor-clock';
import { LiveReviews } from '../../_components/live-reviews';
import {
  ConsoleEyebrow,
  ConsoleHeading,
  ConsolePlate,
} from '../../_components/pahina-console';
import { SpecializationSlot } from './_components/specialization-slot';
import { registeredSpecializationSets } from './_components/specialization-registry';

export const metadata = { title: 'Live · On the Day · Setnayan' };

/**
 * The launched day-of console.
 *
 * ── THE FRAME (2026-07-27) ─────────────────────────────────────────────────
 *
 * Two sections, not one flat stack: the GENERIC KIT every vendor gets, and a
 * SPECIALIZATION slot for the vendor's trade (song desk · script & cues · floor
 * command). The structure is decided by `buildDayOfFrame` in
 * `lib/vendor-dayof-frame.ts`; this page is a renderer over that model.
 *
 * To add a specialization surface you edit ONE file — the registry at
 * `_components/specialization-registry.tsx` — and add ONE line to it, pointing
 * at a component in your own new subdirectory. You do not edit this page. See
 * the registry's header for the two-step recipe.
 *
 * ── THE GATE GOVERNS THE NEW SECTION ONLY ──────────────────────────────────
 *
 * `resolveVendorSpecializationAccessForVendor` is resolved SERVER-SIDE here and
 * the entitlement is `access.unlockedSet`. It decides whether the specialization
 * section renders a desk or an upsell — and nothing else. `resolveModules` still
 * produces the generic kit exactly as it did before this frame existed, and the
 * frame passes that list through untouched on every access path. Free-during-
 * launch is active and every production vendor is on a free tier: nobody loses
 * a tool they had yesterday. Pinned by the identity tests in
 * `lib/vendor-dayof-frame.test.ts`.
 *
 * ── STYLING (Pahina materials) ─────────────────────────────────────────────
 *
 * Dressed in the same Pahina language as the guest site, but WITHOUT the
 * `.pahina-*` classes — those are `.sn-editorial`-scoped and unreachable from a
 * dashboard by design (owner-locked guest-tree ↔ chrome separation). The
 * recipes are recomposed from the `:root`-level palette tokens in
 * `_components/pahina-console.tsx`; see that file's header for the full
 * reasoning and the two contrast traps it handles.
 *
 * The obsidian FOCAL is deliberately kept on `.sn-tile-dark`: `FloorClock` is a
 * client component with hardcoded light-on-dark colours, `.sn-tile-dark` is the
 * mode-stable dark stock it was built against, and a day-of clock wants to be
 * the one glare-legible thing on the screen. It gains the Pahina gild hairline
 * and display face; it does not change what it does.
 */

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
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  /** `?role=` — which desk this person is running tonight. UNTRUSTED: validated
   *  against the entitlement inside `buildDayOfFrame`, never here. */
  searchParams: Promise<{ role?: string }>;
}) {
  const { eventId } = await params;
  const { role: requestedRole } = await searchParams;
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
  // Which client can READ this vendor's profile row. The owner path reads under
  // their own RLS; the grantee path is already authorised by the grant and uses
  // the admin client (as the profile load below does), so the subscription read
  // behind the specialization gate resolves for grantees too instead of silently
  // degrading a paying vendor's crew to the generic kit.
  let profileClient: SupabaseClient = supabase;

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
          profileClient = admin;
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

  // WHICH ROLES THEY WERE BOOKED FOR — read from what they were booked to DO,
  // not only the booking row's single summary category (owner, 2026-08-01).
  //
  // A booking already lists its services (`requested_service_ids`) and each
  // service carries its own category, so a supplier hired as the band AND the
  // emcee has always been recorded — it was simply never read. Best-effort and
  // UNION-only: if this read fails or the booking predates services, the answer
  // is exactly the summary category, so no historic booking can regress.
  const { data: bookedServiceRows } = await supabase
    .from('event_vendors')
    .select('requested_service_ids')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', profile.vendor_profile_id)
    .maybeSingle();

  const serviceIds =
    (bookedServiceRows as { requested_service_ids?: string[] | null } | null)
      ?.requested_service_ids ?? [];

  let bookedServiceCategories: string[] = [];
  if (serviceIds.length > 0) {
    const { data: svcRows } = await supabase
      .from('vendor_services')
      .select('category')
      .in('vendor_service_id', serviceIds);
    bookedServiceCategories = ((svcRows ?? []) as Array<{ category: string | null }>)
      .map((r) => r.category)
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
  }

  const eventTiles = eventTilesForBooking({
    bookedCategories: brief?.booked_categories ?? null,
    bookedServiceCategories,
  });
  const modules = resolveModules(profile.services, eventTiles, override).filter((m) => m.enabled);
  const has = (id: DayOfModuleId) => modules.some((m) => m.id === id);

  // THE SPECIALIZATION GATE — server-side, on the vendor's live subscription
  // row. Governs the specialization section below and nothing above it.
  const access = await resolveVendorSpecializationAccessForVendor(
    profileClient,
    profile.vendor_profile_id,
    { services: profile.services, eventTiles },
  );
  const frame = buildDayOfFrame({
    access,
    genericModuleIds: modules.map((m) => m.id),
    registeredSets: registeredSpecializationSets(),
    // A supplier can be two trades at one wedding; which one they are RUNNING
    // is a fact about the person on the floor tonight. The builder validates
    // this against `unlockedSets` and ignores anything they do not hold.
    activeSet: requestedRole ?? null,
  });

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
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      {/* Close / back to the console */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/vendor-dashboard/on-the-day"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Exit
        </Link>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/55">
          Day-of · live
        </span>
      </div>

      {/* Obsidian focal — couple + live clock. Kept dark on purpose (see the
          page doc): it is the one glare-legible anchor on a venue floor. */}
      <div>
        <div
          aria-hidden
          className="h-2 border border-b-0 border-ink/10 bg-gradient-to-r from-veil via-paper-deep to-gild/25"
        />
        <div className="sn-tile-dark sn-bloom relative p-5 sm:p-6">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-2 border border-gild/20"
          />
          <div className="relative">
            <p className="truncate font-pahina text-2xl font-light leading-snug tracking-tight text-paper">
              {coupleName}
            </p>
            {place ? (
              <p className="mt-0.5 truncate text-sm text-paper/60">{place}</p>
            ) : null}
            <div className="mt-4">
              <FloorClock blocks={blocks} />
            </div>
          </div>
        </div>
      </div>

      {/* Jump nav — only when there are two sections to move between. Every
          href anchors a section this same render produces (no dead links). */}
      {frame.nav.length > 0 ? (
        <nav
          aria-label="Console sections"
          className="flex items-center gap-1 border-y border-ink/10 py-2"
        >
          {frame.nav.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="rounded-full px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-ink/70 transition-colors hover:bg-veil hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}

      {/* ── THE GENERIC KIT — every vendor, every tier, unchanged ─────────── */}
      <section id={frame.genericDomId} className="scroll-mt-4 space-y-4">
        <ConsoleEyebrow>Your tools</ConsoleEyebrow>

        {/* Run of show (reused realtime header) */}
        {has('run_of_show') ? <RunOfShowHeader eventId={eventId} initial={blocks} /> : null}

        {/* Headcount */}
        {has('pax_headcount') ? (
          <ConsolePlate className="space-y-2">
            <div className="flex items-center gap-2">
              <Users aria-hidden className="h-4 w-4 text-gild" strokeWidth={1.75} />
              <ConsoleHeading as="h3">Headcount</ConsoleHeading>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-ink">
                {attending} / {invited}
              </span>
              <span className="text-sm text-ink/65">attending · pulled live from RSVPs</span>
            </div>
          </ConsolePlate>
        ) : null}

        {/* Enabled-module quick links */}
        {linkModules.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {linkModules.map(({ mod, href }) => (
              <Link
                key={mod.id}
                href={href}
                className="sn-press group relative flex items-center justify-between gap-3 border border-ink/10 bg-paper-deep p-4 transition-colors hover:border-gild/40"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-1.5 border border-ink/[0.08]"
                />
                <span className="relative min-w-0">
                  <span className="block font-pahina text-base font-light leading-snug tracking-tight text-ink">
                    {mod.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink/65">
                    {mod.blurb}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="relative h-5 w-5 shrink-0 text-ink/45 transition-colors group-hover:text-gild"
                  strokeWidth={1.75}
                />
              </Link>
            ))}
          </div>
        ) : null}

        {/* Live reviews */}
        {has('live_reviews') ? (
          <LiveReviews vendorProfileId={profile.vendor_profile_id} initial={reviews} />
        ) : null}
      </section>

      {/* ── THE SPECIALIZATION SLOT — the only gated section on this page ─── */}
      <SpecializationSlot
        model={frame}
        eventId={eventId}
        vendorProfileId={profile.vendor_profile_id}
        coupleName={coupleName}
        // Already read above for the floor clock + run-of-show header — passed
        // down rather than re-queried.
        blocks={blocks}
        bookedCategories={brief?.booked_categories ?? null}
      />
    </section>
  );
}
