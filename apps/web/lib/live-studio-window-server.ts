import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SKU_OWNERSHIP_ALIASES,
  eventHasCompGrant,
  eventHostHoldsFounderSeat,
  eventHostIsInternal,
  eventSkuActive,
} from '@/lib/entitlements';
import { isSkuFreeForCouplesNow } from '@/lib/promo-free-windows';
import { LIVE_STUDIO_SKU } from '@/lib/live-studio-control';
import {
  classifyGrant,
  decideBroadcastWindow,
  type GrantKind,
  type WindowDecision,
} from '@/lib/live-studio-window';

/**
 * apps/web/lib/live-studio-window-server.ts
 *
 * The SERVER half of the Live Studio broadcast window (Wave 7 · owner-locked 2026-07-25 ·
 * Live_Studio_Unified_Spec_2026-07-25.md § 4f ②). The DECISION is pure and lives in
 * lib/live-studio-window.ts; this file is only the reads that feed it.
 *
 * SPLIT ON PURPOSE. The controller's window strip is a `'use client'` component — it has to tick
 * through a ceremony to catch the 1-hour and 12-hour crossings a server render cannot see — and it
 * needs the pure predicates. Keeping the readers here means importing them cannot pull
 * lib/entitlements.ts and its DB queries into the browser bundle. Same shape as the repo's other
 * `*-server.ts` modules.
 *
 * Every reader takes the SupabaseClient as a PARAMETER (the lib/panood-control.ts convention)
 * rather than constructing one, so this module holds no secret and needs no `'server-only'` guard.
 */

/* ══════════════════════════════════════════════════════════════════════════════
   SERVER READERS — every one takes the client as a parameter (no server-only
   import here, so this module stays runnable under `tsx --test` too).

   ⚠ PASS AN ADMIN CLIENT. `orders` RLS is purchaser-scoped (orders_owner_read:
   `user_id = auth.uid()`), so a coordinator running the controller for a couple
   who paid would read ZERO days under their own session and be silently downgraded
   to one camera — mid-wedding, on a day that cannot be re-run.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Statuses that mean an order is ADMIN-APPROVED and therefore a real purchased day.
 * Same pair `checkOrderActive` uses — a `submitted` order buys no time, so nothing
 * a host can create for themselves extends the window.
 */
const ACTIVE_ORDER_STATUSES: string[] = ['paid', 'fulfilled'];

/**
 * Every service_key whose paid order counts as one Live Studio event-day.
 *
 * REUSES Wave 6's `SKU_OWNERSHIP_ALIASES` rather than re-listing the pair, so the
 * grandfather clause ("a Cast buyer keeps what they bought") is honoured here by
 * construction: a `PANOOD_SYSTEM` order confers the SKU *and* funds a day. Two
 * lists would eventually disagree, and the way they would disagree is a paying Cast
 * couple with an entitlement and zero days — entitled to multi-cam and instantly
 * expired.
 */
export function broadcastDaySkus(): string[] {
  return [LIVE_STUDIO_SKU, ...(SKU_OWNERSHIP_ALIASES[LIVE_STUDIO_SKU] ?? [])];
}

/**
 * When each purchased event-day was bought (`orders.created_at`), oldest first.
 *
 * Length = days purchased. Returns [] on any error or a pre-migration database —
 * which reads as "no metered days", and combined with an `owned` that also failed
 * to resolve lands on the free tier. Fail-closed on money.
 */
export async function fetchBroadcastDayStarts(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string[]> {
  if (!eventId) return [];
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('created_at')
      .eq('event_id', eventId)
      .in('service_key', broadcastDaySkus())
      .in('status', ACTIVE_ORDER_STATUSES)
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data ?? [])
      .map((r) => (r as { created_at?: string | null }).created_at ?? null)
      .filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

/**
 * The window anchor — the write-once first press-live for this event.
 * Reuses `panood_control_state.first_live_at`; null on a pre-migration DB.
 */
export async function fetchWindowAnchor(
  supabase: SupabaseClient,
  eventId: string,
): Promise<string | null> {
  if (!eventId) return null;
  try {
    const { data, error } = await supabase
      .from('panood_control_state')
      .select('first_live_at')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) return null;
    return (data as { first_live_at?: string | null } | null)?.first_live_at ?? null;
  } catch {
    return null;
  }
}

/** Is a broadcast on air, and when did it start? The never-interrupt rule's inputs. */
export type ActiveBroadcastFacts = { isLive: boolean; startedAt: string | null };

/**
 * The event's current broadcast, if any.
 *
 * Reads `panood_broadcasts` for a row that has not been completed — the SAME
 * predicate `getActivePanoodBroadcast` uses, restated here only so this module can
 * take its client as a parameter instead of importing a server-only one. `startedAt`
 * prefers `went_live_at` (when YouTube actually transitioned it) and falls back to
 * the scheduled start, then the row's own creation.
 *
 * ⚠ FAILS TO `isLive: true`. Every other read in this module fails closed; this one
 * does not, and the asymmetry is the point: the ONLY thing `isLive` can do is KEEP an
 * already-lapsed window open for a broadcast that started inside it. Failing it
 * closed would mean a transient database error cuts a running ceremony down to one
 * camera — the exact outcome the never-interrupt rule exists to forbid. It cannot
 * grant multi-cam to anyone: an un-owned event never reaches this call, and an
 * unexpired one does not need it. A pre-migration database (42P01/42703) is not an
 * error of that kind and reads as "no broadcast".
 */
export async function fetchActiveBroadcast(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ActiveBroadcastFacts> {
  if (!eventId) return { isLive: false, startedAt: null };
  try {
    const { data, error } = await supabase
      .from('panood_broadcasts')
      .select('went_live_at, scheduled_start_at, created_at')
      .eq('event_id', eventId)
      .neq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (error.code === '42P01' || error.code === '42703') {
        return { isLive: false, startedAt: null };
      }
      return { isLive: true, startedAt: null }; // fail PROTECTED — see the header
    }
    if (!data) return { isLive: false, startedAt: null };
    const row = data as {
      went_live_at?: string | null;
      scheduled_start_at?: string | null;
      created_at?: string | null;
    };
    return {
      isLive: true,
      startedAt: row.went_live_at ?? row.scheduled_start_at ?? row.created_at ?? null,
    };
  } catch {
    return { isLive: true, startedAt: null };
  }
}

/**
 * ⭐ WHICH GRANT unlocked Live Studio for an event that bought ZERO days.
 *
 * The owner's 2026-07-26 split (see the GRANT KINDS block in lib/live-studio-window.ts)
 * needs the ROUTE, not just the boolean `eventSkuActive` returns. This is that read —
 * and ONLY the read. The precedence ruling that makes it correct is `classifyGrant`,
 * a pure function next to the doc block, so all sixteen signal combinations are
 * testable without a database and this function cannot quietly re-order them.
 *
 * The four signals are the SAME four `eventSkuActive` already ORs together, read
 * through the SAME helpers, so "is it owned?" and "how is it owned?" cannot disagree.
 * Each helper graceful-degrades to `false` on any RPC error (pre-migration PGRST202
 * included), so a degraded read lands on 'unknown' → METERED. The failure mode is
 * "a grant holder is asked to add a day", never "a ₱3,000 product is given away
 * because an RPC blipped".
 *
 * ── COST ───────────────────────────────────────────────────────────────────────
 * Four reads, issued in PARALLEL, and only ever on the rare `owned && days === 0`
 * branch. A paying customer (days ≥ 1) and the free tier (!owned) never reach it, so
 * the common paths pay nothing for this. `isSkuFreeForCouplesNow` short-circuits
 * before touching the DB while PROMO_FREE_WINDOWS_ENABLED is off (the prod default).
 */
export async function resolveLiveStudioGrantKind(
  supabase: SupabaseClient,
  eventId: string,
): Promise<GrantKind> {
  if (!eventId) return 'unknown';
  const [founder, comp, internal, promo] = await Promise.all([
    eventHostHoldsFounderSeat(supabase, eventId).catch(() => false),
    eventHasCompGrant(supabase, eventId, LIVE_STUDIO_SKU).catch(() => false),
    eventHostIsInternal(supabase, eventId).catch(() => false),
    isSkuFreeForCouplesNow(LIVE_STUDIO_SKU).catch(() => false),
  ]);
  return classifyGrant({ founder, comp, internal, promo });
}

/**
 * THE ONE RESOLUTION. Everything that asks "may this host broadcast multi-cam?"
 * comes through here — the manifest write gate, the public read gate, the program
 * output, and the controller — so there is exactly one rule and it cannot fork.
 *
 * `isLive` may be supplied by a caller that already knows (the controller reads the
 * active broadcast anyway); otherwise it is resolved here.
 */
export async function resolveBroadcastWindow(
  supabase: SupabaseClient,
  eventId: string,
  opts?: { isLive?: boolean; broadcastStartedAt?: string | null; now?: Date },
): Promise<WindowDecision> {
  const now = opts?.now ?? new Date();
  if (!eventId) {
    return decideBroadcastWindow({
      owned: false,
      dayStarts: [],
      firstLiveAt: null,
      isLive: false,
      now,
    });
  }

  let owned = false;
  try {
    owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU);
  } catch {
    owned = false; // fail closed
  }

  // Short-circuit: an un-owned event has no window to resolve, and skipping the
  // three reads keeps the free tier's public page as cheap as it is today.
  if (!owned) {
    return decideBroadcastWindow({
      owned: false,
      dayStarts: [],
      firstLiveAt: null,
      isLive: false,
      now,
    });
  }

  const [dayStarts, firstLiveAt] = await Promise.all([
    fetchBroadcastDayStarts(supabase, eventId),
    fetchWindowAnchor(supabase, eventId),
  ]);

  // Owned but nothing was bought BY THE DAY → a grant. Which grant decides whether it
  // is metered (owner-locked 2026-07-26). Resolved ONLY here, so the paid path never
  // pays for these reads. A comp grant that happens to sit on an event which ALSO has
  // paid days is irrelevant: days ≥ 1 is already the metered answer.
  const grantKind: GrantKind | null =
    dayStarts.length === 0 ? await resolveLiveStudioGrantKind(supabase, eventId) : null;

  // A caller that already read the active broadcast (the controller does, for its
  // tally) hands both facts in rather than paying for the query twice. Supplying
  // `isLive` WITHOUT a start time is treated as "protected" by decideBroadcastWindow,
  // which is the safe direction for anyone who only knows the boolean.
  let isLive: boolean;
  let broadcastStartedAt: string | null;
  if (opts?.isLive !== undefined) {
    isLive = opts.isLive;
    broadcastStartedAt = opts.broadcastStartedAt ?? null;
  } else {
    const active = await fetchActiveBroadcast(supabase, eventId);
    isLive = active.isLive;
    broadcastStartedAt = active.startedAt;
  }

  return decideBroadcastWindow({
    owned,
    dayStarts,
    firstLiveAt,
    isLive,
    broadcastStartedAt,
    grantKind,
    now,
  });
}

/**
 * Stamp the window anchor at the first **ENTITLED** go-live. Write-once by DB trigger
 * (`trg_panood_first_live_at_immutable`), so a re-press can never move, restart or
 * extend the window; the `COALESCE`-shaped guard here only avoids a pointless write.
 *
 * Best-effort and non-fatal by design: a host must never be unable to go live
 * because the meter could not be started. The cost of a missed stamp is a window
 * that stays in `awaiting-go-live` — generous to the couple, never punitive.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🚨 THE ENTITLEMENT GATE — why this function refuses a FREE go-live
 * (owner-approved 2026-07-27, after a completeness audit found the defect)
 * ══════════════════════════════════════════════════════════════════════════════
 * This used to stamp for ANY host that pressed go-live. Two facts made that cost a
 * couple their wedding's multi-cam AFTER paying for it:
 *
 *   ① the **free single-camera livestream** — a promise on the live `/pricing` page,
 *      and the thing § 4d's rehearse-free model actively encourages — runs through
 *      `goLivePanood` exactly like a paid broadcast, so it stamped the PAID clock;
 *   ② `foldWindowEnd` computes `max(firstLiveAt, boughtAt) + 24h`.
 *
 * ⇒ Stream free on Monday. Buy on Thursday — which the apply-then-pay **24-hour
 * MANUAL reconciliation SLA forces**, buy-ahead being the advice we give. The window
 * becomes `max(Mon, Thu) + 24h` = **Friday**. The wedding is **Saturday**: expired,
 * one camera, ₱3,000 paid. That inverted § 4f ②'s own promise — *"anchor the window
 * on first go-live … buying early costs the couple nothing"* — into "your day starts
 * when you pay", on the one event that cannot be re-run.
 *
 * THE GATE REUSES `resolveBroadcastWindow` — the SAME rule every other surface asks,
 * not a second one that can disagree with it. It lives in this module, so there is no
 * import cycle (`live-studio-publish.ts` imports FROM here, so reaching for
 * `canPublishMultiCam` — a thin wrapper over this very call — would have made one).
 *
 * WHY THE BASE CASE IS NOT CIRCULAR: at the first entitled go-live the anchor is
 * still NULL, and `decideBroadcastWindow`'s null-anchor branch returns
 * `multiCam: true, reason: 'awaiting-go-live'`. So the gate says yes, we stamp, and
 * from then on the real expiry is computed. After expiry it says no — and refusing
 * to re-stamp is correct twice over (the DB trigger makes it write-once anyway).
 *
 * WHICH DIRECTION IT FAILS: `resolveBroadcastWindow` fails **closed** (an unreadable
 * entitlement reads as un-owned), so a transient error means we do NOT stamp. That is
 * the safe direction here and not a paywall hole: an unstamped paid event sits in
 * `awaiting-go-live`, which is `multiCam: true` with NO clock — the couple keeps the
 * capability they bought and simply is not metered for that press. A FREE event is
 * unaffected either way, because the free tier never depended on this column.
 *
 * ⚠ DO NOT "OPTIMISE" THIS BY STAMPING FIRST AND CHECKING LATER. The column is
 * write-once by trigger, so a wrong stamp is **unfixable without an admin reset that
 * does not exist** (the audit found no void/reset path). Ask, then write.
 */
export async function stampFirstLiveAt(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  if (!eventId) return;
  try {
    // ASK BEFORE WRITING — see the block above. A free single-cam go-live must never
    // start the paid clock.
    const entitled = await resolveBroadcastWindow(supabase, eventId);
    if (!entitled.multiCam) return;

    await supabase
      .from('panood_control_state')
      .upsert({ event_id: eventId }, { onConflict: 'event_id', ignoreDuplicates: true });
    const existing = await fetchWindowAnchor(supabase, eventId);
    if (existing) return;
    await supabase
      .from('panood_control_state')
      .update({ first_live_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .is('first_live_at', null);
  } catch {
    // Non-fatal — see the header.
  }
}
