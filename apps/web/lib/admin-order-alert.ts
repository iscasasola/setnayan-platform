/**
 * lib/admin-order-alert.ts — WHAT an admin payment alert says, as a pure
 * function of facts already read.
 *
 * Owner, 2026-09-30, holding the alert "Payment logged · ₱245 — confirm it":
 * *"i want the email to identify also the name of the host, event type, event
 * name, and the services availed when we receive an email"*. The old alert
 * named an amount and a bank, and nothing else — to find out WHO had paid, FOR
 * WHAT, the admin had to open the whole queue and search.
 *
 * Split from `order-admin-notify.ts` (which is `server-only` and does the
 * reads) so a test can render the real email from a fixture instead of
 * grepping for words: `admin-payment-alert-says-who.test.ts`.
 *
 * 🔑 AN UNREADABLE FACT IS SAID, NEVER DROPPED. Every fact below has a third
 * state beside "present" and "none": 'unreadable'. A host line that silently
 * vanished on a failed read would render identically to "no host", and an
 * alert that confirms money is the last place a missing name should look
 * like an intended one.
 *
 * 🔒 NO PERSONAL DATA IN THE LINK. The button opens the payments desk filtered
 * to this ORDER's public id — the only identifier in the URL. Names, emails
 * and references live in the body only.
 */

import { formatPhp } from '@/lib/php';

export type AlertPerson = { name: string; email: string | null };

export type AdminOrderAlertFacts = {
  /** The order's public id (S89O-…) — the one id the deep link carries. */
  orderPublicId: string;
  /** The code the buyer was given (e.g. SNM51BN2RX). */
  referenceCode: string;
  /** The event's host account(s); for an eventless order, its owner. */
  hosts: AlertPerson[] | 'unreadable';
  /**
   * Who logged the payment, ONLY when that is somebody other than a host — a
   * guest settling a Papic reload, a supplier paying on a celebration. Null
   * when the host logged it (the host line already names them).
   */
  paidBy: (AlertPerson & { guest: boolean }) | null;
  event: { name: string; typeLabel: string | null } | 'none' | 'unreadable';
  /** Every service on the bill, with the price charged for it. */
  lines: Array<{ label: string; pricePhp: number }> | 'unreadable';
  /** What the order is owed — the shortfall guard's own figure. */
  totalPhp: number;
  /** The payment row this alert is about. Null on an order-submitted alert with no proof yet. */
  payment: {
    amountPhp: number;
    channel: string;
    bankReference: string | null;
    loggedAtIso: string;
  } | null;
};

export type AdminOrderAlert = {
  /** In-app title, the email SUBJECT and the email heading — one string. */
  title: string;
  /** In-app body (one line). */
  body: string;
  paragraphs: string[];
  sections: Array<{
    title?: string;
    rows: Array<{ label: string; value: string; strong?: boolean }>;
  }>;
  ctaLabel: string;
  /** Relative deep link to this order on the payments desk. */
  relatedUrl: string;
};

/** Pesos and centavos, for the bill: "₱245.00". */
export function pesoExact(n: number): string {
  return (
    '₱' +
    n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

const CHANNEL_LABEL: Record<string, string> = {
  gcash: 'GCash',
  bdo: 'BDO',
  maya: 'Maya',
  bpi: 'BPI',
};

/** "gcash" → "GCash"; an unknown channel is shown as typed. */
export function channelLabel(channel: string): string {
  const raw = channel.trim();
  if (!raw) return 'a transfer';
  return CHANNEL_LABEL[raw.toLowerCase()] ?? raw;
}

/** "Sep 30, 2026, 3:04 PM (Manila)" — the desk works in Manila time. */
export function manilaTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d) + ' (Manila)'
  );
}

/**
 * The payments desk, filtered to THIS order — its confirm screen. `filter=all`
 * so the row is still there if a second admin confirmed it first.
 */
export function adminOrderDeepLink(orderPublicId: string): string {
  return `/admin/payments?filter=all&q=${encodeURIComponent(orderPublicId)}`;
}

const personLine = (p: AlertPerson): string => (p.email ? `${p.name} · ${p.email}` : p.name);

/** "Birthday Salubong ni Ate (Birthday)" — or null when there is no event. */
function eventPhrase(facts: AdminOrderAlertFacts): string | null {
  if (facts.event === 'none' || facts.event === 'unreadable') return null;
  return facts.event.typeLabel
    ? `${facts.event.name} (${facts.event.typeLabel})`
    : facts.event.name;
}

/** Who the alert is about, in one short phrase for a subject line. */
function whoPhrase(facts: AdminOrderAlertFacts): string {
  const ev = eventPhrase(facts);
  if (ev) return ev;
  if (Array.isArray(facts.hosts) && facts.hosts[0]) return facts.hosts[0].name;
  if (facts.paidBy) return facts.paidBy.name;
  return facts.referenceCode;
}

function sectionsFor(facts: AdminOrderAlertFacts): AdminOrderAlert['sections'] {
  // ── who and which event ──
  const who: Array<{ label: string; value: string }> = [];
  if (facts.hosts === 'unreadable') {
    who.push({ label: 'Host', value: 'Could not read — open the order' });
  } else if (facts.hosts.length === 0) {
    who.push({ label: 'Host', value: 'No host account on this order' });
  } else {
    const hosts = facts.hosts;
    hosts.forEach((h, i) =>
      who.push({ label: hosts.length > 1 ? `Host ${i + 1}` : 'Host', value: personLine(h) }),
    );
  }
  if (facts.paidBy) {
    who.push({
      label: 'Paid by',
      value: facts.paidBy.guest
        ? `${facts.paidBy.name} · guest, no Setnayan account`
        : personLine(facts.paidBy),
    });
  }
  if (facts.event === 'unreadable') {
    who.push({ label: 'Event', value: 'Could not read — open the order' });
  } else if (facts.event === 'none') {
    who.push({ label: 'Event', value: 'Not tied to an event — an account-level purchase' });
  } else {
    who.push({ label: 'Event', value: facts.event.name });
    who.push({ label: 'Event type', value: facts.event.typeLabel ?? 'Not set' });
  }

  // ── the bill ──
  const bill: Array<{ label: string; value: string; strong?: boolean }> =
    facts.lines === 'unreadable'
      ? [{ label: 'Services', value: 'Could not read the lines — open the order' }]
      : facts.lines.map((l) => ({ label: l.label, value: pesoExact(l.pricePhp) }));
  bill.push({ label: 'Total', value: pesoExact(facts.totalPhp), strong: true });

  // ── the payment ──
  const pay: Array<{ label: string; value: string; strong?: boolean }> = [];
  if (facts.payment) {
    pay.push({ label: 'Amount logged', value: pesoExact(facts.payment.amountPhp), strong: true });
    pay.push({ label: 'Method', value: channelLabel(facts.payment.channel) });
  }
  pay.push({ label: 'Reference', value: facts.referenceCode });
  if (facts.payment?.bankReference) {
    pay.push({ label: 'Bank reference', value: facts.payment.bankReference });
  }
  if (facts.payment) pay.push({ label: 'Logged', value: manilaTime(facts.payment.loggedAtIso) });
  pay.push({ label: 'Order', value: facts.orderPublicId });

  return [
    { title: 'Who', rows: who },
    { title: 'Services availed', rows: bill },
    { title: 'Payment', rows: pay },
  ];
}

/** "A customer says they have paid…" — now with a name and an event. */
export function buildPaymentLoggedAlert(facts: AdminOrderAlertFacts): AdminOrderAlert {
  const amount = facts.payment?.amountPhp ?? facts.totalPhp;
  const how = channelLabel(facts.payment?.channel ?? '');
  const who = whoPhrase(facts);
  const payer =
    facts.paidBy?.name ??
    (Array.isArray(facts.hosts) && facts.hosts[0] ? facts.hosts[0].name : 'A customer');
  const ev = eventPhrase(facts);
  const title = `Payment logged · ${formatPhp(amount)} · ${who} — confirm it`;
  return {
    title,
    body: `${payer} says they have paid ${formatPhp(amount)} via ${how}${
      ev ? ` for ${ev}` : ''
    }. Ref ${facts.referenceCode}. Check it against the account and confirm.`,
    paragraphs: [
      `${payer} says they have paid ${pesoExact(amount)} via ${how}${
        ev ? ` for ${ev}` : ''
      } and is waiting for it to be switched on.`,
      'Check it against the account and confirm.',
    ],
    sections: sectionsFor(facts),
    ctaLabel: 'Confirm this payment',
    relatedUrl: adminOrderDeepLink(facts.orderPublicId),
  };
}

/** The earlier alert — an order submitted, awaiting reconciliation. */
export function buildOrderSubmittedAlert(
  facts: AdminOrderAlertFacts,
  description: string,
): AdminOrderAlert {
  const amount = facts.totalPhp;
  const who = whoPhrase(facts);
  const label = description.trim().slice(0, 80) || 'A new order';
  const title = `New order awaiting reconciliation · ${formatPhp(amount)} · ${who}`;
  return {
    title,
    body: `${label} — ${formatPhp(amount)} is awaiting payment confirmation. Reconcile once it lands. Ref ${facts.referenceCode}.`,
    paragraphs: [
      `${label} — ${pesoExact(amount)} is awaiting payment confirmation.`,
      'Reconcile once it lands.',
    ],
    sections: sectionsFor(facts),
    ctaLabel: 'Open this order',
    relatedUrl: adminOrderDeepLink(facts.orderPublicId),
  };
}
