/**
 * supplier-work.ts — what a supplier sends, as it lands in Admin › Work (owner 2026-10-28: "A"; DECISION_LOG "ADMIN
 * SUPPLIER SLICE APPROVED — BUILD NOW"; prototype `prototypes/admin_supplier_slice_2026-10-28/`).
 *
 * Everything a supplier sends lands in Work, the one "Needs action" list, and is DONE IN ITS ROW — no jumping:
 *   docs   — a verification application waiting (vendor_verification_applications) · Approve / Needs a fix + reason
 *   names  — a shop-name or web-address request (vendor_correction_requests) · Approve / Decline + reason
 *   cards  — a service-card photo flagged by Repost watch (vendor_image_flags) · Publish / Needs a fix + reason
 *   types  — an event type a host asked for (event_type_requests, PR #7001) · Add the type / Point them to one
 *   msgs   — a shop's "Message Setnayan" (help_messages from a supplier) · Reply in the row
 *
 * 🔑 EVERY REASON IS PICKED FROM A LIST, NEVER TYPED. The shop reads it, so it is written once, here, in the words the
 * prototype approved — and a refusal ("a decline without a reason") is decided by `pickedReason`, which a test CALLS.
 *
 * Pure: no React, no database.
 */

export const SUPPLIER_WORK_KINDS = ['docs', 'names', 'cards', 'types', 'msgs'] as const;
export type SupplierWorkKind = (typeof SUPPLIER_WORK_KINDS)[number];

/** The filter chips, in the prototype's order and words. */
export const SUPPLIER_WORK_CHIP: Readonly<Record<SupplierWorkKind, string>> = {
  docs: 'Documents',
  names: 'Name & address',
  cards: 'Flagged cards',
  types: 'Event types',
  msgs: 'Messages',
};

export function coerceSupplierWorkKind(v: string | string[] | undefined): SupplierWorkKind | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return (SUPPLIER_WORK_KINDS as readonly string[]).includes(s ?? '') ? (s as SupplierWorkKind) : undefined;
}

/**
 * The reasons a shop may be shown, per decision (the prototype's lists, verbatim).
 * ⚖ The price reason ("Price is far outside the usual range") is deliberately ABSENT: the owner ruled on 2026-10-26
 * "NO PRICE CHECK ON SERVICE CARDS AT ALL" (supersedes the price rows; `market_price_bands` holds 0 rows), so nothing
 * can flag a card for its price and offering the reason would let an admin send a rule that does not exist.
 */
export const SUPPLIER_WORK_REASONS = {
  docs: [
    'Photo is cut off — upload the whole page',
    'Name does not match the shop',
    'Expired document',
    'Not readable — retake in good light',
    'Wrong document',
  ],
  names: [
    'Too close to another shop’s name',
    'Misleading name',
    'Not allowed words',
    'Please send proof of the new business name',
    // Not in the prototype's list: the Profile-corrections row below also declines the OTHER locked details (phone,
    // email, HQ address…) through the same action, which now refuses a decline without a reason from this list.
    'That detail can’t be changed this way — message Setnayan',
  ],
  cards: ['This photo belongs to another shop — use your own work', 'Verify your shop first'],
} as const satisfies Record<'docs' | 'names' | 'cards', readonly string[]>;

export type ReasonList = keyof typeof SUPPLIER_WORK_REASONS;

/**
 * The reason the admin picked — ONLY if it is one of the list's own words. Anything else (empty, typed, from another
 * list) is null, and every "Needs a fix" / "Decline" refuses on null. 🔑 A decline without a reason is refused here.
 */
export function pickedReason(list: ReasonList, raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  return (SUPPLIER_WORK_REASONS[list] as readonly string[]).includes(s) ? s : null;
}

/** One row in Work's supplier section. */
export type SupplierWorkItem = {
  /** `<kind>:<row id>` — unique across kinds; what `?item=` names. */
  key: string;
  kind: SupplierWorkKind;
  /** "Documents · Tita Nena's Catering". */
  title: string;
  /** "BIR certificate re-uploaded · was “Needs a fix”". */
  line: string;
  /** When the supplier sent it (ISO). Oldest first. */
  at: string;
} & (
  | {
      kind: 'docs';
      applicationId: string;
      shopName: string;
      /** The papers on the application, each with whether it is in. */
      papers: Array<{ slot: string; label: string; present: boolean; r2Key: string | null; previewUrl: string | null }>;
      /** The checks the verify desk already runs, condensed: label + ok / not / manual. */
      checks: Array<{ label: string; outcome: 'pass' | 'mismatch' | 'manual'; detail: string | null }>;
    }
  | {
      kind: 'names';
      requestId: string;
      field: 'business_name' | 'business_slug';
      shopName: string;
      current: string | null;
      requested: string | null;
      note: string | null;
    }
  | {
      kind: 'cards';
      flagId: string;
      shopName: string;
      matchShopName: string;
      flaggedUrl: string | null;
      sourceUrl: string | null;
      /** Hamming distance → a match percentage for the reader. */
      matchPct: number;
      /** The flagged shop is not verified — the second reason a card waits. */
      unverifiedShop: boolean;
    }
  | {
      kind: 'types';
      requestId: string;
      label: string;
      status: 'pending' | 'linked';
      eventType: string | null;
      askedBy: string;
    }
  | {
      kind: 'msgs';
      messageId: string;
      shopName: string;
      subject: string;
      body: string;
      reply: string | null;
    }
);

/** A kind whose read failed is said — never drawn as "nothing waiting". `absent` = the store is not shipped yet. */
export type SupplierWorkRead = {
  items: SupplierWorkItem[];
  failed: SupplierWorkKind[];
  absent: SupplierWorkKind[];
};

/** Oldest first (the prototype: "Everything that needs you, oldest first"); ties keep kind order. */
export function orderSupplierWork(items: readonly SupplierWorkItem[]): SupplierWorkItem[] {
  const rank = (k: SupplierWorkKind) => SUPPLIER_WORK_KINDS.indexOf(k);
  return items.slice().sort((a, b) => a.at.localeCompare(b.at) || rank(a.kind) - rank(b.kind));
}

export function countByKind(items: readonly SupplierWorkItem[]): Record<SupplierWorkKind, number> {
  const out = { docs: 0, names: 0, cards: 0, types: 0, msgs: 0 } as Record<SupplierWorkKind, number>;
  for (const i of items) out[i.kind] += 1;
  return out;
}

/** 64-bit pHash Hamming distance → "96% match" (0 = identical). */
export function matchPercent(hamming: number): number {
  const d = Math.max(0, Math.min(64, Math.round(hamming)));
  return Math.round(((64 - d) / 64) * 100);
}

/** A web address as people read it. */
export function shopAddress(slug: string | null | undefined): string {
  return slug ? `setnayan.com/${slug}` : '—';
}

/**
 * The URL a Work form returns to, with the outcome — the row is done, the admin stays on Work.
 * Drops `item` (the row just settled) and any old outcome, keeps `kind` (the chip) and the rest.
 */
export function workBackHref(back: string, outcome: string, why?: string): string {
  const [path, query = ''] = back.split('?');
  const p = new URLSearchParams(query);
  p.delete('item');
  p.delete('settle');
  p.delete('why');
  p.set('settle', outcome);
  if (why) p.set('why', why.slice(0, 200));
  return `${path}?${p.toString()}`;
}

/**
 * The `error=` a refusing page action redirected with, or null when the redirect was its success.
 * 🚨 A page action ALSO refuses by redirecting (`fail()` in corrections → `?error=<why>`); a wrapper that swallowed
 * every redirect announced those refusals as success. Reads Next's redirect digest: `NEXT_REDIRECT;<type>;<url>;…`.
 */
export function redirectRefusal(digest: string): string | null {
  const url = digest.split(';')[2] ?? '';
  const q = url.indexOf('?');
  if (q === -1) return null;
  const err = new URLSearchParams(url.slice(q + 1)).get('error');
  return err === null ? null : err || 'That could not be done.';
}
