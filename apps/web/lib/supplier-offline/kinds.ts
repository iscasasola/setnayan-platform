/**
 * 📶 THE SUPPLIER OFFLINE ENGINE — what a phone may queue, and every answer it can get back (owner 24 Nov 2026,
 * DECISION_LOG "The supplier dashboard works offline and catches up when back online").
 *
 * Pure (no I/O): read by the phone (the queue, `lib/offline/supplier-queue.ts`), by the server door
 * (`lib/supplier-offline/engine.server.ts`) and by the screens the drawing will add. The ruling, as types:
 *   · FIRST SAVE WINS — a stale or blocked write comes back as a typed clash `{why, by, at}`, never merged.
 *   · MONEY — the server recomputes every amount from live rows; if it differs from what the phone showed, nothing is
 *     applied and the answer is `needs_reconfirm {offline, live}`. Nothing is bought or paid offline (R15): a purchase is
 *     never queued at all — its button reads "Needs internet".
 *   · EVERY ROW IS VERSIONED (owner "Everything at once"): a queued write names the row it changes and that row's
 *     `updated_at` as the phone saw it; the server applies it only if the row is unchanged.
 *   · R14 — a booking made offline counts on that phone at once (`localSlot`, `queuedSeats`).
 *   · GIFTS — given from the last known balance; the live balance decides at sync (`no_gifts_left`, never unpaid).
 *   · NOTHING FAILS SILENTLY — every final answer is kept on the phone until a person looks at it.
 *
 * Every queued action replays through the SHIPPED action for it (a stay door, the own-client action, the payment
 * confirm, the yes) — or, for the schedule, through `supplier_offline_schedule_write`, the one versioned door. The
 * engine adds only the checks the ruling names; it never re-implements an action.
 */
import { formatPhp } from '@/lib/php';
import type { VendorCapability, VendorDuty } from '@/lib/vendor-duties';

/** How the server decides a queued action. */
export type OfflineRule =
  /** versioned schedule write — first save wins, expo holds, a full or closed day (`supplier_offline_schedule_write`) */
  | 'schedule'
  /** an amount re-read from live rows before the shipped action runs */
  | 'money'
  /** gifts from the live balance before the shipped action runs */
  | 'gift'
  /** the shipped action, once (the ledger answers a retry) */
  | 'plain';

type KindRule = {
  rule: OfflineRule;
  /** The role gate (`lib/vendor-duties.ts`) — the same capability the online screen needs. */
  capability: VendorCapability;
  /** The shipped stay door the action replays through, when it has one (`lib/stay-doors.ts`). */
  door?: string;
};

/**
 * EVERY supplier action a phone may keep while offline. Anything else is refused before it is queued
 * (`isSupplierOfflineKind`). Nothing that buys or pays is here (R15): those buttons grey out — "Needs internet".
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
} as const satisfies Record<string, KindRule>;

/**
 * The SHIPPED supplier actions each kind stands for (`<file> › <export>`) — what the form-coverage guard
 * (`the-supplier-works-offline.test.ts` · test 10) counts as "works offline". The schedule kinds stand for the calendar
 * forms they replace offline (through the versioned door); the rest replay through the action itself.
 */
export const KIND_COVERS: Readonly<Record<SupplierOfflineKind, readonly string[]>> = {
  'schedule.client': ['app/vendor-dashboard/calendar/actions.ts › importExternalClient'],
  'schedule.block': ['app/vendor-dashboard/calendar/actions.ts › addManualBlock'],
  'schedule.edit': [],
  'schedule.remove': ['app/vendor-dashboard/calendar/actions.ts › removeBlock'],
  'schedule.day': ['app/vendor-dashboard/calendar/actions.ts › setCalendarDayState'],
  'qr.booking': [],
  'client.add': ['app/vendor-dashboard/invite/own-client-actions.ts › saveOwnClient'],
  'lead.outcome': ['app/vendor-dashboard/messages/[threadId]/outcome-actions.ts › recordInquiryOutcome'],
  'note.add': ['app/vendor-dashboard/clients/[eventId]/actions.ts › createClientNote'],
  'note.done': ['app/vendor-dashboard/clients/[eventId]/actions.ts › toggleClientNoteDone'],
  'note.delete': ['app/vendor-dashboard/clients/[eventId]/actions.ts › deleteClientNote'],
  'message.send': [],
  'payment.ask': ['app/vendor-dashboard/clients/[eventId]/actions.ts › vendorAskForPayment'],
  'payment.ask_withdraw': ['app/vendor-dashboard/clients/[eventId]/actions.ts › vendorWithdrawPaymentAsk'],
  'payment.confirm': ['app/vendor-dashboard/messages/[threadId]/pay-confirm-actions.ts › confirmVendorPayment'],
  'deposit.ack': ['app/vendor-dashboard/clients/[eventId]/actions.ts › vendorAcknowledgeDeposit'],
  'booking.accept': ['app/vendor-dashboard/clients/[eventId]/actions.ts › vendorAgreeToLock'],
};

/**
 * R15: supplier actions that need internet by nature (buying or paying Setnayan) — their buttons grey out, never queue.
 * The area builders add the rest of R15's list (search across shops, Live Watch and calls, AI, renders, live outside
 * lookups, marketplace races) as they take each area off `not-yet-offline.baseline.txt`.
 */
export const NEEDS_INTERNET_ACTIONS: readonly string[] = [
  'app/vendor-dashboard/subscription/ultra-addon-actions.ts › buyUltraAddOn',
];

/**
 * The roles that book (controller under the 20 Nov delegation, DECISION_LOG 24 Nov; review #2 item 1): only they may
 * book, block or hold dates — offline exactly as online — and an offline QR only counts while its phone's member still
 * holds one of them.
 */
export const BOOKING_DUTIES: ReadonlyArray<VendorDuty> = ['shop_manager', 'branch_manager', 'account_manager'];

/* ── R15: what needs internet ─────────────────────────────────────────────────────────────────────────────────── */

/** The greyed button's label and the one quiet line a tap shows (owner 24 Nov, R15). */
export const NEEDS_INTERNET = 'Needs internet';
export const NEEDS_INTERNET_LINE = 'Needs internet · it works again when you’re back online';

/* ── every row is versioned (its own `updated_at`) ─────────────────────────────────────────────────────────────── */

/**
 * The rows a queued write may name, and the key each is found by. The version is the row's EXISTING `updated_at`
 * (owner, "Everything at once": a `version` column only where a table has none — the schedule items). The server reads
 * the row back before the shipped action runs; changed or gone ⇒ a clash, never a merge. Only these tables, by these
 * keys — a queued item can never name another table.
 */
export const VERSIONED_ROWS = {
  event_vendors: 'vendor_id',
  vendor_client_notes: 'note_id',
  chat_threads: 'thread_id',
} as const;
export type VersionedTable = keyof typeof VERSIONED_ROWS;
export type RowVersion = { table: VersionedTable; id: string; updatedAt: string };

export function isRowVersion(v: unknown): v is RowVersion {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.table === 'string' &&
    Object.hasOwn(VERSIONED_ROWS, r.table) &&
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    r.id.length <= 64 &&
    typeof r.updatedAt === 'string' &&
    Number.isFinite(Date.parse(r.updatedAt))
  );
}

/** Is the row still the one the phone saw? Compared as instants (a timestamp may come back spelled differently). */
export function rowUnchanged(seen: RowVersion, liveUpdatedAt: string | null): boolean {
  return liveUpdatedAt !== null && Date.parse(liveUpdatedAt) === Date.parse(seen.updatedAt);
}

export type SupplierOfflineKind = keyof typeof SUPPLIER_OFFLINE_KINDS;

/**
 * Each kind's payload version (review #2 item 11). A phone keeps items made by the code it had; the server keeps an
 * adapter for every version it ever accepted (`adaptQueuedItem`) and refuses a newer one it does not know.
 */
export const KIND_SCHEMA: Readonly<Record<SupplierOfflineKind, number>> = {
  'schedule.client': 1,
  'schedule.block': 1,
  'schedule.edit': 1,
  'schedule.remove': 1,
  'schedule.day': 1,
  'qr.booking': 1,
  'client.add': 1,
  'lead.outcome': 1,
  'note.add': 1,
  'note.done': 1,
  'note.delete': 1,
  'message.send': 1,
  'payment.ask': 1,
  'payment.ask_withdraw': 1,
  'payment.confirm': 1,
  'deposit.ack': 1,
  'booking.accept': 1,
};

/** Older payload versions → today's. Version 1 is today's; a later version adds its adapter here. */
export function adaptQueuedItem(item: SupplierQueuedItem): SupplierQueuedItem {
  return { ...item, schema: KIND_SCHEMA[item.kind] };
}

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
  /** the booking's agreed total NOW, as the screens show it (`agreedTotalNow`: the headline plus its change lines) */
  totalPhp: number | null;
  /** the reservation fee on file (`recordedDepositPhp`: the ledger's deposit row, else the legacy figure) */
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
  /** any other row it changes, with that row's `updated_at` as the phone saw it */
  rowVersion?: RowVersion | null;
  /** an edit or removal of something THIS phone made offline: the item that made it (the server waits for its answer) */
  dependsOn?: string | null;
  /** the payload version of this kind (`KIND_SCHEMA`); an item newer than this server knows is never guessed at */
  schema?: number;
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
  if (r.rowVersion !== undefined && r.rowVersion !== null && !isRowVersion(r.rowVersion)) return null;
  if (r.dependsOn !== undefined && r.dependsOn !== null && !isUuid(r.dependsOn)) return null;
  const schema = r.schema === undefined ? 1 : r.schema;
  if (!Number.isInteger(schema) || (schema as number) < 1 || (schema as number) > KIND_SCHEMA[r.kind as SupplierOfflineKind]) return null;
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
    rowVersion: (r.rowVersion as RowVersion | null | undefined) ?? null,
    dependsOn: (r.dependsOn as string | null | undefined) ?? null,
    schema: schema as number,
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
  | 'busy'
  /** it follows another change made offline (an edit of a booking made offline) that has not been sent yet */
  | 'waiting_parent';

export type SyncOutcome =
  | { status: 'applied'; deduped?: boolean; ref?: string | null; version?: number | null }
  | { status: 'clash'; clash: Clash }
  | { status: 'needs_reconfirm'; offline: MoneySeen | null; live: MoneySeen }
  | { status: 'no_gifts_left'; asOf: string }
  /** an offline QR was used by an event whose hosts do not match the client the supplier typed: the gift waits until
   *  the supplier confirms it is their client — never auto-given to a stranger's event (review #2 item 17) */
  | { status: 'confirm_claim'; eventName: string | null; inviteId: string }
  | { status: 'refused'; why: string }
  | { status: 'retry'; why: RetryWhy };

export type SyncReply = SyncOutcome & { itemId: string; kind: SupplierOfflineKind };

export const SYNC_STATUSES = ['applied', 'clash', 'needs_reconfirm', 'no_gifts_left', 'confirm_claim', 'refused', 'retry'] as const;

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
  hold_cap: 'You hold 5 date ranges already — let one go first.',
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
  if (a.status === 'stopped') return { status: 'refused', why: 'QR codes from this phone were stopped. Make the client a new one.' };
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
    case 'confirm_claim':
      return `Your offline QR was used for ${o.eventName?.trim() || 'an event'}. Is this your client? Confirm before the gift is given.`;
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

/**
 * R5 (corrected 24 Nov): what a TEAMMATE sees — "Ana · last seen 2:14 PM · holding 10–15 Dec". Never a count of the
 * changes still on Ana's phone: the server cannot see them. Only her own phone says "3 changes waiting to send".
 */
export function lastSeenLine(name: string | null, lastSeen: string | null, holding: { start: string; end: string } | null): string {
  const when = timeWords(lastSeen);
  const span = holding ? (holding.start === holding.end ? dayWords(holding.start) : `${dayWords(holding.start)}–${dayWords(holding.end)}`) : null;
  return [name?.trim() || 'A teammate', when ? `last seen ${when}` : null, span ? `holding ${span}` : null].filter(Boolean).join(' · ');
}

/** Only the phone's OWN line: "3 changes waiting to send". */
export function waitingToSendLine(waiting: number): string | null {
  return waiting > 0 ? `${waiting} ${waiting === 1 ? 'change' : 'changes'} waiting to send` : null;
}

/** What a queued item shows until the server accepts it (team-clash rule 2). */
export const NOT_CONFIRMED_YET = 'Not confirmed yet';
/** R14: a time a booking made on this phone already took. */
export const BOOKED_NOT_CONFIRMED = 'Booked · not confirmed yet';

/* ── R14: a booking made offline counts on that phone at once ─────────────────────────────────────────────────── */

/**
 * The phone's saved copy of ONE day of ONE schedule, as the last read put it (the screens fill it from the saved
 * copy): its seats, what is already taken, the times already booked, and whether the day is closed.
 */
export type LocalDayCopy = {
  poolId: string;
  date: string;
  capacity: number;
  /** seats taken on the server copy (couples' bookings + outside clients) */
  taken: number;
  /** HH:MM already booked on the server copy */
  times: readonly string[];
  closed: boolean;
};

export type LocalSlot = 'free' | 'booked' | 'booked_not_confirmed' | 'full' | 'closed';

const fieldOf = (item: SupplierQueuedItem, k: string): string => {
  const v = item.fields[k];
  return typeof v === 'string' ? v.trim() : '';
};

const onDay = (item: SupplierQueuedItem, date: string): boolean => {
  const start = fieldOf(item, 'start_date');
  const end = fieldOf(item, 'end_date') || start;
  return Boolean(start) && start <= date && date <= end;
};

/** A queued item's schedule — empty means "the shop's one schedule", which counts against any schedule (never less). */
const onPool = (item: SupplierQueuedItem, poolId: string): boolean => {
  const p = fieldOf(item, 'pool_id');
  return !p || p === poolId;
};

/**
 * What this phone's QUEUE adds to a day: the seats and times its own offline bookings took (outside clients and offline
 * QR dates), and whether it closed the day ("not available" for the whole day). Nothing from another phone — that is
 * what expo mode and first save wins at sync are for.
 */
export function queuedSeats(queued: readonly SupplierQueuedItem[], poolId: string, date: string): { seats: number; times: string[]; closed: boolean } {
  let seats = 0;
  const times: string[] = [];
  let closed = false;
  for (const item of queued) {
    if (!onDay(item, date)) continue;
    if (item.kind === 'schedule.client' || item.kind === 'qr.booking') {
      if (!onPool(item, poolId)) continue;
      seats += 1;
      const t = fieldOf(item, 'client_time');
      if (/^\d{2}:\d{2}$/.test(t)) times.push(t);
    } else if (item.kind === 'schedule.block') {
      const scope = fieldOf(item, 'scope');
      const wholeDay = (fieldOf(item, 'day_part') || 'all_day') === 'all_day';
      if (wholeDay && (!scope || scope === 'org' || scope === poolId)) closed = true;
    }
  }
  return { seats, times, closed };
}

/**
 * THE ONE local availability read (R14): the saved copy PLUS this phone's queue. The time picker, the offline QR's
 * free-time check and every other screen on the phone ask this, so they all agree. A time a queued booking took reads
 * "Booked · not confirmed yet"; a day whose seats are all taken reads full.
 */
export function localSlot(copy: LocalDayCopy, queued: readonly SupplierQueuedItem[], time: string | null): LocalSlot {
  const q = queuedSeats(queued, copy.poolId, copy.date);
  if (copy.closed || q.closed) return 'closed';
  if (time && q.times.includes(time)) return 'booked_not_confirmed';
  if (time && copy.times.includes(time)) return 'booked';
  if (copy.taken + q.seats >= Math.max(1, copy.capacity)) return 'full';
  return 'free';
}

/** The times a picker may still offer on that day (the copy plus the queue). */
export function offerableTimes(copy: LocalDayCopy, queued: readonly SupplierQueuedItem[], times: readonly string[]): string[] {
  return times.filter((t) => localSlot(copy, queued, t) === 'free');
}

/** R14 for gifts: the last known balance less what this phone's queue already gave ("8 gifts left · as of …"). */
export function giftsLeftWithQueue(balance: number | null, queued: readonly SupplierQueuedItem[], packCode: string): number | null {
  if (balance === null) return null;
  let given = 0;
  for (const item of queued) {
    if (item.kind !== 'client.add') continue;
    const g = item.fields.gift;
    given += (Array.isArray(g) ? g : typeof g === 'string' ? [g] : []).filter((c) => c === packCode).length;
  }
  return Math.max(0, balance - given);
}

/** R14 for "To collect": what is still owed on a booking, less the payments this phone's queue already recorded. */
export function toCollectWithQueue(owed: number | null, queued: readonly SupplierQueuedItem[], eventVendorId: string): number | null {
  if (owed === null) return null;
  let recorded = 0;
  for (const item of queued) {
    if (item.kind === 'payment.confirm' && fieldOf(item, 'vendor_id') === eventVendorId) recorded += item.seen?.paymentPhp ?? 0;
  }
  return Math.max(0, Math.round((owed - recorded) * 100) / 100);
}
