import type { SupabaseClient } from '@supabase/supabase-js';
import { eventSkuActive } from '@/lib/entitlements';
import { LIVE_STUDIO_SKU } from '@/lib/live-studio-control';
import { decideBroadcastWindow, type WindowDecision } from '@/lib/live-studio-window';

/**
 * apps/web/lib/live-studio-window-server.ts
 *
 * The SERVER half of the Live Studio broadcast unlock (LS6 · owner-ruled
 * 2026-09-02). The DECISION is pure and lives in lib/live-studio-window.ts; this
 * file is only the read that feeds it.
 *
 * 🚫 RETIRED HERE (LS6): the day-order reads (`fetchBroadcastDayStarts`,
 * `broadcastDaySkus`), the window anchor read's use as an entitlement input, and
 * the founder/comp/internal/promo grant-kind classifier
 * (`resolveLiveStudioGrantKind`) are all gone — they existed only to compute an
 * expiry, and nothing expires any more. `fetchWindowAnchor` and `stampFirstLiveAt`
 * survive: `panood_control_state.first_live_at` is still a live, informational
 * "when did this event first broadcast" fact (rendered on the broadcast page,
 * read by the unrelated legacy flag-off watermark model), it is just no longer an
 * entitlement anchor.
 *
 * SPLIT ON PURPOSE. The controller's window strip is a `'use client'` component,
 * and keeping the DB reader here means importing it cannot pull
 * lib/entitlements.ts and its queries into the browser bundle. Same shape as the
 * repo's other `*-server.ts` modules.
 *
 * Every reader takes the SupabaseClient as a PARAMETER (the lib/panood-control.ts
 * convention) rather than constructing one, so this module holds no secret and
 * needs no `'server-only'` guard.
 */

/**
 * The window anchor — the write-once first press-live for this event.
 * Reuses `panood_control_state.first_live_at`; null on a pre-migration DB.
 *
 * No longer an ENTITLEMENT input (LS6 retired the per-event-day clock this fed) —
 * kept because it is still a live, informational fact: rendered on the broadcast
 * page, and read by the unrelated legacy flag-off watermark model
 * (lib/panood-watermark.ts).
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

/**
 * THE ONE RESOLUTION. Everything that asks "may this host broadcast multi-cam?"
 * comes through here — the manifest write gate, the public read gate, the program
 * output, and the controller — so there is exactly one rule and it cannot fork.
 */
export async function resolveBroadcastWindow(
  supabase: SupabaseClient,
  eventId: string,
): Promise<WindowDecision> {
  if (!eventId) return decideBroadcastWindow({ owned: false });

  let owned = false;
  try {
    owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU);
  } catch {
    owned = false; // fail closed
  }

  return decideBroadcastWindow({ owned });
}

/**
 * Stamp the FIRST go-live for this event. Write-once by DB trigger
 * (`trg_panood_first_live_at_immutable`), so a re-press can never move, restart or
 * overwrite it.
 *
 * ── WHAT THIS RECORDS NOW (LS6) ──────────────────────────────────────────────
 * Purely informational: "when did this event first broadcast?" — shown on the
 * broadcast page, and read by the unrelated legacy flag-off watermark model
 * (lib/panood-watermark.ts, its own 24-hour overlay clock, untouched by LS6).
 * Multi-cam entitlement no longer depends on WHEN this is stamped — `resolveBroadcastWindow`
 * reads ownership alone — so there is no clock left for a wrong or late stamp to
 * damage.
 *
 * STILL GATED ON ENTITLEMENT, kept for the same reason it always was cheap
 * insurance: a FREE single-camera go-live should not be recorded as this event's
 * "first broadcast" fact ahead of a later PAID one. Best-effort and non-fatal — a
 * host must never be unable to go live because this stamp failed.
 */
export async function stampFirstLiveAt(
  supabase: SupabaseClient,
  eventId: string,
): Promise<void> {
  if (!eventId) return;
  try {
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
