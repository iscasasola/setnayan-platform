import Link from 'next/link';
import type { ReactNode } from 'react';
import { tilesForVendorCategories } from '@/lib/vendor-category-taxonomy';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Armchair,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileText,
  Palette,
  PanelsTopLeft,
  Camera,
  CheckCircle2,
  Circle,
  Clapperboard,
  Images,
  Lock,
  Music,
  PackageCheck,
  Star,
  UserCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readEventsYouRun } from '@/lib/events-you-run.server';
import type { EventYouRun } from '@/lib/events-you-run';
import { isCoordinatorP3Enabled } from '@/lib/coordinator-broadcasts-server';
import { CheckinDeskRows, MessageEveryoneRows, SeatFinderRow } from '../_components/events-you-run-rows';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { resolveDayOfConsoleKind, type DayOfConsoleKind } from '@/lib/vendor-day-of';
import { resolveModules } from '@/lib/vendor-dayof-modules';
import { fetchDayOfOverride } from '@/lib/vendor-dayof-config';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import {
  vendorDayOfFreeUntilIso,
  isVendorDayOfStillFree,
  vendorDayOfFreeUntilLabel,
  vendorDayOfFreeUntilEndedLabel,
} from '@/lib/vendor-dayof-free-until';
import { deriveVendorPapicTier,
  fetchVendorPapicCreditsGranted } from '@/lib/vendor-papic-grants';
import { tierReadout } from '@/lib/vendor-papic-tier';
import {
  fetchVendorTeam,
  enrichTeamWithUsers,
  isVendorAdminRole,
  VENDOR_TEAM_ROLE_LABEL,
} from '@/lib/vendor-team';
import { fetchRunOfShowBlocks } from '@/app/_actions/run-of-show';
import { forYourServicePages } from '@/lib/supplier-event-lines';
import { hubAddChoices, hubEvents, hubScheduleLine, hubSegmentOf, pickHubEvent, type HubEvent, type HubLock } from '@/lib/hub-events';
import { GuestReviewQr } from './_components/guest-review-qr';
import { ShotList } from './_components/shot-list';
import { IssuesLog } from './_components/issues-log';
import { VendorStatusUpdates } from './_components/vendor-status-updates';
import { ModuleConfigurator, type ConfiguratorModule } from './_components/module-configurator';
import { HubEventMenu } from './_components/hub-event-menu';
import {
  HubDoorRow,
  HubEventCard,
  HubEventInfo,
  HubEyebrow,
  HubLockRow,
  HubPageRow,
  HubPageRows,
  HubRunOfShow,
  HubScreen,
} from './_components/hub-screen';
import { HubThumbRow } from './_components/hub-thumb-row';
import { SupplierSavedStrip } from '@/app/_components/offline-ready/supplier-saved-strip';
import { collapseToPickerDays, HUB_OPEN_WINDOW_PLAIN, phTodayIso, pickConfigureDay } from '@/lib/vendor-day-picker';
import { AccessGrants, type GrantableMember } from './_components/access-grants';
import { ShopEmpty } from '../_components/kit';
import { resolveEventFeeGates, type EventFeeGate } from '@/lib/vendor-event-fee-access.server';
import { feeLockCopy } from '@/lib/event-access-stage';
import { VENDOR_BOOKING_FEES_PATH, vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';
import { formatCount } from '@/lib/format-number';
import { isStoreShellRequest } from '@/lib/request-platform';
import { ActionButton } from '@/components/action-button';

export const metadata = { title: 'Event Hub · Supplier' };

/**
 * 🗓 THE SUPPLIER'S HUB — /vendor-dashboard/on-the-day (supplier dashboard v13, owner "Approved." 2026-10-29; prototype
 * `renderHub`; build notes S6). HUB = SET UP, like the Maker: the Hub ▾ picks ONE event — every day this shop is
 * booked on AND every event this person runs as the hosts' coordinator ("Events" folded in, DECISION_LOG 2026-10-29) —
 * and three segments set it up: **Set up** (its tools · its run of show · the coordinator's doors · on the day, the
 * day's own tools) · **Crew** (who may open its Event Hub) · **The event's pages** (the hosts' own screens). The right
 * column (from 701) is the event card with "Open the Event Hub", which opens the live page
 * (`on-the-day/live/[eventId]`) on the day only — the day itself runs there, not here.
 *
 * The event opens on `?event=` when it names one of theirs, else today's, else the next one ahead
 * (`lib/hub-events.ts`); `?seg=` names the segment. A day still ahead (today included) is locked until its booking fee
 * is paid — Set up then says so with the amount and the way to pay, and nothing else.
 *
 * Every number is wired LIVE — nothing is hardcoded to the prototype's sample:
 *   • The dark event card = the chosen event, resolved from
 *     fetchVendorRoomEvents + get_vendor_event_brief (the SECURITY DEFINER
 *     booked-vendor brief RPC) for the couple / date / venue.
 *     ⚠ THIS USED TO SAY "fetchVendorPoolBookings (RLS-scoped)" AND THAT WAS
 *     THE BUG. The schedule pool has one writer, reached by one booking path,
 *     so a supplier who pressed Agree, or one the couple booked by scanning a
 *     Locked QR (money already moved), held no pool row and this screen told
 *     them they had no event. `fetchVendorRoomEvents` asks all three.
 *   • Delivery-to-the-couple progress = the real completion handshake + the
 *     posted delivery handovers (booking_handovers) — a 3-stage derivation, not
 *     an invented percent.
 *   • Guests N / M pax = brief.pax.attending / brief.pax.invited (live RSVPs).
 *   • Recap clips + portfolio photos = editorial_vendor_media rows this vendor
 *     has added for THIS event (media_type clip / photo).
 *   • The guest-review QR encodes the vendor's own public page (/v/[slug]).
 *
 * Where a value has no live source yet (e.g. the vendor isn't published, or the
 * couple hasn't built their timeline), the section renders a clearly-labelled
 * empty / zero state — never a fabricated number.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');
const MAX_MEDIA_PER_TYPE = 3; // mirrors editorial-vendor-media MAX_PER_TYPE

type Brief = {
  event: {
    display_name: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    ceremony_type: string | null;
  };
  booked_categories: string[];
  pax: { invited: number; attending: number; maybe: number; pending: number; declined: number };
};

/** PH wall-clock today (UTC+8, no DST) as 'YYYY-MM-DD' — booked_date is stored in
 *  the same PH civil-day convention, so string comparison is exact. The one
 *  definition lives beside `HUB_OPEN_WINDOW_PLAIN`, which says it in words. */
const phToday = (): string => phTodayIso();

export default async function VendorOnTheDayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const configureId = typeof sp.event === 'string' ? sp.event : null;
  const seg = hubSegmentOf(sp.seg);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/on-the-day');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  // Straight to the documents fold — `/vendor-dashboard/verify` is only a forwarding stub to it (no stub bounce).
  if (!profile) redirect('/vendor-dashboard/profile#docs');
  // 🎫 The events this person runs as the hosts' coordinator — "Events you run", folded into the Hub ▾ (owner
  // 2026-10-29), each with its Check-in desk door. The layout's cache()d read; started now, read below. Fails closed.
  const eventsYouRunP = readEventsYouRun(supabase, user.id).catch(() => ({ events: [], measured: false }));
  // 📣 Message everyone rides beside it — the door shows only where the composer opens (the Schedule's own flag).
  const announceOnP = isCoordinatorP3Enabled().catch(() => false);

  // Q7 (owner 2026-09-11) — the day-of tools' dated end. Unset (the default,
  // since the public-launch date is not decided yet) → this never fires and
  // every line below behaves exactly as it did before this config existed.
  const dayOfFreeUntilIso = vendorDayOfFreeUntilIso();
  const dayOfStillFree = isVendorDayOfStillFree(dayOfFreeUntilIso, Date.now());
  if (!dayOfStillFree) {
    // 🔒 Store shell (sweep 2026-10-19 row C14): a supplier plan is a digital
    // subscription sold on the web only, so the app states the fact and offers
    // no upgrade — the "See plans" link was already hidden by
    // StoreShellLinkGuard, which left "Upgrade to keep using…" with no door.
    const storeShell = await isStoreShellRequest();
    return (
      <section className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10 sm:px-6 lg:px-8">
        <ShopEmpty>
          <Lock aria-hidden className="mx-auto mb-2 h-6 w-6" style={{ color: 'var(--m-slate-3)' }} />
          <p className="font-medium text-ink">{vendorDayOfFreeUntilEndedLabel(dayOfFreeUntilIso)}</p>
          <p className="mt-1">
            {storeShell
              ? 'Your booking and shop listing are unaffected.'
              : 'Your booking and shop listing are unaffected. Upgrade to keep using the day-of tools.'}
          </p>
          {storeShell ? null : (
            <Link
              href="/vendor-dashboard/subscription"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline"
            >
              See plans <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          )}
        </ShopEmpty>
      </section>
    );
  }

  const kind = resolveDayOfConsoleKind(profile.services);
  const today = phToday();

  // Every event this shop is booked on — the schedule pool PLUS the two booking
  // paths that never write a pool row (the supplier's own Agree, and a Locked QR
  // the couple scanned). `fetchVendorRoomEvents` already collapses to one entry
  // per (event, date).
  const bookings = await fetchVendorRoomEvents(supabase, profile.vendor_profile_id);

  // ONE ROW PER DAY YOU ARE ON, never one per celebration. The rule (and the bug
  // it replaces) lives in `lib/vendor-day-picker.ts`, pure and tested; this file
  // only supplies today.
  const pickerBookings = collapseToPickerDays(bookings, today).map((b) => ({
    eventId: b.eventId,
    eventName: b.eventName,
    bookedDate: b.bookedDate,
    when: b.when,
  }));

  // ── THE BOOKING FEE UNLOCKS THE EVENT (owner, 2026-09-20 · 2026-10-21 item 5) ──
  // Every event still ahead (today included) is locked until its booking fee is paid. ONE read for the whole list,
  // through the SHIPPED gate (`resolveEventFeeGates`, "one query for the whole Event Hub"), and the SHIPPED words
  // (`feeLockCopy`): the amount is the bill's own, never a price in code. A refused read falls to "unlocked", exactly
  // as the gate itself does for an unreadable charge (it is logged inside). Asked BEFORE any brief is read, so a locked
  // supplier never causes a read of the couple's details. 🔑 The list is NOT gated — a supplier must still SEE that they
  // have a day on the 14th; what is withheld is the room, and Set up says so with the amount and the way to pay.
  const ahead = [...new Set(pickerBookings.filter((b) => b.when !== 'past').map((b) => b.eventId))];
  const gates: Map<string, EventFeeGate> = ahead.length
    ? await resolveEventFeeGates(profile.vendor_profile_id, ahead).catch(() => new Map<string, EventFeeGate>())
    : new Map<string, EventFeeGate>();
  const dayLocks: Record<string, HubLock> = Object.fromEntries(
    [...gates].flatMap(([eventId, gate]) => {
      if (gate.stage === 'unlocked') return [];
      const copy = feeLockCopy({ stage: gate.stage, owed: gate.access.owed, withheld: [], reason: gate.access.reason });
      const payHref = gate.access.owed?.orderId ? vendorBookingFeePayPath(gate.access.owed.orderId) : VENDOR_BOOKING_FEES_PATH;
      return [[eventId, { headline: copy.headline, cta: copy.cta, payHref }]];
    }),
  );

  // 🗓 THE HUB'S ONE LIST — booked days + events you run, one row per celebration (`lib/hub-events.ts`).
  const [{ events: runEvents }, announceOn] = await Promise.all([eventsYouRunP, announceOnP]);
  const hub = hubEvents({
    days: pickerBookings,
    runs: runEvents.map((e) => ({ eventId: e.eventId, name: e.name, date: e.date, href: e.href, canAnnounce: e.canAnnounce, rank: e.rank })),
    locks: dayLocks,
    today,
  });
  const selected = pickHubEvent(hub, configureId);

  if (!selected) {
    // Nothing booked and nothing run — the honest empty Hub: what it is for and where the customers are.
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6" data-hub-screen="empty">
        <div data-tour="hub-empty">
          <ShopEmpty>
            <CalendarClock aria-hidden className="mx-auto h-8 w-8" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.5} />
            <p className="mt-3 text-base font-medium text-ink">No events yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink/65">
              When a couple books you, their event lands here — set up its tools and crew ahead, and its Event Hub opens
              on the day, {HUB_OPEN_WINDOW_PLAIN}.
            </p>
            <div className="mt-4 flex justify-center">
              <ActionButton tone="brand" main icon={<ArrowRight aria-hidden strokeWidth={1.9} />} label="See your customers" href="/vendor-dashboard/customers" />
            </div>
          </ShopEmpty>
        </div>
      </section>
    );
  }

  // Which of the celebration's days this shop works (the shipped rule) — null for an event only run, not booked.
  const booking = selected.booked ? pickConfigureDay(bookings, selected.eventId, today) : null;
  const isToday = selected.when === 'today';
  const open = booking != null && selected.lock == null;
  const run = runEvents.find((e) => e.eventId === selected.eventId) ?? null;

  // Live brief for the chosen event (couple / date / venue / pax). The booked gate + aggregation live inside the
  // SECURITY DEFINER RPC; asked only for an event this shop is booked on and may open. A refused brief is logged and the
  // card falls back to the booking's own name — the headcount is then "couldn't load", never 0.
  let brief: Brief | null = null;
  let briefMeasured = true;
  if (open) {
    const { data, error: briefError } = await supabase.rpc('get_vendor_event_brief', {
      p_event_id: selected.eventId,
    });
    // ⚠ THIS IS THE SCREEN A SUPPLIER OPENS AT THE VENUE, ON THE DAY. The brief
    // ⚠ carries the couple, the place and the live headcount, and an `.rpc()` is
    // ⚠ refused the same silent way a select is. Refused, `if (data)` is skipped
    // ⚠ and the headcount below would fall to `?? 0` — "0 / 0 attending", which is
    // ⚠ not a number anybody should set up a room from.
    if (briefError) {
      logQueryError('VendorOnTheDay.brief', briefError, { eventId: selected.eventId }, 'graceful_degrade');
    }
    briefMeasured = !briefError;
    if (data) brief = data as Brief;
  }
  const coupleName = brief?.event.display_name ?? selected.name;
  const place = brief?.event.venue_name ?? null;
  // null = not read. A headcount of 0 on the day of the event is a statement
  // that nobody is coming; an em-dash is the truth when the read was refused.
  // Not asked (not booked, or locked) is "not read" too — an event only run has no brief, and "0 invited" there
  // would be a claim about the hosts' list that nobody measured.
  const invited = open && briefMeasured ? brief?.pax.invited ?? 0 : null;
  const attending = open && briefMeasured ? brief?.pax.attending ?? 0 : null;

  const menu = (
    <HubEventMenu
      events={hub}
      selectedId={selected.eventId}
      seg={seg}
      today={today}
      info={<HubEventInfo event={selected} title={coupleName} place={place} invited={invited} attending={attending} />}
    />
  );
  const pane = (
    <HubEventCard
      event={selected}
      title={coupleName}
      place={place}
      saved={
        open && selected.when !== 'past' ? (
          // 📶 The saved mark + Update now, top of the event card (EV3, owner 2026-10-28) — this supplier's own copy
          // of the Hub, the event's console and, when they run the hosts' door, its Check-in desk.
          <SupplierSavedStrip viewer={user.id} eventId={selected.eventId} eventDate={booking?.bookedDate ?? null} checkin={run != null} />
        ) : null
      }
    />
  );

  let body: ReactNode;
  if (seg === 'crew') {
    body = await crewBody({ supabase, vendorProfileId: profile.vendor_profile_id, event: selected, open });
  } else if (seg === 'pages') {
    // 📊 The Schedule row's live count — the SAME run-of-show read Set up makes (one read, never one per row). Not asked
    // for a locked event: a locked supplier causes no read of the couple's details.
    const blocks = selected.lock == null ? await fetchRunOfShowBlocks(selected.eventId) : null;
    body = pagesBody({
      event: selected,
      services: profile.services,
      bookedCategories: brief?.booked_categories ?? null,
      invited,
      attending,
      scheduleLine: hubScheduleLine(blocks),
    });
  } else {
    body = await setupBody({
      supabase,
      userId: user.id,
      profile,
      kind,
      event: selected,
      booking,
      isToday,
      run,
      announceOn,
      brief,
      coupleName,
      invited,
      attending,
    });
  }

  return (
    <HubScreen menu={menu} event={selected} seg={seg} pane={pane} thumb={<HubThumbRow seg={seg} add={hubAddChoices(selected)} />}>
      {/* Q7 — shown only once the owner sets an end date; says nothing while unset ("no invented deadline"). */}
      {vendorDayOfFreeUntilLabel(dayOfFreeUntilIso) ? (
        <p className="pt-3 text-sm text-ink/60">{vendorDayOfFreeUntilLabel(dayOfFreeUntilIso)}</p>
      ) : null}
      {body}
    </HubScreen>
  );
}

type SetupInput = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: NonNullable<Awaited<ReturnType<typeof fetchOwnVendorProfile>>>;
  kind: DayOfConsoleKind;
  event: HubEvent;
  booking: { eventId: string; eventName: string; bookedDate: string } | null;
  isToday: boolean;
  run: EventYouRun | null;
  announceOn: boolean;
  brief: Brief | null;
  coupleName: string;
  invited: number | null;
  attending: number | null;
};

/**
 * SET UP — the chosen event's tools (the shipped per-booking configurator, `vendor_dayof_configs`), its run of show,
 * the coordinator's doors (Check-in desk · Message everyone), and — on the day itself — the day's own tools that the old
 * console carried (headcount, the shot list, reporting to the coordinator, capture, the review QR). A locked event shows
 * its lock and nothing else.
 */
async function setupBody(input: SetupInput): Promise<ReactNode> {
  const { supabase, profile, event, booking, isToday, run } = input;
  if (event.lock) return <HubLockRow lock={event.lock} />;

  const coordinatorDoors = run ? (
    <>
      {/* 🎫 Check-in desk — for an event this person runs as the coordinator (owner 2026-10-28). Nobody else. */}
      <CheckinDeskRows events={[run]} />
      {/* 📣 Message everyone — the couple's shipped announcement sheet, where they may announce (S9). */}
      <MessageEveryoneRows events={[run]} enabled={input.announceOn} />
    </>
  ) : null;

  if (!booking) {
    // Run, not booked through this shop: the hosts' own event is where its set-up lives.
    return (
      <div>
        <HubEyebrow about="You run this event as the hosts' coordinator. Your shop is not booked for a day on it, so there are no shop tools to set up — the event's own pages are under “The event's pages”.">
          Events you run
        </HubEyebrow>
        {event.runHref ? <HubDoorRow href={event.runHref} label="Open their event" line="The hosts' event dashboard, as their coordinator" data="run" /> : null}
        {coordinatorDoors}
      </div>
    );
  }

  const [tools, blocks] = await Promise.all([
    readEventTools({
      supabase,
      vendorProfileId: profile.vendor_profile_id,
      services: profile.services,
      eventId: booking.eventId,
      bookedCategories: input.brief?.booked_categories ?? null,
    }),
    fetchRunOfShowBlocks(booking.eventId),
  ]);
  const scheduleHref = run ? `/dashboard/${booking.eventId}/schedule` : `/vendor-dashboard/clients/${booking.eventId}?tab=schedule`;

  return (
    <div>
      <div id="hub-tools" className="scroll-mt-28" data-tour="hub-setup">
        <ModuleConfigurator eventId={booking.eventId} modules={tools} />
      </div>
      <HubRunOfShow blocks={blocks} moreHref={scheduleHref} />
      {coordinatorDoors}
      {isToday ? await onTheDayBody(input, booking) : null}
    </div>
  );
}

/**
 * The per-booking tools — the shipped configurator's read (`resolveModules` over THIS event's booked tiles, folding in
 * any saved override), with Papic's derived tier badged when its capability is live.
 */
async function readEventTools({
  supabase,
  vendorProfileId,
  services,
  eventId,
  bookedCategories,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  vendorProfileId: string;
  services: string[];
  eventId: string;
  /** The brief's `booked_categories`, already read by the page (one brief per render). Null = refused or not read —
   *  the tile set then falls back to the shop's whole service list, as the shipped configurator did. */
  bookedCategories: string[] | null;
}): Promise<ConfiguratorModule[]> {
  const eventTiles = tilesForVendorCategories(bookedCategories);
  const override = await fetchDayOfOverride(supabase, vendorProfileId, eventId);
  const modules: ConfiguratorModule[] = resolveModules(services, eventTiles, override).map((m) => ({
    id: m.id,
    label: m.label,
    blurb: m.blurb,
    enabled: m.enabled,
    counselGated: m.counselGated,
  }));

  // Papic capture (counsel-gated): when the capability is live, badge the module
  // card with the vendor's DERIVED tier for this booking — Ltd if they accepted
  // the inquiry with a token (or a founder couple), else Lite. Off → no read, no
  // badge; the "Needs setup" chip stands until the DPO/NPC control is approved.
  const papicIdx = modules.findIndex((m) => m.id === 'vendor_papic');
  const papicModule = papicIdx >= 0 ? modules[papicIdx] : undefined;
  if (papicModule && (await isVendorPapicCaptureEnabled())) {
    let readout: string | undefined;
    try {
      // ⚠ READ THE CREDITS TOO. The readout a supplier sees must agree with
      // the allowance the capture route enforces; on the bare tier it would
      // show "50 pts" to somebody holding 1,000 (owner 2026-09-05: 5% of the
      // booking fee + ₱500 packs (100 credits since 2026-09-06), summed from
      // their ledger).
      const admin = createAdminClient();
      const [tier, creditsGranted] = await Promise.all([
        deriveVendorPapicTier(admin, vendorProfileId, eventId),
        fetchVendorPapicCreditsGranted(admin, vendorProfileId, eventId),
      ]);
      readout = tierReadout(tier, creditsGranted);
    } catch {
      /* readout is decorative — omit on any failure */
    }
    modules[papicIdx] = { ...papicModule, counselGated: false, readout };
  }
  return modules;
}

/**
 * ON THE DAY — what the old console carried for the day itself, kept whole (Rule 0: every working part): the headcount
 * and delivery for a photo trade (else the trade's own door), the shot list, reporting to the coordinator, capture for
 * the website and recap, and the guest-review QR. Read only on the day.
 */
async function onTheDayBody(input: SetupInput, booking: { eventId: string }): Promise<ReactNode> {
  const { profile, kind, coupleName, invited, attending } = input;
  const admin = createAdminClient();
  // Delivery-to-the-couple + editorial-media counts — both keyed on today's event. Admin reads (couple-scoped
  // tables); the vendor is already booked-gated by the RPC / room read above.
  const [completionRes, handoverRes, mediaRes] = await Promise.all([
    admin
      .from('event_vendors')
      .select('completion_status, service_marked_complete_at, customer_confirmed_received_at')
      .eq('event_id', booking.eventId)
      .eq('marketplace_vendor_id', profile.vendor_profile_id)
      .maybeSingle(),
    admin
      .from('booking_handovers')
      .select('status, couple_acknowledged_at')
      .eq('event_id', booking.eventId)
      .eq('vendor_profile_id', profile.vendor_profile_id),
    admin
      .from('editorial_vendor_media')
      .select('media_type')
      .eq('event_id', booking.eventId)
      .eq('vendor_profile_id', profile.vendor_profile_id),
  ]);
  const c = completionRes.data as {
    completion_status: string | null;
    service_marked_complete_at: string | null;
    customer_confirmed_received_at: string | null;
  } | null;
  const handovers = (handoverRes.data ?? []) as { status: string | null; couple_acknowledged_at: string | null }[];
  const confirmed =
    c?.completion_status === 'confirmed' ||
    c?.completion_status === 'auto_confirmed' ||
    Boolean(c?.customer_confirmed_received_at) ||
    handovers.some((h) => Boolean(h.couple_acknowledged_at));
  const started = Boolean(c?.service_marked_complete_at) || handovers.length > 0;
  const deliveryStage: 0 | 1 | 2 = confirmed ? 2 : started ? 1 : 0;
  const reviewState: 'awaiting_vendor' | 'awaiting_confirm' | 'confirmed' | 'disputed' =
    c?.completion_status === 'disputed' ? 'disputed' : confirmed ? 'confirmed' : started ? 'awaiting_confirm' : 'awaiting_vendor';
  let clipCount = 0;
  let photoCount = 0;
  for (const m of (mediaRes.data ?? []) as { media_type: string }[]) {
    if (m.media_type === 'clip') clipCount += 1;
    else if (m.media_type === 'photo') photoCount += 1;
  }

  // Guest-review QR — the vendor's own public page (verified vendors only have a
  // live public page). Encoded server-side; the fullscreen/print actions are a
  // small client component.
  const reviewSlug = profile.business_slug;
  const reviewUrl = reviewSlug ? `${SITE_URL}/v/${reviewSlug}#reviews` : null;
  const reviewQrSvg = reviewUrl
    ? await QRCode.toString(reviewUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 200,
        color: { dark: '#1B1A17', light: '#FBFBFA' },
      })
    : null;
  const DELIVERY_PCT = [0, 60, 100][deliveryStage];
  const DELIVERY_LABEL = ['Not started yet', 'In progress', 'Delivered'][deliveryStage];

  return (
    <div className="space-y-5" data-hub-day="">
      <HubEyebrow about={`Today's tools, open ${HUB_OPEN_WINDOW_PLAIN}. The Event Hub has the run of the day itself.`}>
        The Day
      </HubEyebrow>
      {/* 🪑 Find a guest's seat — today's booked event's shipped scanner, one row (S9, owner 2026-10-29). */}
      <SeatFinderRow eventId={booking.eventId} name={coupleName} />

      {/* Photo / Video — delivery progress + guests headcount; every other trade gets its own door. */}
      {kind === 'photo' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sn-tile">
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden className="h-5 w-5" style={{ color: 'var(--m-sage-deep)' }} strokeWidth={1.75} />
              <p className="text-sm font-semibold text-ink">Delivery to the couple</p>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-ink">{DELIVERY_PCT}%</span>
              <span className="text-sm text-ink/65">done · {DELIVERY_LABEL}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--m-line-soft)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${DELIVERY_PCT}%`, background: 'var(--m-sage-deep)' }} />
            </div>
            <p className="mt-3 text-xs text-ink/55">They see these updates live. Post your album link + mark complete from the brief.</p>
          </div>
          <div className="sn-tile">
            <div className="flex items-center gap-2">
              <Users aria-hidden className="h-5 w-5" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
              <p className="text-sm font-semibold text-ink">Guests</p>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-ink">
                {attending == null || invited == null ? '—' : `${formatCount(attending)} / ${formatCount(invited)}`}
              </span>
              <span className="text-sm text-ink/65">{attending == null ? 'couldn’t load' : 'pax'}</span>
            </div>
            <p className="mt-3 text-xs text-ink/55">
              Attending of invited — pulled live from the couple’s RSVPs. Know the headcount before you set up.
            </p>
          </div>
        </div>
      ) : (
        <NonPhotoConsole kind={kind} eventId={booking.eventId} />
      )}

      {/* Shot list — saved to event_shot_list_items (DAY-10) and read by the couple on their vendor workspace. */}
      {kind === 'photo' ? (
        <ShotListSection eventId={booking.eventId} eventName={coupleName} />
      ) : null}

      {/* Report to the coordinator — one-tap status presets into the shared day-of requests stream (build plan §10 #2).
          Renders itself away when its control is dark, or for the coordinator (who reads the inbox instead). */}
      {kind !== 'coordinator' ? <VendorStatusUpdates eventId={booking.eventId} /> : null}

      {/* Capture for your website + their recap. */}
      <div>
        <h2 className="sn-sec">Capture for your website + their recap</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <CaptureCard
            icon={Clapperboard}
            title="Recap capture"
            value={`${clipCount} ${clipCount === 1 ? 'clip' : 'clips'}`}
            sub="5s each · up to 3"
            href={`/vendor-dashboard/clients/${booking.eventId}/editorial-media`}
            hint={clipCount >= MAX_MEDIA_PER_TYPE ? 'Limit reached' : null}
          />
          <CaptureCard
            icon={Images}
            title="Photos"
            value={`${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`}
            sub="for your portfolio · up to 3"
            href={`/vendor-dashboard/clients/${booking.eventId}/editorial-media`}
            hint={photoCount >= MAX_MEDIA_PER_TYPE ? 'Limit reached' : null}
          />
          <CaptureCard
            icon={reviewState === 'confirmed' ? Star : Circle}
            title="Review the couple"
            value={
              reviewState === 'confirmed'
                ? 'Ready'
                : reviewState === 'awaiting_confirm'
                  ? 'Awaiting couple'
                  : reviewState === 'disputed'
                    ? 'On hold'
                    : 'Not yet'
            }
            sub={
              reviewState === 'confirmed'
                ? 'They’ve confirmed — reviews are open'
                : reviewState === 'awaiting_confirm'
                  ? 'Waiting for them to confirm delivery'
                  : reviewState === 'disputed'
                    ? 'A dispute is open on this booking'
                    : 'Opens once you mark complete'
            }
            // "Opens once you mark complete" — and Mark complete is VendorCompletionCard, at the top of the card's
            // Details section. Bare, this landed on the chat (#5614).
            href={`/vendor-dashboard/clients/${booking.eventId}?tab=details`}
            hint={null}
          />
        </div>
      </div>

      {/* Instant reviews from guests — the review QR. */}
      <div>
        <h2 className="sn-sec">Instant reviews from guests</h2>
        <div className="mt-3">
          {reviewQrSvg && reviewUrl ? (
            <GuestReviewQr qrSvg={reviewQrSvg} reviewUrl={reviewUrl} businessName={profile.business_name} />
          ) : (
            <div className="sn-tile flex items-start gap-3">
              <Star aria-hidden className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.75} />
              <div>
                <p className="text-sm font-medium text-ink">Your review QR appears once your page is live</p>
                <p className="mt-1 text-sm text-ink/65">
                  When your business is verified and your Setnayan page is published, a QR shows here — display or print
                  it at the event so guests can scan and review you.
                </p>
                <Link
                  href="/vendor-dashboard/profile#docs"
                  className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-sn-accent hover:underline"
                >
                  Get verified <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CREW — who may open this event's Event Hub. Your teammates, each switched on per event (the shipped per-event grant,
 * `vendor_event_access_grants`). Owner and admins always have it.
 */
async function crewBody({
  supabase,
  vendorProfileId,
  event,
  open,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  vendorProfileId: string;
  event: HubEvent;
  open: boolean;
}): Promise<ReactNode> {
  if (event.lock) return <HubLockRow lock={event.lock} />;
  if (!open) {
    return (
      <div>
        <HubEyebrow about="Crew join the Event Hub of a day your shop works. This event has no booked day for your shop.">
          Crew for the day
        </HubEyebrow>
        <p className="py-3 text-[14px] text-ink/65">No day of yours on this event — there is no Event Hub for a crew to join.</p>
      </div>
    );
  }
  const [teamRows, grantRows] = await Promise.all([
    fetchVendorTeam(supabase, vendorProfileId).catch(() => null),
    supabase
      .from('vendor_event_access_grants')
      .select('grantee_user_id, revoked_at')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', event.eventId),
  ]);
  if (teamRows == null || grantRows.error) {
    // A refused read is said — never an empty team, which would read as "nobody can help you".
    if (grantRows.error) logQueryError('VendorOnTheDay.crewGrants', grantRows.error, { eventId: event.eventId }, 'graceful_degrade');
    return (
      <div>
        <HubEyebrow>Your team on this event</HubEyebrow>
        <p className="py-3 text-[14px] text-ink/65">Couldn’t load your team — try again in a moment.</p>
      </div>
    );
  }
  const grantedIds = new Set(
    ((grantRows.data ?? []) as { grantee_user_id: string; revoked_at: string | null }[])
      .filter((g) => !g.revoked_at)
      .map((g) => g.grantee_user_id),
  );
  const enriched = await enrichTeamWithUsers(supabase, teamRows);
  const members: GrantableMember[] = enriched.map((m) => ({
    userId: m.user_id,
    name: m.display_name || m.email || 'Teammate',
    roleLabel: VENDOR_TEAM_ROLE_LABEL[m.role],
    isOwnerAdmin: isVendorAdminRole(m.role),
    granted: grantedIds.has(m.user_id),
  }));
  return members.length > 0 ? (
    <AccessGrants eventId={event.eventId} members={members} />
  ) : (
    <div>
      <HubEyebrow>Your team on this event</HubEyebrow>
      <p className="py-3 text-[14px] text-ink/65">Only you so far — add teammates under Shop › Team.</p>
    </div>
  );
}

/**
 * THE EVENT'S PAGES — the SAME screens the hosts use, opened inside the app (prototype `hubPages`: an icon row per page
 * with its live count, opening in place). Run as the coordinator: their own event's Guests · Seats · Schedule · Event
 * Hub, through the hosts' door (which admits them by its own shipped check). Booked only: the shipped view-only pages
 * for what this shop does there (`forYourServicePages`, the S3 "For your service").
 *
 * 📊 COUNTS ONLY FROM READS ALREADY MADE — Guests from the brief (booked + unlocked), Schedule / Run of show from the
 * run-of-show read (`scheduleLine`). Seats, the Event Hub, the mood board, the production sheet and the event card
 * have no count a supplier's session reads here today, so their rows keep their plain words — never an invented number.
 */
function pagesBody({
  event,
  services,
  bookedCategories,
  invited,
  attending,
  scheduleLine,
}: {
  event: HubEvent;
  services: string[];
  bookedCategories: string[] | null;
  invited: number | null;
  attending: number | null;
  /** "11 moments · 1:00 PM – 9:30 PM", or null when the read was not made / refused. */
  scheduleLine: string | null;
}): ReactNode {
  const about =
    'The same screens the hosts use, opened inside your app — never a jump into anything else. Run as their coordinator, you can help as the hosts allowed; booked only, you can look.';
  if (event.runHref) {
    const base = event.runHref;
    const access = 'You can help here — as much as the hosts allowed you.';
    const guests = attending != null && invited != null ? `${formatCount(invited)} invited · ${formatCount(attending)} coming` : 'Their guest list';
    return (
      <div data-hub-pages="run">
        <HubEyebrow about={about}>The event’s pages</HubEyebrow>
        <p className="pb-1 text-[13.5px] text-ink/65">You run it — as much as the hosts allowed you.</p>
        <HubPageRows>
          <HubPageRow pageKey="guests" icon={Users} label="Guests" line={guests} href={`${base}/guests`} access={access} />
          <HubPageRow pageKey="seats" icon={Armchair} label="Seats" line="Tables and who sits where" href={`${base}/seating`} access={access} />
          <HubPageRow
            pageKey="schedule"
            icon={CalendarDays}
            label="Schedule"
            line={scheduleLine ?? 'The run of show, hour by hour'}
            href={`${base}/schedule`}
            access={access}
          />
          <HubPageRow pageKey="maker" icon={PanelsTopLeft} label="Event Hub (the Maker)" line="The guests’ page for the event" href={`${base}/website`} access={access} />
        </HubPageRows>
      </div>
    );
  }
  const doors = forYourServicePages({
    eventId: event.eventId,
    stage: event.when === 'past' ? 'done' : 'booked',
    shopServices: services,
    eventTiles: tilesForVendorCategories(bookedCategories),
  });
  return (
    <div data-hub-pages="booked">
      <HubEyebrow about={about}>The event’s pages</HubEyebrow>
      <p className="pb-1 text-[13.5px] text-ink/65">View only — ask the hosts for more.</p>
      <HubPageRows>
        {doors.map((d) => (
          <HubPageRow
            key={d.key}
            pageKey={d.key}
            icon={BOOKED_PAGE_ICON[d.key] ?? FileText}
            label={d.label}
            line={d.key === 'run' && scheduleLine ? scheduleLine : d.line}
            href={d.href}
            access="View only — ask the hosts for more."
          />
        ))}
      </HubPageRows>
    </div>
  );
}

/** Each "For your service" page's row icon (the prototype's round icon per page). */
const BOOKED_PAGE_ICON: Record<string, typeof Users> = {
  mood: Palette,
  seats: Armchair,
  run: CalendarDays,
  sheet: ClipboardList,
  card: FileText,
};

/** Section 4 wrapper — the shot list only makes sense with an event. */
function ShotListSection({
  eventId,
  eventName,
}: {
  eventId: string | null;
  eventName: string | null;
}) {
  if (!eventId) {
    return (
      <div>
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          Shot list · the couple can follow along
        </h2>
        <p
          className="sn-tile mt-3 text-sm"
          style={{ color: 'var(--m-slate-2)' }}
        >
          Your must-get shot list appears here on an event day, ready to check off as you shoot. Once you save it, the couple sees it on their supplier page.
        </p>
      </div>
    );
  }
  // Saved to the DB; localStorage is only its offline cache.
  return (
    <div>
      <h2 className="sn-sec">Shot list · the couple can follow along</h2>
      <div className="mt-3">
        <ShotList eventId={eventId} eventName={eventName ?? 'this event'} />
      </div>
    </div>
  );
}

/** A single capture tile in section 5. */
function CaptureCard({
  icon: Icon,
  title,
  value,
  sub,
  href,
  hint,
}: {
  icon: typeof Camera;
  title: string;
  value: string;
  sub: string;
  href: string | null;
  hint: string | null;
}) {
  const inner = (
    <div className="sn-tile flex h-full flex-col">
      <div className="flex items-center gap-2">
        <Icon aria-hidden className="h-5 w-5" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
        <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          {title}
        </p>
      </div>
      <p className="mt-3 font-mono text-xl font-bold" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
      {hint ? (
        <p className="mt-2 text-[11px] font-medium" style={{ color: 'var(--m-sage-deep)' }}>
          {hint}
        </p>
      ) : null}
      {href ? (
        <span
          className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Open <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
      ) : null}
    </div>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="sn-press block">
      {inner}
    </Link>
  );
}

/** The non-photo console variants (coordinator / caterer / band / general).
 *  Each routes into the surface that already owns its day-of tool, so the
 *  console stays honest to what exists — no duplicated data plumbing. */
function NonPhotoConsole({
  kind,
  eventId,
}: {
  kind: Exclude<DayOfConsoleKind, 'photo'>;
  eventId: string | null;
}) {
  // "Your event brief" · "Run the floor … from the couple's brief" · "Your
  // setlist". All three are the BRIEF, so the section is named — a bare client
  // route is a chat landing since #5614, and a tile that says "Headcount,
  // palette, the day-of timeline" opening a conversation is the day-of screen
  // telling the supplier the wrong thing on the one morning it matters.
  const target = eventId
    ? kind === 'caterer'
      ? `/vendor-dashboard/clients/${eventId}/production-sheet`
      : `/vendor-dashboard/clients/${eventId}?tab=details`
    : kind === 'band'
      ? '/vendor-dashboard/repertoire'
      : '/vendor-dashboard/customers';

  const copy: Record<
    Exclude<DayOfConsoleKind, 'photo'>,
    { icon: typeof Camera; title: string; sub: string }
  > = {
    coordinator: {
      icon: UserCheck,
      title: 'Run the floor',
      sub: 'Follow the live run-of-show, keep suppliers moving, and log anything that comes up — all from the couple’s brief.',
    },
    caterer: {
      icon: UtensilsCrossed,
      title: 'Final headcount & meal splits',
      sub: 'Attending pax + per-part counts, pulled live from the couple’s RSVPs, with your portion math on the production sheet.',
    },
    band: {
      icon: Music,
      title: 'Your setlist',
      sub: 'The songs you play, ready against the couple’s requests so you go on knowing the room.',
    },
    general: {
      icon: PackageCheck,
      title: 'Your event brief',
      sub: 'Headcount, palette, the day-of timeline, and the delivery handover — everything for this booking in one place.',
    },
  };
  const c = copy[kind];
  const Icon = c.icon;

  return (
    <div className="mt-4 space-y-3">
      <Link
        href={target}
        className="sn-tile sn-press flex items-center justify-between gap-4 sm:p-6"
      >
        <span className="flex items-start gap-3">
          <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
          <span>
            <span className="block text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
              {c.title}
            </span>
            <span className="mt-0.5 block text-sm" style={{ color: 'var(--m-slate-2)' }}>
              {c.sub}
            </span>
          </span>
        </span>
        <ArrowRight aria-hidden className="h-5 w-5 shrink-0" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.75} />
      </Link>
      {/* Coordinators get their day-of issues log inline (device-local, offline
          tolerant) — the shipped command-center tool, preserved through the
          reskin. */}
      {kind === 'coordinator' && eventId ? <IssuesLog eventId={eventId} /> : null}
    </div>
  );
}
