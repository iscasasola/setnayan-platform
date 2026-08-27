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
 * · **order** → `/admin/money`, and this one is deliberately NOT the precise-
 *   looking answer. `/admin/payments?q=<ref>` filters, but it queries the
 *   PAYMENTS table scoped to matching orders, so an order with no payment row
 *   returns NOTHING — which is the state of the only order production has ever
 *   held. A QUEUE IS NOT A LEDGER: `/admin/money` lists every order in every
 *   status, so it is the one surface that always contains the record you found.
 *   ⏭ It cannot focus a single row yet; giving that ledger a search term is a
 *   real follow-up, not a thing to fake here with a link that lands empty.
 */

/** Every kind of record the Entity map's search can return. */
export const UGAT_RECORD_KINDS = ['vendor', 'event', 'user', 'order', 'taxonomy'] as const;

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
  | { kind: 'order' }
  | { kind: 'taxonomy'; tileId: string | null; canonicalService: string };

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
    case 'taxonomy':
      return ref.tileId
        ? `/admin/taxonomy?open=${encodeURIComponent(ref.tileId)}`
        : `/admin/taxonomy?q=${encodeURIComponent(ref.canonicalService)}`;
    case 'order':
      return '/admin/money';
    default: {
      // A new kind reaches here only by skipping the switch — which the `never`
      // makes a compile error first, and a thrown error second.
      const unreachable: never = ref;
      throw new Error(`ugatRecordHref: no destination for ${JSON.stringify(unreachable)}`);
    }
  }
}
