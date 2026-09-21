/**
 * GUARD — /admin/booking-fees tells "never billed" apart from "not paid yet".
 *
 * Until 2026-09-21 every pending charge with no `orders` row rendered the words
 * **"Nothing sent yet"** — the same six words as a supplier who HAS been billed
 * and is simply taking their time. They are opposite situations: one is a
 * customer, the other is Setnayan never having asked for its only revenue. The
 * one page built to answer "who owes us?" agreed with the supplier's screen
 * that nothing was owed.
 *
 * The judgement itself is executable and lives in `lib/unbilled-fee-repair.ts`
 * (`whyNotBilled`), driven by `lib/unbilled-fee-repair.test.ts`. What a grep is
 * for — and all it is for — is that this page still MOUNTS it and still PRINTS
 * the reason. A correct judge nobody renders is the defect, not the cure
 * ([[a-log-line-never-changed-a-pixel]]).
 *
 * 🛡 MUTATION-CHECKED, five sabotages, each confirmed RED by pass/fail count:
 * the `whyNotBilled(f)` call swapped for a local rule · the `{missing.reason}`
 * mount removed · "Never billed" collapsed back into "Nothing sent yet" · the
 * billed row's copy reverted to the bare "Nothing sent yet" · the headline
 * count dropped.
 *
 * ⚠ ONE MUTATION THIS FILE DOES **NOT** CATCH, MEASURED: deleting the import
 * line alone leaves 5/5 green, because every assertion here is about the CALL,
 * not the import. That mutation does not compile, so `tsc` is the guard for it
 * — said out loud rather than left as an untested claim, since an unmeasured
 * mutation in a docblock proves nothing ([[a-zero-from-a-harness-is-not-evidence]]).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const PAGE = join(__dirname, 'page.tsx');
const SRC = readFileSync(PAGE, 'utf8');
/** Comments must never satisfy an assertion about code — this page's docblock
 *  quotes every string below. */
const CODE = stripComments(SRC);

test('ANCHOR — the page was read and stripping left code behind', () => {
  assert.ok(SRC.length > 3000, `page.tsx read as ${SRC.length} chars — too short to be the page`);
  assert.ok(
    CODE.includes('export default async function AdminBookingFeesPage'),
    'comment-stripping ate the code; every scan below would prove nothing',
  );
  assert.ok(!CODE.includes('THE ROW THAT MEANT TWO OPPOSITE THINGS'), 'stripComments left prose in');
});

test('the page consults the SHARED judge, not a rule of its own', () => {
  // One judge, two readers: the desk and the repair sweep must never disagree
  // about which charges are a person's problem.
  for (const symbol of ['whyNotBilled', 'gatherUnbilledFacts']) {
    assert.ok(
      new RegExp(String.raw`\b${symbol}\b`).test(CODE),
      `${symbol} is no longer used by /admin/booking-fees. A desk that re-derives ` +
        `its own version of "why is there no bill" will drift from the sweep that heals it.`,
    );
  }
  const calls = CODE.match(/\bwhyNotBilled\s*\(/g) ?? [];
  assert.equal(calls.length, 1, `expected 1 whyNotBilled() call, found ${calls.length}`);
});

test('the REASON reaches the pixels, not just the object', () => {
  // A verdict computed and never rendered is exactly the defect: measured, and
  // still invisible. Count the mount, do not merely find the word.
  const mounts = CODE.match(/\{missing\.reason\}/g) ?? [];
  assert.equal(
    mounts.length,
    1,
    `expected the unbillable reason to be rendered exactly once, found ${mounts.length}. ` +
      `Computing whyNotBilled() and not printing its sentence leaves the admin ` +
      `looking at a charge with no explanation — the state this page was changed to end.`,
  );
  assert.ok(
    /data-unbilled-reason=\{missing\.code\}/.test(CODE),
    'the machine-readable code must ride along with the sentence',
  );
});

test('"never billed" and "not paid yet" are DIFFERENT strings on the row', () => {
  assert.ok(
    CODE.includes('Never billed'),
    'the row no longer says "Never billed" for a charge with no order behind it',
  );
  assert.ok(
    CODE.includes('Billed — nothing sent yet'),
    'the billed-but-unpaid row must say it was BILLED. The bare "Nothing sent yet" ' +
      'meant both things at once, which is the whole defect.',
  );
  // And the ambiguous original must not survive anywhere on the page.
  const bare = CODE.match(/>\s*Nothing sent yet\s*</g) ?? [];
  assert.equal(bare.length, 0, `the ambiguous copy is still rendered ${bare.length} time(s)`);
});

test('the headline count of unbilled charges is rendered', () => {
  assert.ok(
    /\{notBilled\.size\}/.test(CODE),
    'the summary tile must say how many charges have never been billed — a per-row ' +
      'badge nobody scrolls to is not a report.',
  );
});
