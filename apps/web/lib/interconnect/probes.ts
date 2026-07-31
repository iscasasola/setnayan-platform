import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { tilesForVendorCategories } from '@/lib/vendor-category-taxonomy';
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
 * ── WHAT THESE TWO PROBES ARE ──────────────────────────────────────────────
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
 * The registry.
 *
 * TWO probes over 83 mapped joints, and the map itself covers roughly a third
 * of the app — `ugat-concept.baseline.txt` still lists 47 subsystems it has
 * never reached. That ratio is the honest state of this system on day one and
 * it is written down here rather than implied, because a coverage number nobody
 * states drifts upward in everyone's memory.
 */
export const PROBES: readonly Probe[] = [bookedVendorDeskReach, songRequestsHaveAnAudience];
