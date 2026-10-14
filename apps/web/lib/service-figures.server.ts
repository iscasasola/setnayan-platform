import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';
import type { ServiceOwnership } from '@/lib/services-glance';

/**
 * What `event_service_figures` answers (migration 20271269705444) — every figure
 * the services' Home rows and page bands say, in ONE request (owner "approve
 * all", 2026-10-14; least requests, 2026-10-08).
 */
export type ServiceFigures = {
  suppliers: number;
  cameras: number;
  live: boolean;
  live_since: string | null;
  recorded: boolean;
  recorded_minutes: number | null;
  reels: number;
  prices: Record<string, number | string>;
};

/** The catalog price of one code from the figures — null when off sale or unread. */
export function figurePrice(f: ServiceFigures | null, code: string): number | null {
  const v = f?.prices?.[code];
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Ask once, through the viewer's own session. The function answers only the
 * couple or a coordinator (anyone else gets NULL); a refusal or a throw is null
 * here, and every row then says "—", never 0.
 */
export async function readServiceFigures(eventId: string): Promise<ServiceFigures | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('event_service_figures', { p_event_id: eventId });
    if (error) {
      logQueryError('serviceFigures', error, { event_id: eventId }, 'graceful_degrade');
      return null;
    }
    return (data ?? null) as ServiceFigures | null;
  } catch {
    return null;
  }
}

/**
 * Who holds a service — the gates' own answers: unlocked (`eventSkuActive`),
 * bought and waiting for approval (`eventOwnsSku` only), or not added. In a
 * render both ride the event's one orders read (`lib/request-once`). null =
 * the answer could not be read (the row says "—").
 */
export async function serviceOwnership(
  eventId: string,
  sku: string,
  /**
   * The client to ask with. Home passes its service-role client (the caller is
   * already a member — `notFound()` refused anyone else): its answers then share
   * the render's one orders read with every other service-role asker, and the
   * membership look-up `eventEntitlementClient` makes is not repeated.
   */
  client?: SupabaseClient,
): Promise<ServiceOwnership | null> {
  try {
    const ent = client ?? (await eventEntitlementClient(eventId));
    const [active, owns] = await Promise.all([eventSkuActive(ent, eventId, sku), eventOwnsSku(ent, eventId, sku)]);
    return active ? 'on' : owns ? 'waiting' : 'none';
  } catch {
    return null;
  }
}
