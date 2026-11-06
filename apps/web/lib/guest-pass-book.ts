/**
 * lib/guest-pass-book.ts — ONE GUEST PASS PER EVENT (2026-10-12).
 *
 * 🔴 WHY THIS EXISTS. A browser held ONE guest pass (`setnayan_guest_session`,
 * lib/guest-session.ts). Opening a second event's personal link REPLACED it, so a
 * guest invited to two events — common in wedding season, and the owner's own
 * desktop Safari on 2026-10-11 (handovers/safari-pass.md: reproduced exactly in
 * WebKit with two tabs) — was thrown to the first event's stranger door the
 * moment the landing's 30-minute re-entry code (`?k=`, #6480) was gone.
 *
 * 🔑 THE DESIGN — the fewest moving parts that keep every reader as it is:
 *   · `setnayan_guest_session` stays EXACTLY what it was: the ACTIVE pass, the
 *     one cookie ~70 readers read. A browser holding only that cookie (every
 *     guest today) keeps working; nothing about it is read differently.
 *   · `setnayan_guest_passes` — THE PASS BOOK — is one signed cookie (the same
 *     seal) holding up to {@link GUEST_PASS_BOOK_CAP} passes, ONE PER EVENT,
 *     newest first, the oldest out. Every pass write puts the new pass in it and
 *     moves the pass it replaces (a legacy single cookie too) into it.
 *   · The middleware, on a request for one event's pages, makes THAT event's
 *     pass the active one when the book holds it ({@link bookEntryForPath}).
 *   · `readGuestSession({ eventId })` also finds an event's pass in the book by
 *     its event id — a renamed slug cannot hide it.
 *
 * ⚠ The slug in an entry is a ROUTING HINT, looked up from the database by
 * event id at write time — never the authority. Whatever pass is made active is
 * still verified and DB-checked by `readGuestSession()` (a rotated QR is still
 * signed out), and every page still compares the pass's event to its own.
 *
 * Pure. No I/O — signing lives in lib/guest-session.ts.
 */

export const GUEST_PASS_BOOK_COOKIE_NAME = 'setnayan_guest_passes';

/**
 * How many events one browser keeps a pass for. 8 entries of the longest slug
 * (32) sign to well under 2 KB — the cookie limit is 4 KB per cookie, and the
 * guard measures it (lib/guest-pass-book.test.ts).
 */
export const GUEST_PASS_BOOK_CAP = 8;

export type GuestPassBookEntry = {
  /** Routing hint only (see above); null when the lookup could not answer. */
  slug: string | null;
  guest_id: string;
  event_id: string;
  qr_token: string;
  /** The pass's own expiry (seconds) — a pass never outlives it by riding the book. */
  exp: number;
};

/** The compact wire shape inside the signed cookie: `[slug, guest, event, qr, exp]`. */
export type GuestPassBookWire = [string | null, string, string, string, number];

export function bookToWire(entries: readonly GuestPassBookEntry[]): GuestPassBookWire[] {
  return entries.map((e) => [e.slug, e.guest_id, e.event_id, e.qr_token, e.exp]);
}

/** Reads the wire shape back; anything malformed is dropped, never guessed at. */
export function bookFromWire(raw: unknown): GuestPassBookEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: GuestPassBookEntry[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== 5) continue;
    const [slug, guest, event, qr, exp] = row as unknown[];
    if (slug !== null && typeof slug !== 'string') continue;
    if (typeof guest !== 'string' || typeof event !== 'string' || typeof qr !== 'string') continue;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) continue;
    if (!guest || !event || !qr) continue;
    out.push({ slug: slug ? slug.toLowerCase() : null, guest_id: guest, event_id: event, qr_token: qr, exp });
  }
  return out;
}

/**
 * The next book: `incoming` first (newest first), then what the book held —
 * ONE pass per event (the first seen wins, so a new pass for an event replaces
 * its old one), expired passes dropped, capped with the oldest out.
 */
export function mergeIntoBook(
  book: readonly GuestPassBookEntry[],
  incoming: readonly GuestPassBookEntry[],
  nowSeconds: number,
): GuestPassBookEntry[] {
  const seen = new Set<string>();
  const out: GuestPassBookEntry[] = [];
  for (const e of [...incoming, ...book]) {
    if (e.exp <= nowSeconds) continue;
    if (seen.has(e.event_id)) continue;
    seen.add(e.event_id);
    out.push(e);
    if (out.length >= GUEST_PASS_BOOK_CAP) break;
  }
  return out;
}

/** The book without one event's pass — by its event id, or by its slug hint. */
export function bookWithout(
  book: readonly GuestPassBookEntry[],
  scope: { eventId?: string | null; slug?: string | null },
): GuestPassBookEntry[] {
  const slug = scope.slug ? scope.slug.toLowerCase() : null;
  return book.filter(
    (e) => !(scope.eventId && e.event_id === scope.eventId) && !(slug && e.slug === slug),
  );
}

/** The book with one pass's expiry slid forward (the middleware's refresh of that pass). */
export function bookWithExp(
  book: readonly GuestPassBookEntry[],
  pass: { guest_id: string; event_id: string },
  exp: number,
): GuestPassBookEntry[] | null {
  let changed = false;
  const out = book.map((e) => {
    if (e.event_id !== pass.event_id || e.guest_id !== pass.guest_id || e.exp >= exp) return e;
    changed = true;
    return { ...e, exp };
  });
  return changed ? out : null;
}

/** The latest expiry in the book (the book cookie lives as long as its longest pass). */
export function bookExp(book: readonly GuestPassBookEntry[]): number {
  return book.reduce((m, e) => Math.max(m, e.exp), 0);
}

/**
 * Which event a request is FOR, as the book can see it from the address:
 *   · `/{slug}/…` → that slug;
 *   · `/u/{user}/{slug}/…` — the nested address the middleware rewrites to `/{slug}/…`
 *     (the caller passes the rewritten path; see middleware.ts);
 *   · `/join/{eventId}/…` → that event id.
 */
export function bookEntryForPath(
  book: readonly GuestPassBookEntry[],
  pathname: string,
  nowSeconds: number,
): GuestPassBookEntry | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0]!.toLowerCase();
  const live = book.filter((e) => e.exp > nowSeconds);
  if (first === 'join' && segments[1]) {
    return live.find((e) => e.event_id === segments[1]) ?? null;
  }
  return live.find((e) => e.slug === first) ?? null;
}
