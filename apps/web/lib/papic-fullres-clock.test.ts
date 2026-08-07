/**
 * HIGH-RES ORIGINALS EXPIRE PER EVENT, NOT PER PHOTO.
 *
 * 🔒 CURRENT RULE — owner, 2026-08-07. READ THIS ONE:
 *   • high-res is kept **6 months from the event's FIRST capture**, and
 *   • **never less than 3 months after the event date itself**, and
 *   • cameras may start shooting **6 months before** the event.
 *
 * ⚠ SUPERSEDED, KEPT ONLY SO THE NUMBERS BELOW READ CORRECTLY — owner 2026-08-02:
 * *"the total time we keep their high resolution is 6 months from the first day
 * they use the service. the reason why i said 5 month for until the event date
 * is so they have at least 30 days to download the files they have."* On
 * 2026-08-07 shooting moved 5 → 6 months and the post-event floor moved 30 days
 * → 3 months. **Do not reason from the 5-month / 30-day pair anywhere.** At the
 * new 6-month cap the old subtraction yields ZERO days after the event; the
 * floor, not the subtraction, is what keeps the promise. See the test below.
 *
 * ── THE DEFECT THIS REPLACED ──────────────────────────────────────────────
 * The sweep aged each photo against ITS OWN capture time, 90 days. Fine for a
 * one-day wedding; wrong for a journey (numbers are the then-current 5-month cap):
 *
 *   a photo taken 5 months (150d) before the wedding
 *     → original deleted 90 days later
 *     → TWO MONTHS BEFORE THE WEDDING ITSELF
 *
 * The longer a couple's journey, the more of its beginning was destroyed first —
 * the exact opposite of what a keepsake product should do. And it was silent:
 * the gallery still worked, because the web copy survives. Only someone asking
 * for a print-quality file would ever have found out.
 *
 * 🪤 A per-photo clock CANNOT express the owner's sentence, because the sentence
 * is about the EVENT. Any future edit that reintroduces an age test in the
 * per-file predicates reintroduces the bug, which is what these tests watch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_FULL_RES_RETENTION_DAYS,
  FULL_RES_POST_EVENT_GRACE_DAYS,
} from './papic-fullres-drop-core';
import { PAPIC_CAPTURE_MONTHS_BEFORE } from './papic-window';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const sql = readFileSync(
  join(WEB, '../../supabase/migrations/20271102113000_fullres_clock_is_per_event_not_per_photo.sql'),
  'utf8',
);
const noComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

test('the window is 6 months, not 90 days', () => {
  assert.equal(DEFAULT_FULL_RES_RETENTION_DAYS, 183);
});

test('and never less than THREE MONTHS of high-res after the event itself', () => {
  // Owner 2026-08-07: "still preserve 3 months all their photos in high res
  // before we compress it." 92 = the longest three calendar months, so the
  // promise is true for a March wedding as well as a December one.
  assert.equal(FULL_RES_POST_EVENT_GRACE_DAYS, 92);
  assert.ok(FULL_RES_POST_EVENT_GRACE_DAYS >= 92, 'three months must never round down');
});

test('🔑 AT THE EARLIEST PERMITTED SHOT, SUBTRACTION GIVES ZERO — the floor is the promise', () => {
  // THE TRAP THIS EXISTS TO CATCH, and it is not hypothetical: an earlier
  // version of this suite "proved" the promise by subtraction —
  // `retention − time_shot_before_the_event >= grace` — back when shooting
  // opened 5 months out (183 − 150 = 33 days spare). The owner then opened it
  // to SIX months. The same subtraction now yields ZERO, and had the promise
  // really rested on it, every engagement-shoot original would become
  // droppable on the morning of the wedding.
  const capMonths = PAPIC_CAPTURE_MONTHS_BEFORE;
  assert.equal(capMonths, 6, 'if this changes, re-read the reasoning below before editing it');

  const shotDaysBeforeEvent = 183; // six months out, the earliest allowed
  const clockLeftAfterEvent = DEFAULT_FULL_RES_RETENTION_DAYS - shotDaysBeforeEvent;
  assert.equal(clockLeftAfterEvent, 0, 'the first-capture clock expires ON the wedding day');

  // The sweep takes the LATER of the two dates, so the floor rescues it.
  const survivesUntil = Math.max(clockLeftAfterEvent, FULL_RES_POST_EVENT_GRACE_DAYS);
  assert.equal(
    survivesUntil,
    92,
    'the earliest photo a couple can take must still be high-res three months ' +
      'after their wedding. If this is 0, the sweep is using the first-capture ' +
      'clock alone and the floor has been dropped from the query.',
  );
});

test('🪤 the floor is a GREATEST in SQL, not a subtraction in TypeScript', () => {
  // The assertion above is arithmetic on constants — it would still pass if the
  // migration stopped applying the floor. Pin the SQL itself.
  //
  // ⚠ THE FIRST DRAFT OF THIS TEST WAS DECORATION, and it took a sabotage run to
  // find out. It matched /NOW\(\) >= \(f\.event_date/, so renaming the column to
  // `f.event_dateX` still matched on the prefix, and prefixing the clause with
  // `OR TRUE` — which neuters it completely — left the text it looked for fully
  // intact. Both sabotages went green. Match the ARITHMETIC and ban the
  // tautology, not the presence of a name.
  //
  // ⚠ And strip SQL comments first: this migration's own header contains the
  // line "(b) the event date + p_post_event_days", so a comment alone would
  // satisfy a naive search for that identifier.
  const bare = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.ok(bare.length > 500, 'self-check: the migration read as near-empty after stripping');
  assert.ok(
    bare.includes('p_post_event_days'),
    'the eligibility RPC no longer takes a post-event floor (checked in CODE, not comments)',
  );
  // ⏭ Renaming the ARGUMENT in the function signature is deliberately not
  // asserted here — it is caught by rpc-argument-names.db.test.ts, which
  // compares every .rpc() call site's named arguments against the real function
  // in the database. That is the stronger check: a phantom argument name makes
  // PostgREST match no candidate at all and the call fails before the body runs.

  // The floor's actual arithmetic: event_date + N days.
  assert.match(
    bare,
    // [\s\S], not [^\n]: the clause is wrapped across two lines in the migration.
    // \b after event_date: without it, renaming the column to `event_dateX` — a
    // phantom identifier, the exact shape of three live bugs on this project —
    // still matched on the prefix and the sabotage run went green.
    /\bevent_date\b[\s\S]{0,60}\+\s*make_interval\(days\s*=>\s*GREATEST\(p_post_event_days,\s*0\)\)/,
    'the floor must ADD p_post_event_days to event_date in the predicate. ' +
      'Without this the three-month promise lives only in a comment.',
  );

  // A tautology anywhere in the predicate makes the floor unreachable while
  // leaving every string above it intact — the exact way the first draft was
  // fooled.
  assert.doesNotMatch(
    bare,
    /\bOR\s+(TRUE\b|1\s*=\s*1)/i,
    'a tautology short-circuits the floor: the clause is still there to read, ' +
      'and originals become droppable the moment the first-capture clock ends.',
  );
});

test('🪤 neither per-file predicate tests age any more', () => {
  // The regression guard. Both used `ageDays >= opts.retentionDays`; either one
  // coming back reinstates "delete the beginning of the journey first".
  const core = noComments(read('lib/papic-fullres-drop-core.ts'));
  assert.ok(
    !/ageDays\s*>=\s*opts\.retentionDays/.test(core),
    'a per-file age fuse is back — that is the defect, not a tightening',
  );
});

test('but an unreadable capture time still fails closed, in both', () => {
  // We never delete a row we cannot parse. Removing the age test must not have
  // taken this with it.
  const core = noComments(read('lib/papic-fullres-drop-core.ts'));
  assert.equal(
    (core.match(/if \(!Number\.isFinite\(capturedMs\)\) return false;/g) ?? []).length,
    2,
    'both the photo and the clip predicate must reject an unparseable timestamp',
  );
});

test('the sweep selects by EVENT, never by a photo-age cutoff', () => {
  const sweep = noComments(read('lib/papic-fullres-drop.ts'));
  assert.ok(
    !/\.lt\('captured_at'/.test(sweep),
    'a captured_at cutoff would silently exclude the very photos the event ' +
      'clock just made eligible — a wedding-day photo can be young when its ' +
      'event expires',
  );
  assert.match(sweep, /\.in\('event_id', expiredEventIds\)/);
});

test('🚨 an unreadable clock deletes NOTHING', () => {
  // Fail-CLOSED is the whole posture here. "Assume expired" would turn a
  // database blip into irreversible loss of originals; a sweep that does
  // nothing is recoverable on the next run.
  const sweep = read('lib/papic-fullres-drop.ts');
  const fn = sweep.slice(sweep.indexOf('async function eventsPastTheirClock'));
  assert.match(fn, /if \(error \|\| !Array\.isArray\(data\)\) return \[\];/);
  assert.match(fn, /catch \{\s*\n\s*return \[\];/);
  assert.match(
    noComments(sweep),
    /if \(expiredEventIds\.length === 0\) \{\s*\n\s*return emptySummary\(/,
    'and an empty list must short-circuit rather than fall through to a query ' +
      'with an empty IN, which some clients treat as "no filter"',
  );
});

test('the rule lives in ONE place, and both terms are in it', () => {
  assert.match(sql, /papic_events_past_fullres_clock/);
  // (a) 6 months from first use…
  assert.match(sql, /f\.started_at \+ make_interval\(days => GREATEST\(p_retention_days, 0\)\)/);
  // (b) …and the post-event download grace.
  assert.match(sql, /make_interval\(days => GREATEST\(p_post_event_days, 0\)\)/);
});

test('first use spans BOTH capture tables', () => {
  // A guest's phone and a seat camera are the same service to the person paying
  // for it. Reading only one table would start the clock late for half of them.
  assert.match(sql, /MIN\(p\.captured_at\) FROM public\.papic_photos/);
  assert.match(sql, /MIN\(g\.captured_at\) FROM public\.papic_guest_captures/);
  assert.match(sql, /LEAST\(/, 'and the EARLIER of the two starts the clock');
});

test('an event with no captures is never selected', () => {
  // The 'infinity' sentinel must be filtered, or an event that never used Papic
  // would compare as expired.
  assert.match(sql, /f\.started_at <> 'infinity'::timestamptz/);
});

test('🔒 the clock function is service_role only', () => {
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.papic_events_past_fullres_clock/);
  assert.ok(
    !/GRANT EXECUTE ON FUNCTION public\.papic_events_past_fullres_clock\(INTEGER, INTEGER\)\s*\n?\s*TO (anon|authenticated)/.test(sql),
    'it reads across every event — never anon or authenticated',
  );
});

/* ── the labels must match the switch ──────────────────────────────────────── */

/**
 * 🔑 READ THE EXPRESSION ONCE, APPLY IT TO EVERY COPY.
 *
 * The header of the one module that permanently deletes couples' originals said
 * "Ships DRY-RUN by default: it deletes NOTHING unless
 * PAPIC_FULLRES_DROP_ENABLED='true'". The gate is `!== 'false'` — ON unless
 * disabled. Anyone reading before touching that code believed nothing could be
 * deleted. The SAME false sentence sat in the cron route too, so fixing one copy
 * would have left the other.
 *
 * ⚠ A per-file "if it contains the expression it must not say dry-run" test
 * would pass VACUOUSLY on the cron route, which never mentions the env var at
 * all. So: establish the real default from the library ONCE, then apply the
 * copy assertion to BOTH files unconditionally.
 *
 * ⚠ Deliberately NOT using retention-copy-is-true.test.ts's `code()` helper — it
 * strips comments, and a docblock is exactly what we need to read here.
 */
const DROP_SOURCES = [
  'lib/papic-fullres-drop.ts',
  'app/api/cron/papic-fullres-drop/route.ts',
] as const;

test('the drop is ON by default, and no copy claims otherwise', () => {
  const lib = read('lib/papic-fullres-drop.ts');

  // Establish the truth from the code, not from a comment.
  assert.match(
    lib,
    /PAPIC_FULLRES_DROP_ENABLED\s*!==\s*'false'/,
    'the gate should be `!== \'false\'` (ON unless disabled). If this changed ' +
      'deliberately, update the assertion below too — do not delete this test.',
  );

  for (const rel of DROP_SOURCES) {
    const src = read(rel);
    assert.ok(
      !/DRY.?RUN by default/i.test(src),
      `${rel} claims it ships dry-run by default. It does not: the gate is ` +
        `!== 'false', so it deletes unless explicitly disabled. This is the ` +
        `first thing a reader sees before touching irreversible deletion.`,
    );
  }
});

test('the warning email uses the SAME retention default as the drop', async () => {
  // These were typed separately and drifted: the warn hand-typed 90 while the
  // drop used 183, so the one notice a couple ever gets fired 107 days early.
  const warn = read('lib/daily-email-jobs.ts');
  assert.match(
    warn,
    /:\s*DEFAULT_FULL_RES_RETENTION_DAYS/,
    'the warn job must DERIVE its retention default from ' +
      'DEFAULT_FULL_RES_RETENTION_DAYS, never re-type the number',
  );
  assert.ok(
    !/\?\s*Math\.floor\(n\)\s*:\s*\d+/.test(warn),
    'a literal retention fallback is back in the warn job — derive it',
  );
});

test('the warn audience honours the post-event grace, not photo age alone', () => {
  // The drop's clock is max(first_capture + retention, event_date + grace).
  // Warning on captured_at alone is early whenever the post-event term binds —
  // the engagement-shoot case.
  const warn = read('lib/daily-email-jobs.ts');
  assert.match(
    warn,
    /papic_events_past_fullres_clock/,
    'the warn job must intersect with the same clock rpc the sweep uses',
  );
  assert.match(
    warn,
    /p_post_event_days:\s*Math\.max\(0,\s*FULL_RES_POST_EVENT_GRACE_DAYS\s*-\s*WARN_LEAD_DAYS\)/,
    'BOTH offsets must be pulled back by the lead time — pulling back only the ' +
      'retention one gives zero lead on events where the post-event term binds',
  );
});
