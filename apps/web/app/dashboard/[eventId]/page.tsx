import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Sparkles, CalendarPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import { sweepExpiredConcierge } from '@/lib/concierge';
import { fetchGuestsByEvent } from '@/lib/guests';
import { isChineseWedding, isMuslimWedding } from '@/lib/chinese-wedding';
import { getLifecyclePhase } from '@/lib/day-of-mode';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { fetchTables, type EventTableRow } from '@/lib/seating';
import { eventPabatiActive, fetchPabatiQuota } from '@/lib/pabati';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { findSameDayVendors, type SameDayVendor } from '@/lib/same-day-vendors';
import {
  computeOfficiantAutoResolution,
  getOfficiantAutoResolvedHint,
} from '@/lib/officiant-auto-resolve';
import { EventDayPrepCta } from '@/app/_components/event-day-prep-cta';
import { AutoPreloadOnEventDay } from '@/app/_components/auto-preload-on-event-day';
import { DayOfModeGrid } from './_components/day-of-mode/grid';
import type { PabatiClipThumb } from './_components/day-of-mode/video-guestbook-card';
import { SetDateNudge } from './_components/set-date-nudge';
import { NikahEssentialsCard } from './_components/nikah-essentials-card';
import { EventDashboard } from './_components/event-dashboard';
import { SubmitButton } from '@/app/_components/submit-button';
import { canPlanNextYear } from '@/lib/event-recurrence';
import { planNextYearEvent } from '@/app/dashboard/(account)/create-event/actions';

export const dynamic = 'force-dynamic';

/**
 * /dashboard/[eventId] — the event Home.
 *
 * Owner directive 2026-07-10: the Home IS the dashboard. The couple's
 * journey-rail / decisions / around-your-event experience (formerly the
 * standalone `/progress` route) now renders here in place via
 * `<EventDashboard>`. The Home keeps ONLY the surfaces the dashboard doesn't
 * cover — the wedding-day takeover (iteration 0031 · DayOfModeGrid + prep CTA)
 * above it, and the cultural / set-date overlays injected between the bento and
 * the journey rail through EventDashboard's `slotAfterBento` slot:
 *   • SetDateNudge          — when no firm date is set
 *   • NikahEssentialsCard   — Muslim wedding track
 *   • Tea-ceremony tile     — Chinese (Tsinoy) wedding track
 *
 * `<EventDashboard>` owns the AI gate (real entitlement OR `?suri=preview` for
 * internal accounts) + all its own data loading; this shell forwards the Home
 * URL's `?suri` param straight through, so the preview override now works on
 * the Home URL.
 */

const OFFICIANT_LOCKED_STATUSES = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export default async function EventHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ suri?: string }>;
}) {
  const { eventId } = await params;
  const search = searchParams ? await searchParams : {};
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Lazy expiry sweeps at the top of the dashboard (no-cron architecture per
  // CLAUDE.md 2026-05-14 / PR #47). Fire-and-forget; failures never block the
  // render. Concierge expiry + non-Concierge subscription-SKU lapse, the
  // latter scoped to this event so the hot path stays fast.
  const adminClient = createAdminClient();
  void sweepExpiredConcierge(adminClient);
  void sweepLapsedSubscriptions(adminClient, { eventId });

  // Event row — lean select of exactly what the Home shell (day-of takeover +
  // cultural / set-date overlays) reads, with the defensive fallback-to-'*'
  // pattern for migration drift between local + prod.
  const eventRes = await (async () => {
    const leanSelect =
      'event_id, event_date, event_type, ceremony_type, secondary_ceremony_type, cleared_at, venue_latitude, venue_longitude, region, mahr_description, gender_separation';
    const leanRes = await supabase
      .from('events')
      .select(leanSelect)
      .eq('event_id', eventId)
      .maybeSingle();
    if (
      leanRes.error &&
      /column .* does not exist|undefined_column|42703/i.test(
        (leanRes.error as { message?: string; code?: string }).message ??
          (leanRes.error as { code?: string }).code ??
          '',
      )
    ) {
      return supabase.from('events').select('*').eq('event_id', eventId).maybeSingle();
    }
    return leanRes;
  })();

  const event = eventRes.data;
  if (!event) notFound();

  const isNikahEvent = isMuslimWedding({
    ceremony_type: (event as { ceremony_type?: string | null }).ceremony_type ?? null,
    secondary_ceremony_type:
      (event as { secondary_ceremony_type?: string | null }).secondary_ceremony_type ?? null,
  });
  const isChineseEvent = isChineseWedding({
    ceremony_type: (event as { ceremony_type?: string | null }).ceremony_type ?? null,
    secondary_ceremony_type:
      (event as { secondary_ceremony_type?: string | null }).secondary_ceremony_type ?? null,
  });

  // Guests — read ONLY by the Muslim-track NikahEssentialsCard (wali / witness /
  // imam role tallies), which itself renders only when isNikahEvent. So the
  // fetch is gated on isNikahEvent — every non-Muslim event skips the query
  // entirely. Fail-soft to [] so a guest-query hiccup never blocks Home.
  // (EventDashboard re-fetches its own guests for the at-a-glance stats.)
  const guests = isNikahEvent
    ? await fetchGuestsByEvent(supabase, eventId).catch((err: unknown) => {
        logQueryError(
          'EventHome (fetchGuestsByEvent threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return [] as Awaited<ReturnType<typeof fetchGuestsByEvent>>;
      })
    : ([] as Awaited<ReturnType<typeof fetchGuestsByEvent>>);

  // Day-of mode (iteration 0031): inside the T-1h..T+8h window of the event
  // date, load the schedule + seating + same-day + Pabati data for the live
  // grid that takes over above the dashboard. Outside the window we render
  // nothing extra and skip every query.
  const dayOfActive = event.event_date
    ? getLifecyclePhase(
        event.event_date,
        (event as { cleared_at?: string | null }).cleared_at ?? null,
      ) === 'dayof'
    : false;
  let dayOfBlocks: Awaited<ReturnType<typeof fetchScheduleBlocks>> = [];
  let dayOfHeadTable: EventTableRow | null = null;
  let dayOfNearbyTables: EventTableRow[] = [];
  let dayOfSameDayVendors: SameDayVendor[] = [];
  let dayOfPabatiActive = false;
  let dayOfPabatiClips: PabatiClipThumb[] = [];
  let dayOfPabatiUsed = 0;
  let dayOfPabatiTotal = 0;
  if (dayOfActive) {
    const [blocksRes, tablesRes, sameDayRes] = await Promise.all([
      fetchScheduleBlocks(supabase, eventId).catch(() => []),
      fetchTables(supabase, eventId).catch(() => [] as EventTableRow[]),
      // Day-of "Get help" shortlist (Event Lifecycle Menu §4 / PR5) — verified
      // + paid vendors who opted into same-day work, nearest the venue first.
      // Best-effort: a query error just leaves the escalation-only floor.
      findSameDayVendors(supabase, {
        lat: (event as { venue_latitude?: number | null }).venue_latitude ?? null,
        lng: (event as { venue_longitude?: number | null }).venue_longitude ?? null,
        region: (event as { region?: string | null }).region ?? null,
      }).catch(() => [] as SameDayVendor[]),
    ]);
    dayOfBlocks = blocksRes;
    dayOfSameDayVendors = sameDayRes;
    const tables = tablesRes;
    // The canonical 2026-05-09 catalog replaces the variable-capacity 'head_table'
    // with three fixed family_head_12/14/16 variants. Day-of UI keeps surfacing
    // a single "head table" by picking the first family_head_* row found.
    dayOfHeadTable = tables.find((t) => t.table_type.startsWith('family_head_')) ?? null;
    dayOfNearbyTables = tables.filter((t) => t.table_id !== dayOfHeadTable?.table_id).slice(0, 6);

    // PABATI — gate first; only fetch clips + quota when the pack is active so a
    // non-owner pays no query cost. Best-effort: any read error leaves the card
    // hidden / empty rather than crashing the day-of grid.
    try {
      dayOfPabatiActive = await eventPabatiActive(adminClient, eventId);
      if (dayOfPabatiActive) {
        const [quota, clipsRes] = await Promise.all([
          fetchPabatiQuota(adminClient, eventId),
          // Latest clean, non-hidden greetings for the thumbnail strip. Excludes
          // nsfw_blocked + unscreened (fail-closed, same as every guest surface)
          // and couple-hidden rows.
          adminClient
            .from('pabati_clips')
            .select('clip_id, r2_object_key')
            .eq('event_id', eventId)
            .eq('moderation_state', 'clean')
            .is('hidden_at', null)
            .order('captured_at', { ascending: false })
            .limit(6),
        ]);
        dayOfPabatiUsed = quota.used;
        dayOfPabatiTotal = quota.total;
        const clipRows = (clipsRes.data ?? []) as Array<{
          clip_id: string;
          r2_object_key: string | null;
        }>;
        dayOfPabatiClips = await Promise.all(
          clipRows.map(async (r) => ({
            id: r.clip_id,
            url: r.r2_object_key
              ? await displayUrlForStoredAsset(r.r2_object_key).catch(() => null)
              : null,
          })),
        );
      }
    } catch {
      dayOfPabatiActive = false;
      dayOfPabatiClips = [];
    }
  }

  // Nikah imam designation (Muslim track). The Five-essentials card ticks the
  // "Imam / qadi" essential when a guest has role 'imam' (computed in the card
  // from `guests`), OR — computed here, since the card only sees guests — when
  // the couple has booked an officiant vendor (locked), OR when a locked mosque
  // venue auto-resolves the imam (computeOfficiantAutoResolution → muslim_mosque,
  // which also surfaces the PD 1083 hint). Only runs for muslim events, and the
  // auto-resolve query only fires when no officiant vendor is already booked.
  let nikahImamBooked = false;
  let nikahImamNote: string | null = null;
  if (isNikahEvent) {
    const officiantRowsRes = await (async () => {
      try {
        return await supabase
          .from('event_vendors')
          .select('marketplace_vendor_id, source_venue_directory_id, category, status')
          .eq('event_id', eventId)
          .is('archived_at', null);
      } catch (caught) {
        logQueryError(
          'EventHome (nikah officiant event_vendors SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })();
    const officiantRows = (officiantRowsRes.data ?? []) as Array<{
      marketplace_vendor_id: string | null;
      source_venue_directory_id: string | null;
      category: string | null;
      status: string | null;
    }>;
    nikahImamBooked = officiantRows.some(
      (v) => v.category === 'officiant' && OFFICIANT_LOCKED_STATUSES.has(v.status ?? ''),
    );
    if (!nikahImamBooked) {
      const resolved = await computeOfficiantAutoResolution(supabase, {
        eventId,
        ceremonyType: 'muslim',
        vendorRows: officiantRows,
      }).catch(() => null);
      if (resolved?.framing === 'muslim_mosque') {
        nikahImamBooked = true;
        nikahImamNote = getOfficiantAutoResolvedHint('muslim_mosque');
      }
    }
  }

  // Recurrence (owner 2026-07-12): recurring types (birthday · anniversary ·
  // reunion · corporate) get a "plan next year" card that clones this event's
  // details forward into a fresh instance.
  const canRecur = canPlanNextYear((event.event_type as string | null) ?? null);

  // Home-injected overlays — the cultural / set-date cards that the dashboard
  // doesn't cover. Passed to <EventDashboard> as `slotAfterBento` so they land
  // between the At-a-glance bento and the journey rail.
  const overlays = (
    <>
      {/* The five essentials of your Nikah — the signature card for the Muslim
       *  wedding track. Shows ONLY for muslim weddings (primary ceremony OR a
       *  mixed ceremony with a muslim leg). Turns the five validity pillars of
       *  the Islamic marriage contract into a tangible checklist + hosts the
       *  mahr / gender-separation editor. */}
      {isNikahEvent ? (
        <NikahEssentialsCard
          eventId={eventId}
          eventDateSet={!!event.event_date}
          mahrDescription={
            (event as { mahr_description?: string | null }).mahr_description ?? null
          }
          genderSeparation={
            (event as { gender_separation?: string | null }).gender_separation ?? null
          }
          guests={guests}
          imamBooked={nikahImamBooked}
          imamNote={nikahImamNote}
        />
      ) : null}

      {/* Set-your-date nudge — date-as-output keeps onboarding's event_date NULL,
       *  but the couple still needs a clear, low-friction way to lock the date
       *  later so the date-gated public website lifecycle (Save-the-Date / Event
       *  / Editorial) can launch. Renders ONLY when no date is set; dismissible
       *  per-event; links to the existing /date-selection governed surface. */}
      {!event.event_date ? <SetDateNudge eventId={eventId} /> : null}

      {/* Chinese (Tsinoy) tea-ceremony helper — a FREE, ceremony-gated tile.
       *  Renders only for Chinese weddings (primary OR secondary 'chinese' rite,
       *  per the locked overlay model · isChineseWedding). The tea ceremony
       *  (敬茶) is the signature moment; the tile links to the serving-order
       *  helper so couples prepare the groom's-side-then-bride's-side order with
       *  both families. Never routed through the paid add-ons catalog. */}
      {isChineseEvent ? (
        <Link
          href={`/dashboard/${eventId}/guests/tea-ceremony`}
          className="flex items-center gap-3 rounded-xl border border-terracotta/25 bg-terracotta/[0.04] px-4 py-3 transition-colors hover:border-terracotta/45 hover:bg-terracotta/[0.07]"
        >
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta-700"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              Tea ceremony serving order
            </span>
            <span className="block text-xs text-ink/60">
              Plan who you serve first — groom&rsquo;s side, then bride&rsquo;s,
              in order of seniority.
            </span>
          </span>
          <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
        </Link>
      ) : null}

      {/* Plan next year — recurrence (owner-locked 2026-07-12). Recurring types
       *  clone this event's details forward into next year's fresh planning
       *  instance; the guest list starts fresh ("Details, not the guest list"). */}
      {canRecur ? (
        <form
          action={planNextYearEvent}
          className="flex items-center gap-3 rounded-xl border border-mulberry/25 bg-mulberry/[0.04] px-4 py-3"
        >
          <input type="hidden" name="event_id" value={eventId} />
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry"
          >
            <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              Make it an annual tradition
            </span>
            <span className="block text-xs text-ink/60">
              Plan next year&rsquo;s celebration — we&rsquo;ll carry over the
              details and start you a fresh guest list.
            </span>
          </span>
          <SubmitButton
            className="shrink-0 rounded-full border border-mulberry/30 px-4 py-2 text-sm font-semibold text-mulberry transition hover:bg-mulberry/10"
            pendingLabel="Creating…"
          >
            Plan next year
          </SubmitButton>
        </form>
      ) : null}
    </>
  );

  const hasOverlays =
    isNikahEvent || !event.event_date || isChineseEvent || canRecur;

  return (
    <>
      <EventDayPrepCta eventId={eventId} eventDate={event.event_date} />
      <AutoPreloadOnEventDay eventId={eventId} eventDate={event.event_date} />
      {dayOfActive ? (
        <DayOfModeGrid
          eventId={eventId}
          blocks={dayOfBlocks.map((b) => ({
            block_id: b.block_id,
            label: b.label,
            start_at: b.start_at,
            end_at: b.end_at,
            location: b.location,
          }))}
          headTable={dayOfHeadTable}
          nearbyTables={dayOfNearbyTables}
          sameDayVendors={dayOfSameDayVendors}
          pabatiActive={dayOfPabatiActive}
          pabatiClips={dayOfPabatiClips}
          pabatiUsed={dayOfPabatiUsed}
          pabatiTotal={dayOfPabatiTotal}
        />
      ) : null}

      {/* The dashboard — hero → at-a-glance bento → [overlays] → journey rail →
       *  decisions → around-your-event, plus the AI extras (Suri briefing,
       *  What's-next, Suri on watch) when Setnayan AI is active for the viewer
       *  (or `?suri=preview` for internal accounts). */}
      <EventDashboard
        eventId={eventId}
        suriPreviewParam={search.suri}
        slotAfterBento={hasOverlays ? overlays : undefined}
      />
    </>
  );
}
