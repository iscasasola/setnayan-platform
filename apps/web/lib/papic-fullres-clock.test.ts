/**
 * HIGH-RES ORIGINALS EXPIRE PER EVENT, NOT PER PHOTO.
 *
 * Owner-locked 2026-08-02: *"the total time we keep their high resolution is
 * 6 months from the first day they use the service. the reason why i said
 * 5 month for until the event date is so they have at least 30 days to download
 * the files they have."*
 *
 * ── THE DEFECT THIS REPLACED ──────────────────────────────────────────────
 * The sweep aged each photo against ITS OWN capture time, 90 days. Fine for a
 * one-day wedding; wrong for a journey:
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

test('and never less than a 30-day grace after the event itself', () => {
  assert.equal(FULL_RES_POST_EVENT_GRACE_DAYS, 30);
});

test('🔑 the owner’s example works: start 5 months out, keep 30 days after', () => {
  // Their arithmetic, checked rather than assumed. Open the window at the
  // 5-month cap, and the 6-month clock still leaves a month after the day.
  const FIVE_MONTHS = 150;
  const graceLeft = DEFAULT_FULL_RES_RETENTION_DAYS - FIVE_MONTHS;
  assert.ok(
    graceLeft >= FULL_RES_POST_EVENT_GRACE_DAYS,
    `starting ${FIVE_MONTHS} days out leaves only ${graceLeft} days after the ` +
      `event, short of the ${FULL_RES_POST_EVENT_GRACE_DAYS}-day download grace`,
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
