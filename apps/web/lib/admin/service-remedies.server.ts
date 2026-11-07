import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { emitNotification } from '@/lib/notification-emit';
import { orderNoticeLinkForRow } from '@/lib/pay-back-link';
import { activateOrderSku, rederiveStoredEventFlags } from '@/lib/sku-activation';
import {
  SERVICES_SET_UP_ON_THE_EVENT,
  creditsNotice,
  movedNotice,
  packLine,
  remedyRefusalCopy,
} from '@/lib/admin/service-remedies';

/**
 * The I/O half of `lib/admin/service-remedies.ts` — called from Admin › Payments
 * (`refundOrder`'s `intent` branches; the server-action budget is at its
 * ceiling, and these sit beside the refund tool on the same row).
 *
 * Each function returns the sentence for the admin; it never throws for a
 * refusal. The SQL function does the work in one transaction and decides
 * "already done" (a double click) — this layer only adds what must happen
 * AFTER a real, first application: the audit row, the couple's in-app notice,
 * and the stored per-event flags (switched off on the old event; for a move,
 * switched on at the new one).
 *
 * ⚖ The credit figure is never typed and never computed here: the SQL function
 * `orders_papic_credit_value` is its one home (owner 2026-11-05: what they paid,
 * at the best-value Papic pack on sale).
 */

export type RemedyOutcome = { ok: boolean; message: string };

type OrderRow = {
  order_id: string;
  public_id: string;
  user_id: string | null;
  event_id: string | null;
  vendor_profile_id: string | null;
  service_key: string | null;
};

type RpcResult = {
  ok?: boolean;
  applied?: boolean;
  refusal?: string;
  remedy_id?: string;
  grant_id?: string;
  credits?: number;
  event_id?: string;
  from_event_id?: string;
  to_event_id?: string;
  grants_moved?: number;
  paid_php?: number | string;
  status_before?: string;
};

const MIN_REASON = 20;

async function readOrder(admin: SupabaseClient, orderId: string): Promise<OrderRow | null> {
  const { data, error } = await admin
    .from('orders')
    .select('order_id, public_id, user_id, event_id, vendor_profile_id, service_key')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Could not read the order: ${error.message}`);
  return (data as OrderRow | null) ?? null;
}

async function audit(
  admin: SupabaseClient,
  row: { action: string; orderId: string; adminUserId: string; metadata: Record<string, unknown> },
): Promise<void> {
  // Best-effort, like refundOrder's: the ledger row in `order_service_remedies`
  // is the load-bearing record; this is the cross-surface stream.
  try {
    const { error } = await admin.from('admin_audit_log').insert({
      action: row.action,
      target_id: row.orderId,
      target_table: 'orders',
      actor_user_id: row.adminUserId,
      metadata: row.metadata,
    });
    if (error) console.error('[service-remedies] admin_audit_log insert refused (non-fatal):', error);
  } catch (e) {
    console.error(`[service-remedies] admin_audit_log insert failed (non-fatal):`, e);
  }
}

// ── Convert to Papic credits ────────────────────────────────────────────────

export async function convertOrderToPapicCredits(
  admin: SupabaseClient,
  args: { adminUserId: string; orderId: string; expectedCreditsRaw: unknown; reason: string | null },
): Promise<RemedyOutcome> {
  const reason = (args.reason ?? '').trim();
  if (reason.length < MIN_REASON) return { ok: false, message: remedyRefusalCopy('short_reason') };
  // The figure the admin's page SHOWED. The SQL recomputes it and refuses if the
  // two differ, so nothing is granted that nobody looked at.
  const expected =
    typeof args.expectedCreditsRaw === 'string' && /^\d{1,9}$/.test(args.expectedCreditsRaw.trim())
      ? Number(args.expectedCreditsRaw.trim())
      : null;
  if (expected === null) return { ok: false, message: remedyRefusalCopy('prices_changed') };

  const order = await readOrder(admin, args.orderId);
  if (!order) return { ok: false, message: remedyRefusalCopy('not_found') };
  if (order.service_key && SERVICES_SET_UP_ON_THE_EVENT.has(order.service_key)) {
    return { ok: false, message: remedyRefusalCopy('set_up_on_the_event') };
  }

  const { data, error } = await admin.rpc('admin_convert_order_to_papic_credits', {
    p_order_id: args.orderId,
    p_expected_credits: expected,
    p_reason: reason,
    p_admin_user_id: args.adminUserId,
  });
  if (error) throw new Error(`Convert to Papic credits failed: ${error.message}`);
  const r = (data ?? {}) as RpcResult;
  if (r.ok !== true) return { ok: false, message: remedyRefusalCopy(r.refusal) };

  if (r.applied !== true) {
    // A second press, or a stale page: the first one already did it. No second notice.
    return {
      ok: true,
      message: `Order ${order.public_id} was already converted to ${Number(r.credits ?? 0).toLocaleString('en-PH')} Papic credits.`,
    };
  }
  const credits = Number(r.credits ?? 0);

  // "Switch it off" (owner 2026-11-05): the order is now 'lapsed', so every
  // orders-backed gate already reads it as not owned. The one stored per-event
  // flag (Setnayan AI) is re-derived here.
  if (order.event_id) {
    await rederiveStoredEventFlags({
      admin,
      orderId: args.orderId,
      eventId: order.event_id,
      serviceKey: order.service_key ?? '',
      actorUserId: args.adminUserId,
    });
  }

  await audit(admin, {
    action: 'convert_order_to_papic_credits',
    orderId: args.orderId,
    adminUserId: args.adminUserId,
    metadata: {
      order_public_id: order.public_id,
      remedy_id: r.remedy_id ?? null,
      grant_id: r.grant_id ?? null,
      event_id: r.event_id ?? null,
      papic_credits: credits,
      paid_php: r.paid_php ?? null,
      before: { status: r.status_before ?? null },
      after: { status: 'lapsed' },
      reason,
    },
  });

  if (order.user_id) {
    const n = creditsNotice(order.public_id, credits);
    await emitNotification({
      userId: order.user_id,
      type: 'service_became_credits',
      title: n.title,
      body: n.body,
      relatedUrl: orderNoticeLinkForRow(order, args.orderId, order.user_id),
    });
  }

  return {
    ok: true,
    message: `${credits.toLocaleString('en-PH')} Papic credits added to the event for order ${order.public_id}, and the service is switched off. The couple was told in the app.`,
  };
}

// ── Move to the couple's next event ─────────────────────────────────────────

export async function moveOrderToNextEvent(
  admin: SupabaseClient,
  args: { adminUserId: string; orderId: string; toEventId: string | null; reason: string | null },
): Promise<RemedyOutcome> {
  const reason = (args.reason ?? '').trim();
  if (reason.length < MIN_REASON) return { ok: false, message: remedyRefusalCopy('short_reason') };
  if (!args.toEventId) return { ok: false, message: remedyRefusalCopy('no_target') };

  const order = await readOrder(admin, args.orderId);
  if (!order) return { ok: false, message: remedyRefusalCopy('not_found') };
  if (order.service_key && SERVICES_SET_UP_ON_THE_EVENT.has(order.service_key)) {
    return { ok: false, message: remedyRefusalCopy('set_up_on_the_event') };
  }

  const { data, error } = await admin.rpc('admin_move_order_to_next_event', {
    p_order_id: args.orderId,
    p_to_event_id: args.toEventId,
    p_reason: reason,
    p_admin_user_id: args.adminUserId,
  });
  if (error) throw new Error(`Move to next event failed: ${error.message}`);
  const r = (data ?? {}) as RpcResult;
  if (r.ok !== true) return { ok: false, message: remedyRefusalCopy(r.refusal) };
  if (r.applied !== true) {
    return { ok: true, message: `Order ${order.public_id} is already on their next event.` };
  }

  const fromEventId = r.from_event_id ?? order.event_id;
  const toEventId = r.to_event_id ?? args.toEventId;
  const serviceKey = order.service_key ?? '';

  // Switch it on where it now lives. Every hook is idempotent and non-fatal; a
  // Papic pack's credits already moved inside the SQL, so its hook finds them and
  // grants nothing twice.
  await activateOrderSku({ admin, orderId: args.orderId, eventId: toEventId, serviceKey, actorUserId: args.adminUserId });
  // …and off where it was, for the one stored per-event flag (Setnayan AI). Every
  // orders-backed service already follows `orders.event_id`.
  if (fromEventId) {
    await rederiveStoredEventFlags({
      admin,
      orderId: args.orderId,
      eventId: fromEventId,
      serviceKey,
      actorUserId: args.adminUserId,
    });
  }

  // Only for the words: a refused read names "your next event" instead.
  const { data: toEvent, error: toEventErr } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', toEventId)
    .maybeSingle();
  if (toEventErr) console.error('[service-remedies] next-event name read refused:', toEventErr);
  const toName = (toEvent as { display_name?: string | null } | null)?.display_name ?? null;

  await audit(admin, {
    action: 'move_order_to_next_event',
    orderId: args.orderId,
    adminUserId: args.adminUserId,
    metadata: {
      order_public_id: order.public_id,
      remedy_id: r.remedy_id ?? null,
      before: { event_id: fromEventId },
      after: { event_id: toEventId },
      papic_grants_moved: r.grants_moved ?? 0,
      paid_php: r.paid_php ?? null,
      reason,
    },
  });

  if (order.user_id) {
    const n = movedNotice(order.public_id, toName);
    await emitNotification({
      userId: order.user_id,
      type: 'service_moved_to_event',
      title: n.title,
      body: n.body,
      relatedUrl: orderNoticeLinkForRow({ ...order, event_id: toEventId }, args.orderId, order.user_id),
    });
  }

  return {
    ok: true,
    message: `Order ${order.public_id} moved to ${toName ? `“${toName}”` : 'their next event'}. The couple was told in the app.`,
  };
}

// ── What the desk shows on each paid order row ──────────────────────────────

export type RemedyDone = {
  kind: 'papic_credits' | 'next_event';
  createdAt: string;
  credits: number | null;
  fromEventName: string | null;
  toEventName: string | null;
  reason: string;
};

export type RemedyDeskRow = {
  done: RemedyDone[];
  converted: boolean;
  nextEvent: { id: string; name: string | null } | null;
  paidPhp: number;
  /** What converting would grant now, or null when no Papic pack is on sale. */
  credits: number | null;
  /** The pack it is priced at, "₱999 = 3,000 credits". */
  pack: string | null;
};

export type RemedyDesk = {
  byOrderId: Map<string, RemedyDeskRow>;
  /** A read was refused: the forms are hidden and the desk says so, never an empty "nothing done". */
  failed: boolean;
};

/**
 * ONE batched read for every paid order on the page. A refused read sets
 * `failed` — the desk then says so instead of offering a convert button on an
 * order whose earlier conversion it could not see.
 */
export async function readRemedyDesk(admin: SupabaseClient, orderIds: readonly string[]): Promise<RemedyDesk> {
  const ids = [...new Set(orderIds)];
  const empty: RemedyDesk = { byOrderId: new Map(), failed: false };
  if (ids.length === 0) return empty;

  const [done, next, value] = await Promise.all([
    admin
      .from('order_service_remedies')
      .select('order_id, kind, created_at, papic_credits, from_event_id, to_event_id, reason')
      .in('order_id', ids)
      .order('created_at', { ascending: true }),
    admin.rpc('orders_next_event', { p_order_ids: ids }),
    // The SAME function the conversion grants from — the figure shown is the figure granted.
    admin.rpc('orders_papic_credit_value', { p_order_ids: ids }),
  ]);
  if (done.error || next.error || value.error) {
    console.error('[service-remedies] desk read refused:', done.error ?? next.error ?? value.error);
    return { ...empty, failed: true };
  }

  type DoneRow = {
    order_id: string;
    kind: 'papic_credits' | 'next_event';
    created_at: string;
    papic_credits: number | null;
    from_event_id: string | null;
    to_event_id: string | null;
    reason: string;
  };
  const doneRows = (done.data ?? []) as DoneRow[];

  // Event names for the history lines.
  const eventIds = [
    ...new Set(doneRows.flatMap((r) => [r.from_event_id, r.to_event_id]).filter((x): x is string => !!x)),
  ];
  const names = new Map<string, string | null>();
  if (eventIds.length > 0) {
    const { data: evs, error: evErr } = await admin.from('events').select('event_id, display_name').in('event_id', eventIds);
    // Names are only words on the history line; a refused read shows "an earlier event", never hides the history.
    if (evErr) console.error('[service-remedies] event names read refused:', evErr);
    for (const e of (evs ?? []) as Array<{ event_id: string; display_name: string | null }>) {
      names.set(e.event_id, e.display_name);
    }
  }

  type ValueRow = {
    order_id: string;
    paid_php: number | string | null;
    credits: number | null;
    pack_credits: number | null;
    pack_price_php: number | string | null;
  };
  const valueBy = new Map<string, ValueRow>();
  for (const v of (value.data ?? []) as ValueRow[]) valueBy.set(v.order_id, v);

  const byOrderId = new Map<string, RemedyDeskRow>();
  for (const id of ids) {
    const v = valueBy.get(id);
    byOrderId.set(id, {
      done: [],
      converted: false,
      nextEvent: null,
      paidPhp: Number(v?.paid_php ?? 0),
      credits: typeof v?.credits === 'number' ? v.credits : null,
      pack: packLine(v?.pack_credits ?? null, v?.pack_price_php == null ? null : Number(v.pack_price_php)),
    });
  }
  for (const r of doneRows) {
    const row = byOrderId.get(r.order_id);
    if (!row) continue;
    row.done.push({
      kind: r.kind,
      createdAt: r.created_at,
      credits: r.papic_credits,
      fromEventName: r.from_event_id ? (names.get(r.from_event_id) ?? null) : null,
      toEventName: r.to_event_id ? (names.get(r.to_event_id) ?? null) : null,
      reason: r.reason,
    });
    if (r.kind === 'papic_credits') row.converted = true;
  }
  for (const n of (next.data ?? []) as Array<{ order_id: string; next_event_id: string | null; next_event_name: string | null }>) {
    const row = byOrderId.get(n.order_id);
    if (row && n.next_event_id) row.nextEvent = { id: n.next_event_id, name: n.next_event_name };
  }

  return { byOrderId, failed: false };
}
