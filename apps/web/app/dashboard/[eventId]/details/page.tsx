import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { planMyselfOn } from '@/lib/plan-myself';
import { Fragment, type ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { PageMasthead } from '@/app/_components/page-masthead';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import { fetchEventViewer } from '@/lib/event-viewer.server';
import { isDelegateWithoutArea } from '@/lib/event-viewer';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { pickVenueBookingRows, type VenueBookingRow } from '@/lib/event-venues';
import { CEREMONY_LABEL, titleCase } from '@/lib/personalized-menu';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { blockTime, ceremonyBlock } from '@/lib/print-pieces';
import { computeGuestStats, fetchGuestsByEventMeasured } from '@/lib/guests';
import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';
import { resolveEventMoney } from '@/lib/budget-truth';
import { buildBudgetLiveSummary, fetchBudgetSnapshot } from '@/lib/budget';
import { fetchOrdersForEvent } from '@/lib/orders';
import { computeVatFromBase } from '@/lib/receipts';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { LastSeenCapture } from '@/app/_components/last-seen/last-seen-capture';
import { formatCount } from '@/lib/format-number';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { readEventPoolStatus } from '@/lib/papic-event-pool';
import { INVITE_THEMES, resolveInviteTheme } from '@/lib/invite-themes';
import { HUB_FONT_BY_KEY, sanitizeHubFontKey } from '@/lib/hub-fonts';
import { isStoreShellRequest } from '@/lib/request-platform';
import { regionLabel } from '@/lib/region-source';
import { COULD_NOT_LOAD, HIDDEN_BY_THE_COUPLE, NOT_SET_YET, describeEventDate } from '@/lib/event-details-sheet';
import { recordFieldHref, recordHref } from '@/lib/event-details-record';
import {
  FAILED,
  HIDDEN,
  SETTLED,
  SETTLED_NOTE,
  STILL_YOURS,
  accessBadge,
  guestsLine,
  hubLine,
  line,
  moneyLine,
  ok,
  parseDetailsView,
  purchasesLine,
  suppliersLine,
  type Read,
} from '@/lib/event-details-segments';
import { readHomeGuide } from '../_components/details-guide-home-card';
import { PutAwayCard } from './_components/put-away-card';
import { PeopleWithAccess } from './_components/people-with-access';
import { DetailsSegments } from './_components/details-segments';
import { DetailsFold } from './_components/details-fold';
import { Eyebrow, FieldRow, JumpRow, PlainRow, SettledGroup } from './_components/details-rows';
import { AreaPick, CostsPick, PlanMyselfRow } from './_components/details-controls';
import { loadPeopleWithAccess } from '@/lib/people-with-access.server';
import { areaCells, type PersonRow } from '@/lib/people-with-access';

export const dynamic = 'force-dynamic';

/** The words `removeHost` can bring back here — anything else in the address is
 *  not ours, so a hand-edited link cannot print its own message on the sheet. */
const REMOVE_REFUSALS = new Set([
  'You cannot remove yourself.',
  'A celebrant stays a co-host. A celebrant can change their role first.',
  'Could not remove them. Try again.',
]);

export const metadata = { title: 'Event Details' };

/**
 * Event Details · /dashboard/[eventId]/details — reached from Home (owner
 * 2026-10-08: *"this is the Event Details from Home"*).
 *
 * 🎚 THREE SEGMENTS: EVENT · ACCESS · SETTINGS (owner 2026-10-07, *"approve
 * all"* — DECISION_LOG "EVENT DETAILS IS THREE SEGMENTS"; design
 * `EVENT_DETAILS_ARRANGE_2026-10-07_fable.md`, prototype
 * `prototypes/event_details_arranged_2026-10-07_fable.html`). The Suppliers /
 * Guests shape: the couple's line and one segmented control pinned on top,
 * one body, every part one tap from the top. One row shape — a label, a
 * one-line summary, and ONE thing on the right:
 *   · › — the fact lives elsewhere (the Maker, Suppliers, Guests, Budget,
 *     Purchases); the row is a plain link to its home (`JumpRow`);
 *   · ⌄ — unfolds here (`DetailsFold`), any choice inside is one dropdown;
 *   · a switch — on or off, saves at once.
 *
 * 🚫 NO UNDO · APPLY (owner 2026-10-08: *"why is there still undo and
 * apply?"*). Seventeen rows used to write the Event Hub draft, which is the
 * only reason the Maker's dock sat here. They left for their homes; nothing on
 * this page writes the draft, and what stays saves at once. Held by
 * `the-record-is-three-segments.test.ts`.
 *
 * 📌 SETTLED — what a booking holds (date · venue · suppliers · kind · guest
 * count) sits in one quiet group with ONE ⓘ, never a padlock per row; a
 * Settled row mounts no editor.
 *
 * 🩺 EMPTY ≠ FAILED ≠ HIDDEN. A summary built from a read that failed says
 * "Could not load…"; a part the couple did not share with a helper says
 * "Hidden by the couple"; neither is ever drawn as 0 (`lib/event-details-segments.ts`).
 */
export default async function EventDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ host_removed?: string; invite_error?: string; view?: string }>;
}) {
  const { eventId } = await params;
  const flashParams = (await searchParams) ?? {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Every column here is granted to the session (the per-column allowlist,
  // `lint-events-column-grants.mjs`). The two PRIVATE ones (budget target and
  // band) are read through `events_host` below, behind the budget gate.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, display_name, event_type, archived, slug, bride_name, groom_name, region, ' +
        'ceremony_type, secondary_ceremony_type, event_date, event_date_precision, date_mode, date_candidates, ' +
        'date_window_start, date_window_end, estimated_pax, guest_list_edit_deadline, adaptive_pricing_mode, ' +
        'invite_theme, site_font_key, setnayan_ai_active, planning_mode, std_film_ceremony_name, std_film_venue_name, venue_name',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  const e = event as unknown as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = e[k];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  const num = (k: string): number | null => {
    const v = e[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const base = `/dashboard/${eventId}`;
  const admin = createAdminClient();
  const budgetTruth = isBudgetTruthEnabled();

  const [profile, viewer, budgetAccess] = await Promise.all([
    resolveProfile(str('event_type') ?? 'wedding'),
    fetchEventViewer(supabase, eventId, user.id),
    resolveBudgetVisibility(supabase, eventId, user.id),
  ]);
  const words = eventWordsFromProfile(profile);
  const eventWord = words.eventWord;
  const maker = surfaceEnabled(profile, 'website');
  // A helper the couple did not give the guest list reads "Hidden by the couple",
  // never an empty list — the guest read below is skipped for them.
  const mayReadGuests = !isDelegateWithoutArea(viewer, 'guest_list');
  const suppliersHidden = isDelegateWithoutArea(viewer, 'vendors');
  const moneyHidden = !budgetAccess.mayRead;
  const isCouple = viewer.isCouple;

  // 👥 People with access (owner 2026-10-03) — the ONE place a host sets who
  // can do what. A host sees every person and sets each area; a delegate sees
  // their own access, as words; anyone else, nothing.
  const accessRead = viewer.isCouple
    ? loadPeopleWithAccess(eventId, user.id).catch((err: unknown) => {
        console.error('[event-details] people with access failed', err);
        return { measured: false as const };
      })
    : null;

  const [vendorsRead, scheduleRead, guestsRead, ordersRead, vatRead, privateRead, moneyRead, snapshotRead, proRead, poolRead, guideRead, storeShell] =
    await Promise.all([
      settle(
        (async () => {
          const { data, error } = await supabase
            .from('event_vendors')
            .select(
              'vendor_id, category, status, vendor_name, updated_at, archived_at, manual_vendor_id, ' +
                'source_venue_directory_id, marketplace_vendor_id, linked_vendor_profile_id',
            )
            .eq('event_id', eventId)
            .is('archived_at', null);
          if (error) throw new Error(error.message);
          return (data ?? []) as unknown as (VenueBookingRow & { vendor_id: string })[];
        })(),
      ),
      settle(fetchScheduleBlocks(supabase, eventId)),
      mayReadGuests ? settle(fetchGuestsByEventMeasured(supabase, eventId)) : Promise.resolve(null),
      moneyHidden ? Promise.resolve(null) : settle(fetchOrdersForEvent(supabase, eventId)),
      moneyHidden ? Promise.resolve(null) : settle(getEffectiveVatRatePct(supabase)),
      moneyHidden
        ? Promise.resolve(null)
        : settle(
            (async () => {
              const { data, error } = await supabase
                .from('events_host')
                .select('estimated_budget_centavos, budget_band')
                .eq('event_id', eventId)
                .maybeSingle();
              if (error) throw new Error(error.message);
              return (data ?? {}) as { estimated_budget_centavos?: number | string | null; budget_band?: string | null };
            })(),
          ),
      moneyHidden || !budgetTruth ? Promise.resolve(null) : settle(resolveEventMoney(supabase, eventId)),
      moneyHidden || budgetTruth ? Promise.resolve(null) : settle(fetchBudgetSnapshot(supabase, eventId)),
      settle(eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId)),
      readEventPoolStatus(admin, eventId),
      /* 🧭 The Finish card, folded into the Event Hub row — Home's own read of the guided flow. */
      isCouple ? settle(readHomeGuide({ eventId, memberType: 'couple' })) : Promise.resolve(null),
      isStoreShellRequest(),
    ]);

  // ── Suppliers + venues: the confirmed bookings, one read ───────────────────
  const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);
  const lockedSuppliers = vendorsRead.ok
    ? vendorsRead.v.filter((r) => r.status != null && confirmed.has(r.status) && (r.vendor_name ?? '').trim())
    : [];
  // The governed facts (kind · date · guest estimate) are held once any
  // supplier is confirmed — the same rule `GovernedFields` enforces.
  const bookingLocks = lockedSuppliers.length > 0;
  const venuesWon = vendorsRead.ok ? pickVenueBookingRows(vendorsRead.v) : { ceremony: null, reception: null };
  const wedding = eventWord === 'wedding';

  // ── Names · kind · date · area ─────────────────────────────────────────────
  const personA = str('bride_name');
  const personB = str('groom_name');
  const names = personA && personB ? `${personA} & ${personB}` : (personA ?? personB ?? str('display_name'));
  const kind = wedding
    ? (() => {
        const c = str('ceremony_type');
        if (!c) return null;
        const main = CEREMONY_LABEL[c] ?? `${titleCase(c)} ceremony`;
        const also = str('secondary_ceremony_type');
        return also ? `${main} · also ${(CEREMONY_LABEL[also] ?? titleCase(also)).toLowerCase()}` : main;
      })()
    : titleCase(eventWord);
  const eventDateShown = describeEventDate(e);
  const blocks = scheduleRead.ok ? scheduleRead.v : [];
  const ceremony = ceremonyBlock(blocks);
  const ceremonyTime = ceremony ? blockTime(ceremony) : null;
  const area = regionLabel(str('region')) ?? str('region');

  // ── Venue: the booked ones first (the Event Hub reads the same), else the typed name ──
  const venueNames = vendorsRead.ok
    ? [
        venuesWon.ceremony?.vendor_name ?? str('std_film_ceremony_name'),
        venuesWon.reception?.vendor_name ?? str('venue_name') ?? str('std_film_venue_name'),
      ]
    : null;
  const venueBooked = Boolean(venuesWon.ceremony || venuesWon.reception);

  // ── The Event Hub (live look + the Finish card's count) ────────────────────
  const ownsPro = proRead.ok && proRead.v === true;
  const theme = INVITE_THEMES[resolveInviteTheme({ saved: e.invite_theme, ownsPro: ownsPro || (isCouple && maker && !storeShell) })];
  const headingFontKey = sanitizeHubFontKey(e.site_font_key);
  const headingFont = headingFontKey ? HUB_FONT_BY_KEY[headingFontKey].family : theme.fonts.heading;
  const guide = guideRead && guideRead.ok ? guideRead.v : null;

  // ── Guests ────────────────────────────────────────────────────────────────
  const guestRows = guestsRead && guestsRead.ok && guestsRead.v.measured ? guestsRead.v.rows : null;
  const stats = guestRows ? computeGuestStats(guestRows) : null;
  const guests: Read<{ listed: number; replied: number; asking: number }> = !mayReadGuests
    ? HIDDEN
    : stats && guestRows
      ? ok({
          listed: stats.total,
          replied: stats.attending + stats.declined + stats.maybe,
          asking: guestRows.filter((g) => g.entry_source === 'self_added_unlisted').length,
        })
      : FAILED;
  const estimate = num('estimated_pax');

  // ── Money (the Budget page's own numbers, under either flag state) ─────────
  const priv = privateRead && privateRead.ok ? privateRead.v : null;
  const targetCentavos = priv?.estimated_budget_centavos != null ? Number(priv.estimated_budget_centavos) : null;
  const orders = ordersRead && ordersRead.ok ? ordersRead.v : null;
  const vat = vatRead && vatRead.ok ? vatRead.v : null;
  let money: Read<{ paid: number; owed: number; target: number | null }> = moneyHidden ? HIDDEN : FAILED;
  if (moneyRead && moneyRead.ok) {
    money = ok({ paid: moneyRead.v.paid, owed: moneyRead.v.stillOwed, target: moneyRead.v.targetPhp });
  } else if (snapshotRead && snapshotRead.ok && orders) {
    // Flag OFF (or the resolver refused): `/budget`'s legacy live summary for Paid / Owed.
    const live = buildBudgetLiveSummary(snapshotRead.v);
    money = ok({ paid: live.paid, owed: live.remaining, target: targetCentavos != null && targetCentavos > 0 ? targetCentavos / 100 : null });
  }
  const paidOrders: Read<number> = moneyHidden
    ? HIDDEN
    : !orders || vat == null
      ? FAILED
      : ok(
          orders
            .filter((o) => o.status === 'paid' || o.status === 'fulfilled')
            .reduce((n, o) => n + computeVatFromBase(Number(o.confirmed_total_php ?? o.requested_total_php), vat).gross, 0),
        );
  const pool = poolRead.status;
  const purchases = purchasesLine({
    pro: proRead.ok ? ok(ownsPro) : FAILED,
    ai: e.setnayan_ai_active === true,
    papic: poolRead.ok ? ok(pool.applies ? { remaining: pool.remainingPoints, total: pool.totalPoints } : null) : FAILED,
    paid: paidOrders,
  });

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const suppliers: Read<string[]> = suppliersHidden
    ? HIDDEN
    : vendorsRead.ok
      ? ok(lockedSuppliers.map((s) => (s.vendor_name ?? '').trim()))
      : FAILED;

  // ── People with access ────────────────────────────────────────────────────
  const people = accessRead ? await accessRead : null;
  const ownAccess: PersonRow | null =
    !isCouple && viewer.delegatePermissions
      ? {
          key: 'me',
          kind: 'helper',
          name: 'You',
          roleWord: 'Your access',
          moderatorId: null,
          guestId: null,
          access: null,
          live: true,
          areas: areaCells(viewer.delegatePermissions),
          lastDay: null,
          ended: false,
          isViewer: true,
          canInviteAsCoordinator: false,
          vendorId: null,
        }
      : null;
  const accessFlash =
    flashParams.host_removed === '1'
      ? 'Removed — their access ended immediately.'
      : flashParams.invite_error && REMOVE_REFUSALS.has(flashParams.invite_error)
        ? flashParams.invite_error
        : null;

  // 💾 A read that failed shows "Could not load…" — never kept as last-seen
  // data. (Money reads are left out: money is never kept at all.)
  const lastSeenFresh =
    vendorsRead.ok &&
    scheduleRead.ok &&
    proRead.ok &&
    poolRead.ok &&
    (people === null || people.measured) &&
    (guestsRead === null || (guestsRead.ok && guestsRead.v.measured));

  // ── The rows that move to Settled by themselves, from their lock source ────
  const dateSettled = bookingLocks;
  const kindSettled = bookingLocks && wedding;
  const estimateSettled = bookingLocks && wedding;
  const record = recordHref(eventId);

  const dateRow = (
    <JumpRow
      row="date"
      fact="date"
      label="Date"
      quiet={dateSettled}
      summary={line([eventDateShown, ceremonyTime ? `ceremony ${ceremonyTime}` : null], NOT_SET_YET)}
      /* Settled → Suppliers (the booking holds it, DECISION_LOG 10-06 "DATE AND
         VENUE LIVE IN SUPPLIERS"); until a booking holds it, the Maker's Info
         step, where its one editor is. */
      href={dateSettled || !maker ? `${base}/vendors` : `${base}/launch?tool=details&item=date`}
    />
  );
  const venueRow = venueNames ? (
    <JumpRow
      row="venue"
      fact="venues"
      label="Venue"
      quiet={venueBooked}
      summary={line(venueNames, NOT_SET_YET)}
      href={venueBooked || !maker ? `${base}/vendors` : `${base}/launch?tool=details&item=venues`}
    />
  ) : (
    <PlainRow row="venue" fact="venues" label="Venue" summary={COULD_NOT_LOAD} />
  );
  const suppliersRow =
    suppliers.state === 'ok' && profile.marketplaceEnabled ? (
      <JumpRow row="suppliers" label="Suppliers" quiet={bookingLocks} summary={suppliersLine(suppliers)} href={`${base}/vendors`} />
    ) : (
      <PlainRow row="suppliers" label="Suppliers" quiet={bookingLocks} summary={suppliersLine(suppliers)} />
    );
  const kindRow =
    !kindSettled && wedding && isCouple ? (
      <FieldRow row="kind" fact="kind" label="Kind" summary={kind ?? NOT_SET_YET} href={recordFieldHref(eventId, 'kind')} recordHref={record} />
    ) : (
      <PlainRow row="kind" fact="kind" label="Kind" quiet={kindSettled} summary={kind ?? NOT_SET_YET} />
    );
  const estimateSummary = estimate != null && estimate > 0 ? `About ${formatCount(estimate)}` : NOT_SET_YET;
  const estimateRow =
    !estimateSettled && isCouple ? (
      <FieldRow row="estimate" fact="estimate" label="Guest count" summary={estimateSummary} href={recordFieldHref(eventId, 'estimate')} recordHref={record} />
    ) : (
      <PlainRow row="estimate" fact="estimate" label="Guest count" quiet={estimateSettled} summary={estimateSummary} />
    );

  const settled: ReactNode[] = [];
  const open: ReactNode[] = [];
  (dateSettled ? settled : open).push(<Fragment key="date">{dateRow}</Fragment>);
  (venueBooked ? settled : open).push(<Fragment key="venue">{venueRow}</Fragment>);
  (bookingLocks ? settled : open).push(<Fragment key="suppliers">{suppliersRow}</Fragment>);
  (kindSettled ? settled : open).push(<Fragment key="kind">{kindRow}</Fragment>);
  (estimateSettled ? settled : open).push(<Fragment key="estimate">{estimateRow}</Fragment>);

  /* ══ EVENT — what the event is ══ */
  const eventBody = (
    <div data-details-segment="event">
      {settled.length > 0 ? <Eyebrow>{STILL_YOURS}</Eyebrow> : <div className="pt-2" />}
      <div>
        {maker && isCouple ? (
          <JumpRow row="event-name" fact="names" label="Event name" summary={names ?? NOT_SET_YET} href={`${base}/launch?tool=details&item=names`} />
        ) : (
          <PlainRow row="event-name" fact="names" label="Event name" summary={names ?? NOT_SET_YET} />
        )}
        {isCouple ? (
          <DetailsFold row="area" fact="area" label="Area" summary={area ?? NOT_SET_YET}>
            <AreaPick eventId={eventId} value={str('region')} />
          </DetailsFold>
        ) : (
          <PlainRow row="area" fact="area" label="Area" summary={area ?? NOT_SET_YET} />
        )}
        {maker ? (
          <JumpRow
            row="hub"
            fact="cover colours fonts music arrive love-story wears"
            label="Event Hub"
            summary={hubLine({ look: theme.name, font: headingFont, done: guide?.done ?? null, total: guide?.total ?? null })}
            href={`${base}/launch`}
          />
        ) : null}
        <JumpRow row="guests" fact="listed guests-get-in rsvp-questions reply-by" label="Guests" summary={guestsLine(guests)} href={`${base}/guests`} />
        {surfaceEnabled(profile, 'budget') && money.state !== 'hidden' ? (
          <JumpRow row="money" fact="budget-target" money label="Money" summary={moneyLine(money)} href={`${base}/budget`} />
        ) : (
          <PlainRow row="money" fact="budget-target" money label="Money" summary={moneyLine(money)} />
        )}
        <JumpRow row="purchases" fact="services purchases" money label="Purchases" summary={purchases} href={`${base}/orders`} />
        {open}
      </div>
      {settled.length > 0 ? (
        <SettledGroup title={SETTLED} note={SETTLED_NOTE}>
          {settled}
        </SettledGroup>
      ) : null}
    </div>
  );

  /* ══ ACCESS — who may do what (EA's People with access, as built) ══ */
  const accessBody = (
    <div className="pt-3" data-details-segment="access">
      {people || ownAccess ? (
        <PeopleWithAccess
          eventId={eventId}
          rows={people && people.measured ? people.rows : ownAccess ? [ownAccess] : []}
          addable={people && people.measured ? people.addable : []}
          readOnly={!people}
          failed={Boolean(people && !people.measured)}
          flash={accessFlash}
        />
      ) : (
        <PlainRow row="access" label="Access" summary={HIDDEN_BY_THE_COUPLE} />
      )}
    </div>
  );

  /* ══ SETTINGS — how it behaves (Guest settings · Event Hub · Papic arrive with PR-C) ══ */
  const costsMode = str('adaptive_pricing_mode') === 'final_only' ? 'final_only' : 'realtime';
  const costsWord = costsMode === 'final_only' ? 'Final only' : 'Realtime';
  const settingsBody = (
    <div className="pt-2" data-details-segment="settings">
      {isCouple ? (
        <DetailsFold row="costs" label="Costs shown" summary={costsWord}>
          <CostsPick eventId={eventId} mode={costsMode} deadline={str('guest_list_edit_deadline')} />
        </DetailsFold>
      ) : (
        <PlainRow row="costs" label="Costs shown" summary={costsWord} />
      )}
      {isCouple ? <PlanMyselfRow eventId={eventId} on={planMyselfOn(typeof e.planning_mode === 'string' ? e.planning_mode : null)} /> : null}
    </div>
  );

  const archived = Boolean(e.archived);
  const eventName = typeof e.display_name === 'string' && e.display_name.trim() ? e.display_name : 'this event';

  return (
    /* 💾 Event Details is kept on the phone and shown at once on the next open,
       then refreshed (owner 2026-10-02, DECISION_LOG "LAST-SEEN DATA SHOWS
       INSTANTLY, THEN REFRESHES"). The Money and Purchases rows carry
       `data-money` and are never kept (lib/last-seen). */
    <LastSeenCapture page="details" fresh={lastSeenFresh}>
      <section className="sn-col pb-6" data-event-details>
        <PageMasthead title="Event Details" />
        <DetailsSegments
          initial={parseDetailsView(flashParams.view ?? (accessFlash ? 'access' : undefined))}
          who={names ?? 'Event Details'}
          line={line([kind ?? titleCase(eventWord), eventDateShown, area], '')}
          accessBadge={accessBadge(people && people.measured ? people.rows : null)}
          bodies={{ event: eventBody, access: accessBody, settings: settingsBody }}
        />

        {/* ── Put this away — the last row of every segment, un-boxed. ── */}
        <div className="mt-7 border-t border-ink/10 pt-1" data-section="put-away">
          <DetailsFold
            row="put-away"
            label="Put this away"
            summary={archived ? 'Put away · bring it back any time' : 'Off your active list · nothing is deleted'}
          >
            <PutAwayCard eventId={eventId} archived={archived} eventName={eventName} bare />
          </DetailsFold>
        </div>
      </section>
    </LastSeenCapture>
  );
}

// ---------------------------------------------------------------------------

type Settled<T> = { ok: true; v: T } | { ok: false };

/** A read that FAILED stays a failure — it is never handed on as an empty answer. */
async function settle<T>(p: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, v: await p };
  } catch (err) {
    console.error('[event-details] read failed', err);
    return { ok: false };
  }
}
