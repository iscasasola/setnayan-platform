/**
 * service-requests.ts — the rules of "a service we don't list" (owner rulings 2026-11-13).
 *
 * Pure: no database, no React, so every rule here is unit-tested in `service-requests.test.ts`.
 * The pages (`/vendor-dashboard/services/requests`, `/admin/categories/requests`) and the one
 * decision action read their words and their arithmetic from HERE, so the supplier's badge, the
 * admin's badge, the notice and the "n cards move from … to …" line can never disagree.
 *
 * The shipped table is `taxonomy_category_requests` (20260811000000). Its five statuses are kept
 * exactly; what changes is the WORDS (the owner's, DECISION_LOG 2026-11-13):
 *   Waiting · Added as a new service · Moved to "…" · Kept just for your shop · Not added
 *
 * 🔑 "<category> › Others" IS A PLACE THAT IS DRAWN, NOT A ROW. A waiting card carries the request
 * (`vendor_services.category_request_id`); the request carries the category the supplier picked
 * (`tile_id`). There is no Others row in the taxonomy and there must never be one — the owner chose
 * a tag over 80 new tier-3 rows.
 */

export type RequestStatus = 'pending' | 'promoted' | 'mapped' | 'kept_private' | 'rejected';

export const REQUEST_STATUSES: readonly RequestStatus[] = ['pending', 'promoted', 'mapped', 'kept_private', 'rejected'];

export function isRequestStatus(v: unknown): v is RequestStatus {
  return typeof v === 'string' && (REQUEST_STATUSES as readonly string[]).includes(v);
}

/** Badge tone, one colour per meaning: wait (terracotta tint) · ok (green) · info · grey · bad (red). */
export type StatusTone = 'wait' | 'ok' | 'info' | 'grey' | 'bad';

/** The supplier's words for a status (owner, verbatim list). `movedTo` is the service's label. */
export function supplierStatusWord(status: RequestStatus, movedTo: string | null): { word: string; tone: StatusTone } {
  switch (status) {
    case 'pending':
      return { word: 'Waiting', tone: 'wait' };
    case 'promoted':
      return { word: 'Added as a new service', tone: 'ok' };
    case 'mapped':
      return { word: movedTo ? `Moved to “${movedTo}”` : 'Moved to a service we have', tone: 'info' };
    case 'kept_private':
      return { word: 'Kept just for your shop', tone: 'grey' };
    case 'rejected':
      return { word: 'Not added', tone: 'bad' };
  }
}

/** The admin's shorter words (the prototype's list badges). */
export function adminStatusWord(status: RequestStatus): { word: string; tone: StatusTone } {
  switch (status) {
    case 'pending':
      return { word: 'Pending', tone: 'wait' };
    case 'promoted':
      return { word: 'Added', tone: 'ok' };
    case 'mapped':
      return { word: 'Moved', tone: 'info' };
    case 'kept_private':
      return { word: 'Kept for shop', tone: 'grey' };
    case 'rejected':
      return { word: 'Not added', tone: 'bad' };
  }
}

/** "<category> › Others" — the waiting place, drawn from the request's category. */
export function othersPlace(categoryLabel: string | null): string {
  return `${categoryLabel ?? 'Your category'} › Others`;
}

/**
 * Where a request's cards sit now. Waiting, kept and not-added cards stay under the category's Others;
 * an added or moved request's cards sit under the decided service.
 */
export function placeOf(r: {
  status: RequestStatus;
  categoryLabel: string | null;
  decided: { categoryLabel: string | null; serviceLabel: string } | null;
}): string {
  if ((r.status === 'promoted' || r.status === 'mapped') && r.decided) {
    return `${r.decided.categoryLabel ?? r.categoryLabel ?? 'Your category'} › ${r.decided.serviceLabel}`;
  }
  return othersPlace(r.categoryLabel);
}

/**
 * Two shops asked for "the same name" when their words match after case and spacing are ignored.
 * The admin list groups on this and a decision moves every pending request that shares it.
 */
export function sameNameKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The name a supplier gives a service: 2–80 characters after trimming (the table's own CHECK). */
export function serviceNameProblem(raw: string): string | null {
  const n = raw.trim().length;
  if (n < 2) return 'Give it a name of at least 2 characters.';
  if (n > 80) return 'Keep the name to 80 characters.';
  return null;
}

// ── The one Decision dropdown ────────────────────────────────────────────────

export type DecisionChoice = 'add' | 'move' | 'keep' | 'no';

export const DECISION_CHOICES: ReadonlyArray<{ key: DecisionChoice; label: string; hint: string }> = [
  { key: 'add', label: 'Add as a new service', hint: 'A real service in the directory; their cards move to it.' },
  { key: 'move', label: 'Move to an existing service', hint: 'We already have it under another name.' },
  { key: 'keep', label: 'Keep just for this shop', hint: 'Valid but niche; no directory service.' },
  { key: 'no', label: 'Not added', hint: 'Mis-scoped or not listed; a note is required.' },
];

export function isDecisionChoice(v: unknown): v is DecisionChoice {
  return v === 'add' || v === 'move' || v === 'keep' || v === 'no';
}

/** The status each choice writes — the shipped four outcomes, unchanged. */
export const STATUS_FOR_CHOICE: Record<DecisionChoice, Exclude<RequestStatus, 'pending'>> = {
  add: 'promoted',
  move: 'mapped',
  keep: 'kept_private',
  no: 'rejected',
};

export type DecisionInput = {
  choice: DecisionChoice;
  /** Add: the new service's name (their words unless tidied). */
  name: string;
  /** Add: the category it goes under — preset to where they filed it. */
  tileId: string;
  /** Move: the existing service. */
  target: string;
  note: string;
};

/**
 * The one check every decision passes before anything is written. Returns the problem in plain words,
 * or null. A "Not added" needs a reason the supplier can read (owner ruling 5).
 */
export function decisionProblem(d: DecisionInput): string | null {
  if (d.note.trim().length > 400) return 'Keep the note to 400 characters.';
  switch (d.choice) {
    case 'add': {
      const p = serviceNameProblem(d.name);
      if (p) return p.replace('Give it', 'Give the new service');
      if (!d.tileId) return 'Pick the category it goes under.';
      return null;
    }
    case 'move':
      return d.target ? null : 'Pick the service to move to.';
    case 'keep':
      return null;
    case 'no':
      return d.note.trim().length > 0 ? null : 'A “Not added” needs a reason the supplier can read.';
  }
}

/**
 * "n cards move from A to B" — printed on the admin's decision before they press. A choice that leaves
 * the cards where they are says so instead of pretending to move them.
 */
export function cardsMoveLine(n: number, from: string, to: string | null): string {
  if (n === 0) return 'No cards to move — the shop has not made one here yet.';
  const cards = `${n} card${n === 1 ? '' : 's'}`;
  if (!to || to === from) return `${cards} ${n === 1 ? 'stays' : 'stay'} under ${from}.`;
  return `${cards} ${n === 1 ? 'moves' : 'move'} from ${from} to ${to}.`;
}

/**
 * 🔒 A CARD FOLLOWS A DECISION ONLY WHEN ITS SHOP FILED THE REQUEST. A supplier may write
 * `category_request_id` on their own card (the row is theirs), so a stranger could tag a card with
 * someone else's request id; the decision then refuses to move it. The field is theirs; the request
 * it names must be too.
 */
export function cardMayFollow(card: { vendor_profile_id: string }, request: { proposed_by_vendor_id: string }): boolean {
  return Boolean(card.vendor_profile_id) && card.vendor_profile_id === request.proposed_by_vendor_id;
}

/** Waiting first, then Decided — each newest first. */
export function splitWaitingDecided<T extends { status: RequestStatus; created_at: string; reviewed_at?: string | null }>(
  rows: readonly T[],
): { waiting: T[]; decided: T[] } {
  const byNewest = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  const waiting = rows.filter((r) => r.status === 'pending').sort((a, b) => byNewest(a.created_at, b.created_at));
  const decided = rows
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => byNewest(a.reviewed_at ?? a.created_at, b.reviewed_at ?? b.created_at));
  return { waiting, decided };
}

/** The decided request the supplier has not opened yet — the notice on Services (newest decision). */
export function unseenDecision<T extends { status: RequestStatus; supplier_seen_at: string | null; reviewed_at: string | null }>(
  rows: readonly T[],
): T | null {
  const unseen = rows.filter((r) => r.status !== 'pending' && !r.supplier_seen_at);
  if (unseen.length === 0) return null;
  return [...unseen].sort((a, b) => ((a.reviewed_at ?? '') < (b.reviewed_at ?? '') ? 1 : -1))[0] ?? null;
}

/** The notice's one line, per outcome. */
export function noticeLine(status: Exclude<RequestStatus, 'pending'>, cards: number, place: string): string {
  const yours = `Your ${cards} card${cards === 1 ? '' : 's'}`;
  switch (status) {
    case 'promoted':
      return cards ? `Added as a new service. ${yours} now show under ${place}.` : `Added as a new service: ${place}.`;
    case 'mapped':
      return cards ? `Moved to a service we have. ${yours} now show under ${place}.` : `Moved to ${place}.`;
    case 'kept_private':
      return `Kept just for your shop. Your cards stay under ${place}.`;
    case 'rejected':
      return `Not added. Your cards stay online under ${place}.`;
  }
}

/** Group pending-first rows by same name, for the admin list's "n shops". */
export function shopsAskingByName<T extends { proposed_label: string; proposed_by_vendor_id: string; status: RequestStatus }>(
  rows: readonly T[],
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.status !== 'pending') continue;
    const k = sameNameKey(r.proposed_label);
    const s = m.get(k) ?? new Set<string>();
    s.add(r.proposed_by_vendor_id);
    m.set(k, s);
  }
  return m;
}

// ── Where the pages live (one home, so a link and a redirect can never drift) ──
export const SERVICE_REQUESTS_HREF = '/vendor-dashboard/services/requests' as const;
export const SERVICE_REQUEST_NEW_HREF = '/vendor-dashboard/services/requests/new' as const;
export const ADMIN_SERVICE_REQUESTS_HREF = '/admin/categories/requests' as const;
