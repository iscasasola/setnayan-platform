import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { activateOrderSku } from '@/lib/sku-activation';
import { fetchV2CustomerCatalog } from '@/lib/v2-catalog';

/**
 * Comp-grant fulfillment bridge — admin "early wedding gift" (PR 1 of the gift
 * experience · Admin_Account_Access_Model_2026-06-22.md).
 *
 * THE GAP THIS CLOSES: issueCompGrant recorded a comp_grants row but created NO
 * order and never called activateOrderSku, so a gifted FLAG-BACKED SKU (e.g.
 * SETNAYAN_AI → events.setnayan_ai_active) stayed owned-but-dark — the couple
 * "had" the gift but the feature never turned on. This mirrors the vendor
 * self-comp path (createSelfCompOrder, fixed in #1999): for each gifted SKU on
 * each of the couple's events, create a ₱0 paid comp order + run the SKU's
 * activation hook. Non-fatal per SKU by contract — a hiccup never rolls back
 * the already-recorded grant.
 */

/** SN-prefixed reference code (mirrors orders/actions.ts generateReferenceCode). */
function genReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Event ids the user is a couple-member of — a gift applies to their wedding(s). */
export async function resolveCoupleEventIds(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  if (error || !data) return [];
  return Array.from(new Set(data.map((r) => r.event_id as string)));
}

/** One ₱0 paid comp order for (event, sku) + its activation hook. Non-fatal. */
async function fulfillOne(
  admin: SupabaseClient,
  args: { eventId: string; userId: string; serviceKey: string; grantId: string; actorUserId: string },
): Promise<void> {
  const { data, error } = await admin
    .from('orders')
    .insert({
      event_id: args.eventId,
      user_id: args.userId,
      service_key: args.serviceKey,
      description: `Setnayan Team gift — ${args.serviceKey}`,
      requested_total_php: 0,
      confirmed_total_php: 0,
      reference_code: genReferenceCode(),
      status: 'paid',
      comp_grant_id: args.grantId,
    })
    .select('order_id')
    .single();
  if (error || !data) {
    console.error(
      `[comp-fulfillment] order insert failed (${args.serviceKey} · ${args.eventId}) — non-fatal:`,
      error?.message,
    );
    return;
  }
  // Stamps flag-backed entitlements (SETNAYAN_AI → events.setnayan_ai_active).
  // Idempotent + never-throws by contract.
  await activateOrderSku({
    admin,
    orderId: data.order_id as string,
    eventId: args.eventId,
    serviceKey: args.serviceKey,
    actorUserId: args.actorUserId,
  });
}

export type FulfillResult = { eventCount: number; serviceKeys: string[]; titles: string[] };

/**
 * Fulfill an admin comp grant so the gifted feature(s) ACTUALLY unlock. Returns
 * the gifted feature titles (for the "early wedding gift" notification) +
 * how many of the couple's events were provisioned.
 */
export async function fulfillCompGrant(
  admin: SupabaseClient,
  args: {
    grantId: string;
    targetUserId: string;
    scope: 'all_services' | 'specific_skus';
    scopedSkus: string[] | null;
    actorUserId: string;
  },
): Promise<FulfillResult> {
  const eventIds = await resolveCoupleEventIds(admin, args.targetUserId);
  if (eventIds.length === 0) return { eventCount: 0, serviceKeys: [], titles: [] };

  // Catalog gives the all_services SKU set + the code→title map for the notice.
  const catalog = await fetchV2CustomerCatalog().catch(() => []);
  const titleByCode = new Map(catalog.map((s) => [s.service_code, s.title] as const));

  const serviceKeys =
    args.scope === 'specific_skus'
      ? args.scopedSkus ?? []
      : catalog.map((s) => s.service_code);
  if (serviceKeys.length === 0) return { eventCount: eventIds.length, serviceKeys: [], titles: [] };

  for (const eventId of eventIds) {
    for (const serviceKey of serviceKeys) {
      try {
        await fulfillOne(admin, {
          eventId,
          userId: args.targetUserId,
          serviceKey,
          grantId: args.grantId,
          actorUserId: args.actorUserId,
        });
      } catch (e) {
        console.error(`[comp-fulfillment] fulfill threw (${serviceKey}) — non-fatal:`, e);
      }
    }
  }

  const titles = serviceKeys.map((k) => titleByCode.get(k) ?? k);
  return { eventCount: eventIds.length, serviceKeys, titles };
}

/** Warm one-line body for the "early wedding gift" notification. */
export function giftNotificationBody(
  scope: 'all_services' | 'specific_skus',
  titles: string[],
): string {
  if (scope === 'all_services') {
    return 'You’ve unlocked full access to every Setnayan service — our gift for your wedding.';
  }
  if (titles.length === 1) {
    return `You’ve unlocked ${titles[0]} free — yours through the wedding.`;
  }
  const shown = titles.slice(0, 3).join(', ');
  const more = titles.length > 3 ? `, and ${titles.length - 3} more` : '';
  return `You’ve unlocked ${shown}${more} free — our gift for your wedding.`;
}
