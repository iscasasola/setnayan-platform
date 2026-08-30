import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError, isMissingRelationError } from '@/lib/supabase/error-detect';
import { eventOwnsSku, eventSkuActive, eventHasPapicUnlock } from '@/lib/entitlements';
import { readEventPoolStatus, EVENT_POOL_ABSENT } from '@/lib/papic-event-pool';
import { papicGuestCapLifts, papicGuestCapAppliesWithCeiling } from '@/lib/papic-guest-cap';

/**
 * apps/web/lib/papic-guest.ts
 *
 * Closes the partial PAPIC_GUEST SKU (₱2,999 · "Every guest's phone, a candid
 * camera" — the Premium Guest Camera Pack · v2.1 brief § 5 + the iteration-0012
 * Papic spec § 8 "150 captured-photo credits, bundled free in the Premium Guest
 * Camera Pack"). The Papic web-capture surface is scaffolded; v2-catalog.ts
 * marks PAPIC_GUEST 'partial' because "quota enforcement not wired" — there was
 * no guest-camera surface and no per-guest capture limit.
 *
 * THIS adds the missing half: when the event owns a paid PAPIC_GUEST order,
 * every signed-in guest gets a browser camera with a per-guest capture quota of
 * GUEST_CAPTURE_CREDITS (150), enforced SERVER-SIDE. Captures land in a new
 * papic_guest_captures table keyed by guest_id; a SECURITY DEFINER RPC counts
 * the guest's existing captures and rejects the insert once the credit pool is
 * exhausted. The guest surface shows "N captures left" from the same count.
 *
 * WHY a separate captures table (not the existing papic_photos) — papic_photos
 * (migration 20260520015000) is SEAT-bound: every row has a NOT NULL FK to
 * paparazzi_seats and is governed by PAPIC_SEATS. Guest cameras are a different
 * actor (the guest, identified by guest_id from the guest-session cookie, not a
 * claimed seat) and a different SKU (PAPIC_GUEST). Keeping guest captures in
 * their own table keeps the per-guest 150-credit quota cleanly separate from
 * the seat-pack pooled-credit model and avoids overloading the seat FK.
 *
 * Gating — same owned-orders pattern eventOwnsProWebsite() / eventOwnsIndoor-
 * Blueprint() use: an `orders` row with service_key = 'PAPIC_GUEST' whose status
 * is NOT cancelled / refunded / lapsed. A still-in-reconciliation 'submitted'
 * order counts as owned so the couple can't double-buy mid-reconciliation.
 *
 * SAFETY — every helper here that touches papic_guest_captures runs ONLY behind
 * a gate (the couple's add-on page is auth-bound; the guest camera route checks
 * the guest session + ownership BEFORE any captures query). NOTHING here runs on
 * the always-rendered public landing page. Graceful-degrade on a missing/legacy
 * table (42P01 undefined_table · 42703 undefined_column) so a pre-bootstrap
 * database surfaces the upgrade CTA / no-cameras state rather than crashing —
 * matches the PR #380/#390 + website/page.tsx + indoor-blueprint hotfix pattern.
 */

export const PAPIC_GUEST_SERVICE_KEY = 'PAPIC_GUEST';
export const PAPIC_GUEST_PRICE_PHP = 2999; // v2.1 brief § 5 · ₱2,999

/**
 * Per-guest captured-photo credits bundled in the Premium Guest Camera Pack.
 * Iteration 0012 Papic spec § 8: "Each guest receives 150 captured-photo
 * credits, bundled free in the Premium Guest Camera Pack."
 */
export const GUEST_CAPTURE_CREDITS = 150;

/**
 * Does this event own the paid Premium Guest Camera Pack?
 *
 * Delegates to the bundle-aware eventOwnsSku() reader (lib/entitlements.ts) —
 * refund-aware, graceful-degrade on a missing orders table, AND counts a
 * GUIDED_PACK or MEDIA_PACK bundle (both include PAPIC_GUEST) as owning the
 * guest-camera pack. Kept in lockstep with the DB RPC papic_event_owns_service
 * (migration 20270103010000) so the gate and the provisioning RPC agree.
 */
export async function eventOwnsPapicGuest(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventOwnsSku(supabase, eventId, PAPIC_GUEST_SERVICE_KEY);
}

/**
 * Is Papic Guest ACTIVE (admin-approved)? The handshake FEATURE GATE — the
 * guest camera unlocks only after the Setnayan team verifies the payment
 * (owner 2026-06-18). The buy surface keeps eventOwnsPapicGuest.
 */
export async function eventPapicGuestActive(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  // ── A LIVE POOL OPENS THE CAMERA, PAID OR FREE (owner-locked 2026-08-02) ──
  //
  // This used to require a PURCHASE. The free 50-point pool did not count, so on
  // a free event the guest site showed "Show my QR" and "Photos of you" and NO
  // camera — the only people who could shoot were whoever was handed one of the
  // three claim links. The free tier therefore had shots nobody could spend.
  //
  // Owner's call: "free guests can shoot." Paying buys MORE SHOTS, not more
  // PEOPLE. That costs nothing to give away, because the bound was never the
  // number of cameras — it is the purse, and the purse is already fenced:
  // papic_reserve_event_points_for_seat fails CLOSED at zero.
  //
  // ⚠ `applies`, deliberately NOT `remaining > 0`. An empty pool must still open
  // the camera: the capture screen explains "out of shots" far better than a
  // missing button does, and closing the door at zero would strand a guest who
  // scanned seconds earlier. Same reasoning as the poster join action.
  return (await eventPapicGuestAccess(supabase, eventId)) === 'on';
}

/**
 * The same question, answered in THREE states instead of two.
 *
 * 🔴 WHY. `eventPapicGuestActive` collapses "we could not find out" into
 * "false", and two guest-facing pages then print that as a sentence about the
 * HOST: "the host hasn't turned on guest cameras for this event yet."
 * `fetchEventPoolStatus` returns its ABSENT sentinel on any RPC error, and the
 * call below used to wrap it in a second `.catch(() => null)` — so a metering
 * outage, a missing grant or a renamed function all arrived at a guest's phone
 * as a decision their host had made. This repo's own rule: a rejected query is
 * not a thrown error, and the only symptom is an absence.
 *
 * 'unknown' is NOT a third permission. Every gate keeps failing closed — the
 * boolean above still returns false for it, so all ten existing callers behave
 * exactly as before. It exists so a screen can tell a person the truth about
 * WHY the camera is not opening.
 */
export type PapicGuestAccess = 'on' | 'off' | 'unknown';

export async function eventPapicGuestAccess(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PapicGuestAccess> {
  const [owned, pool] = await Promise.all([
    Promise.all(PAPIC_PASS_SERVICE_KEYS.map((key) => eventSkuActive(supabase, eventId, key))),
    readEventPoolStatus(supabase, eventId).catch(() => ({ ok: false, status: null })),
  ]);
  if (owned.some(Boolean)) return 'on';
  if (!pool.ok) return 'unknown';
  return pool.status?.applies === true ? 'on' : 'off';
}

/**
 * Every SKU that grants the guest-camera pass.
 *
 * ── WHY THERE IS NO DATE HERE (owner 2026-07-21) ─────────────────────────
 * The pass runs until the POINTS are depleted, not until a date passes. Points
 * are already the bound — the fail-closed pool RPC refuses at zero — so a date
 * gate would be a second fence around something already fenced, and the worst
 * case is bounded by construction: N unused points is at most N more captures,
 * whenever they happen.
 *
 * It is also the only model that survives a MULTI-DAY event. `travel` is
 * multi_day = TRUE by definition, and a ten-day trip must not need ten
 * purchases. Per-day scoping breaks there; points do not.
 *
 * A service_date column + date-aware gate were built and REMOVED before merge
 * for exactly this reason (PR #3430). Do not reintroduce one without a concrete
 * need — and if the pass ever does need to close, tie it to the RETENTION
 * WINDOW (it shuts when the gallery does), not to a per-day picker.
 */
export const PAPIC_PASS_SERVICE_KEYS: readonly string[] = Object.freeze([
  PAPIC_GUEST_SERVICE_KEY,
  'PAPIC_GUEST_6K',
  'PAPIC_GUEST_10K',
  'PAPIC_GUEST_TOPUP',
]);

// ─────────────────────────────────────────────────────────────────────────
// Quota — count a guest's captures + derive credits remaining. The
// authoritative enforcement is the SECURITY DEFINER RPC (papic_guest_capture)
// which re-checks the count under the same transaction as the insert; these
// helpers are the read side that drives the "N captures left" display.
// ─────────────────────────────────────────────────────────────────────────

export type GuestQuota = {
  /**
   * How many credits actually bind on this guest — the couple's own ceiling
   * (migration 20271184624871, S2) when they have set one, else the platform's
   * flat 150. `COALESCE(v_ceiling, v_credits)` in papic_record_guest_capture,
   * mirrored exactly: this is never a second number invented for display, it
   * is the same total the RPC would refuse against.
   */
  total: number;
  /** Credits the guest has already spent against `total` above (1 photo = 1,
   *  a ten-second clip = up to 8) — a row count only on a pre-migration DB
   *  where every capture cost exactly 1. */
  used: number;
  /** total − used, floored at 0. When `unlimited`, a large sentinel so the
   *  remaining-based gate (route pre-check + client `exhausted`) never trips. */
  remaining: number;
  /**
   * Mirrors `v_unlimited AND v_ceiling IS NULL` — the exact shape
   * papic_record_guest_capture reports back on an `ok` capture (migration
   * 20271184624871). An active PAPIC_UNLOCK or a shared pot report unlimited
   * ONLY while the couple has not put a ceiling on this one guest; the couple's
   * own number always overrides both, because "the couple bought their way
   * past OUR limit" is not permission to walk through a limit the couple
   * themselves set (see the RPC's own comment on the ceiling gate).
   */
  unlimited: boolean;
  /**
   * The inverse, and the field every screen gate must read: true whenever
   * SOME per-guest number can actually refuse a shot — the couple's own
   * ceiling, or (absent one) the platform's flat 150 on a non-pool, non-Unlock
   * celebration. On a pool celebration with no couple ceiling set — every
   * celebration today, because the free 50-shot grant arms on render — this is
   * FALSE, so no countdown is drawn and no shutter is hidden.
   */
  capApplies: boolean;
  /**
   * Shots left in the SHARED pot, or null when this celebration has no pot.
   * Present so a screen can say what is true about the celebration without
   * inventing a per-guest number.
   */
  poolRemaining: number | null;
  /** True once the pot crosses its own soft-stop line — "running low". */
  poolLow: boolean;
};

/** Sentinel `remaining` for an unlimited (Unlock) guest — large enough that the
 *  `<= 0` pre-check + client `exhausted` never fire, but still a finite number
 *  so it serializes cleanly to the client and survives a decrement. */
const UNLIMITED_REMAINING = Number.MAX_SAFE_INTEGER;

/**
 * Read-only mirror of the couple's per-guest ceiling — `papic_guest_spend_
 * ceiling(guest_id)` (migration 20271184624871, S2), `service_role`-only, so
 * `supabase` here MUST be the admin client. Returns null on ANY failure,
 * including 42883 function-not-found on a database that predates S2 — the
 * display side degrades exactly like eventHasPapicUnlock/readEventPoolStatus
 * above; the RPC's own gate (not this read) is the real enforcement.
 */
async function readGuestSpendCeiling(
  supabase: SupabaseClient,
  guestId: string,
): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('papic_guest_spend_ceiling', {
      p_guest_id: guestId,
    });
    if (error) {
      // 42883 function-not-found (pre-S2) is the EXPECTED shape this branch
      // is built to degrade through — quiet. Anything else is a genuine
      // outage, and staying silent about it would understate the couple's
      // ceiling on the guest's screen without a trace of why.
      if (!isMissingRelationError(error)) {
        logQueryError('readGuestSpendCeiling', error, { guest_id: guestId }, 'graceful_degrade');
      }
      return null;
    }
    return typeof data === 'number' ? data : null;
  } catch (err) {
    logQueryError('readGuestSpendCeiling', err, { guest_id: guestId }, 'graceful_degrade');
    return null;
  }
}

/**
 * Resolve a single guest's quota from papic_guest_captures. `supabase` here is
 * an admin client (the guest camera route is a public surface with no RLS
 * session) constrained to this event_id + guest_id. Graceful-degrade to a
 * full-quota shape (used=0) on a missing/legacy table so the first capture can
 * still be attempted — the RPC is the real gate.
 *
 * THE ONE PLACE — both the Event Hub inline camera (app/[slug]/_lib/loaders.ts)
 * and the standalone guest-camera page (app/papic/guest/page.tsx) call this and
 * only this. They drifted once already (the browser mirrored only half of
 * `v_unlimited`) precisely because the allowance was resolved twice; keeping
 * one function is what stops that happening again — see
 * lib/papic-guest-quota-mirrors-sql.test.ts.
 */
export async function fetchGuestQuota(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<GuestQuota> {
  // ── BOTH DISJUNCTS, because the RPC has two ────────────────────────────
  //
  // `papic_record_guest_capture` lifts the per-guest ceiling for an active
  // PAPIC_UNLOCK *and* for any celebration whose shared pot applies. This read
  // used to mirror only the first, so the browser enforced a 150 the database
  // was not applying anywhere. The rule itself lives in ONE place now —
  // lib/papic-guest-cap.ts — with one entry per write to `v_unlimited`.
  const [hasUnlock, poolRead, guestCeiling] = await Promise.all([
    eventHasPapicUnlock(supabase, eventId).catch(() => false),
    readEventPoolStatus(supabase, eventId).catch(() => ({
      ok: false,
      status: EVENT_POOL_ABSENT,
    })),
    readGuestSpendCeiling(supabase, guestId),
  ]);
  const poolApplies = poolRead.status.applies === true;
  const unlimitedBase = papicGuestCapLifts({
    hasUnlock,
    poolApplies,
    // A read failure is an outage, not a decision — and it fails OPEN. See the
    // reasoning on GuestCapInputs.poolUnknown.
    poolUnknown: !poolRead.ok,
  }).some(Boolean);
  // ── THE COUPLE'S CEILING OVERRIDES THE YIELD ────────────────────────────
  // Mirrors `v_unlimited := v_unlimited OR (pool_applies AND v_ceiling IS
  // NULL)` and the response's own `'unlimited', (v_unlimited AND v_ceiling IS
  // NULL)` in papic_record_guest_capture: an Unlock pass or a shared pot only
  // reports unlimited while nobody has put a number on THIS guest.
  const unlimited = unlimitedBase && guestCeiling === null;
  const capApplies = !unlimited;
  const poolRemaining = poolApplies ? poolRead.status.remainingPoints : null;
  const poolLow = poolApplies && poolRead.status.soft;

  // ⚠ CREDITS, NOT ROWS — same reasoning as the RPC's own SUM(points_cost):
  // a ten-second clip costs up to 8. `used` (row count) only equals credits
  // spent when points_cost is absent (pre-S2) or every row cost exactly 1.
  //
  // 🚨 THE LITERAL BELOW IS DELIBERATE — DO NOT HIDE IT BEHIND A CONSTANT.
  // `points_cost` does not exist on `papic_guest_captures` until S2's ceiling
  // migration (20271184624871) merges, so `lib/security/select-column-scan.
  // test.ts`'s phantom-column guard (T1) is CORRECT to fail red on this exact
  // line today — that failure is the ordering (S4 after S2) enforced by a
  // guard instead of a document. A named-constant indirection was tried and
  // reverted: `scanSelectSites()` only calls `extractSelectSites()`, which
  // matches STRING LITERALS only (SELECT_RE) — an identifier argument produces
  // no site at all, so the guard goes SILENTLY BLIND rather than passing a
  // real check. That is worse than red, not a fix for it. Leave this red until
  // #5017 merges; it clears on its own once the column exists.
  let used = 0;
  let usedCredits = 0;
  {
    const { data: rows, error: rowsError } = await supabase
      .from('papic_guest_captures')
      .select('points_cost')
      .eq('event_id', eventId)
      .eq('guest_id', guestId);
    if (!rowsError && rows) {
      used = rows.length;
      usedCredits = rows.reduce((sum, r) => {
        const cost = (r as Record<string, unknown>).points_cost;
        return sum + (typeof cost === 'number' ? cost : 1);
      }, 0);
    } else {
      // ⚠ A READ ERROR AND AN EMPTY RESULT MUST NOT LOOK THE SAME. The
      // EXPECTED case — points_cost absent on a pre-migration DB (42703, or
      // its PostgREST/message-substring equivalents) — degrades quietly: that
      // is the whole point of building this branch ahead of S2. Anything else
      // is a genuine outage and gets logged, so a guest never sees "0 used,
      // full total left" that is actually a read failure wearing a zero.
      if (rowsError && !isMissingRelationError(rowsError)) {
        logQueryError(
          'fetchGuestQuota.points_cost',
          rowsError,
          { event_id: eventId, guest_id: guestId },
          'graceful_degrade',
        );
      }
      // Fall back to a bare count, the exact pre-S2 shape (every capture cost
      // 1). The RPC enforces the real cap; this read only drives the display.
      const { count, error: countError } = await supabase
        .from('papic_guest_captures')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('guest_id', guestId);
      if (!countError) {
        used = count ?? 0;
        usedCredits = used;
      } else {
        // Both reads failed — the last-resort fallback itself broke. Always
        // log this one: there is no more-expected explanation to filter out.
        logQueryError(
          'fetchGuestQuota.count',
          countError,
          { event_id: eventId, guest_id: guestId },
          'graceful_degrade',
        );
      }
    }
  }

  const total = guestCeiling ?? GUEST_CAPTURE_CREDITS;
  const remaining = unlimited
    ? UNLIMITED_REMAINING
    : guestCeiling !== null
      ? Math.max(0, guestCeiling - usedCredits)
      : Math.max(0, GUEST_CAPTURE_CREDITS - used);

  return {
    total,
    used: guestCeiling !== null ? usedCredits : used,
    remaining,
    unlimited,
    capApplies,
    poolRemaining,
    poolLow,
  };
}

/**
 * Total guest captures across the whole event — drives the couple-facing
 * "Guest cameras" card. Admin client, constrained to event_id.
 *
 * ⚠ RETURNS `null` WHEN THE COUNT COULD NOT BE READ, and that is the whole
 * point of the signature. It used to `return 0` on an error, which is the
 * SAME VALUE a real empty event produces — so a refusal, an RLS silent-zero or
 * a legacy/missing table all arrived at the gallery hub as "no photos yet", on
 * a page whose entire job is to reach photos that exist. This area has paid for
 * that exact mistake before: the home tile once told coordinators "0 cameras
 * out" mid-shoot, an RLS silent-zero.
 *
 * 🔑 Binding the error is not enough if you then throw it away — `if (error)
 * return 0` reads as careful code and states an absence nobody measured.
 * Callers that genuinely cannot show a caveat may still `?? 0`; they are then
 * choosing the zero, in the open, at the call site.
 */
export async function countEventGuestCaptures(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from('papic_guest_captures')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) {
    logQueryError(
      'countEventGuestCaptures',
      error,
      { event_id: eventId },
      'graceful_degrade',
    );
    return null;
  }
  return count ?? 0;
}
