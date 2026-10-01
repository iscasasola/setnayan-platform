/**
 * guest-import-file.ts — the guest list FILE: which template a host downloads,
 * and how a filled-in file becomes rows the importer understands.
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "GUEST IMPORT = A TEMPLATE FILE YOU
 * DOWNLOAD…" + "…UPLOAD AGAIN TO UPDATE"): the host downloads a template that
 * opens in Excel, Numbers and Google Sheets, fills in names, and uploads it.
 * The importer had only ever read raw keys (`first_name,last_name,…`) pasted
 * into a box; this module is the bridge from the template's plain headers.
 *
 * Pure on purpose (no `server-only`, no Supabase): the server action and the
 * page are thin, and everything that can be got wrong here is EXECUTED by
 * guest-import-file.test.ts.
 */

/** The two ready-made files (copied from the spec corpus `templates/`). */
export const GUEST_TEMPLATES = {
  /** Weddings — carries the Side column (Bride · Groom · Both). */
  withSides: {
    xlsx: '/templates/setnayan-guest-list-wedding.xlsx',
    csv: '/templates/setnayan-guest-list-wedding.csv',
  },
  /** Every other event type — no Side column. */
  withoutSides: {
    xlsx: '/templates/setnayan-guest-list.xlsx',
    csv: '/templates/setnayan-guest-list.csv',
  },
} as const;

/**
 * Which template THIS event gets. Keyed on "does the event have sides" —
 * `eventHasSides(roleSet)` from guest-side-question.ts — never on a list of
 * event-type names, so a new type inherits the right file from its profile.
 */
export function guestTemplateFor(hasSides: boolean) {
  return hasSides ? GUEST_TEMPLATES.withSides : GUEST_TEMPLATES.withoutSides;
}
