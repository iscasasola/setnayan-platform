/**
 * silent-query-refusals.test.ts — four places the database said NO and the app
 * heard "nothing to show".
 *
 * ─── THE FAMILY ──────────────────────────────────────────────────────────
 * This repo has now paid for the same shape six times: a phantom COLUMN, a
 * phantom ENUM VALUE, a phantom RPC ARGUMENT, a blocked IFRAME, an unresolved
 * `r2://`, and a CHECK constraint that never learned a new field. Every one of
 * them is a REJECTION, not an exception — nothing throws, nothing logs as
 * broken, and the only symptom is an absence that looks exactly like an empty
 * table. The four fixed on 2026-08-15 are the same disease in four costumes:
 *
 *   1. six sample story pages asked `events` + `orders` for a FIXTURE id
 *      → `22P02`, twice per render, since 2026-07-31
 *   2. every public shop page asked for its save tally as the trusted server
 *      → `P0001 forbidden`, so the badge read 0 and never drew — from the day
 *        it shipped
 *   3. the six-hourly health probe asked for an event brief as the trusted
 *      server → `42501 not_a_vendor`, so the thing it exists to measure was
 *      never measured
 *   4. `/join/<anything>` handed a URL segment to a `uuid` column → `22P02`,
 *      mintable by anyone who can type
 *
 * ⚠ WHAT THIS FILE CAN AND CANNOT SEE. It never opens a database and never
 * renders React. It reads the real source and calls the real pure helpers, so
 * it catches a guard being deleted and a rule being inverted. It CANNOT catch
 * a gate that is wrong in SQL — `20271141980127`'s own db test does that, and
 * the production probe that proved the fault is quoted in the migration.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isSampleEditorialId } from '@/app/[slug]/_components/editorial/sample-ids';

const WEB = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/** Source with comments stripped — every file below EXPLAINS the thing it bans. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · A CURATED SAMPLE IS NEVER LOOKED UP
   ══════════════════════════════════════════════════════════════════════════ */

const EDITORIAL = 'app/[slug]/_components/editorial/editorial-content.tsx';

test('every curated sample id is recognised as one', () => {
  for (const id of [
    'sample-maria-and-juan',
    'sample-jack-and-jill',
    'sample-john-and-jane',
    'sample-peter-and-mary',
    'sample-jack-and-rose',
    'sample-sofia-reyes',
  ]) {
    assert.equal(isSampleEditorialId(id), true, `${id} must never reach a uuid column`);
  }
});

test('a real event id is NOT mistaken for a sample', () => {
  // Inverting this would skip the monogram + paid-perk reads for every real
  // couple — a silent downgrade of the thing they paid for, with no error.
  assert.equal(isSampleEditorialId('f47ac10b-58cc-4372-a567-0e02b2c3d479'), false);
  assert.equal(isSampleEditorialId('sample-'), false);
  assert.equal(isSampleEditorialId(''), false);
});

test('the predicate cannot be fooled by an inherited property', () => {
  // The tempting one-liner — `Boolean(SAMPLE_EDITORIALS[eventId])` — answers
  // truthy for 'constructor', 'toString' and friends, because object index
  // access walks the prototype. An event whose id happened to be one of those
  // words would then skip its monogram and its paid perk, silently. Membership
  // in an explicit list has no prototype to inherit from, which is why the
  // predicate is a list lookup and not an object lookup.
  for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    assert.equal(isSampleEditorialId(id), false, `${id} is not a curated sample`);
  }
});

/**
 * The condition of the nearest `if (` ABOVE `needle`.
 *
 * 🪤 THE FIRST CUT OF THE TEST BELOW USED `/if \(!isSample\) \{[\s\S]*?<call>/`
 * AND WAS DECORATION. `[\s\S]*?` is lazy but unbounded, so with two guarded
 * blocks in the file the regex happily started at the FIRST `if (!isSample)`
 * and ran past the end of that block, through everything between, down to the
 * SECOND block's call — which means un-gating the second block left it green.
 * The mutation run caught it (sabotage landed 2→1, tests stayed 14/14).
 *
 * Walking BACK from the call to its nearest `if (` cannot span blocks, because
 * the mutated `if (true)` becomes the nearest one and the assertion sees it.
 */
function nearestGuardAbove(src: string, needle: string): string {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, `${needle} is gone from the file entirely`);
  const before = src.slice(0, at);
  const ifAt = before.lastIndexOf('if (');
  assert.ok(ifAt >= 0, `${needle} has no enclosing condition at all`);
  return before.slice(ifAt, ifAt + 40);
}

test('the editorial skips BOTH database reads for a sample', () => {
  const src = code(read(EDITORIAL));
  assert.match(src, /isSampleEditorialId\(/, 'the sample check is gone entirely');

  // Each of the two reads must sit behind the sample check — measured at the
  // call itself, not by a span that can wander across both blocks.
  assert.match(
    nearestGuardAbove(src, ".from('events')"),
    /^if \(!isSample\)/,
    'the masthead monogram read is no longer gated — a sample id is not a uuid',
  );
  assert.match(
    nearestGuardAbove(src, 'eventCoupleWebsiteProActive('),
    /^if \(!isSample\)/,
    'the paid-perk probe is no longer gated — it looks a sample up in orders',
  );
});

test('the sample predicate is imported, never re-typed', () => {
  // A second hand-typed list of these ids is how a seventh sample gets added
  // and only half the code learns about it. `sample-ids.ts` is the one home;
  // `data.ts` re-exports it and types its fixture table by the same union, so
  // TypeScript refuses a missing member or an extra key.
  assert.match(
    code(read(EDITORIAL)),
    /import \{ isSampleEditorialId \} from '\.\/sample-ids'/,
    'the sample ids have been copied instead of imported',
  );
  assert.match(
    code(read('app/[slug]/_components/editorial/data.ts')),
    /const SAMPLE_EDITORIALS: Record<SampleEditorialId, \(\) => EditorialData>/,
    'The fixture table is keyed by `string` again, so the id list and the ' +
      'fixtures can drift silently. Keying it by the union is what makes the ' +
      'correspondence a mechanism rather than a promise.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE PUBLIC SAVE TALLY — the gate admits the server that renders it
   ══════════════════════════════════════════════════════════════════════════ */

const SAVES_MIGRATION =
  '../../supabase/migrations/20271141980127_saves_count_readable_by_trusted_server.sql';

test('the trusted server may read a save tally; a stray browser session may not', () => {
  const sql = read(SAVES_MIGRATION);
  /*
    🪤 SQL COMMENTS STRIPPED — THE THIRD SELF-MATCH IN THIS ONE FILE. The
    `current_user` ban below fires on the migration's own warning about
    `current_user`, exactly as the editorial ban fired on the comment
    explaining the editorial bug and the call-site ban fired on the sentence
    quoting the retired claim. Every guard written here that searched raw text
    matched its own explanation first. Strip, then search.
  */
  const body = sql
    .slice(sql.indexOf('CREATE OR REPLACE FUNCTION'))
    .replace(/^\s*--.*$/gm, '');

  assert.match(
    body,
    /current_setting\('role', true\) = 'service_role'/,
    'The public shop page renders as the trusted server. Without this disjunct ' +
      'the gate raises P0001 forbidden on every public render and the badge ' +
      'reads 0 — which is exactly what shipped.',
  );

  /*
    🚨 AND IT MUST NOT BE `current_user`. The first cut of this migration used
    the repo's usual `current_user NOT IN ('authenticated','anon')` idiom and
    OPENED THE GATE TO EVERYONE, `anon` included — because inside a
    SECURITY DEFINER body `current_user` is the function's OWNER, not the
    caller, so the test is always true. Dry-running the function against prod
    in a rolled-back transaction is what caught it; reading it did not, and no
    unit test could have.

    The six shipped functions that DO use that idiom were checked against prod
    by `prosecdef` and are all SECURITY INVOKER, where it is correct. Copy an
    idiom with its precondition, or don't copy it.
  */
  assert.doesNotMatch(
    body,
    /current_user/,
    'A SECURITY DEFINER body cannot identify its caller with `current_user` — ' +
      'that is the OWNER, so the gate admits everyone including anon. Use ' +
      "current_setting('role', true).",
  );
  // The two original disjuncts must survive: this widened the gate, it did not
  // replace it. Losing either would hand the vendor dashboard a broken count.
  assert.match(body, /current_vendor_profile_ids\(\)/, 'the owner lost their own count');
  assert.match(body, /public\.is_admin\(\)/, 'admins lost the count');
  assert.match(body, /RAISE EXCEPTION 'forbidden'/, 'the gate stopped refusing anyone at all');

  // 🔑 `anon` must NEVER hold EXECUTE. The fix admits our SERVER, not a browser.
  assert.doesNotMatch(
    body,
    /GRANT EXECUTE ON FUNCTION public\.count_saves_for_vendor\(UUID\) TO [^;]*\banon\b/,
    'a signed-out browser can now call this directly',
  );
  // And no user_id may ever leave: the whole privacy argument for widening the
  // gate is that only an integer escapes.
  assert.match(body, /RETURNS INTEGER/, 'the function stopped returning only a count');
});

test('the call site records WHY the service role was not enough', () => {
  /*
    🪤 TWO CUTS OF THIS WERE WRONG, AND BOTH ARE THE SAME LESSON.

    The first windowed a ban to ±2000 chars around the RPC's first mention —
    which is the surviving comment's opening line, so the banned sentence fell
    outside the window and restoring it left the test GREEN. The mutation run
    measured that; nothing about reading it said so.

    The second widened the ban to the whole file and then failed on the fix
    itself, because the corrected comment QUOTES the retired sentence in order
    to explain what was wrong with it. A guard that fires on the explanation of
    the defect is the cry-wolf shape this repo keeps paying for — and here it
    was unfixable in that direction: the banned text lives only in comments, so
    stripping comments to avoid the self-match would leave nothing to search.

    So this asserts the CORRECTION is present rather than the error absent.
    Rewriting the comment back to the old belief deletes this sentence, which
    fails; quoting the old belief while explaining it does not.
  */
  // Comment markers are stripped from the line breaks first, so the sentence
  // is matched as a SENTENCE and not as whatever way it happens to be wrapped
  // today. Re-wrapping the paragraph must not turn this guard red.
  const prose = read('app/v/[slug]/page.tsx').replace(/\n\s*\/\/ ?/g, ' ');
  assert.match(
    prose,
    /[Ss]ervice role bypasses \*{0,2}RLS, not a hand-written/,
    'The one sentence that explains the outage is gone from the call site: ' +
      'service role bypasses RLS, NOT a hand-written RAISE EXCEPTION inside a ' +
      'SECURITY DEFINER function. Without it the next reader re-derives the ' +
      'same wrong conclusion from the same true fact about the GRANT.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE HEALTH PROBE ACTUALLY NARROWS
   ══════════════════════════════════════════════════════════════════════════ */

test('the song-desk probe passes the tiles it already holds', () => {
  const src = code(read('lib/interconnect/probes.ts'));
  const probe = src.slice(src.indexOf("key: 'song-desk-narrowing'"));
  assert.match(
    probe,
    /resolveSongDeskAccess\([\s\S]*?tilesForVendorCategories\(pair\.bookedCategories\)/,
    'The probe is asking the gate to fetch the narrowing itself again. That ' +
      'fetch reads get_vendor_event_brief, which refuses service_role with ' +
      '42501 not_a_vendor — so the narrowing arrives null, both calls become ' +
      'the SAME call, and this probe can never fail. A check that cannot fail ' +
      'is worse than none: it occupies the slot a real one would.',
  );
});

test('the gate still fetches the narrowing for every vendor-facing caller', () => {
  const gate = code(read('lib/song-desk-gate.ts'));
  assert.match(
    gate,
    /knownEventTiles !== undefined \? knownEventTiles : await fetchBookedTiles\(/,
    'The pre-resolved tiles must be an OPT-IN. If the fetch is gone, a vendor ' +
      'session silently stops narrowing and the paywall reads wrong for them.',
  );
  // `undefined` means "fetch"; `null` means "decline to narrow" and is a real,
  // documented value. Collapsing them with `??` would make an explicit null
  // trigger a fetch the caller was trying to avoid.
  assert.doesNotMatch(
    gate,
    /knownEventTiles \?\? await fetchBookedTiles\(/,
    '`??` conflates the caller saying "do not narrow" with saying nothing',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · A URL SEGMENT NEVER REACHES A UUID COLUMN UNCHECKED
   ══════════════════════════════════════════════════════════════════════════ */

test('the join door checks the id before it asks the database', () => {
  const src = code(read('app/join/[eventId]/page.tsx'));
  const guardAt = src.indexOf('isUuid(eventId)');
  const firstQueryAt = src.indexOf("from('event_join_tokens')");
  assert.ok(guardAt >= 0, 'the join door hands a raw URL segment to a uuid column again');
  assert.ok(
    firstQueryAt >= 0 && guardAt < firstQueryAt,
    'the guard runs AFTER the query, which is no guard at all',
  );
  assert.match(
    src.slice(guardAt, guardAt + 200),
    /return <InvalidTokenScreen \/>/,
    'a junk id must land on the same "this link is not valid" screen it always did',
  );
});
