/**
 * request-card.ts — ONE card for every Work request (owner approved 2026-11-14: "approved admin request cards"; drawing
 * `prototypes/admin_request_cards_2026-11-14_fable.html` in the specs repo, findings
 * `prototypes/admin_work_cards_findings_2026-11-14.md`).
 *
 * Owner, verbatim, on the screen this replaces: *"it matters that our admin dashboard design is fully functioning with
 * easy presentation of the different functions, requests."* Work › All › Profile corrections read "Change logo_url",
 * two r2:// paths, an `apply` select and a reason select already showing "Too close to another shop's name".
 *
 * The card, always in this order:
 *   1. a plain title — WHO wants WHAT ("Liwanag Lights & Sound wants a new logo"), a soft queue chip, the age;
 *   2. the real thing — old vs new logo as pictures, old vs new text, the papers, the receipt, the review;
 *   3. who asked + when, "Open shop ↗" (the public page) and "Open record";
 *   4. the footer — decide here · one detail · open the case · done elsewhere. Which one a queue gets was decided in
 *      code before this card existed (JUDGEMENT_QUEUES, SETTLED_ELSEWHERE, what each action refuses to run without);
 *      the card does not re-decide it.
 *
 * 🔑 A DECLINE IS PICKED FROM A LIST THAT FITS WHAT WAS ASKED, AND NOTHING IS PICKED FOR YOU. The lists live in
 * `supplier-work.ts` (`SUPPLIER_WORK_REASONS`), the actions refuse a reason that is not one of their words.
 *
 * Pure: no React, no database — so the words can be tested by calling them.
 */

import { LOCKED_FIELD_LABEL, isLockedIdentityFieldKey } from '@/lib/vendor-corrections';
import { SUPPLIER_WORK_REASONS, correctionReasonList, type ReasonList } from '@/lib/admin/supplier-work';

/** The server action a card's buttons post to — mapped to the real function in the drawer, one table. */
export type CardActionKind =
  | 'payment'
  | 'verify'
  | 'approval'
  | 'review'
  | 'payout'
  | 'help'
  | 'chat-flag'
  | 'correction'
  | 'subscription'
  | 'payment-option';

/** What the card shows as "the real thing". Never a file address, a field name or a raw code. */
export type CardShow =
  | { kind: 'images'; before: string | null; after: string | null; beforeAlt: string; afterAlt: string }
  | { kind: 'text'; before: string | null; after: string | null }
  | { kind: 'facts'; rows: Array<{ label: string; value: string; tone?: 'ok' | 'warn' }> }
  | { kind: 'papers'; papers: Array<{ label: string; present: boolean; previewUrl: string | null }> }
  | { kind: 'review'; stars: number | null; body: string | null; why: string | null };

export type CardButton = {
  label: string;
  tone: 'ok' | 'danger' | 'warn' | 'neutral';
  /** The green main verb — one per card. */
  main?: boolean;
  /** Hidden fields posted with this button (decision=apply, intent=resubmit …). */
  post: Record<string, string>;
  /** Present ⇒ the button opens a sheet of reasons first. Nothing is picked until the admin picks it. */
  reasons?: { title: string; reader: string; list: ReasonList };
};

/** A detail the decision cannot happen without (payouts: how it was paid + the reference; help: the reply). */
export type CardField =
  | { kind: 'pick'; name: string; label: string; placeholder: string; options: Array<{ key: string; label: string }> }
  | { kind: 'text'; name: string; label: string; placeholder: string; required: boolean; multiline?: boolean };

export type RequestCard = {
  /** "Liwanag Lights & Sound wants a new logo". */
  title: string;
  /** The queue, in words ("Profile correction"). */
  chip: string;
  /** Two letters for the avatar. */
  initials: string;
  /** When it was asked (ISO), or null when unknown. */
  at: string | null;
  /** "Marco Reyes · owner" — who asked. */
  who: string | null;
  /** Their own words, quoted above who asked. */
  quote: string | null;
  show: CardShow[];
  /** The public page (shop, event) — opened in a new tab. */
  shopHref: string | null;
  /** The record behind the request. */
  recordHref: string;
  /** Decide-here / one-detail footers. Absent ⇒ the card says why there is nothing to press (`footNote`). */
  act?: { kind: CardActionKind; id: string; buttons: CardButton[]; fields?: CardField[] };
  /** The sentence where buttons would be (judgement / done elsewhere / no proof yet). */
  footNote?: string;
};

/** Two initials from a name — never from a status or a code ("Camera off" once drew "C"). */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').replace(/[^\p{L}\p{N}\s&]/gu, ' ').split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (words.length === 0) return '·';
  const first = words[0]![0]!;
  const second = words.length > 1 ? words[words.length - 1]![0]! : (words[0]![1] ?? '');
  return (first + second).toUpperCase();
}

/** What a shop is asking for, in words — `wants a new logo`, `wants to rename the shop`, `wants a new HQ address`. */
export function correctionAsk(fieldKey: string | null | undefined): string {
  switch (fieldKey) {
    case 'logo_url':
      return 'wants a new logo';
    case 'business_name':
      return 'wants to rename the shop';
    case 'business_slug':
      return 'wants a new web address';
    default: {
      const label = isLockedIdentityFieldKey(fieldKey) ? LOCKED_FIELD_LABEL[fieldKey] : null;
      return label ? `wants to change its ${label.charAt(0).toLowerCase()}${label.slice(1)}` : 'wants to change a locked detail';
    }
  }
}

/**
 * A stored value as a person reads it. 🔒 A storage address (`r2://…`), a bare object key or an `https://` link to a
 * file is never shown as text — the card shows the picture instead, or says the value is a file.
 */
export function readableValue(fieldKey: string | null | undefined, raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (fieldKey === 'logo_url' || /^r2:\/\//i.test(v)) return null;
  if (fieldKey === 'business_slug') return `setnayan.com/${v}`;
  return v;
}

/** The decline sheet for a correction: its title, who reads it, and the list that FITS the field. */
export function correctionDecline(fieldKey: string | null | undefined, shopName: string): CardButton['reasons'] {
  const label = isLockedIdentityFieldKey(fieldKey) ? LOCKED_FIELD_LABEL[fieldKey].toLowerCase() : 'change';
  return {
    title: fieldKey === 'logo_url' ? 'Why are you declining the new logo?' : `Why are you declining the new ${label}?`,
    reader: `${shopName} will read this.`,
    list: correctionReasonList(fieldKey),
  };
}

/** The words a reason list offers — read by the sheet, so a list is written once. */
export function reasonOptions(list: ReasonList): readonly string[] {
  return SUPPLIER_WORK_REASONS[list];
}

/** Payout methods as people say them (the stored keys `markPayoutPaidAction` accepts). */
export const PAYOUT_METHOD_LABEL: Readonly<Record<string, string>> = {
  gcash: 'GCash',
  bdo_transfer: 'BDO transfer',
  maya: 'Maya',
  check: 'Check',
};

/** Chat-flag categories in words. An unknown category reads as "a contact detail", never its code. */
const CHAT_FLAG_WORD: Readonly<Record<string, string>> = {
  phone: 'a phone number',
  email: 'an email address',
  url: 'a link',
  handle: 'a social media handle',
  app_name: 'a messaging app',
  euphemism: 'a hint to talk elsewhere',
  solicit: 'an ask to pay outside Setnayan',
};

export function chatFlagWhat(categories: readonly string[] | null | undefined): string {
  const words = [...new Set((categories ?? []).map((c) => CHAT_FLAG_WORD[c] ?? 'a contact detail'))];
  if (words.length === 0) return 'a contact detail';
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** A plan tier as the shop knows it. Unknown tiers read as "a plan", never the code. */
const TIER_WORD: Readonly<Record<string, string>> = {
  pro: 'Supplier Pro',
  verified: 'Verified',
};

export function tierWords(tier: string | null | undefined, cycle: string | null | undefined): string {
  const t = TIER_WORD[(tier ?? '').toLowerCase()] ?? 'a plan';
  const c = cycle === 'annual' || cycle === 'yearly' ? ' for a year' : cycle ? ' for 28 days' : '';
  return `${t}${c}`;
}

/**
 * A payment channel in words, or "Method not given" when the payer did not say (walk RW-301: the card read
 * "Sent by: Payment" for an empty method, which reads like an answer). A method we do not know by name is "Another way".
 */
export function channelWords(channel: string | null | undefined): string {
  const c = (channel ?? '').trim().toLowerCase();
  if (!c) return 'Method not given';
  if (c.includes('gcash')) return 'GCash';
  if (c.includes('maya')) return 'Maya';
  if (c.includes('bdo')) return 'BDO';
  if (c.includes('bank')) return 'Bank transfer';
  if (c.includes('cash')) return 'Cash';
  return 'Another way';
}

/**
 * A person's two letters the way the admin's person page draws them (`app/admin/users/[userId]/page.tsx` `initials`):
 * the first letters of the first two words of their name, else the first two letters of their name or email. An email
 * is never split on its dots and @ (walk RW-301: "testnayan4@…" drew "TC" — the T of the name and the C of ".com").
 */
export function personInitials(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name?.trim() || email?.trim() || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/** A payout-destination kind in words. */
export function methodWords(method: string | null | undefined): string {
  const m = (method ?? '').toLowerCase();
  if (m.includes('gcash')) return 'GCash account';
  if (m.includes('maya')) return 'Maya account';
  if (m.includes('bank')) return 'bank account';
  if (m.includes('qr')) return 'QR code';
  if (m.includes('link')) return 'payment link';
  return 'way to be paid';
}

/**
 * 🔎 THE GUARD'S QUESTION, asked of every string a card renders: does it look like a database word? A snake_case
 * token (`logo_url`, `in_progress`) or a storage address (`r2://`) on a card is the defect this file exists to end.
 */
export function looksRaw(s: string | null | undefined): boolean {
  if (!s) return false;
  return /r2:\/\//i.test(s) || /\b[a-z]+_[a-z_]+\b/.test(s);
}

/** "2 days ago" · "5 hours ago" · "just now" — the card's age, in words. */
export function agoWords(iso: string | null | undefined, nowMs: number): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.floor((nowMs - t) / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} days ago`;
}
