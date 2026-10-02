/**
 * record-href.ts — where a found record actually opens.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The Entity map's search has always found real records — typing "setnaprod"
 * returns the owner's own shop — and every hit carried an `href`. **Nothing
 * read it.** The only consumer rendered each hit as a button whose click called
 * `onOpenRecord(h.typeNodeId)`, which highlights the generic TYPE node: you
 * searched for a shop by name and the console opened the word "Vendors". All
 * five kinds behaved that way, and the same field on `UgatRow` was dead in the
 * table browser, which rendered each record's id and threw it away on the very
 * next line.
 *
 * 🔑 THE HREFS WERE TREATED AS UNWRITTEN, NOT HALF-WORKING. Never once
 * exercised, they had drifted to whatever looked plausible: four of the five
 * pointed at a LIST (`/admin/users`, `/admin/payments`, `/admin/taxonomy`) — so
 * even wiring them up verbatim would have "opened" a page with every record on
 * it. Each destination below was re-derived by reading the page it names.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * `ugatRecordHref` returns `string`, never `string | undefined`, and switches
 * exhaustively over `UgatRecordKind`. A sixth kind therefore cannot compile
 * until somebody decides where it opens — which is the property the old
 * optional field failed to have. `UgatSearchHit.href` is required for the same
 * reason: the type system, not a reviewer, is what refuses a dead link now.
 *
 * ── WHY EACH DESTINATION, MEASURED ──────────────────────────────────────────
 * · **vendor** → `/admin/vendors/[vendorProfileId]/edit` — a real per-record
 *   page. The one href that was already right.
 * · **user** → `/admin/users/[userId]` — a real per-record page. The old
 *   `/admin/users` was the list.
 * · **event** → `/admin/accounts?tab=events&q=…`. There is no per-event page.
 *   The Events surface filters on `display_name / slug / public_id`, so a
 *   public id narrows it to exactly one row. Pointed at the CANONICAL address
 *   rather than the `/admin/events` stub that forwards here: sending somebody
 *   to a stub works while telling them the wrong address for where they landed.
 * · **taxonomy** → `/admin/taxonomy?open=<tile_id>`. `?open=` genuinely expands
 *   that tile in the Studio; `?q=` is the fallback when a leaf has no tile.
 * · **order** → `/admin/payments?q=<public id>` — the payments desk, where the
 *   "Record a payment received" card appears the moment the search names
 *   EXACTLY ONE order (`fetchRecordTarget` matches `public_id` /
 *   `reference_code` on the ORDERS table, so it does not need a payment row).
 *   This used to say `/admin/money`, on the reasoning that the desk's list
 *   filters PAYMENTS and an order with no payment returns an empty list. That
 *   reasoning was about the list, and it missed the card: the order with no
 *   payment is exactly the one an admin is searching for when money arrived
 *   that nobody logged (owner 2026-10-01), and `/admin/money` had no way to
 *   record it on a phone. The card shows even when the list below it is empty.
 *   An order with no public id falls back to `/admin/money`, the ledger that
 *   holds every order in every status.
 * · **guest** → the CELEBRATION they belong to, via the `event` arm. A guest
 *   has no admin page of their own — there is no `/admin/guests`, no
 *   `[guestId]` segment anywhere in the admin tree, and the only `from('guests')`
 *   in it is a count. This is not an oversight to route around: the guests
 *   table in this very console already resolves its rows the same way, and says
 *   why ("a guest… has no admin page"). Sending them to the celebration is the
 *   honest answer, and it is the surface any action on a guest would live on.
 *
 * ── WHY THERE IS NO `person` KIND, MEASURED ─────────────────────────────────
 * `public.people` was the other half of the ask and it is deliberately absent,
 * because every destination it could have is a link that lands nowhere:
 * · **It has no admin surface at all** — zero references to `people` or
 *   `person_id` in the entire `app/admin` tree. Structural, not a count.
 * · `/admin/users/[userId]` is the tempting answer and it resolves for exactly
 *   NONE of the people you could find by name. Measured in prod: all 9 claimed
 *   people carry NO name of their own, and both people who DO have a name are
 *   unclaimed — so they have no user row, and that page `notFound()`s on a
 *   person id. The two populations are disjoint.
 * · A claimed person is already reachable: their account is what carries the
 *   name, and the `user` arm above already finds it. A person hit would be a
 *   duplicate row pointing at the same page.
 * ⏭ Giving `people` a real home is a genuine follow-up. It needs a surface
 * first, not a sixth entry in this switch.
 */

/** Every kind of record the Entity map's search can return. */
export const UGAT_RECORD_KINDS = ['vendor', 'event', 'user', 'order', 'taxonomy', 'guest'] as const;

export type UgatRecordKind = (typeof UGAT_RECORD_KINDS)[number];

/**
 * The identifiers each kind needs to name ONE record. Deliberately the raw
 * database ids where the destination is a per-record route — `UgatRow.id` and
 * `UgatSearchHit.id` are display ids (`public_id ?? uuid`), and a public id in
 * a `[vendorProfileId]` slot is a 404.
 */
export type UgatRecordRef =
  | { kind: 'vendor'; vendorProfileId: string }
  | { kind: 'event'; publicId: string | null; slug: string | null }
  | { kind: 'user'; userId: string }
  /** The public id is the one term the payments desk's Record card finds an order by. */
  | { kind: 'order'; publicId: string | null }
  | { kind: 'taxonomy'; tileId: string | null; canonicalService: string }
  /**
   * A guest is named by the CELEBRATION they belong to, never by themselves —
   * there is no per-guest page to carry a guest id to.
   */
  | { kind: 'guest'; eventPublicId: string | null; eventSlug: string | null };

/** Where this one record opens. Always a real address — never undefined. */
export function ugatRecordHref(ref: UgatRecordRef): string {
  switch (ref.kind) {
    case 'vendor':
      return `/admin/vendors/${encodeURIComponent(ref.vendorProfileId)}/edit`;
    case 'user':
      return `/admin/users/${encodeURIComponent(ref.userId)}`;
    case 'event': {
      // public_id is the exact-match term; slug is the readable fallback. With
      // neither, the unfiltered tab is still the right PLACE for an event.
      const term = ref.publicId ?? ref.slug ?? '';
      return term
        ? `/admin/accounts?tab=events&q=${encodeURIComponent(term)}`
        : '/admin/accounts?tab=events';
    }
    case 'guest':
      // DELEGATED, never a second copy of the same URL. Two hand-written
      // versions of one destination drift, and this repo has paid for that
      // shape more than once — when the events surface changes address, a
      // guest must move with it or start landing on a page that no longer
      // exists.
      return ugatRecordHref({
        kind: 'event',
        publicId: ref.eventPublicId,
        slug: ref.eventSlug,
      });
    case 'taxonomy':
      return ref.tileId
        ? `/admin/categories?open=${encodeURIComponent(`c:${ref.tileId}`)}`
        : `/admin/categories?open=${encodeURIComponent(`s:${ref.canonicalService}`)}`;
    case 'order':
      return ref.publicId
        ? `/admin/payments?q=${encodeURIComponent(ref.publicId)}`
        : '/admin/money';
    default: {
      // A new kind reaches here only by skipping the switch — which the `never`
      // makes a compile error first, and a thrown error second.
      const unreachable: never = ref;
      throw new Error(`ugatRecordHref: no destination for ${JSON.stringify(unreachable)}`);
    }
  }
}
