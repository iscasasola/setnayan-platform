/**
 * the-supplier-ledger-collapses.test.ts — on the budget screen a supplier is a
 * LEDGER ROW: the money shows without being asked, the history opens on a tap.
 *
 * ── What this pins, and why the second rule matters more than the first ────
 * The binding Ledger archetype (prototypes/archetype_data_roster_ledger_
 * comparison_2026-08-01.html, route chip `/dashboard/[event]/budget`), note 3:
 *
 *   "Summary first, history on demand. Each row expands to its dated payments
 *    and receipts; collapsed, the ledger stays one screen of truth."
 *
 * Collapsing is the easy half and a later edit cannot silently undo it — the
 * screen visibly changes. The half that CAN rot silently is WHICH SIDE OF THE
 * FOLD THE MONEY IS ON. Move the money strip below the summary and every
 * assertion about "the card collapses" still passes while the collapsed row
 * becomes a name and a status pill — a ledger with no amounts, which is the
 * one thing the archetype's first note forbids ("magnitude scans down one
 * edge"). So the rules below are ORDERING rules, not presence rules.
 *
 * ── And the embed must NOT collapse ───────────────────────────────────────
 * The same component renders inside the vendor workspace's own Payments
 * disclosure. A second disclosure there is a door behind a door, so the
 * 'embed' branch is asserted to have none — the false-positive direction,
 * which a presence-only rule would happily let drift.
 *
 * ⚠ EVIDENCE GRADE: source-derived. This card sits behind a login and a session
 * does not authenticate, so nothing here was observed in a browser. It is
 * covered by these rules, not by an observation — do not upgrade that.
 *
 * 🛡 Mutation-checked by printed occurrence count, before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CARD = join(
  __dirname,
  '..',
  '_components',
  'vendor-itemization-card.tsx',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** The two render branches, split at the `variant === 'embed'` early return. */
function branches(): { embed: string; card: string } {
  const src = stripComments(readFileSync(CARD, 'utf8'));
  const at = src.indexOf("variant === 'embed'");
  assert.ok(
    at > 0,
    'the two-variant shape is gone — this card is rendered on /budget AND inside the vendor workspace, and the rules below depend on telling them apart. Teach this guard the new shape rather than deleting it.',
  );
  // The embed branch is the early-return `if` block; the card branch is
  // everything from its closing brace to the end of the component. Bounding
  // BOTH matters: an unbounded card slice runs on into the file's other
  // components, and an unbounded embed slice swallows the card — which is how
  // a first cut of this guard reported a disclosure inside the embed that was
  // really the card's, and reported the card's ordering from a different
  // component entirely.
  const embedEnd = src.indexOf('\n  }', at);
  const componentEnd = src.indexOf('\n}', embedEnd);
  assert.ok(
    embedEnd > at && componentEnd > embedEnd,
    'could not bound the two branches — the component shape moved.',
  );
  const embed = src.slice(at, embedEnd);
  const card = src.slice(embedEnd, componentEnd);
  // Floor: an empty or mis-cut slice passes every rule below in silence.
  assert.ok(
    embed.includes('return (') && card.includes('<article'),
    'the branch split landed on the wrong text — embed must hold a return, card must hold the <article> shell.',
  );
  return { embed, card };
}

test("a supplier's history opens on demand, and the money never goes with it", () => {
  const { card } = branches();

  const summaryEnd = card.indexOf('</summary>');
  assert.ok(
    card.includes('<details') && summaryEnd > 0,
    'the /budget supplier card no longer has a disclosure: every supplier now holds its full line-item table and payment log open at once, which is the state the Ledger archetype calls out by name.',
  );

  const moneyAt = card.indexOf('{ledgerRow}');
  const historyAt = card.indexOf('{workingSections}');
  assert.ok(moneyAt > 0 && historyAt > 0, 'the row and the history are no longer rendered by name — re-anchor this guard on whatever replaced them.');

  assert.ok(
    moneyAt < summaryEnd,
    'the money moved BELOW the fold. A collapsed supplier now shows a name and a status pill and no amounts — a ledger row with no magnitude to scan. Budget / Paid / Remaining belong in the summary.',
  );
  assert.ok(
    historyAt > summaryEnd,
    'the line items and the payment log are inside the summary, so the card is a disclosure that discloses nothing — everything is open again, one indirection later.',
  );
});

test('the workspace embed is NOT wrapped in a second disclosure', () => {
  const { embed } = branches();
  assert.ok(
    !embed.includes('<details'),
    'the embedded card grew its own disclosure. It already renders inside the vendor workspace’s Payments disclosure, so this is a door behind a door.',
  );
});
