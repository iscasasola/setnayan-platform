/**
 * lib/guest-proxy.ts — 🧍‍♀️➡️🧍 A ROLE HOLDER CAN SEND A PROXY. THE ROLE STAYS, THE PROXY STANDS IN.
 *
 * Owner, 2026-10-27 (DECISION_LOG row of that name), verbatim:
 *   *"a person with role cannot come and will have a proxy instead. we do not want to remove the roled person but we
 *    want to allow them to have a proxy."* · *"the dress code, call time, will be same as their proxy role. the person
 *    will replace their seat."* · *"make sure the seats are properly counted. not having 2 guests but 1."* ·
 *   *"so catherine sacdalan's invitation will indicate they are proxying for XXX. giving them the role and dress code,
 *    call time, etc"* · *"this only works if they have role and not guest"*.
 *
 * ── THE ONE LINK ───────────────────────────────────────────────────────────────────────────────────────────────
 * `guests.represented_by_guest_id`, on the ROLE HOLDER, names the PROXY (migration 20271292712479). The database
 * holds who may stand in for whom, moves the seat with the link, and leaves the holder out of its counts. This file is
 * the app's ONE reading of it — pure, no database, no React — so every reader agrees:
 *
 *   · `holdsARole`          — may this guest send a proxy at all (the same words as SQL `guest_holds_a_proxyable_role`).
 *   · `proxyPairs`          — who stands in for whom, over a list of rows.
 *   · `effectiveRoleOf`     — 🔑 THE ROLE A GUEST DRESSES AND ARRIVES AS: their own, or — for a proxy — the role holder's.
 *                             Every dress-code and call-time reader (the card's attire line, Me › Your role / What to
 *                             wear / Arrive by, the ticket's "Arrive by", the checklist, the reminder) passes THIS, never
 *                             `guest.role`, for a guest who stands in. 🔒 lib/a-proxy-wears-the-role.test.ts
 *   · `asOnePair`           — the Guest List's rows: the pair is ONE row (the holder's name and role, the proxy's reply),
 *                             the proxy has no row of their own. Counted by the same `countsTowardEvent`, so List N,
 *                             Attending, No reply and Not coming all count the pair once.
 *   · `cameAfterAll`        — the holder replied "attending" AFTER the link: the host is asked, nothing is changed.
 *   · the words             — "Represented by …", "Proxy for …", "Standing in for … · Principal Sponsor".
 *
 * ⚖ THE HONEST SHAPE OF THE HOLDER'S REPLY: it is NOT rewritten. A represented holder keeps whatever they answered;
 * the pair is counted as the proxy's reply, and every surface says "Represented by <proxy>" where the holder's reply
 * would be. So removing the proxy restores everything exactly — reply, count, seat.
 */
import { guestDisplayName, type GuestRole, type GuestRow, type RsvpStatus } from '@/lib/guests';

/** The roles that are the people the event is FOR — they never send a proxy to their own celebration. */
const NOT_A_PROXYABLE_ROLE: ReadonlySet<GuestRole> = new Set<GuestRole>(['guest', 'bride', 'groom', 'celebrant']);

type Roles = Pick<GuestRow, 'role'> & { extra_roles?: readonly GuestRole[] | null };

/**
 * May this guest send someone in their place? Only a guest who HOLDS A ROLE — a sponsor, an attendant, a parent, a
 * reader — never a plain guest, never the couple or the celebrant (owner: *"this only works if they have role and not
 * guest"*). The database refuses the same (`guest_holds_a_proxyable_role`); this decides what the card OFFERS.
 */
export function holdsARole(g: Roles): boolean {
  if (g.role === 'bride' || g.role === 'groom') return false;
  if (!NOT_A_PROXYABLE_ROLE.has(g.role)) return true;
  return (g.extra_roles ?? []).some((r) => !NOT_A_PROXYABLE_ROLE.has(r));
}

/** The role a proxy takes on — the holder's main role, or (a plain-guest main role) their first named extra role. */
export function roleOfRecord(holder: Roles): GuestRole {
  if (!NOT_A_PROXYABLE_ROLE.has(holder.role)) return holder.role;
  return (holder.extra_roles ?? []).find((r) => !NOT_A_PROXYABLE_ROLE.has(r)) ?? holder.role;
}

export const PROXY_NEEDS_A_ROLE = 'Only a guest with a role can send someone in their place.';

type Linkable = Pick<GuestRow, 'guest_id'> & { represented_by_guest_id?: string | null };

export type ProxyPairs<T extends Linkable> = {
  /** holder guest_id → the proxy's row */
  proxyOf: Map<string, T>;
  /** proxy guest_id → the holder's row */
  holderOf: Map<string, T>;
};

/** Who stands in for whom among these rows. A link whose proxy is not in the list is left out of both maps. */
export function proxyPairs<T extends Linkable>(rows: readonly T[]): ProxyPairs<T> {
  const byId = new Map(rows.map((r) => [r.guest_id, r] as const));
  const proxyOf = new Map<string, T>();
  const holderOf = new Map<string, T>();
  for (const r of rows) {
    const p = r.represented_by_guest_id;
    if (!p || p === r.guest_id) continue;
    const proxy = byId.get(p);
    if (!proxy) continue;
    proxyOf.set(r.guest_id, proxy);
    holderOf.set(proxy.guest_id, r);
  }
  return { proxyOf, holderOf };
}

/** The role holder a proxy stands in for — what a guest-facing or card reader needs to know about them. */
export type StandingInFor = {
  guestId: string;
  /** The list's name — "Ma. Theresa Sacdalan-Tria". */
  name: string;
  role: GuestRole;
  extra_roles: GuestRole[];
};

/** The proxy a holder is represented by. */
export type RepresentedBy = { guestId: string; name: string; rsvp: RsvpStatus };

/**
 * 🔑 THE ROLE THIS GUEST DRESSES AND ARRIVES AS. A proxy wears the role they stand in for — its dress code and its
 * call time (owner: *"the dress code, call time, will be same as their proxy role"*); everyone else wears their own.
 * Pass `standingInFor` (from `proxyPairs` or the guest-side read) when you have it; null/undefined = their own role.
 */
export function effectiveRoleOf(
  guest: Roles,
  standingInFor?: Pick<StandingInFor, 'role' | 'extra_roles'> | null,
): GuestRole {
  return standingInFor ? roleOfRecord(standingInFor) : guest.role;
}

/** "Standing in for Mrs. Ma. Theresa Sacdalan-Tria · Principal Sponsor" — the proxy's own invitation and Me. */
export function standingInWords(holderName: string, roleWord: string): string {
  return `Standing in for ${holderName} · ${roleWord}`;
}
/** "Maria Catherine Sacdalan is standing in for you" — the holder's own invitation. */
export function standsInForYouWords(proxyName: string): string {
  return `${proxyName} is standing in for you`;
}
/** "Represented by Maria Catherine Sacdalan" — the holder's list row and card. */
export function representedByWords(proxyName: string): string {
  return `Represented by ${proxyName}`;
}
/** "Proxy for Mrs. Ma. Theresa Sacdalan-Tria" — the proxy's card. */
export function proxyForWords(holderName: string): string {
  return `Proxy for ${holderName}`;
}
/** "… (represented by …)" — the entourage, the program, the prints. */
export function representedOnPrint(holderLine: string, proxyName: string): string {
  return `${holderLine} (represented by ${proxyName})`;
}

/**
 * The holder answered "attending" AFTER the proxy was linked — the card asks the host ("says she can come after all —
 * keep the proxy?"). Never acted on by itself: the host decides.
 */
export function cameAfterAll(
  holder: Pick<GuestRow, 'rsvp_status'> & {
    represented_by_guest_id?: string | null;
    represented_since?: string | null;
    rsvp_set_by?: 'guest' | 'host' | null;
    rsvp_responded_at?: string | null;
  },
): boolean {
  if (!holder.represented_by_guest_id || holder.rsvp_status !== 'attending' || holder.rsvp_set_by !== 'guest') return false;
  if (!holder.represented_since || !holder.rsvp_responded_at) return false;
  return Date.parse(holder.rsvp_responded_at) > Date.parse(holder.represented_since);
}

/** The holder named someone on their reply, and the host has not linked anyone yet. */
export function namedAProxy(holder: { represented_by_guest_id?: string | null; proxy_named_by_guest?: string | null }): string | null {
  if (holder.represented_by_guest_id) return null;
  const n = holder.proxy_named_by_guest?.trim();
  return n ? n : null;
}

/** What a Guest List row carries for a pair — drawn on its line 2 and searched. */
export type PairOnRow = { proxyId: string; proxyName: string };

/**
 * 🧍 THE GUEST LIST'S ROWS — THE PAIR IS ONE ROW (owner: *"not having 2 guests but 1"*; controller's design: the role
 * holder's name and role on line 1, "Represented by <proxy>" on line 2, the reply pill = the PROXY's reply; the proxy
 * has no row of their own; search for either name finds the pair; a reply filter uses the proxy's reply).
 *
 * Returns the rows to draw and count: the holder's row stands for the pair, carrying the proxy's reply and invitation
 * stamp (the proxy is the one who comes and is sent an invite) and NO `represented_by_guest_id` — so the same
 * `countsTowardEvent` that counts every other row counts this one ONCE. `pairs` maps each pair row to its proxy.
 * A link whose proxy is not on the list (a refused read) leaves the holder's row as it is — represented, uncounted —
 * rather than inventing a reply.
 */
export function asOnePair<
  T extends Linkable & Pick<GuestRow, 'rsvp_status'> & {
    invitation_sent_at?: string | null;
    first_name: string;
    last_name: string;
    display_name: string | null;
  },
>(rows: readonly T[]): { rows: T[]; pairs: Map<string, PairOnRow> } {
  const { proxyOf, holderOf } = proxyPairs(rows);
  const pairs = new Map<string, PairOnRow>();
  const out: T[] = [];
  for (const r of rows) {
    if (holderOf.has(r.guest_id)) continue; // the proxy is drawn on their holder's row
    const proxy = proxyOf.get(r.guest_id);
    if (!proxy) {
      out.push(r);
      continue;
    }
    pairs.set(r.guest_id, { proxyId: proxy.guest_id, proxyName: guestDisplayName(proxy) });
    out.push({
      ...r,
      rsvp_status: proxy.rsvp_status,
      invitation_sent_at: proxy.invitation_sent_at ?? null,
      represented_by_guest_id: null,
    });
  }
  return { rows: out, pairs };
}
