/**
 * focus-search.ts — the pure half of admin search "Focus at Spotlight level".
 *
 * Owner approved the drawing on 18 Nov 2026 (P3 Fable drawing, claude.ai artifact
 * PUtA4pCjKe2eCteNh3ek12 — "Focus, as powerful as Spotlight"). The name stays
 * "Focus" (owner ruling). This file holds every rule the drawing adds that can
 * be decided without a database, so each one is a unit test rather than a hope:
 *
 *   1. A WHOLE public ID (`S89B-9TX4BH2FGB`) shows exactly one record — the
 *      search reads the one table that letter belongs to and lists nothing else.
 *   2. A GCash / BDO reference finds its payment, however it was spaced when it
 *      was logged ("4012 345 678 901" and "4012345678901" are one reference).
 *   3. A question gets a number — "paid today", "orders this week", "waiting to
 *      verify" — and a number that could not be read says so. It NEVER shows 0.
 *   4. A group whose read failed says "Couldn't search …", never "no matches".
 *      Before this, every arm of `ugatSearch` turned an error into `[]`, so a
 *      refused read and an empty table drew the same pixels.
 *   5. Records sit under their own kind, each kind its own few — the single
 *      flat "Records" heading and its 8-row cap across all kinds are gone.
 *   6. Recent: the last records and pages opened from Focus, kept in THIS
 *      browser (no table, no migration — see `FOCUS_RECENTS_KEY`).
 *
 * 🔒 It runs no query and imports nothing server-only: the palette is a client
 * component and imports this directly.
 */

/* ── 1 · PUBLIC IDs ──────────────────────────────────────────────────────── */

/**
 * `S89<TYPE>-<10-char Crockford>` — the canonical entity ID
 * (`public.generate_public_id(type_letter)`). Case-insensitive on input; the
 * stored value is upper case. Crockford base32 has no I, L, O or U.
 */
export const WHOLE_PUBLIC_ID = /^S89([A-Z]{1,2})-([0-9A-HJKMNP-TV-Z]{10})$/;

/**
 * The letters Focus can open, and the one table each lives in. Taken from the
 * `generate_public_id('<L>')` default on each table's own migration — re-measure
 * with `grep -h -B8 "generate_public_id('B')" supabase/migrations/*.sql`.
 * A letter not listed here is still recognised as an ID; it just finds nothing,
 * and the box says so instead of falling back to a name search.
 * ⚠ Some letters are SHARED (G is also `guest_groups` and `godparents`, B also
 * `bir_2307_filings`, E also `fraud_enforcement_audit`, O also
 * `vendor_service_addons`). Focus reads the record table an admin opens — the one
 * listed here — so an ID from a shared side table finds nothing, honestly.
 */
export const PUBLIC_ID_KINDS = {
  B: { table: 'vendor_profiles', kind: 'vendor', label: 'Supplier' },
  U: { table: 'users', kind: 'user', label: 'Person' },
  E: { table: 'events', kind: 'event', label: 'Event' },
  O: { table: 'orders', kind: 'order', label: 'Order' },
  G: { table: 'guests', kind: 'guest', label: 'Guest' },
} as const;

export type PublicIdLetter = keyof typeof PUBLIC_ID_KINDS;

export type FocusQuery =
  | { kind: 'public-id'; publicId: string; letter: string; known: PublicIdLetter | null }
  | { kind: 'words'; text: string; referenceDigits: string | null };

/**
 * The digits of a payment reference, or null when the text is not one.
 *
 * A reference is what a bank or e-wallet prints: digits, maybe broken by spaces
 * or dashes. Eight digits is the floor — a GCash reference is 13 and a BDO one
 * 10–12, while a date (8 digits WITH separators of its own shape) or a short
 * order number is not worth a payments read on every keystroke. Anything with a
 * letter in it is words, not a reference.
 */
export function referenceDigits(text: string): string | null {
  const t = text.trim();
  if (!/^[0-9][0-9\s-]*$/.test(t)) return null;
  const digits = t.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 32 ? digits : null;
}

/** What the box typed, read as either one whole ID or words (maybe a reference). */
export function classifyFocusQuery(raw: string): FocusQuery {
  const text = raw.trim();
  const upper = text.toUpperCase();
  const m = WHOLE_PUBLIC_ID.exec(upper);
  if (m) {
    const letter = m[1]!;
    const known = Object.prototype.hasOwnProperty.call(PUBLIC_ID_KINDS, letter)
      ? (letter as PublicIdLetter)
      : null;
    return { kind: 'public-id', publicId: upper, letter, known };
  }
  return { kind: 'words', text, referenceDigits: referenceDigits(text) };
}

/**
 * The ILIKE pattern that finds a reference whatever its spacing: a wildcard
 * between every digit. `4012345678901` → `%4%0%1%2%3%4%5%6%7%8%9%0%1%`, which
 * matches "4012 345 678 901" and "4012-345-678-901" alike. Loose on purpose —
 * `referenceMatches` is the exact check run on what comes back.
 * Digits only, so nothing in it can re-parse a PostgREST filter.
 */
export function referenceIlikePattern(digits: string): string {
  return `%${digits.replace(/\D/g, '').split('').join('%')}%`;
}

/** Does this stored reference carry these digits, in order and unbroken? */
export function referenceMatches(stored: string | null | undefined, digits: string): boolean {
  const s = (stored ?? '').replace(/\D/g, '');
  return s.length > 0 && s.includes(digits);
}

/** The whole reference, not just a run inside it — the "Exact reference" heading. */
export function referenceIsExact(stored: string | null | undefined, digits: string): boolean {
  return (stored ?? '').replace(/\D/g, '') === digits;
}

/* ── 3 · ANSWERS — a question gets a number ─────────────────────────────── */

export type FocusAnswerKey = 'paid-today' | 'orders-this-week' | 'waiting-to-verify' | 'payments-waiting';

export interface FocusAnswerDef {
  key: FocusAnswerKey;
  /** The words after the number: "3 payments confirmed today". */
  noun: [one: string, many: string];
  href: string;
  /** "opens Payments". */
  opens: string;
}

export const FOCUS_ANSWER_DEFS: Record<FocusAnswerKey, FocusAnswerDef> = {
  'paid-today': {
    key: 'paid-today',
    noun: ['payment confirmed today', 'payments confirmed today'],
    href: '/admin/payments?filter=all',
    opens: 'Payments',
  },
  'orders-this-week': {
    key: 'orders-this-week',
    noun: ['order in the last 7 days', 'orders in the last 7 days'],
    href: '/admin/payments?filter=all',
    opens: 'Payments',
  },
  'waiting-to-verify': {
    key: 'waiting-to-verify',
    noun: ['supplier waiting to verify', 'suppliers waiting to verify'],
    href: '/admin/verify',
    opens: 'Verify',
  },
  'payments-waiting': {
    key: 'payments-waiting',
    noun: ['payment waiting for you', 'payments waiting for you'],
    href: '/admin/payments',
    opens: 'Payments',
  },
};

/**
 * Which question these words ask, or null. Deliberately a short, literal list —
 * the drawing names "paid today", "orders this week" and "waiting to verify";
 * anything not on it stays a search, never a guessed number.
 */
export function matchFocusAnswer(raw: string): FocusAnswerKey | null {
  const q = raw.toLowerCase().replace(/[?.!]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  if (/\b(paid|confirmed|matched) today\b|\bpayments? (paid|confirmed|matched) today\b/.test(q)) return 'paid-today';
  if (/\borders? (this week|in the last 7 days|last 7 days)\b/.test(q)) return 'orders-this-week';
  if (/\b(waiting to verify|to verify|waiting for verification|verify waiting)\b/.test(q)) return 'waiting-to-verify';
  if (/\b(payments? waiting|waiting payments?|payments? to (confirm|approve))\b/.test(q)) return 'payments-waiting';
  return null;
}

/** One counted number, as the search hands it to the box. `count: null` = could not be read. */
export interface FocusCount {
  key: FocusAnswerKey;
  count: number | null;
}

/** A Supabase head-count result, or null when it did not read. Never folds an error into 0. */
export function countOrNull(res: { count: number | null; error: unknown } | null | undefined): number | null {
  if (!res || res.error) return null;
  return typeof res.count === 'number' && Number.isFinite(res.count) ? res.count : null;
}

/**
 * The words on an answer row.
 * 🔑 A NUMBER THAT CANNOT BE READ SAYS SO. It never renders "0".
 */
export function focusAnswerWords(c: FocusCount): { number: string | null; line: string } {
  const def = FOCUS_ANSWER_DEFS[c.key];
  if (c.count === null) {
    return {
      number: null,
      line: `Couldn’t count ${def.noun[1]} — not the same as none. Opens ${def.opens}.`,
    };
  }
  return {
    number: c.count.toLocaleString('en-PH'),
    line: `${c.count === 1 ? def.noun[0] : def.noun[1]} · opens ${def.opens}`,
  };
}

/* ── 4 + 5 · GROUPS → THE ROWS THE BOX DRAWS ───────────────────────────── */

/** A read's outcome: the rows, or the fact that it failed. Never both silently. */
export interface SettledRead<T> {
  rows: T[];
  failed: boolean;
}

/**
 * Settle one Supabase read. `{ error }` (Supabase RESOLVES with it) and a thrown
 * promise both become `failed: true` — the exact case the old `() => []` hid.
 */
export async function settleRead<T>(
  read: PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<SettledRead<T>> {
  try {
    const { data, error } = await read;
    if (error) return { rows: [], failed: true };
    return { rows: data ?? [], failed: false };
  } catch {
    return { rows: [], failed: true };
  }
}

/** Structural: `UgatSearchGroup` (server-only) is assignable to this. */
export interface FocusSearchHit {
  id: string;
  type: string;
  title: string;
  sub: string;
  href: string;
  score: number;
  /** The record's public ID (or payment reference) shown at the row's end. */
  publicId?: string | null;
  /** "Prepared · nothing is done for you" — pages only, never a mutation. */
  prepared?: ReadonlyArray<{ label: string; sub: string; href: string }>;
}

export interface FocusSearchGroup {
  category: string;
  hits: FocusSearchHit[];
  /** The read behind this group failed — say "Couldn't search", never "no matches". */
  failed?: boolean;
  /** An answered question (group category "Answer"), with or without a number. */
  answer?: FocusCount[];
}

/** Headings that are a single exact match — nothing is ranked beside them. */
export const EXACT_CATEGORIES = new Set(['Exact ID', 'Exact reference']);

/** How many rows each kind shows. The search reads 6 per kind; Focus shows its few. */
export const FOCUS_ROWS_PER_KIND = 4;

/** A top hit must actually match the words, not merely share a token. */
export const TOP_HIT_MIN_SCORE = 45;

export type FocusRow =
  | {
      kind: 'answer';
      key: string;
      category: 'Answer';
      number: string | null;
      line: string;
      href: string;
      /** The second answer row ("2 Payments waiting for you") is a plain row. */
      secondary: boolean;
    }
  | {
      kind: 'record';
      key: string;
      category: string;
      title: string;
      detail: string;
      publicId: string | null;
      href: string;
      recordKind: string;
    }
  | { kind: 'prepared'; key: string; category: 'Prepared · nothing is done for you'; title: string; detail: string; href: string }
  | { kind: 'failed'; key: string; category: string; title: string; detail: string };

/**
 * Turn the search's groups into the ordered rows the box draws and the
 * keyboard walks: Answer → Exact match or Top hit → Prepared → each kind.
 *
 * `redact` is the contact-detail fence (`redactContactDetail`), passed in so this
 * module stays free of the presentation file it would otherwise import.
 */
export function toFocusRows(
  groups: readonly FocusSearchGroup[] | null | undefined,
  redact: (s: string) => string,
  perKind: number = FOCUS_ROWS_PER_KIND,
): FocusRow[] {
  if (!groups?.length) return [];
  const out: FocusRow[] = [];
  const recordRow = (category: string, h: FocusSearchHit): FocusRow => ({
    kind: 'record',
    key: `${category}:${h.type}:${h.id}`,
    category,
    title: h.title,
    detail: redact(h.sub),
    publicId: h.publicId ?? null,
    href: h.href,
    recordKind: h.type,
  });

  // Answer first.
  for (const g of groups) {
    if (!g.answer) continue;
    g.answer.forEach((c, i) => {
      const w = focusAnswerWords(c);
      const def = FOCUS_ANSWER_DEFS[c.key];
      out.push({ kind: 'answer', key: `answer:${c.key}`, category: 'Answer', number: w.number, line: w.line, href: def.href, secondary: i > 0 });
    });
  }

  const recordGroups = groups.filter((g) => !g.answer);

  // An exact match stands alone at the top.
  const exact = recordGroups.filter((g) => EXACT_CATEGORIES.has(g.category));
  let top: { category: string; hit: FocusSearchHit } | null = null;
  if (exact.length === 0) {
    for (const g of recordGroups) {
      if (g.failed) continue;
      const best = g.hits.find((h) => h && h.href);
      if (best && best.score >= TOP_HIT_MIN_SCORE && (!top || best.score > top.hit.score)) top = { category: g.category, hit: best };
    }
  }

  const pushGroup = (g: FocusSearchGroup, label: string) => {
    if (g.failed) {
      out.push({ kind: 'failed', key: `failed:${g.category}`, category: label, title: `Couldn’t search ${g.category}`, detail: 'Not “no matches”. Tap to try again.' });
      return;
    }
    const usable = g.hits.filter((h) => h && h.href && h !== top?.hit).slice(0, perKind);
    for (const h of usable) out.push(recordRow(label, h));
  };

  for (const g of exact) pushGroup(g, g.category);
  if (top) {
    out.push(recordRow('Top hit', top.hit));
    for (const p of top.hit.prepared ?? []) {
      out.push({ kind: 'prepared', key: `prepared:${p.href}`, category: 'Prepared · nothing is done for you', title: p.label, detail: p.sub, href: p.href });
    }
  }
  for (const g of recordGroups) {
    if (EXACT_CATEGORIES.has(g.category)) continue;
    pushGroup(g, g.category);
  }
  return out;
}

/** True when the box should list ONLY the exact match — no pages beside it. */
export function focusIsExactOnly(rows: readonly FocusRow[]): boolean {
  return rows.length > 0 && rows.every((r) => EXACT_CATEGORIES.has(r.category));
}

/* ── VENDOR + PAYMENT DESTINATIONS ──────────────────────────────────────── */

/**
 * Where a supplier opens from Focus: its waiting Verify job when papers are
 * waiting (the per-shop address `/admin/verify?shop=`), else its shop page.
 */
export function focusVendorHref(vendorProfileId: string, waiting: 'pending_review' | 'in_review' | null): string {
  const id = encodeURIComponent(vendorProfileId);
  return waiting ? `/admin/verify?status=${waiting}&shop=${id}` : `/admin/vendors/${id}`;
}

/** A payment opens on the Payments desk, on top, at `?open=<payment_id>`. */
export function focusPaymentHref(paymentId: string): string {
  return `/admin/payments?filter=all&open=${encodeURIComponent(paymentId)}`;
}

/* ── 6 · RECENT — this browser only ─────────────────────────────────────── */

/**
 * localStorage key. Per browser, so per admin on their own device. A store that
 * follows an admin across devices would need a table (and a migration); the
 * drawing asks only for "the last things you opened, one tap away".
 */
export const FOCUS_RECENTS_KEY = 'sn.admin.focus.recents.v1';
export const FOCUS_RECENTS_MAX = 8;
export const FOCUS_RECENTS_SHOWN = 3;

export interface FocusRecent {
  href: string;
  title: string;
  /** "Supplier", "Event", "Page" … */
  label: string;
  at: number;
}

/** Add one opened thing to the front; same href moves up instead of repeating. */
export function pushFocusRecent(list: readonly FocusRecent[], item: FocusRecent, max: number = FOCUS_RECENTS_MAX): FocusRecent[] {
  if (!item.href || !item.title) return [...list];
  return [item, ...list.filter((r) => r.href !== item.href)].slice(0, max);
}

/** Read whatever was stored, keeping only well-formed rows. */
export function parseFocusRecents(raw: string | null | undefined): FocusRecent[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (r): r is FocusRecent =>
          r && typeof r.href === 'string' && r.href.startsWith('/admin') && typeof r.title === 'string' && typeof r.label === 'string' && typeof r.at === 'number',
      )
      .slice(0, FOCUS_RECENTS_MAX);
  } catch {
    return [];
  }
}

/** "opened today" · "opened yesterday" · "opened 3 days ago" — Manila days. */
export function recentWhen(at: number, nowMs: number): string {
  const day = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const days = Math.round((Date.parse(day(nowMs)) - Date.parse(day(at))) / 86_400_000);
  if (days <= 0) return 'opened today';
  if (days === 1) return 'opened yesterday';
  return `opened ${days} days ago`;
}

/** The label a record kind carries in Recent. */
export function recentLabelOf(recordKind: string): string {
  switch (recordKind) {
    case 'vendor':
      return 'Supplier';
    case 'user':
      return 'Person';
    case 'event':
      return 'Event';
    case 'order':
      return 'Order';
    case 'guest':
      return 'Guest';
    case 'payment':
    case 'billing':
      return 'Payment';
    case 'taxonomy':
      return 'Category';
    default:
      return 'Page';
  }
}
