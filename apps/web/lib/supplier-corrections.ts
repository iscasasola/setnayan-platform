/**
 * ✏️ WHEN THE COUPLE APPROVES A SUPPLIER WHO JOINED FROM THEIR LINK, THEIR LIST TAKES THE SUPPLIER'S CORRECTIONS
 * (DECISION_LOG 2026-11-07, "WHEN THE COUPLE APPROVES A SUPPLIER WHO JOINED FROM THEIR LINK…" and the row under it,
 * "A SUPPLIER'S CORRECTION: CONTACT DETAILS ONLY NOTIFY; A PRICE OR SERVICE CHANGE NEEDS THE COUPLE'S APPROVAL").
 * Owner, verbatim: *"changing name or number, address, just gets notified."*
 *
 * 🔑 THE SHAPE: NOTHING IS COPIED, NO NEW COLUMN.
 *   · The couple's own record (`event_vendors` + their hand-typed card `event_manual_vendors`) is left exactly as they
 *     typed it — it is what the supplier's details are compared against.
 *   · On Approve, `answerClaimAccess` compares that record with the shop (`vendor_profiles`, where every claim door
 *     writes its corrections — the shipped `/vendor/claim` finalize and the open-shop claim door alike) and stores the
 *     difference on the answered ask itself: `event_access_requests.decisions.updated`. That row is read by the couple
 *     of that event and by the supplier who asked, and by nobody else (`event_access_requests_host_read` is
 *     couple-scoped) — which makes the ask the "revealed to this couple" rule as well.
 *   · The couple's Suppliers page reads its answered, granted claim asks and, for the row the ask points at (still
 *     bonded to the same shop), draws the shop's REAL name — even while the shop is anonymous to everyone else — and
 *     marks what changed.
 *
 * 📞 THE PHONE AND THE ADDRESS ARE SHOWN IN FULL, TO THE INVITING COUPLE ONLY (owner, 2026-11-07, verbatim: *"we are
 * giving them more freedom to talk outside since we already tracked them from our website that they have been
 * discovered by others. we allow their calling on the app and video calls on the app. that is already built. but only
 * for booked."*). The couple brought this supplier to Setnayan themselves, so the number and address are theirs to
 * see; the reveal is the same couple-scoped RLS on the ask that reveals the real name, and nobody else ever reads it.
 * This is the one surface `lib/no-door-out-of-the-app.test.ts` lets through, by name.
 *
 * 🛑 CONTACT DETAILS ONLY. A price, or the services on the couple's booking or package, is never part of this — a change
 * to what they BOUGHT reaches them only as an amendment through the shipped flow (`proposal_amendments`,
 * `createAmendmentFromChat` in `app/_components/negotiation-actions.ts`). Services a supplier adds to their own shop
 * stay on the shop and do not touch the couple (owner 2026-11-07).
 *
 * Pure: no imports besides the phone rule, so the action, the page and the tests share one rule.
 */
import { parseVendorPhone } from '@/lib/phone-rules';

/** The contact details a supplier can correct — and nothing else. */
export const CORRECTABLE_FIELDS = ['name', 'person', 'phone', 'address'] as const;
export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

export type ContactDetails = Partial<Record<CorrectableField, string | null>>;

/** One corrected detail: what the couple had (null = nothing typed) and what the supplier says. */
export type Correction = { from: string | null; to: string };
export type SupplierCorrections = Partial<Record<CorrectableField, Correction>>;

const FIELD_WORD: Readonly<Record<CorrectableField, string>> = {
  name: 'name',
  person: 'contact person',
  phone: 'phone',
  address: 'address',
};

const FIELD_LABEL: Readonly<Record<CorrectableField, string>> = {
  name: 'Name',
  person: 'Contact person',
  phone: 'Phone',
  address: 'Address',
};

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** Two values are the same detail when they say the same thing — case and spacing aside, a phone by its number. */
function sameDetail(field: CorrectableField, a: string, b: string): boolean {
  if (field === 'phone') {
    const pa = parseVendorPhone(a, 'PH');
    const pb = parseVendorPhone(b, 'PH');
    if (pa.ok && pb.ok) return pa.e164 === pb.e164;
    return a.replace(/\D/g, '') === b.replace(/\D/g, '');
  }
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * What the supplier corrected: every detail the shop states that differs from what the couple typed. A detail the shop
 * leaves blank is never a correction (blank says nothing), and a detail the couple never typed but the shop states is
 * one (`from: null`) — the couple learns it.
 */
export function supplierCorrections(couple: ContactDetails, shop: ContactDetails): SupplierCorrections {
  const out: SupplierCorrections = {};
  for (const field of CORRECTABLE_FIELDS) {
    const to = clean(shop[field]);
    if (!to) continue;
    const from = clean(couple[field]);
    if (from && sameDetail(field, from, to)) continue;
    out[field] = { from: from || null, to };
  }
  return out;
}

export function correctedFields(c: SupplierCorrections | null | undefined): CorrectableField[] {
  return c ? CORRECTABLE_FIELDS.filter((f) => c[f]) : [];
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** "Name updated by the supplier" · "Name and phone updated by the supplier". Null when nothing changed. */
export function correctionsMark(c: SupplierCorrections | null | undefined): string | null {
  const fields = correctedFields(c);
  if (fields.length === 0) return null;
  const words = joinWords(fields.map((f) => FIELD_WORD[f]));
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} updated by the supplier`;
}

/** The row's short word, for a line that is already tight. */
export const CORRECTIONS_SHORT = 'updated by the supplier';

/** A phone reads the one way the app writes numbers (`+63 918 111 2222`); anything unparseable reads as typed. */
function shown(field: CorrectableField, value: string): string {
  if (field !== 'phone') return value;
  const p = parseVendorPhone(value, 'PH');
  return p.ok ? p.display : value;
}

/**
 * The ⓘ's lines, the new value in full beside the old one:
 * "Name: Kusina ni Lola Catering (was Kusina ni Lola)" · "Phone: +63 918 111 2222 (was +63 917 000 0000)".
 */
export function correctionsDetail(c: SupplierCorrections | null | undefined): string[] {
  return correctedFields(c).map((f) => {
    const x = c![f]!;
    const to = shown(f, x.to);
    return x.from ? `${FIELD_LABEL[f]}: ${to} (was ${shown(f, x.from)})` : `${FIELD_LABEL[f]}: ${to}`;
  });
}

/** Read `decisions.updated` back off an answered ask. Anything malformed reads as no corrections. */
export function readCorrections(decisions: unknown): SupplierCorrections {
  const raw = (decisions as { updated?: unknown } | null)?.updated;
  if (!raw || typeof raw !== 'object') return {};
  const out: SupplierCorrections = {};
  for (const f of CORRECTABLE_FIELDS) {
    const v = (raw as Record<string, unknown>)[f] as { from?: unknown; to?: unknown } | undefined;
    if (!v || typeof v !== 'object') continue;
    if (typeof v.to !== 'string' || !v.to.trim()) continue;
    out[f] = { from: typeof v.from === 'string' && v.from.trim() ? v.from : null, to: v.to };
  }
  return out;
}

/** An answered claim ask as the couple's page reads it (couple-scoped RLS). */
export type AnsweredClaimAsk = {
  event_vendor_id: string | null;
  vendor_profile_id: string | null;
  decisions: unknown;
};

/** The couple's own view of a supplier they let in: whose shop, and what they corrected. */
export type ClaimReveal = { shopId: string; corrections: SupplierCorrections };

/**
 * 🔓 WHICH ROWS THE INVITING COUPLE SEES BY THE SHOP'S REAL NAME — the rows a GRANTED claim ask points at. Only the
 * couple of the event can read these asks, so for any other viewer (another event's couple, a helper, a guest, anon)
 * this map is empty and every name stays as hybrid anonymity resolves it.
 */
export function claimReveals(asks: readonly AnsweredClaimAsk[] | null | undefined): Map<string, ClaimReveal> {
  const out = new Map<string, ClaimReveal>();
  for (const a of asks ?? []) {
    const access = (a.decisions as { access?: unknown } | null)?.access;
    if (access !== 'granted' || !a.event_vendor_id || !a.vendor_profile_id) continue;
    out.set(a.event_vendor_id, { shopId: a.vendor_profile_id, corrections: readCorrections(a.decisions) });
  }
  return out;
}

/**
 * The reveal for THIS row — only while the row is still bonded to the shop that was let in. A row the couple later
 * re-pointed at another shop never shows that other shop's real name.
 */
export function revealFor(
  reveals: ReadonlyMap<string, ClaimReveal>,
  eventVendorId: string,
  shopId: string | null | undefined,
): ClaimReveal | null {
  const r = reveals.get(eventVendorId);
  return r && shopId && r.shopId === shopId ? r : null;
}

/**
 * The name the row draws: the shop's REAL name for the couple who invited and let them in (they already know who it is),
 * and hybrid anonymity's answer (`resolveVendorDisplayName`) for everyone else.
 */
export function invitedCoupleName(reveal: ClaimReveal | null, businessName: string | null | undefined, resolvedName: string): string {
  const real = clean(businessName);
  return reveal && real ? real : resolvedName;
}

/** The couple's notice: what changed, in the app (never an email). Null when nothing did. */
export function correctionsNotice(args: {
  eventId: string;
  eventVendorId: string;
  shopName: string | null;
  corrections: SupplierCorrections;
}): { title: string; body: string; relatedUrl: string } | null {
  const fields = correctedFields(args.corrections);
  if (fields.length === 0) return null;
  const who = clean(args.shopName) || 'Your supplier';
  return {
    title: `${who} updated their ${joinWords(fields.map((f) => FIELD_WORD[f]))}`,
    body: `${correctionsDetail(args.corrections).join(' · ')}. Your Suppliers list shows their details now.`,
    // `?tab=budget` opens Booked (`suppliersModeOfTab`) and `?team=` opens their row in it.
    relatedUrl: `/dashboard/${args.eventId}/vendors?tab=budget&team=${encodeURIComponent(args.eventVendorId)}`,
  };
}
