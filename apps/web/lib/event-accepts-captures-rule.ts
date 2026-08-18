/**
 * event-accepts-captures-rule.ts — the DECISION, with no boundary and no IO.
 *
 * 🪤 THIS SPLIT IS NOT STYLE, IT IS THE ONLY WAY TO TEST THE RULE. The package
 * `server-only` is **not installed in this repo**, so importing a module that
 * carries `import 'server-only'` from a test fails outright with
 * MODULE_NOT_FOUND. A rule that cannot be exercised is a rule verified by
 * reading, and reading is what this codebase keeps getting wrong.
 *
 * So the read lives in `event-accepts-captures.ts` (server-only) and the
 * judgement lives here, where a test can hand it every shape the database can
 * actually return.
 */

/** What a read of `events.archived` can hand back. */
export type ArchivedRow = { archived?: boolean | null } | null | undefined;

/**
 * May this celebration accept new photographs?
 *
 * ─── FAILS OPEN, DELIBERATELY ──────────────────────────────────────────────
 * A read failure must let the shutter work. The two outcomes are not
 * symmetrical: a few photographs landing on a celebration somebody tidied away
 * is a tidiness problem, while blocking capture during a live wedding is the one
 * irreversible failure in this product — **the day does not happen twice.**
 *
 * ⚠ This is the OPPOSITE of the metering gate beside it, which fails CLOSED
 * because it is money, and the opposite of the wall gate, which fails closed
 * because a wall still playing a put-away celebration is exactly what the couple
 * believed they had stopped. Three neighbouring gates, chosen by what each one's
 * failure costs. **Do not "make them consistent".**
 *
 * Only an explicit `true` stops capture: Supabase resolves with `{ error }`
 * rather than throwing, so "could not read it" arrives as a null row, and a
 * NULL column is not a decision anybody made.
 */
export function rowAcceptsNewCaptures(row: ArchivedRow, hadError: boolean): boolean {
  if (hadError || !row) return true;
  return row.archived !== true;
}

/**
 * What a person is told when the shutter is refused for this reason.
 *
 * Names the way back, because the couple can undo it in one press and the
 * photographer standing there cannot. **A refusal that does not say what to do
 * instead is half a refusal.** Lives here, not behind the server boundary, so a
 * client surface can render it.
 */
export const EVENT_PUT_AWAY_CAPTURE_COPY =
  'This celebration has been put away, so it isn’t taking new photos. The host can bring it back any time from its Personalization page.';
