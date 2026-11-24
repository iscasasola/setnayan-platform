/**
 * 📶 THE SUPPLIER OFFLINE ENGINE — what a phone may queue, and every answer it can get back (owner 24 Nov 2026,
 * DECISION_LOG "The supplier dashboard works offline and catches up when back online").
 *
 * Pure (no I/O): read by the phone (the queue, `lib/offline/supplier-queue.ts`), by the server door
 * (`lib/supplier-offline/engine.server.ts`) and by the screens the drawing will add. The ruling, as types:
 *   · FIRST SAVE WINS — a stale or blocked write comes back as a typed clash `{why, by, at}`, never merged.
 *   · MONEY — the server recomputes every amount from live rows; if it differs from what the phone showed, nothing is
 *     applied and the answer is `needs_reconfirm {offline, live}`. A purchase is never charged from the queue.
 *   · GIFTS — given from the last known balance; the live balance decides at sync (`no_gifts_left`, never unpaid).
 *   · NOTHING FAILS SILENTLY — every final answer is kept on the phone until a person looks at it.
 *
 * Every queued action replays through the SHIPPED action for it (a stay door, the own-client action, the payment
 * confirm, the yes) — or, for the schedule, through `supplier_offline_schedule_write`, the one versioned door. The
 * engine adds only the checks the ruling names; it never re-implements an action.
 */
import { formatPhp } from '@/lib/php';
import type { VendorCapability } from '@/lib/vendor-duties';

/** How the server decides a queued action. */
export type OfflineRule =
  /** versioned schedule write — first save wins, expo holds, a full or closed day (`supplier_offline_schedule_write`) */
  | 'schedule'
  /** an amount re-read from live rows before the shipped action runs */
  | 'money'
  /** gifts from the live balance before the shipped action runs */
  | 'gift'
  /** the shipped action, once (the ledger answers a retry) */
  | 'plain'
  /** never from the queue: "Pay when online" */
  | 'purchase';

type KindRule = {
  rule: OfflineRule;
  /** The role gate (`lib/vendor-duties.ts`) — the same capability the online screen needs. */
  capability: VendorCapability;
  /** The shipped stay door the action replays through, when it has one (`lib/stay-doors.ts`). */
  door?: string;
};

/**
 * EVERY supplier action a phone may keep while offline. Anything else is refused before it is queued
 * (`isSupplierOfflineKind`) — and a purchase is listed only so it can be answered "Pay when online".
 */
export const SUPPLIER_OFFLINE_KINDS = {
  /* ── schedule (versioned, first save wins) ── */
  'schedule.client': { rule: 'schedule', capability: 'schedule' },
  'schedule.block': { rule: 'schedule', capability: 'schedule' },
  'schedule.edit': { rule: 'schedule', capability: 'schedule' },
  'schedule.remove': { rule: 'schedule', capability: 'schedule' },
  'schedule.day': { rule: 'schedule', capability: 'schedule' },
  /** the offline client QR's date — one code, one entry (`supplier_offline_code_use`) */
  'qr.booking': { rule: 'schedule', capability: 'schedule' },
  /* ── clients and leads ── */
  /** Add a client: the shipped `saveOwnClient`, its gift checked against the live stock first */
  'client.add': { rule: 'gift', capability: 'clients' },
  'lead.outcome': { rule: 'plain', capability: 'clients', door: 'svMessages.recordInquiryOutcome' },
  /* ── notes and message drafts ── */
  'note.add': { rule: 'plain', capability: 'clients', door: 'supClients.createClientNote' },
  'note.done': { rule: 'plain', capability: 'clients', door: 'supClients.toggleClientNoteDone' },
  'note.delete': { rule: 'plain', capability: 'clients', door: 'supClients.deleteClientNote' },
  /** a message written offline, sent through the shipped chat core (`sendChatMessageCore`) */
  'message.send': { rule: 'plain', capability: 'clients' },
  /* ── bookings and payment records (the server decides every amount) ── */
  'payment.ask': { rule: 'money', capability: 'clients', door: 'supClients.vendorAskForPayment' },
  'payment.ask_withdraw': { rule: 'plain', capability: 'clients', door: 'supClients.vendorWithdrawPaymentAsk' },
  /** confirm a payment the couple recorded (`confirmVendorPayment`) */
  'payment.confirm': { rule: 'money', capability: 'clients' },
  /** acknowledge the reservation fee (`vendorAcknowledgeDeposit`) */
  'deposit.ack': { rule: 'money', capability: 'clients' },
  /** the yes (`vendorAgreeToLock`) */
  'booking.accept': { rule: 'money', capability: 'clients' },
  /* ── never from the queue ── */
  purchase: { rule: 'purchase', capability: 'plan' },
} as const satisfies Record<string, KindRule>;

export type SupplierOfflineKind = keyof typeof SUPPLIER_OFFLINE_KINDS;

export function isSupplierOfflineKind(v: unknown): v is SupplierOfflineKind {
  return typeof v === 'string' && Object.hasOwn(SUPPLIER_OFFLINE_KINDS, v);
}

export function ruleOf(kind: SupplierOfflineKind): OfflineRule {
  return SUPPLIER_OFFLINE_KINDS[kind].rule;
}

/* ── what the phone saw ───────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The amounts the phone showed when the action was made (₱, as the booking's own columns hold them). The server
 * compares these with the live rows; any difference stops the write.
 */
export type MoneySeen = {
  /** the booking's total (`event_vendors.total_cost_php`, through `event_vendor_money_read`) */
  totalPhp: number | null;
  /** the reservation fee paid so far (`deposit_paid_php`) */
  depositPhp: number | null;
  /** one payment record's amount (`event_vendor_payments.amount_php`) — `payment.confirm` only */
  paymentPhp?: number | null;
};

/** The fields each money action is decided on. */
export function moneyFieldsOf(kind: SupplierOfflineKind): ReadonlyArray<keyof MoneySeen> {
  return kind === 'payment.confirm' ? ['paymentPhp'] : ['totalPhp', 'depositPhp'];
}

const amountOf = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** Did the live amounts move since the phone showed them? Missing what it showed counts as moved. */
export function moneyMoved(kind: SupplierOfflineKind, seen: MoneySeen | null | undefined, live: MoneySeen): boolean {
  if (!seen) return true;
  return moneyFieldsOf(kind).some((k) => amountOf(seen[k]) !== amountOf(live[k]));
}

/* ── one queued action ────────────────────────────────────────────────────────────────────────────────────────── */

/** One action kept on the phone. It never carries a price it would charge — only what it SHOWED (`seen`). */
export type SupplierQueuedItem = {
  v: 1;
  /** UUID the phone made; the server's idempotency key (`vendor_offline_writes.item_id`). */
  itemId: string;
  /** the shop (`vendor_profile_id`) it was made in */
  shop: string;
  /** the member (auth user id) who made it — only that account ever sends it */
  member: string;
  /** the phone's clock when it was made (ISO), shown as phone time; the server orders by its own clock */
  phoneTime: string;
  madeOffline: true;
  kind: SupplierOfflineKind;
  /** the version of the schedule item the edit was made against (0 = the phone saw none) */
  baseVersion?: number | null;
  /** the amounts the phone showed (money kinds) */
  seen?: MoneySeen | null;
  /** "8 gifts left · as of 2:14 pm" — when the gift balance the phone gave from was read (ISO) */
  giftsAsOf?: string | null;
  /** the form fields of the shipped action, as strings (a repeated key is an array) */
  fields: Record<string, string | string[]>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

/** The shape check the server makes before anything runs. Null = not a queued supplier action. */
export function parseQueuedItem(raw: unknown): SupplierQueuedItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !isUuid(r.itemId) || !isUuid(r.shop) || !isUuid(r.member)) return null;
  if (typeof r.phoneTime !== 'string' || !Number.isFinite(Date.parse(r.phoneTime))) return null;
  if (r.madeOffline !== true || !isSupplierOfflineKind(r.kind)) return null;
  const fields: Record<string, string | string[]> = {};
  if (!r.fields || typeof r.fields !== 'object') return null;
  for (const [k, v] of Object.entries(r.fields as Record<string, unknown>)) {
    if (!/^[a-z_]{1,40}$/.test(k)) return null;
    if (typeof v === 'string' && v.length <= 4000) fields[k] = v;
    else if (Array.isArray(v) && v.length <= 12 && v.every((x) => typeof x === 'string' && x.length <= 200)) fields[k] = v as string[];
    else return null;
  }
  const base = r.baseVersion;
  if (base !== undefined && base !== null && !(Number.isInteger(base) && (base as number) >= 0)) return null;
  let seen: MoneySeen | null = null;
  if (r.seen && typeof r.seen === 'object') {
    const s = r.seen as Record<string, unknown>;
    seen = { totalPhp: amountOf(s.totalPhp), depositPhp: amountOf(s.depositPhp), paymentPhp: amountOf(s.paymentPhp) };
  }
  return {
    v: 1,
    itemId: r.itemId,
    shop: r.shop,
    member: r.member,
    phoneTime: r.phoneTime,
    madeOffline: true,
    kind: r.kind,
    baseVersion: (base as number | null | undefined) ?? null,
    seen,
    giftsAsOf: typeof r.giftsAsOf === 'string' ? r.giftsAsOf : null,
    fields,
  };
}

/* ── every answer ─────────────────────────────────────────────────────────────────────────────────────────────── */

export type ClashWhy = 'held' | 'booked' | 'closed' | 'changed' | 'removed';
export const CLASH_WHYS: ReadonlyArray<ClashWhy> = ['held', 'booked', 'closed', 'changed', 'removed'];

export type Clash = {
  why: ClashWhy;
  /** who got there first: a teammate (named), or a couple's booking. Null = not known (a removal). */
  by: { kind: 'member' | 'couple'; userId: string | null; name: string | null } | null;
  /** when, on the server's clock (ISO). Null = not known. */
  at: string | null;
  /** the day(s) it is about */
  dates: { start: string; end: string } | null;
};

/** Why an item stays on the phone for the next pass — none of these is final. */
export type RetryWhy =
  /** no answer from the server (no signal, a timeout) */
  | 'offline'
  /** signed out: it waits for the account that made it */
  | 'signed_out'
  /** another account is signed in on this phone */
  | 'other_member'
  /** the phone is standing in another shop */
  | 'other_shop'
  /** a live read failed — never decided on an unread number */
  | 'unread'
  /** the same item is being applied right now */
  | 'busy';

export type SyncOutcome =
  | { status: 'applied'; deduped?: boolean; ref?: string | null; version?: number | null }
  | { status: 'clash'; clash: Clash }
  | { status: 'needs_reconfirm'; offline: MoneySeen | null; live: MoneySeen }
  | { status: 'no_gifts_left'; asOf: string }
  | { status: 'pay_when_online' }
  | { status: 'refused'; why: string }
  | { status: 'retry'; why: RetryWhy };

export type SyncReply = SyncOutcome & { itemId: string; kind: SupplierOfflineKind };

export const SYNC_STATUSES = ['applied', 'clash', 'needs_reconfirm', 'no_gifts_left', 'pay_when_online', 'refused', 'retry'] as const;

/** Final = the phone stops sending it. Only `retry` keeps it queued. */
export function isFinalOutcome(o: Pick<SyncOutcome, 'status'>): boolean {
  return o.status !== 'retry';
}

/** The phone reads the server's answer through this — anything it does not recognise stays queued, never dropped. */
export function parseSyncReply(raw: unknown): SyncReply | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.itemId !== 'string' || !isSupplierOfflineKind(r.kind)) return null;
  if (!(SYNC_STATUSES as readonly unknown[]).includes(r.status)) return null;
  if (r.status === 'clash') {
    const c = r.clash as Record<string, unknown> | undefined;
    if (!c || !(CLASH_WHYS as readonly unknown[]).includes(c.why)) return null;
  }
  return raw as SyncReply;
}

/* ── a database door's answer → the typed outcome ───────────────────────────────────────────────────────────── */

/** What `supplier_offline_schedule_write` / `_hold` / `_code_use` answer (migration `supplier_offline_engine`). */
export type SqlAnswer = {
  status?: string;
  reason?: string;
  why?: string;
  by?: string | null;
  by_kind?: string | null;
  at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  block_id?: string | null;
  version?: number | null;
  deduped?: boolean;
  hold_id?: string | null;
  released?: number;
  invite_id?: string | null;
  claimed_event_id?: string | null;
  used_via?: string | null;
};

/** The door's refusal reasons, in words. */
export const SQL_INVALID: Readonly<Record<string, string>> = {
  dates: 'Those dates can’t be saved — pick a range of up to a month.',
  pool: 'Pick which schedule this goes on.',
  name: 'Add the client’s name.',
  day_part: 'Pick a part of the day.',
  base_version: 'This change doesn’t say which version it was made on. Open the item and make it again.',
  source: 'A booking made through Setnayan can’t be changed here.',
  day_state: 'That day setting can’t be saved.',
  code: 'That QR code isn’t one of this shop’s.',
  date: 'That QR code was made for another date.',
  shape: 'That could not be saved just now. Please try again.',
};

/** A clash as the door said it, with the member it names (`names`: user id → display name). */
export function clashFromSqlAnswer(a: SqlAnswer, names: ReadonlyMap<string, string>): Clash {
  const why = (CLASH_WHYS as readonly unknown[]).includes(a.why) ? (a.why as ClashWhy) : 'changed';
  return {
    why,
    by:
      a.by_kind === 'couple'
        ? { kind: 'couple', userId: null, name: null }
        : a.by
          ? { kind: 'member', userId: a.by, name: names.get(a.by) ?? null }
          : null,
    at: a.at ?? null,
    dates: a.start_date ? { start: a.start_date, end: a.end_date ?? a.start_date } : null,
  };
}

/** The door's answer → the outcome the phone keeps. A clash is ALWAYS a clash — never read as saved. */
export function outcomeFromSqlAnswer(a: SqlAnswer | null, names: ReadonlyMap<string, string>): SyncOutcome {
  if (!a?.status) return { status: 'refused', why: SQL_INVALID.shape! };
  if (a.status === 'applied') return { status: 'applied', deduped: a.deduped === true, ref: a.block_id ?? null, version: a.version ?? null };
  if (a.status === 'clash') return { status: 'clash', clash: clashFromSqlAnswer(a, names) };
  if (a.status === 'cancelled') return { status: 'refused', why: 'This QR code was cancelled.' };
  if (a.status === 'used') return { status: 'refused', why: 'This QR code was already used.' };
  return { status: 'refused', why: SQL_INVALID[a.reason ?? 'shape'] ?? SQL_INVALID.shape! };
}

/* ── the words (the drawing may restyle them; the facts are these) ──────────────────────────────────────────── */

const MANILA_DAY = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const MANILA_TIME = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });

function dayWords(iso: string | null | undefined): string {
  if (!iso) return 'that day';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00+08:00` : iso);
  return Number.isFinite(d.getTime()) ? MANILA_DAY.format(d) : 'that day';
}

export function timeWords(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? MANILA_TIME.format(d).toLowerCase() : '';
}

function whoWords(by: Clash['by']): string {
  if (!by) return 'Someone';
  if (by.kind === 'couple') return 'A couple';
  return by.name?.trim() || 'A teammate';
}

/** "Couldn't save: <why>" — one line per answer that is not a plain success. Null for applied and retry. */
export function outcomeLine(o: SyncOutcome): string | null {
  switch (o.status) {
    case 'clash': {
      const c = o.clash;
      const span = c.dates ? (c.dates.start === c.dates.end ? dayWords(c.dates.start) : `${dayWords(c.dates.start)}–${dayWords(c.dates.end)}`) : 'that day';
      if (c.why === 'booked') return `Couldn’t save. ${whoWords(c.by)} booked ${span} while you were offline.`;
      if (c.why === 'held') return `Couldn’t save: ${whoWords(c.by)} is handling ${span}.`;
      if (c.why === 'closed') return `Couldn’t save: ${span} was closed while you were offline.`;
      if (c.why === 'changed') return `Couldn’t save: ${whoWords(c.by)} changed this while you were offline.`;
      return 'Couldn’t save: this was removed while you were offline.';
    }
    case 'needs_reconfirm': {
      const field = (o.offline?.paymentPhp ?? null) !== null || (o.live.paymentPhp ?? null) !== null ? 'paymentPhp' : 'totalPhp';
      return `The amount changed: ${formatPhp(o.offline?.[field] ?? null)} on your phone, ${formatPhp(o.live[field] ?? null)} now. Confirm again.`;
    }
    case 'no_gifts_left':
      return 'Gift not sent: no gifts left';
    case 'pay_when_online':
      return 'Pay when online';
    case 'refused':
      return `Couldn’t save: ${o.why}`;
    default:
      return null;
  }
}

/** "8 gifts left · as of 2:14 pm" — the offline gift balance, always with its age. */
export function giftsLeftLine(left: number | null, asOf: string | null): string {
  const when = timeWords(asOf);
  if (left === null) return 'Couldn’t read your gifts';
  const n = Math.max(0, Math.trunc(left));
  return `${n} ${n === 1 ? 'gift' : 'gifts'} left${when ? ` · as of ${when}` : ''}`;
}

/** "<member>: N changes waiting, last online <time>" — a teammate's pending line. */
export function pendingLine(name: string | null, waiting: number, lastOnline: string | null): string | null {
  if (!(waiting > 0)) return null;
  const when = timeWords(lastOnline);
  return `${name?.trim() || 'A teammate'}: ${waiting} ${waiting === 1 ? 'change' : 'changes'} waiting${when ? `, last online ${when}` : ''}`;
}

/** What a queued item shows until the server accepts it (team-clash rule 2). */
export const NOT_CONFIRMED_YET = 'Not confirmed yet';
/** A purchase made offline (owner: "the supplier cannot purchase gifts when offline"). */
export const PAY_WHEN_ONLINE = 'Pay when online';
export const BUY_WHEN_ONLINE = 'Buy when online';
/** How many one-time codes each member's device keeps (controller's call, DECISION_LOG 2026-11-24). */
export const OFFLINE_CODE_STOCK = 50;
