/**
 * 🤝 INVITE A SUPPLIER — the words and the one address (owner 16 Nov 2026, DECISION_LOG "Invite a supplier v3
 * APPROVED"; prototype specs cb1affde `prototypes/invite_a_supplier_2026-11-16/invite_a_supplier_2026-11-16_fable.html`).
 *
 *   · ONE link per shop, `/i/<business_slug>`, with its QR. It never runs out (owner answer 3: no cap).
 *   · Joining through it IS the accept: one accepted `vendor_partnerships` row, origin `invited`
 *     (`supplier_invite_join`, migration 20271350444634). A shop CREATED through it is the Invites record
 *     (`brought_new_shop`); a shop that already existed makes the handshake and is never counted (answer 2).
 *   · Every tie says where it came from — `worked_together` · `added` · `invited` — the ⓘ tag on Trusted by.
 *
 * Pure: no session, no read. The reads are `supplier-invite.server.ts`.
 */

/** Where each partnership came from (`vendor_partnerships.origin`). */
export const PARTNERSHIP_ORIGINS = ['worked_together', 'added', 'invited'] as const;
export type PartnershipOrigin = (typeof PARTNERSHIP_ORIGINS)[number];

export function isPartnershipOrigin(v: unknown): v is PartnershipOrigin {
  return typeof v === 'string' && (PARTNERSHIP_ORIGINS as readonly string[]).includes(v);
}

/** An unknown or missing origin is the only way in before 16 Nov: worked together. */
export function originOf(v: unknown): PartnershipOrigin {
  return isPartnershipOrigin(v) ? v : 'worked_together';
}

/** The ⓘ tags, as drawn: "The ⓘ tags: Worked together · Added · Invited". */
export const ORIGIN_TAG: Readonly<Record<PartnershipOrigin, string>> = {
  worked_together: 'Worked together',
  added: 'Added',
  invited: 'Invited',
};

/** The address of a shop's invite link. */
export function supplierInvitePath(slug: string): string {
  return `/i/${encodeURIComponent(slug)}`;
}

/** The cookie that carries "which shop's link" from the door through the shop setup (and any sign-in round trip). */
export const SUPPLIER_INVITE_COOKIE = 'sn_supplier_invite';
/** Seven days: a link opened today and a shop made this week. */
export const SUPPLIER_INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** A business slug, as the database mints it (lowercase letters, digits, hyphens). Anything else is not a link. */
export function cleanInviteSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s) ? s : null;
}

/* ── The card at the top of Shop › Partnerships ─────────────────────────────────────────────────────────────── */

export const ADD_PREFERRED_TITLE = 'Add a preferred supplier';
export const ADD_PREFERRED_LINE =
  'Add a Setnayan shop you trust, or invite one that isn’t here yet. You become each other’s preferred supplier.';
/** The ⓘ on Invite a supplier, word for word. */
export const INVITE_INFO =
  'When a supplier joins Setnayan through your link, you are each other’s preferred supplier. Each one counts toward your Invites badge after their first completed booking.';
export const INVITE_SHEET_TITLE = 'Invite a supplier';
export const INVITE_QR_LINE = 'Scan to join Setnayan as our preferred supplier.';
export const INVITE_SHARE_NOTE =
  'The phone’s own share opens, so the link comes from you. One link for every supplier you invite; it never runs out.';
export const ADD_SHEET_TITLE = 'Add a shop';
export const ADD_SHEET_NOTE =
  'They are on your Trusted by at once. You show on theirs once they accept, through their Incoming requests.';

/** "2 joined through your link" — null when nobody has yet (the line is not drawn). */
export function joinedThroughLinkLine(joined: number): string | null {
  if (!Number.isFinite(joined) || joined <= 0) return null;
  return `${joined} joined through your link`;
}

/* ── The rows ───────────────────────────────────────────────────────────────────────────────────────────────── */

// "16 Nov", as drawn — day first (en-GB), on the Manila calendar.
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
function day(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DAY.format(d);
}

/**
 * The one quiet line under a partner's name in Shop › Partnerships, as drawn:
 *   inviter  — "Invited · joined through your link · 16 Nov"
 *   invitee  — "Invited you · 16 Nov"
 *   added    — "Added by you" / "Added you"
 *   worked   — "Worked together · 2 events" (the count is the served-together read; absent → "Worked together")
 */
export function partnerLine(p: {
  origin: PartnershipOrigin;
  iProposed: boolean;
  at: string | null;
  events?: number | null;
}): string {
  const when = day(p.at);
  const tail = when ? ` · ${when}` : '';
  if (p.origin === 'invited') return p.iProposed ? `Invited · joined through your link${tail}` : `Invited you${tail}`;
  if (p.origin === 'added') return p.iProposed ? `Added by you${tail}` : `Added you${tail}`;
  const n = p.events ?? 0;
  return n > 0 ? `Worked together · ${n} ${n === 1 ? 'event' : 'events'}` : 'Worked together';
}

/** The incoming request's line for a hand add: "Added you as a preferred supplier · 16 Nov". */
export function addedYouLine(at: string | null): string {
  const when = day(at);
  return `Added you as a preferred supplier${when ? ` · ${when}` : ''}`;
}

/** The sent row's line for a hand add: "Added by you · Waiting for them to accept". */
export const ADDED_WAITING_LINE = 'Added by you · Waiting for them to accept';

/* ── Trusted by on the shop page ────────────────────────────────────────────────────────────────────────────── */

/** The section's line, as drawn: "Suppliers <shop> works with." */
export function trustedByLine(businessName: string): string {
  return `Suppliers ${businessName} works with.`;
}

/**
 * The ⓘ under one partner on a shop page — the tag and one sentence. `shop` is the page's shop; `other` is the
 * partner. `direction` says who made the tie: `this_shop` (the page's shop invited / added the partner) or `partner`.
 */
export function trustedByHint(p: {
  origin: PartnershipOrigin;
  shop: string;
  other: string;
  direction: 'this_shop' | 'partner';
  events?: number | null;
}): string {
  if (p.origin === 'invited') {
    return p.direction === 'this_shop'
      ? `Joined Setnayan through ${p.shop}’s link.`
      : `${p.shop} joined Setnayan through ${p.other}’s link.`;
  }
  if (p.origin === 'added') {
    return p.direction === 'this_shop' ? `${p.shop} added ${p.other} as a preferred supplier.` : `${p.other} added ${p.shop} as a preferred supplier.`;
  }
  const n = p.events ?? 0;
  return n > 0 ? `Served ${n} ${n === 1 ? 'event' : 'events'} together on Setnayan.` : 'Served an event together on Setnayan.';
}

/* ── The Invites badge's count line ─────────────────────────────────────────────────────────────────────────── */

/**
 * "0 counted · 2 joined, waiting for their first completed booking" — the only line this build adds to the Invites
 * badge (the graph is #7808). `null` facts = the read failed: the caller says it could not count, never "0".
 */
export function invitesCountLine(f: { counted: number; joined: number }): string {
  const waiting = Math.max(0, f.joined - f.counted);
  if (waiting === 0) return `${f.counted} counted`;
  return `${f.counted} counted · ${waiting} joined, waiting for their first completed booking`;
}
