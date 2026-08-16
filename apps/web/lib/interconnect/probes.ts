import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { tilesForVendorCategories } from '@/lib/vendor-category-taxonomy';
import { resolveSongDeskAccess } from '@/lib/song-desk-gate';
import { resolveVendorSpecializationAccessForVendor } from '@/lib/vendor-specialization-gate.server';
import { holdsSpecialization } from '@/lib/vendor-specialization-gate';
import { eventSkuActive } from '@/lib/entitlements';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { fetchGuestsByEvent } from '@/lib/guests';
import { classifyPopulation, type ProbeResult } from './verdict';

/**
 * The probe registry — one entry per interconnection we are willing to claim
 * still works.
 *
 * ── THE RULE THAT MAKES A PROBE REAL ───────────────────────────────────────
 * A probe MUST call the same function the surface calls. It must never
 * re-implement the surface's logic in SQL or in its own copy, because two
 * hand-maintained copies of one rule drift TOGETHER and the check stays green
 * while the product breaks — that is exactly how a retired SKU sat on a live
 * page for eight days behind a passing guard.
 *
 * Concretely: `bookedVendorDeskReach` below calls
 * {@link tilesForVendorCategories}, the shipped bridge, and does not encode the
 * band_dj→live_band mapping anywhere in this file. If someone changes that
 * mapping, this probe changes with it. If someone deletes it, this probe stops
 * compiling. Neither is true of a SQL copy.
 *
 * ── WHAT THESE PROBES ARE ─────────────────────────────────────────────────
 * Both halves of one real incident, watched from opposite ends:
 *   · the CAUSE   — a vendor whose booked categories no longer reach the tiles
 *                   their desks are keyed on (the vocabulary mismatch itself)
 *   · the SYMPTOM — song requests sitting pending with nobody able to see them
 * Either one alone would have caught the song desk on day one. Both are cheap,
 * and they fail independently, which is the point of watching a joint from more
 * than one side.
 */

/** A probe is an async function returning what it saw. It must not throw. */
export type Probe = {
  key: string;
  /** Ugat joint id when the probe watches a mapped joint. */
  jointId?: string;
  /** Shown in the admin console above the verdict. */
  title: string;
  run: () => Promise<ProbeResult>;
};

/** Rows the joint queries below need, shaped once so both probes share a read. */
type BookedPair = {
  eventId: string;
  vendorProfileId: string;
  services: string[];
  bookedCategories: string[];
};

/**
 * Every (vendor, event) booking with the two vocabularies side by side.
 *
 * `event_vendors` links to a marketplace vendor through EITHER
 * `linked_vendor_profile_id` OR `marketplace_vendor_id` — both are real FKs to
 * `vendor_profiles`, so matching on only one silently drops half the bookings.
 * (`event_vendors.vendor_id` is that table's own primary key, not a vendor
 * reference; the name invites exactly the mistake this comment prevents.)
 */
async function fetchBookedPairs(): Promise<BookedPair[]> {
  const { data, error } = await createAdminClient().rpc('interconnect_booked_vocabularies' as never);
  if (error || !data) return [];
  return (data as unknown[]).map((row) => {
    const r = row as {
      event_id: string;
      vendor_profile_id: string;
      services: string[] | null;
      booked_categories: string[] | null;
    };
    return {
      eventId: r.event_id,
      vendorProfileId: r.vendor_profile_id,
      services: Array.isArray(r.services) ? r.services : [],
      bookedCategories: Array.isArray(r.booked_categories) ? r.booked_categories : [],
    };
  });
}

/**
 * Can this booking's vendor still reach the desks their booking implies?
 *
 * `tilesForVendorCategories` returns NULL when it declines to narrow — an
 * unclassifiable event does not lock anyone out, by design. So null is REACHABLE,
 * not a fault. Reading null as "no tiles" would invert the whole intent of that
 * function and make this probe scream about healthy bookings.
 */
function deskIsReachable(pair: BookedPair): boolean {
  const tiles = tilesForVendorCategories(pair.bookedCategories);
  if (tiles === null) return true; // declined to narrow — access unaffected
  return tiles.some((t) => pair.services.includes(t));
}

/**
 * PROBE 1 · the cause.
 *
 * A booked vendor whose categories map to tiles they do not hold has, from
 * their side of the screen, no day-of desks at all — every specialization
 * surface denies them and the denial looks like an empty page. This is the
 * exact state prod was in for the whole song-desk build.
 */
const bookedVendorDeskReach: Probe = {
  key: 'vendor-desk-reach',
  // J7 · Event ↔ Vendor (booking), joint `event_vendors` — this probe watches
  // exactly that joint's two vocabularies, so the map can colour it live.
  jointId: 'J7',
  title: 'Booked vendors can reach their day-of desks',
  run: async (): Promise<ProbeResult> => {
    const pairs = await fetchBookedPairs();
    const reachable = pairs.filter(deskIsReachable);
    const stranded = pairs.length - reachable.length;

    return {
      probeKey: bookedVendorDeskReach.key,
      permitted: true,
      subjectCount: reachable.length,
      truthCount: pairs.length,
      verdict: classifyPopulation(reachable.length, pairs.length),
      detail:
        pairs.length === 0
          ? 'No bookings to check.'
          : stranded === 0
            ? `All ${pairs.length} booking(s) reach at least one held tile.`
            : `${stranded} of ${pairs.length} booking(s) map to tiles the vendor does not hold — their desks deny and render as empty.`,
    };
  },
};

/**
 * PROBE 2 · the symptom.
 *
 * Pending song requests on an event where no booked vendor holds a tile that
 * opens the desk are invisible to every human being. Nobody is ignoring them;
 * nobody can see them. That is what "no requests yet" over three real rows
 * looked like from the guest's side.
 *
 * Deliberately does NOT re-check entitlement: whether the act has paid is a
 * different failure (they get a paywall, which is a surface that tells the
 * truth). This probe only asks whether an audience is structurally possible.
 */
const songRequestsHaveAnAudience: Probe = {
  key: 'song-requests-audience',
  title: 'Pending song requests have an act who can see them',
  run: async (): Promise<ProbeResult> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('event_song_requests')
      .select('request_id, event_id')
      .eq('status', 'pending');
    if (error) throw new Error(`pending song requests unreadable: ${error.message}`);

    const pending = (data ?? []) as { request_id: string; event_id: string }[];
    if (pending.length === 0) {
      return {
        probeKey: songRequestsHaveAnAudience.key,
        permitted: true,
        subjectCount: 0,
        truthCount: 0,
        verdict: 'empty',
        detail: 'No pending requests to route.',
      };
    }

    // An event can serve its requests when at least one booked vendor there can
    // reach a desk at all.
    const pairs = await fetchBookedPairs();
    const servedEvents = new Set(
      pairs.filter(deskIsReachable).map((p) => p.eventId),
    );
    const visible = pending.filter((r) => servedEvents.has(r.event_id));
    const orphaned = pending.length - visible.length;

    return {
      probeKey: songRequestsHaveAnAudience.key,
      permitted: true,
      subjectCount: visible.length,
      truthCount: pending.length,
      verdict: classifyPopulation(visible.length, pending.length),
      detail:
        orphaned === 0
          ? `All ${pending.length} pending request(s) have a reachable act.`
          : `${orphaned} of ${pending.length} pending request(s) sit on events where no booked vendor can open a desk — nobody can see them.`,
    };
  },
};

/**
 * PROBE 3 · the narrowing, isolated.
 *
 * Probes 1 and 2 compare the two vocabularies beside the gate. This one calls
 * the REAL gate — {@link resolveSongDeskAccess}, the same function the vendor's
 * page calls — twice for each booked vendor, and the difference between the two
 * answers is the finding:
 *
 *   with the event-tile narrowing    → what the vendor actually gets
 *   with the narrowing suppressed    → what their entitlement alone would give
 *
 * A vendor who passes WITHOUT narrowing and fails WITH it is not being
 * paywalled — they hold the specialization, and the event-tile intersection
 * took it away. That is precisely and only the defect that made every
 * specialization desk unreachable for the whole song-desk build, and it is
 * invisible to any check that just asks "did the gate say yes".
 *
 * ── WHY IT ASKS TWICE INSTEAD OF READING ROWS ──────────────────────────────
 * The obvious probe — "gate passed, so can they see the rows?" — cannot fail.
 * The inbox reads as service_role once the gate passes, so agreement is
 * guaranteed by construction and the probe would report health forever. A check
 * that is structurally incapable of failing is worse than no check: it occupies
 * the slot where a real one would go.
 *
 * A refusal on BOTH calls is skipped, not flagged. "You have not paid for the
 * song desk" is a paywall telling the truth, and a health check that screams
 * about honest paywalls gets muted within a week.
 *
 * ⚠ WHAT THIS DOES NOT PROVE. It runs the gate's LOGIC under service_role, not
 * the vendor's own database session, so a row-level-security mistake could deny
 * the real vendor while this reads clean. The 64 DB tests cover that layer;
 * what broke the song desk lived here, in the TypeScript decision above RLS.
 * Minting a real login session for a real vendor on a schedule would close the
 * gap and is deliberately not done — standing credentials for real accounts are
 * a worse risk than the one they would retire.
 *
 * 🔴 AND UNTIL 2026-08-15 IT PROVED NOTHING AT ALL — the paragraph above was
 * written about running under service_role WITHOUT NOTICING that the narrowing
 * input itself came from a call service_role is refused. `resolveSongDeskAccess`
 * fetched the event's tiles through `get_vendor_event_brief`, whose gate answers
 * `42501 not_a_vendor` to anyone who is not a booked vendor; the helper reads
 * only `data`, so the refusal arrived as `null` — which the gate's own contract
 * defines as "decline to narrow". Both of the two calls below were therefore the
 * SAME call, their difference was always zero, and this probe would have reported
 * all-clear straight through the outage it was written after. The tiles are
 * passed in now, from `booked_categories` this file already holds.
 *
 * 🔑 The warning three paragraphs up — *"a check that is structurally incapable
 * of failing is worse than no check"* — was true of this probe, in the same file
 * that says it, for as long as it has existed.
 */
const songDeskNarrowingLockout: Probe = {
  key: 'song-desk-narrowing',
  jointId: 'J7',
  title: 'The event-tile narrowing does not lock out entitled acts',
  run: async (): Promise<ProbeResult> => {
    const admin = createAdminClient();
    const pairs = await fetchBookedPairs();

    let entitled = 0; // holds song_desk on entitlement alone
    let reaching = 0; // ...and still gets in once the event narrows

    for (const pair of pairs) {
      const booked = [pair.eventId]; // this row IS the booking

      // Entitlement alone — narrowing suppressed by asking about an event the
      // brief cannot classify is not reliable, so ask the specialization
      // resolver directly with eventTiles = null (its documented "do not
      // narrow" input).
      const bare = await resolveVendorSpecializationAccessForVendor(admin, pair.vendorProfileId, {
        services: pair.services,
        eventTiles: null,
      });
      if (!holdsSpecialization(bare, 'song_desk')) continue; // honest paywall
      entitled += 1;

      /*
        🔴 THE NARROWING IS PASSED IN, AND UNTIL 2026-08-15 THERE WAS NONE.
        `resolveSongDeskAccess` used to fetch the event's tiles itself, through
        `get_vendor_event_brief` — a gate that refuses anyone who is not a
        vendor booked on that event. This probe runs as the trusted server, so
        that call answered `42501 not_a_vendor` every six hours, and the helper
        reading only `data` turned the refusal into `null`, which the gate's own
        contract reads as "decline to narrow".

        So THIS PROBE — "the event-tile narrowing does not lock out entitled
        acts" — was measuring a narrowing that never ran, and would have
        reported all-clear straight through the outage it was written after. A
        health check that cannot fail is worse than none: it is a standing
        claim that somebody looked.

        `fetchBookedPairs` already carries `booked_categories` for every
        booking, and `deskIsReachable` above already maps them with the same
        function. Passing them here uses what we hold instead of knocking on a
        door this caller can never open — no gate widened, and the narrowing is
        finally the real one.
      */
      const real = await resolveSongDeskAccess(
        admin,
        pair.vendorProfileId,
        pair.services,
        pair.eventId,
        booked,
        tilesForVendorCategories(pair.bookedCategories),
      );
      if (real.ok) reaching += 1;
    }

    const lockedOut = entitled - reaching;
    return {
      probeKey: songDeskNarrowingLockout.key,
      jointId: 'J7',
      permitted: entitled > 0,
      subjectCount: reaching,
      truthCount: entitled,
      // Population rule: entitled-but-locked-out is `lying` even if only one of
      // several is affected. classifyPopulation returns `empty` at 0/0, which is
      // the correct reading of "no entitled act exists yet".
      verdict: classifyPopulation(reaching, entitled),
      detail:
        entitled === 0
          ? `No act holds song_desk across ${pairs.length} booking(s) — nothing to narrow.`
          : lockedOut === 0
            ? `All ${entitled} entitled act(s) still reach the desk after event narrowing.`
            : `${lockedOut} of ${entitled} entitled act(s) are locked out BY THE NARROWING, not by the paywall.`,
    };
  },
};

/**
 * PROBE 4 · the arrival check — money landed, did the feature switch on?
 *
 * This is the owner's original idea, built the DERIVED way rather than the
 * declared way, and the distinction is the whole design:
 *
 *   declared — every write site records "this is supposed to land over there".
 *              Precise, and it fails the moment somebody forgets one, because a
 *              missing declaration is indistinguishable from a healthy joint.
 *              It also only ever covers writes made after it ships.
 *   derived  — state the pair of facts ONCE and let a query find the gap. No
 *              instrumentation to forget, and it works retroactively on every
 *              row already in the database.
 *
 * The pair here: **an order that has been paid should have its SKU active on
 * its event.** Money is the right first one — a silent gap costs a real
 * customer something they paid for, and they find out before we do.
 *
 * ── IT CALLS THE PRODUCT'S OWN READER ──────────────────────────────────────
 * `eventSkuActive` is the function the product itself uses to decide whether a
 * feature is unlocked, so this cannot drift from what the couple experiences.
 * A SQL re-implementation would be a second copy of a rule that already folds
 * in bundle composition, promo free-windows and admin comp grants — and two
 * copies of one rule drift together while the check stays green.
 *
 * ── THE GRACE WINDOW IS LOAD-BEARING ───────────────────────────────────────
 * Activation runs after payment, not inside it, so a just-paid order is
 * legitimately not-yet-active. Orders younger than ACTIVATION_GRACE_MS are
 * excluded — without that, this probe would report a fault on every healthy
 * checkout and be muted within a day.
 */
const ACTIVATION_GRACE_MS = 15 * 60 * 1000;

const paidOrderActivation: Probe = {
  key: 'paid-order-activation',
  title: 'Paid orders actually switched their feature on',
  run: async (): Promise<ProbeResult> => {
    const admin = createAdminClient();

    // `fulfilled` is included on purpose: it claims MORE than `paid` does, so a
    // fulfilled order whose SKU is not active is a louder contradiction, not a
    // quieter one.
    const { data, error } = await admin
      .from('orders')
      .select('order_id, event_id, service_key, status, created_at')
      .in('status', ['paid', 'fulfilled']);
    if (error) throw new Error(`orders unreadable: ${error.message}`);

    const cutoff = Date.now() - ACTIVATION_GRACE_MS;
    const due = (
      (data ?? []) as {
        order_id: string;
        event_id: string | null;
        service_key: string | null;
        created_at: string;
      }[]
    ).filter((o) => o.event_id && o.service_key && new Date(o.created_at).getTime() < cutoff);

    let live = 0;
    const dead: string[] = [];
    for (const o of due) {
      const active = await eventSkuActive(admin, o.event_id as string, o.service_key as string);
      if (active) live += 1;
      else dead.push(o.service_key as string);
    }

    // No PII: SKU keys only, never order ids or customer identifiers.
    const worst = [...new Set(dead)].slice(0, 5).join(', ');
    return {
      probeKey: paidOrderActivation.key,
      permitted: true,
      subjectCount: live,
      truthCount: due.length,
      verdict: classifyPopulation(live, due.length),
      detail:
        due.length === 0
          ? 'No settled orders past the activation grace window.'
          : dead.length === 0
            ? `All ${due.length} settled order(s) have their SKU active.`
            : `${dead.length} of ${due.length} settled order(s) are PAID but their feature is not active (${worst}).`,
    };
  },
};

/**
 * PROBE 5 · a vendor's own bookings reach their own calendar.
 *
 * Pair: **a live pool booking should appear in that vendor's calendar read.**
 *
 * ── WHY THIS IS NOT TAUTOLOGICAL ───────────────────────────────────────────
 * It looks like it must always pass — same database, same filter, both under
 * service_role. It does not, and the reason is in the reader:
 *
 *     const { data: rows } = await supabase.from(...)...   // ← no error check
 *     const bookings = (rows ?? []) as ...
 *
 * `fetchVendorPoolBookings` DISCARDS the error object. Any failure — a renamed
 * column, a dropped column, a view/table divergence, an RLS change — comes back
 * as `data: null` and becomes an empty calendar with no exception and no log.
 * The vendor opens their day and sees nothing; the page renders perfectly. That
 * is the phantom-column class this codebase has already shipped once, and the
 * `?? []` is what hid it.
 *
 * So the probe compares the READER against a direct count of the same filtered
 * rows. Agreement proves the select still resolves; disagreement is the reader
 * silently degrading. Nothing else in CI can see that, because a `?? []`
 * fallback typechecks and tests green.
 */
const vendorCalendarReach: Probe = {
  key: 'vendor-calendar-reach',
  title: "Vendors' bookings reach their own calendar",
  run: async (): Promise<ProbeResult> => {
    const admin = createAdminClient();

    // `released_at is null` mirrors the reader's own filter exactly — a truth
    // count that counted released bookings too would fault on healthy data.
    const { data, error } = await admin
      .from('vendor_schedule_pool_bookings')
      .select('vendor_profile_id')
      .is('released_at', null);
    if (error) throw new Error(`pool bookings unreadable: ${error.message}`);

    const truthByVendor = new Map<string, number>();
    for (const r of (data ?? []) as { vendor_profile_id: string }[]) {
      truthByVendor.set(r.vendor_profile_id, (truthByVendor.get(r.vendor_profile_id) ?? 0) + 1);
    }

    let truth = 0;
    let seen = 0;
    let blind = 0;
    for (const [vendorProfileId, expected] of truthByVendor) {
      truth += expected;
      const got = (await fetchVendorPoolBookings(admin, vendorProfileId)).length;
      seen += Math.min(got, expected);
      if (got < expected) blind += 1;
    }

    return {
      probeKey: vendorCalendarReach.key,
      permitted: true,
      subjectCount: seen,
      truthCount: truth,
      verdict: classifyPopulation(seen, truth),
      detail:
        truth === 0
          ? 'No live bookings to check.'
          : blind === 0
            ? `All ${truth} live booking(s) reach their vendor's calendar.`
            : `${blind} vendor(s) have bookings their own calendar read does not return — the reader is degrading silently.`,
    };
  },
};

/**
 * PROBE 6 · a couple's guests reach the couple's own list.
 *
 * Pair: **a non-deleted guest row should appear in that event's guest list.**
 *
 * Same shape as probe 5 and the same justification, except here the reader says
 * it out loud. `fetchGuestsByEvent` carries a five-pass hotfix header ending in
 * a deliberate decision to "always graceful-degrade, never crash the page" — on
 * RLS denial, auth failure, network error or schema drift it returns an EMPTY
 * GUEST LIST rather than throwing. That is the right call for a page a host is
 * standing in front of, and it means the failure is invisible from inside the
 * product: a host with 39 guests sees a clean empty state and assumes they
 * imported nothing.
 *
 * A reader that cannot fail loudly needs something outside it that can.
 */
const guestListReach: Probe = {
  key: 'guest-list-reach',
  title: "Couples' guests reach their own guest list",
  run: async (): Promise<ProbeResult> => {
    const admin = createAdminClient();

    // `deleted_at is null` mirrors the reader's filter — see probe 5.
    const { data, error } = await admin
      .from('guests')
      .select('event_id')
      .is('deleted_at', null);
    if (error) throw new Error(`guests unreadable: ${error.message}`);

    const truthByEvent = new Map<string, number>();
    for (const r of (data ?? []) as { event_id: string }[]) {
      truthByEvent.set(r.event_id, (truthByEvent.get(r.event_id) ?? 0) + 1);
    }

    let truth = 0;
    let seen = 0;
    let blind = 0;
    for (const [eventId, expected] of truthByEvent) {
      truth += expected;
      const got = (await fetchGuestsByEvent(admin, eventId)).length;
      seen += Math.min(got, expected);
      if (got < expected) blind += 1;
    }

    return {
      probeKey: guestListReach.key,
      permitted: true,
      subjectCount: seen,
      truthCount: truth,
      verdict: classifyPopulation(seen, truth),
      detail:
        truth === 0
          ? 'No guests to check.'
          : blind === 0
            ? `All ${truth} guest(s) reach their event's list.`
            : `${blind} event(s) have guests the host's own list does not return — the reader is degrading silently.`,
    };
  },
};

/**
 * The registry.
 *
 * These probes cover a fraction of the mapped joints, and the map itself
 * reaches roughly a third of the app — the remainder is the `map-backlog` list
 * in `ugat-concept.baseline.txt`.
 *
 * ⚠ NO COUNTS IN THIS COMMENT, deliberately, after it got two wrong in two
 * days. It said "TWO probes" while the array held four, and "47 subsystems"
 * when the file held 44 — a number miscounted at birth by a `grep -c` that
 * swallowed three comment lines, then copied to a second place before anyone
 * checked it. That is precisely the defect this module exists to detect,
 * committed twice in its own header.
 *
 * A number in prose has no way to be wrong out loud. `PROBES.length` and the
 * baseline file are the readings; take them from there.
 */
export const PROBES: readonly Probe[] = [
  bookedVendorDeskReach,
  songRequestsHaveAnAudience,
  songDeskNarrowingLockout,
  paidOrderActivation,
  vendorCalendarReach,
  guestListReach,
];
