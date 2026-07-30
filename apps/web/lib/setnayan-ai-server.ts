import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSetnayanAiPerEventPricingEnabled } from './integration-config';
import {
  SETNAYAN_AI_SKU,
  resolveSetnayanAiTypePricePhp,
} from './setnayan-ai-event-pricing';
import { setnayanAiTierSkuForEventType } from './setnayan-ai-type-pricing';

/**
 * setnayan-ai-server.ts — server-only resolution for the PER-USER Setnayan AI
 * subscription fan-out.
 *
 * The per-user entitlement is a single window per user
 * (`user_ai_subscription.active_until`). While it's in the future, Setnayan AI is
 * on for EVERY event the user hosts/co-hosts. That fan-out is resolved here at the
 * EVENT level: an event is entitled when ANY of its host/co-host members
 * (event_members.member_type='couple') has an active subscription window. Keying
 * on the event (not the viewer) means the resolution is identical for dashboard
 * surfaces and the public guest page — the latter has no session, so it MUST run
 * on the service-role admin client.
 *
 * The result is fed into the pure gate `isSetnayanAiActiveForUser` via
 * `subscription: { active_until }`; `userAiSubscriptionActive` does the lazy
 * expiry check (cron-free).
 *
 * The per-user FLAG resolver lives in lib/integration-config.ts
 * (`resolveSetnayanAiPerUserEnabled`), mirroring the paywall flag; callers
 * short-circuit this DB read entirely when the flag is OFF so there is zero added
 * query cost while it's off (the default).
 */

/**
 * Latest (max) `active_until` among an event's host/co-host members.
 *
 * Returns `{ active_until: null }` when the event has no hosting member with a
 * subscription window, or on ANY read error (fail-soft: no subscription → the
 * per-event behaviour, never a crash). The caller passes the result into
 * `isSetnayanAiActiveForUser({ subscription })`, where `userAiSubscriptionActive`
 * applies the future-vs-now expiry check — so a stale (past) `active_until`
 * resolves to inactive there, not here.
 *
 * MUST use the admin/service client: it both crosses RLS (couple→couple reads are
 * blocked) and works where there is no session (the public /v/[slug] page).
 */
export async function getEventHostAiSubscription(
  admin: SupabaseClient,
  eventId: string,
): Promise<{ active_until: string | null }> {
  try {
    // Host/co-host members of this event.
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');

    const userIds = (members ?? [])
      .map((m) => (m as { user_id?: string | null }).user_id)
      .filter((id): id is string => Boolean(id));
    if (userIds.length === 0) return { active_until: null };

    // Their subscription windows (one row per user). Take the LATEST expiry —
    // either co-host's active window covers the event (never double-charged).
    const { data: subs } = await admin
      .from('user_ai_subscription')
      .select('active_until')
      .in('user_id', userIds);

    let maxActiveUntil: string | null = null;
    let maxTime = -Infinity;
    for (const s of subs ?? []) {
      const raw = (s as { active_until?: string | null }).active_until;
      if (!raw) continue;
      const t = new Date(raw).getTime();
      if (Number.isNaN(t)) continue;
      if (t > maxTime) {
        maxTime = t;
        maxActiveUntil = raw;
      }
    }
    return { active_until: maxActiveUntil };
  } catch {
    // DB unreachable / tables absent (pre-migration) → no subscription.
    return { active_until: null };
  }
}

/* ── The price a host is SHOWN for Setnayan AI ───────────────────────────────
 * Lives HERE, not in lib/setnayan-ai-event-pricing.ts, for a concrete reason: it
 * must read the per-event-pricing switch, that switch lives in
 * lib/integration-config.ts, and integration-config pulls in `server-only`.
 * Importing it into the pricing module broke that module's own unit test
 * (`Cannot find module 'server-only'`) — it is deliberately free of server-only
 * imports so the tier ladder stays testable under `tsx --test`. This file already
 * declares `server-only`, so it is the right home. Same split as
 * r2-client-ref.ts / r2-client-ref.server.ts.
 */
/**
 * The price to SHOW a host for Setnayan AI — resolved through the SAME switch the
 * charge path uses, so the two can never disagree.
 *
 * ── WHY THIS EXISTS (2026-07-30) ────────────────────────────────────────────
 * The studio page used to call `resolveSetnayanAiTypePricePhp` directly and
 * UNGATED, while `lib/order-charge-authority.ts` takes the per-type branch only
 * when `resolveSetnayanAiPerEventPricingEnabled()` is true and otherwise falls
 * through to the flat `SETNAYAN_AI` retail row. With the flag OFF that is a
 * display/charge mismatch IN THE CUSTOMER'S DISFAVOUR: a `date` event (tier D)
 * was shown ₱99 and charged ₱1,499.
 *
 * The flag is ON in prod today, so the two currently agree — flipping it on is
 * what closed the gap. But that made the correctness of the price a property of a
 * SETTING rather than of the code, and the studio page's own comment asserted
 * "checkout re-resolves this same per-type amount server-side", which is only true
 * while the flag is on. Turning it off would silently re-open an overcharge while
 * that comment reassured the next reader.
 *
 * So the decision moves HERE, into one function both sides share: the flag still
 * chooses the MODEL, but it can no longer make the shown price and the charged
 * price disagree. Flag on ⇒ both per-type. Flag off ⇒ both flat.
 *
 * Returns 0 for Tier E (no vendors ⇒ Setnayan AI is not present) and 0 on an
 * unreadable read, which the caller renders as "no buy shown", never as "free".
 */
export async function resolveSetnayanAiDisplayPricePhp(
  client: SupabaseClient,
  eventType: string | null | undefined,
): Promise<number> {
  if (await resolveSetnayanAiPerEventPricingEnabled()) {
    return resolveSetnayanAiTypePricePhp(client, eventType);
  }
  // Flag off — checkout will charge the flat SETNAYAN_AI row, so show exactly
  // that. Tier E still shows nothing: with no vendors there is no product to buy,
  // which is a product fact rather than a pricing one.
  if (setnayanAiTierSkuForEventType(eventType) === null) return 0;
  const { data } = await client
    .from('platform_retail_catalog_v2')
    .select('retail_price_php')
    .eq('service_code', SETNAYAN_AI_SKU)
    .maybeSingle();
  const flat = (data as { retail_price_php?: number | null } | null)?.retail_price_php;
  return typeof flat === 'number' && Number.isFinite(flat) && flat > 0 ? flat : 0;
}
