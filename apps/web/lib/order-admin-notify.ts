import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { composeFormalName } from '@/lib/formal-name';
import { ONBOARDING_SERVICES_SKU, readOnboardingOrderItems } from '@/lib/onboarding-order-items';
import { isVatInclusiveServiceKey, orderGrossOwed } from '@/lib/orders';
import { fetchPlatformSettings, getEffectiveVatRatePct } from '@/lib/platform-settings';
import { channelLabel as accountName } from '@/lib/payment-channels';
import {
  buildOrderSubmittedAlert,
  buildPaymentLoggedAlert,
  type AdminOrderAlert,
  type AdminOrderAlertFacts,
  type AlertPerson,
} from '@/lib/admin-order-alert';

/**
 * Notification Foundation · Phase B (2026-06-19) — admin-side ORDER confirmation.
 *
 * When a couple submits an order (apply-then-pay), the row lands in the
 * /admin/payments reconciliation queue but, until now, no admin was notified —
 * the queue only refreshed if an admin happened to be looking at it. This
 * fans out an in-app notification to every admin/internal/team user so the
 * 24-hr reconciliation SLA actually starts on submit, not on the next time
 * someone opens the queue.
 *
 * Mirrors lib/subscription-purchase-notify.ts (notifyAdminsSubscriptionPending):
 * the same admin OR-filter (is_internal / is_team_member / account_type='admin')
 * and the same fail-soft try/catch. Uses its OWN type
 * `order_awaiting_reconciliation` (added 2026-06-24) — NOT the borrowed
 * `vendor_token_purchase_pending`. The tray renders the TYPE as its badge, so
 * the old reuse made a couple's PHP order read "TOKEN PURCHASE AWAITING
 * PAYMENT" (wrong — the customer token wallet is retired; couples pay PHP
 * direct). The dedicated type renders "Awaiting reconciliation". Deep-link
 * points at /admin/payments FILTERED TO THIS ORDER (adminOrderDeepLink).
 *
 * 🔑 BOTH ALERTS SAY WHO, WHICH EVENT AND WHAT (owner 2026-09-30: *"identify
 * also the name of the host, event type, event name, and the services
 * availed"*). The facts are read once by `readAdminOrderAlertFacts` below and
 * worded by the pure `lib/admin-order-alert.ts`, which
 * `admin-payment-alert-says-who.test.ts` renders into a real email.
 *
 * Best-effort: a failed notification never rolls back the order. We log and
 * continue.
 */

const peso = (n: number) =>
  '₱' + new Intl.NumberFormat('en-PH').format(Math.round(n));

export async function notifyAdminsOrderAwaitingReconciliation(args: {
  orderId: string;
  description: string;
  amountPhp: number;
  referenceCode: string;
}): Promise<void> {
  const { orderId, description, amountPhp, referenceCode } = args;
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    if (!admins?.length) return;

    // Who, which event, what was bought — read once, sent to every admin.
    const facts = await readAdminOrderAlertFacts(admin, orderId).catch((err: unknown) => {
      // A details read that THROWS must not cost the alert itself.
      console.error('[orders] alert: details read threw:', err);
      return null;
    });
    const alert: AdminOrderAlert | null = facts
      ? buildOrderSubmittedAlert({ ...facts, totalPhp: facts.totalPhp || amountPhp }, description)
      : null;
    const label = description.trim().slice(0, 80) || 'A new order';

    await Promise.all(
      admins.map((row) =>
        emitNotification({
          userId: row.user_id as string,
          type: 'order_awaiting_reconciliation',
          title: alert?.title ?? `New order awaiting reconciliation · ${peso(amountPhp)}`,
          body:
            alert?.body ??
            `${label} — ${peso(
              amountPhp,
            )} is awaiting payment confirmation. Reconcile once it lands. Ref ${referenceCode}. (Could not read the order's details — open the desk.)`,
          relatedUrl: alert?.relatedUrl ?? '/admin/payments',
          email: alert
            ? {
                paragraphs: alert.paragraphs,
                sections: alert.sections,
                ctaLabel: alert.ctaLabel,
                audience: 'admin',
              }
            : { audience: 'admin' },
        }),
      ),
    );
  } catch (e) {
    console.error('[orders] admin awaiting-reconciliation notify failed:', e);
    void orderId;
  }
}

/**
 * The SECOND event, and the one that matters more.
 *
 * `notifyAdminsOrderAwaitingReconciliation` above fires when a couple SUBMITS
 * an order — before any money exists. This one fires when they come back and
 * say "I have paid, here is the proof", which is the moment real pesos have
 * left a real bank account and somebody is waiting for their purchase to switch
 * on. Until now that step notified NOBODY: `logPayment` wrote the row,
 * revalidated, and redirected.
 *
 * 🔑 THE DAILY OPS DIGEST IS NOT THIS. The digest is a next-morning summary of
 * what is waiting, and it only sends when a queue is non-empty and only around
 * 08:00 Manila. For "your customer has paid and is waiting", tomorrow is the
 * wrong answer. The digest is the safety net UNDER this notification, not a
 * substitute for it.
 *
 * Best-effort, exactly like its sibling: a failed notification must never roll
 * back a recorded payment.
 */
export async function notifyAdminsPaymentProofSubmitted(args: {
  orderId: string;
  eventId: string;
  amountPhp: number;
  channel: string;
}): Promise<void> {
  const { orderId, eventId, amountPhp, channel } = args;
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    if (!admins?.length) return;

    // The account's NAME from the receiving-accounts list — `channel` is an id
    // ("maribank-7k2q") and an admin's inbox must never read one. A refused
    // settings read falls back to the id, which `channelLabel` still tidies.
    const channelName = await fetchPlatformSettings(admin)
      .then((s) => accountName(s, channel.trim() || null))
      .catch(() => null);
    const how = (channelName && channelName !== '—' ? channelName : channel.trim()).slice(0, 40) || 'a transfer';

    // Owner 2026-09-30: the alert must say WHO paid, for WHICH event, for WHAT.
    // Read once with the admin client, then sent to every admin. A failed read
    // still sends — the old one-line alert, saying it could not read the rest.
    const facts = await readAdminOrderAlertFacts(admin, orderId).catch((err: unknown) => {
      // A details read that THROWS must not cost the alert itself.
      console.error('[orders] alert: details read threw:', err);
      return null;
    });
    const alert: AdminOrderAlert | null = facts
      ? buildPaymentLoggedAlert({
          ...facts,
          // The caller's own figures are the truth for the amount and method —
          // they are what was just written.
          payment: {
            amountPhp,
            channel,
            channelName: channelName && channelName !== '—' ? channelName : null,
            bankReference: facts.payment?.bankReference ?? null,
            loggedAtIso: facts.payment?.loggedAtIso ?? new Date().toISOString(),
          },
        })
      : null;

    await Promise.all(
      admins.map((row) =>
        emitNotification({
          userId: row.user_id as string,
          type: 'order_awaiting_reconciliation',
          title: alert?.title ?? `Payment logged · ${peso(amountPhp)} — confirm it`,
          body:
            alert?.body ??
            `A customer says they have paid ${peso(
              amountPhp,
            )} via ${how} and is waiting for it to be switched on. Check it against the account and confirm. (Could not read the order's details — open the desk.)`,
          relatedUrl: alert?.relatedUrl ?? '/admin/payments',
          email: alert
            ? {
                paragraphs: alert.paragraphs,
                sections: alert.sections,
                ctaLabel: alert.ctaLabel,
                audience: 'admin',
              }
            : { audience: 'admin' },
        }),
      ),
    );
  } catch (e) {
    console.error('[orders] payment-proof notify failed:', e);
    void orderId;
    void eventId;
  }
}

// ─── the facts, read once per alert ─────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

type UserNameRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  name_prefix: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  name_suffix: string | null;
};

const USER_NAME_COLUMNS =
  'user_id, email, display_name, name_prefix, first_name, middle_name, last_name, name_suffix';

/** The formal name ("Mr. Indalecio S. Casasola II" style), else nickname, else email. */
function personFrom(u: UserNameRow): AlertPerson {
  const name = composeFormalName(u) || (u.display_name ?? '').trim() || u.email || 'Unnamed account';
  return { name, email: u.email };
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Everything the alert names, read with the ADMIN client (the buyer's own
 * session is not the reader here — this runs for the team). Null only when the
 * ORDER itself cannot be read; every other failure is carried as
 * 'unreadable' so the email SAYS it could not read a fact instead of dropping
 * the line.
 */
async function readAdminOrderAlertFacts(
  admin: AdminClient,
  orderId: string,
): Promise<AdminOrderAlertFacts | null> {
  if (!orderId) return null;
  const { data: orderRow, error: orderErr } = await admin
    .from('orders')
    .select(
      'order_id, public_id, reference_code, description, service_key, requested_total_php, confirmed_total_php, voucher_discount_centavos, user_id, event_id',
    )
    .eq('order_id', orderId)
    .maybeSingle();
  if (orderErr || !orderRow) {
    if (orderErr) console.error('[orders] alert: order read failed:', orderErr.message);
    return null;
  }
  const order = orderRow as {
    order_id: string;
    public_id: string;
    reference_code: string;
    description: string | null;
    service_key: string | null;
    requested_total_php: unknown;
    confirmed_total_php: unknown;
    voucher_discount_centavos: unknown;
    user_id: string | null;
    event_id: string | null;
  };

  // ── the newest payment on this order ──
  const { data: payRow } = await admin
    .from('payments')
    .select('amount_php, channel, reference_number, created_at, user_id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const pay = payRow as {
    amount_php: unknown;
    channel: string | null;
    reference_number: string | null;
    created_at: string;
    user_id: string | null;
  } | null;

  // The newest payment's rail, NAMED from the receiving-accounts list.
  const payChannelName: string | null = pay?.channel
    ? await fetchPlatformSettings(admin)
        .then((s) => accountName(s, pay.channel))
        .catch(() => null)
    : null;

  // ── the event, and its type's own label ──
  let event: AdminOrderAlertFacts['event'] = 'none';
  if (order.event_id) {
    const { data: ev, error: evErr } = await admin
      .from('events')
      .select('display_name, public_id, event_type')
      .eq('event_id', order.event_id)
      .maybeSingle();
    if (evErr || !ev) {
      if (evErr) console.error('[orders] alert: event read failed:', evErr.message);
      event = 'unreadable';
    } else {
      const e = ev as { display_name: string | null; public_id: string; event_type: string | null };
      let typeLabel: string | null = null;
      if (e.event_type) {
        const { data: vocab } = await admin
          .from('event_type_vocab')
          .select('label_en')
          .eq('event_type', e.event_type)
          .maybeSingle();
        typeLabel =
          ((vocab as { label_en?: string | null } | null)?.label_en ?? '').trim() ||
          e.event_type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
      event = { name: (e.display_name ?? '').trim() || e.public_id, typeLabel };
    }
  }

  // ── the host(s): the event's hosting accounts, or the order's owner ──
  let hosts: AdminOrderAlertFacts['hosts'] = [];
  let hostIds: string[] = [];
  if (order.event_id) {
    const { data: members, error: memErr } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', order.event_id)
      .eq('member_type', 'couple')
      .not('user_id', 'is', null)
      .limit(4);
    if (memErr) {
      console.error('[orders] alert: hosts read failed:', memErr.message);
      hosts = 'unreadable';
    } else {
      hostIds = [...new Set((members ?? []).map((m) => (m as { user_id: string }).user_id))];
    }
  } else if (order.user_id) {
    hostIds = [order.user_id];
  }
  const payerId = pay?.user_id ?? null;
  const wanted = [...new Set([...hostIds, ...(payerId ? [payerId] : [])])];
  const people = new Map<string, AlertPerson>();
  if (wanted.length > 0) {
    const { data: users, error: usersErr } = await admin
      .from('users')
      .select(USER_NAME_COLUMNS)
      .in('user_id', wanted);
    if (usersErr) {
      console.error('[orders] alert: names read failed:', usersErr.message);
      if (hostIds.length > 0) hosts = 'unreadable';
    } else {
      for (const u of (users ?? []) as UserNameRow[]) people.set(u.user_id, personFrom(u));
    }
  }
  if (hosts !== 'unreadable') {
    hosts = hostIds.map((id) => people.get(id)).filter((p): p is AlertPerson => !!p);
  }

  // ── who logged it, when that is not a host ──
  let paidBy: AdminOrderAlertFacts['paidBy'] = null;
  if (payerId && !hostIds.includes(payerId)) {
    const p = people.get(payerId);
    paidBy = p ? { ...p, guest: false } : null;
  } else if (pay && !payerId) {
    // A guest settling a Papic reload — no account, only the name they typed.
    const { data: guestOrder } = await admin
      .from('papic_guest_orders')
      .select('payer_name')
      .eq('order_id', orderId)
      .maybeSingle();
    const payerName = ((guestOrder as { payer_name?: string | null } | null)?.payer_name ?? '').trim();
    paidBy = { name: payerName || 'A guest (no name given)', email: null, guest: true };
  }

  // ── the bill: every service with the price charged, and the total owed ──
  let vatRatePct = 0;
  try {
    vatRatePct = await getEffectiveVatRatePct(admin);
  } catch {
    vatRatePct = 0;
  }
  const totalPhp = orderGrossOwed({
    requestedTotalPhp: num(order.requested_total_php),
    confirmedTotalPhp: order.confirmed_total_php == null ? null : num(order.confirmed_total_php),
    voucherDiscountPhp: num(order.voucher_discount_centavos) / 100,
    vatInclusive: isVatInclusiveServiceKey(order.service_key),
    vatRatePct,
  });

  let lines: AdminOrderAlertFacts['lines'];
  const codes: string[] = [];
  let basket: Awaited<ReturnType<typeof readOnboardingOrderItems>> = [];
  if (order.service_key === ONBOARDING_SERVICES_SKU) {
    basket = await readOnboardingOrderItems(admin, orderId);
    for (const i of basket) codes.push(i.serviceCode);
  } else if (order.service_key) {
    codes.push(order.service_key);
  }
  const titleFor = new Map<string, string>();
  if (codes.length > 0) {
    const { data: catalog } = await admin
      .from('platform_retail_catalog_v2')
      .select('service_code, title')
      .in('service_code', [...new Set(codes)]);
    for (const r of (catalog ?? []) as Array<{ service_code?: string; title?: string }>) {
      if (r.service_code && r.title?.trim()) titleFor.set(r.service_code, r.title.trim());
    }
  }
  if (order.service_key === ONBOARDING_SERVICES_SKU) {
    // An empty basket is a failed read or a broken order — either way, said.
    lines =
      basket.length === 0
        ? 'unreadable'
        : basket.map((i) => ({
            label:
              (titleFor.get(i.serviceCode) || i.serviceCode) +
              (i.quantity > 1 ? ` × ${i.quantity}` : ''),
            pricePhp: i.unitPricePhp * i.quantity,
          }));
  } else {
    // A single purchase: its own description is the most specific name it has
    // ("Papic — guest reload, 500 credits for one camera").
    const label =
      (order.description ?? '').trim() ||
      (order.service_key ? titleFor.get(order.service_key) || order.service_key : 'Order');
    lines = [{ label, pricePhp: totalPhp }];
  }

  return {
    orderPublicId: order.public_id,
    referenceCode: order.reference_code,
    hosts,
    paidBy,
    event,
    lines,
    totalPhp,
    payment: pay
      ? {
          amountPhp: num(pay.amount_php),
          channel: pay.channel ?? '',
          channelName: payChannelName,
          bankReference: (pay.reference_number ?? '').trim() || null,
          loggedAtIso: pay.created_at,
        }
      : null,
  };
}
