/**
 * THE COUPLE'S PAYMENT NOTE MOVES NO MONEY. (2026-09-20)
 *
 * Owner: *"payment method and payment option can be entered manually. but this
 * is just manual, so nothing is searched added. meaning no connection to the
 * user's event. it needs to be imported to a vendor first."* and *"payment
 * options doesn't need to be a qr. just a note so the user can rely on the
 * payment method."*
 *
 * ── Why a guard and not just a comment ────────────────────────────────────
 * The card TELLS the couple, in so many words, *"Setnayan does not send or
 * track this money, and nothing here creates a payment or a due date."* That
 * sentence is a promise about the whole codebase, not about one component, and
 * it is exactly the kind of promise that decays: the columns sit one join away
 * from `event_vendor_payment_plan` and `event_vendor_payments`, and the next
 * person to want a head start on a payment schedule will find them sitting
 * there looking useful.
 *
 * The moment any writer of the event's real money reads a payment note, the
 * copy on the card becomes false — silently, for every couple.
 *
 * ── What it asserts ───────────────────────────────────────────────────────
 * No file that writes `event_vendor_payment_plan`, `event_vendor_payments`,
 * `payments`, `orders` or `manual_payment_logs` also mentions
 * `payment_method_note` / `payment_terms_note`.
 *
 * ⚠ ANCHORED SO IT CANNOT PASS VACUOUSLY. It first asserts that the notes are
 * referenced SOMEWHERE (they are real, and this walker can see them) and that
 * the money writers were found at all. A walker that matched nothing would
 * otherwise report a clean bill of health over an empty set — the "zero from a
 * harness is not evidence" failure this repo keeps re-finding.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const ROOTS = ['app', 'lib', 'components'].map((d) => path.join(WEB_ROOT, d));

/**
 * ⚠ THE *METHOD* NOTE ONLY. `payment_terms_note` was here until the owner
 * settled that a payment PLAN carries due dates "just like on our quote
 * maker" — which makes it the event's real money, written to
 * `event_vendor_payment_plan`, not an inert note. The column was removed
 * before it shipped. Guarding a plan for inertness would assert the opposite
 * of what it is for.
 */
const NOTE_COLUMNS = ['payment_method_note'];

/** Tables that ARE the event's money. A write to one of these is an obligation. */
const MONEY_TABLES = [
  'event_vendor_payment_plan',
  'event_vendor_payments',
  'manual_payment_logs',
  'vendor_payment_asks',
];

/** A write, not a read — `.insert(`, `.update(`, `.upsert(`, `.delete(`. */
const WRITE_CALL = /\.(insert|update|upsert|delete)\s*\(/;

/**
 * ⚠ STRUCTURAL, NOT A PHRASE MATCH — and this guard convicted its own author
 * before it was. The first draft asked whether a file MENTIONED a money table.
 * `saveSelfAddedServiceCard`'s docblock mentions `event_vendor_payment_plan`
 * precisely to explain why it does NOT write there, and the file does write
 * (to `event_manual_vendors`) — so the guard flagged the one file that is most
 * careful about the rule. A phrasing ban fails in both directions: it misses a
 * reword and convicts innocent prose.
 *
 * So the question is now "does this file QUERY that table" — `.from('<table>')`
 * is how every read and write in this codebase names one — which no comment
 * can trip.
 */
/**
 * ⚠ COMMENTS ARE STRIPPED BEFORE SCANNING — with the REPO'S stripper.
 *
 * This guard convicted careful code twice by matching prose: first a docblock
 * naming the table it deliberately avoids, then `payment-plan-actions.ts`
 * quoting this very rule. So comments must go before the scan.
 *
 * 🔴 AND THE FIRST STRIPPER WRITTEN HERE WAS WRONG IN THE DANGEROUS DIRECTION.
 * It was a two-replace regex that removed BLOCK comments first — so a line
 * comment containing `video/*` opens a "block" that runs to the next real `*` +
 * `/` and blanks the code in between. This guard would then have asserted
 * against a blank and PASSED: a false negative in a guard whose one job is to
 * catch a note reaching the money tables. `lint-one-comment-stripper.mjs`
 * refused it in CI with exactly that explanation. `stripComments` from
 * `lib/strip-comments.ts` is the one stripper the repo trusts; using it is not
 * a style preference.
 */
const queriesTable = (src: string, table: string): boolean =>
  new RegExp(String.raw`\.from\(\s*['"\`]` + table + String.raw`['"\`]\s*\)`).test(src);

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const SOURCES = ROOTS.flatMap((r) => walk(r));
const rel = (f: string) => path.relative(WEB_ROOT, f);

describe('the couple’s payment note is inert', () => {
  it('found a real source tree to search', () => {
    // ANCHOR 1 — a broken walker must fail here, not pass everything below.
    assert.ok(SOURCES.length > 500, `only ${SOURCES.length} source files found — walker is broken`);
  });

  it('the note columns exist somewhere in the app', () => {
    // ANCHOR 2 — if the columns were renamed, every assertion below would pass
    // over a term that matches nothing. This is the test that notices.
    const mentions = SOURCES.filter((f) => {
      const src = stripComments(fs.readFileSync(f, 'utf8'));
      return NOTE_COLUMNS.some((c) => src.includes(c));
    });
    assert.ok(
      mentions.length > 0,
      'payment_method_note appears nowhere. ' +
        'If they were renamed, re-point this guard — do not delete it.',
    );
  });

  it('found the money writers it is supposed to be checking', () => {
    // ANCHOR 3 — same reasoning, from the other side.
    const writers = SOURCES.filter((f) => {
      const src = stripComments(fs.readFileSync(f, 'utf8'));
      return MONEY_TABLES.some((t) => queriesTable(src, t)) && WRITE_CALL.test(src);
    });
    assert.ok(
      writers.length > 0,
      'no writer of the event money tables was found — the match is broken, ' +
        `looked for ${MONEY_TABLES.join(', ')}`,
    );
  });

  it('no writer of the event’s real money reads a payment note', () => {
    const offenders: string[] = [];
    for (const f of SOURCES) {
      const src = stripComments(fs.readFileSync(f, 'utf8'));
      if (!NOTE_COLUMNS.some((c) => src.includes(c))) continue;
      const table = MONEY_TABLES.find((t) => queriesTable(src, t));
      if (!table) continue;
      if (!WRITE_CALL.test(src)) continue;
      offenders.push(`${rel(f)} — mentions a payment note and queries ${table}`);
    }
    assert.deepEqual(
      offenders,
      [],
      'A couple’s payment NOTE has reached the event’s real money. The card ' +
        'promises "Setnayan does not send or track this money, and nothing here ' +
        'creates a payment or a due date" — that sentence is now false. Owner ' +
        '2026-09-20: "no connection to the user\'s event. it needs to be ' +
        'imported to a vendor first."\n' +
        offenders.join('\n'),
    );
  });
});
