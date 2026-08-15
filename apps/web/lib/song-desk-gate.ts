import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tilesForVendorCategories } from '@/lib/vendor-category-taxonomy';
import { resolveVendorSpecializationAccessForVendor } from '@/lib/vendor-specialization-gate.server';
import { holdsSpecialization } from '@/lib/vendor-specialization-gate';

/**
 * The song-desk access DECISION, with the identity passed in rather than read
 * from the session.
 *
 * ── WHY THIS MOVED OUT OF actions.ts ───────────────────────────────────────
 * `requireSongDeskAct` asked "who is logged in right now?" via
 * `supabase.auth.getUser()`. That is correct for a page render and impossible
 * for anything else — a background health check has nobody logged in, so it
 * could not call the gate at all. The interconnection probes were therefore
 * reduced to re-deriving the vocabulary comparison beside the gate instead of
 * asking the gate itself, which is the drift-prone shape this whole subsystem
 * exists to avoid.
 *
 * Splitting it costs nothing at the call site: `requireSongDeskAct` stays
 * exactly where it was and now resolves the identity, then calls this. Both the
 * page and the probe end up on the SAME decision, so a change to the rule
 * cannot reach one without the other.
 *
 * ── WHY A lib MODULE AND NOT AN EXPORT FROM actions.ts ─────────────────────
 * `app/vendor-dashboard/on-the-day/actions.ts` carries `'use server'`. EVERY
 * export from such a file becomes a callable server action, so exporting a
 * function that takes `vendorProfileId` as a parameter would publish an
 * endpoint letting any client evaluate the gate as any vendor they like. The
 * decision belongs in `lib/`, where it is an ordinary import and reachable only
 * from server code that already knows who it is asking about.
 *
 * ⚠ THE IDENTITY IS AN ARGUMENT NOW, WHICH MEANS CALLERS MUST EARN IT. Nothing
 * in here proves the caller is entitled to ask about this vendor — that is the
 * wrapper's job (`auth.getUser()` → `fetchOwnVendorProfile`) or the probe's
 * (service-role, no user in the loop). A future caller that takes a
 * vendorProfileId from a request body without checking ownership would be a
 * privilege escalation this function cannot see.
 */

export type SongDeskAccess =
  | {
      ok: true;
      /** The tiles this vendor is booked under — reused by callers that seed a
       *  `vendor_dayof_configs` row, so the brief is fetched once. */
      eventTiles: string[] | null;
    }
  | { ok: false; error: string };

/**
 * The event's booked categories, translated into the TILE vocabulary.
 *
 * `booked_categories` speaks the COUPLE-SIDE vocabulary (`band_dj`); `services`
 * speaks TILES (`live_band`). Intersecting them raw is what made all three
 * specialization desks unreachable for the entire song-desk build, so the
 * translation happens here, once, and never at a call site.
 *
 * Returns NULL when nothing maps — a deliberate "decline to narrow", not an
 * empty narrowing. Reading null as "no tiles" locks out every vendor on an
 * event the data cannot classify.
 */
export async function fetchBookedTiles(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string[] | null> {
  const { data: brief } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  const raw = (brief as { booked_categories?: unknown } | null)?.booked_categories;
  return tilesForVendorCategories(Array.isArray(raw) ? (raw as string[]) : null);
}

/**
 * Booked on this event → holds `song_desk` → in.
 *
 * The entitlement deliberately stays in TypeScript rather than SQL:
 * `resolveVendorSpecializationAccessForVendor` folds in the admin free-window
 * promotion and the mid-event lapse, and a SQL copy of those rules would drift
 * from the copy every render path already uses. A drifting paywall fails open.
 */
export async function resolveSongDeskAccess(
  supabase: SupabaseClient,
  vendorProfileId: string,
  services: string[],
  eventId: string,
  bookedEventIds: string[],
  /**
   * The event's tiles, when the caller ALREADY KNOWS them — pass `undefined` to
   * have them fetched here (every vendor-facing caller does).
   *
   * 🔴 THIS EXISTS BECAUSE THE HEALTH PROBE COULD NOT SEE WHAT IT WAS BUILT TO
   * WATCH. `fetchBookedTiles` reads `get_vendor_event_brief`, whose gate refuses
   * anyone who is not a vendor booked on that event. The interconnection probe
   * runs as the trusted server, so the call returned `42501 not_a_vendor` every
   * six hours — and because that helper reads only `data`, the refusal arrived
   * as `null`, which this function's contract defines as *"decline to narrow"*.
   * So the probe whose whole job is *"the event-tile narrowing does not lock out
   * entitled acts"* was measuring a narrowing that never happened, and would
   * have reported all-clear through the exact outage it was written after.
   *
   * The probe already holds these tiles: `interconnect_booked_vocabularies`
   * hands it `booked_categories` for every booking, and its sibling probe reads
   * them directly. So it passes what it has rather than asking through a door
   * it cannot open — no gate is widened, and the narrowing is finally real.
   *
   * ⚠ NOT a way to hand-supply tiles on a vendor path. Every caller with a
   * vendor's own session omits it and gets the fetched answer.
   */
  knownEventTiles?: string[] | null,
): Promise<SongDeskAccess> {
  if (!bookedEventIds.includes(eventId)) {
    return { ok: false, error: 'You are not booked on this event.' };
  }

  const eventTiles =
    knownEventTiles !== undefined ? knownEventTiles : await fetchBookedTiles(supabase, eventId);
  const access = await resolveVendorSpecializationAccessForVendor(supabase, vendorProfileId, {
    services,
    eventTiles,
  });
  if (!holdsSpecialization(access, 'song_desk')) {
    return { ok: false, error: 'The song desk is part of a paid plan.' };
  }

  return { ok: true, eventTiles };
}
