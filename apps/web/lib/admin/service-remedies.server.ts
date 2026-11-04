import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { emitNotification } from '@/lib/notification-emit';
import { orderNoticeLinkForRow } from '@/lib/pay-back-link';
import { fetchGiftLadder } from '@/lib/setnayan-gift.server';
import { activateOrderSku, rederiveEventFlagsAfterMove } from '@/lib/sku-activation';
import {
  SERVICES_THAT_CANNOT_MOVE,
  creditsNotice,
  maxCreditsForPaid,
  movedNotice,
  packsLine,
  parseCredits,
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
 * and (for a move) the activation on the new event.
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

/** Sum of MATCHED payments — the same figure the SQL function snapshots. */
async function paidCentavos(admin: SupabaseClient, orderId: string): Promise<number> {
  const { data, error } = await admin
    .from('payments')
    .select('amount_php')
    .eq('order_id', orderId)
    .eq('status', 'matched');
  if (error) throw new Error(`Could not read the payments: ${error.message}`);
  return (data ?? []).reduce(
    (sum, r) => sum + Math.round(Number((r as { amount_php?: unknown }).amount_php ?? 0) * 100),
    0,
  );
}

async function audit(
  admin: SupabaseClient,
  row: { action: string; orderId: string; adminUserId: string; metadata: Record<string, unknown> },
): Promise<void> {
  // Best-effort, like refundOrder's: the ledger row in `order_service_remedies`
  // is the load-bearing record; this is the cross-surface stream.
  try {
    await admin.from('admin_audit_log').insert({
      action: row.action,
      target_id: row.orderId,
      target_table: 'orders',
      actor_user_id: row.adminUserId,
      metadata: row.metadata,
    });
  } catch (e) {
    console.error(`[service-remedies] admin_audit_log insert failed (non-fatal):`, e);
  }
}

// ── Convert to Papic credits ────────────────────────────────────────────────

export async function convertOrderToPapicCredits(
  admin: SupabaseClient,
  args: { adminUserId: string; orderId: string; creditsRaw: unknown; reason: string | null },
): Promise<RemedyOutcome> {
  const credits = parseCredits(args.creditsRaw);
  if (credits === null) return { ok: false, message: remedyRefusalCopy('bad_credits') };
  const reason = (args.reason ?? '').trim();
  if (reason.length < MIN_REASON) return { ok: false, message: remedyRefusalCopy('short_reason') };

  const order = await readOrder(admin, args.orderId);
  if (!order) return { ok: false, message: remedyRefusalCopy('not_found') };

  // The bound: never more than what was paid buys at today's cheapest Papic
  // price. Read live; an unreadable catalogue refuses rather than accept any number.
  const [paid, ladder] = await Promise.all([paidCentavos(admin, args.orderId), fetchGiftLadder(admin)]);
  const bound = maxCreditsForPaid(paid, ladder);
  if (bound === null) return { ok: false, message: remedyRefusalCopy('no_prices') };
  if (paid > 0 && credits > bound) {
    return {
      ok: false,
      message: `${remedyRefusalCopy('over_bound')} The most is ${bound.toLocaleString('en-PH')}.`,
    };
  }

  const { data, error } = await admin.rpc('admin_convert_order_to_papic_credits', {
    p_order_id: args.orderId,
    p_credits: credits,
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
      bound_credits: bound,
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
    message: `${credits.toLocaleString('en-PH')} Papic credits added to the event for order ${order.public_id}. The couple was told in the app.`,
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
  if (order.service_key && SERVICES_THAT_CANNOT_MOVE.has(order.service_key)) {
    return { ok: false, message: remedyRefusalCopy('cannot_move_service') };
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
    await rederiveEventFlagsAfterMove({
      admin,
      orderId: args.orderId,
      eventId: fromEventId,
      serviceKey,
      actorUserId: args.adminUserId,
    });
  }

  const { data: toEvent } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', toEventId)
    .maybeSingle();
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
  paidCentavos: number;
  maxCredits: number | null;
};

export type RemedyDesk = {
  byOrderId: Map<string, RemedyDeskRow>;
  /** The live Papic packs, "₱99 = 150 · …", or null when unreadable. */
  packs: string | null;
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
  const empty: RemedyDesk = { byOrderId: new Map(), packs: null, failed: false };
  if (ids.length === 0) return empty;

  const [done, next, paid, ladder] = await Promise.all([
    admin
      .from('order_service_remedies')
      .select('order_id, kind, created_at, papic_credits, from_event_id, to_event_id, reason')
      .in('order_id', ids)
      .order('created_at', { ascending: true }),
    admin.rpc('orders_next_event', { p_order_ids: ids }),
    admin.from('payments').select('order_id, amount_php').in('order_id', ids).eq('status', 'matched'),
    fetchGiftLadder(admin),
  ]);
  if (done.error || next.error || paid.error) {
    console.error('[service-remedies] desk read refused:', done.error ?? next.error ?? paid.error);
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
    const { data: evs } = await admin.from('events').select('event_id, display_name').in('event_id', eventIds);
    for (const e of (evs ?? []) as Array<{ event_id: string; display_name: string | null }>) {
      names.set(e.event_id, e.display_name);
    }
  }

  const paidBy = new Map<string, number>();
  for (const p of (paid.data ?? []) as Array<{ order_id: string; amount_php: number | string }>) {
    paidBy.set(p.order_id, (paidBy.get(p.order_id) ?? 0) + Math.round(Number(p.amount_php) * 100));
  }

  const byOrderId = new Map<string, RemedyDeskRow>();
  for (const id of ids) {
    const cents = paidBy.get(id) ?? 0;
    byOrderId.set(id, {
      done: [],
      converted: false,
      nextEvent: null,
      paidCentavos: cents,
      maxCredits: maxCreditsForPaid(cents, ladder),
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

  return { byOrderId, packs: packsLine(ladder), failed: false };
}
