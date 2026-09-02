/**
 * EVERY SCAN GOES THROUGH ONE DOOR — so the guest's opt-out cannot be missed.
 *
 * ── THE DEFECT THIS EXISTS TO PREVENT ───────────────────────────────────────
 * `guests.scan_tracking_opt_out` is honoured in exactly one place:
 * `recordScan` in `lib/scan-trail.ts`. Before that function there were FOUR
 * files inserting into `scan_events`, and a fifth would have been written the
 * next time somebody added a door. A switch honoured at four sites out of five
 * is stored and ignored — from the guest's side, identical to never having
 * built it, and worse, because we told them it works.
 *
 * This guard is therefore not about the four sites that exist today. It is
 * about the fifth. A new write path either goes through the door, or it turns
 * this test red in the same PR that adds it.
 *
 * ── WHY TWO NETS ────────────────────────────────────────────────────────────
 * `lib/gate-writers.ts` documents at length why one regex over one call
 * expression is not enough: this codebase writes through helper wrappers,
 * through assembled payload variables, and across hundreds of characters. So:
 *
 *   NET 1 — no file outside the door may pair `from('scan_events')` with a
 *           ROW-CREATING verb, however far apart and however chained.
 *   NET 2 — no file outside a NAMED, REASONED allowlist may mention the table
 *           at all. This one catches the shapes net 1 cannot see, at the price
 *           of one line in the diff whenever a legitimate new reader appears —
 *           which is exactly where a reviewer should be looking anyway.
 *
 * ⚖ CREATING A ROW, NOT WRITING ONE. Net 1 was first written against
 * insert/upsert/update/delete and immediately flagged `lib/erasure/purge.ts`,
 * which UPDATES existing rows to null a departed scanner's identity under RA
 * 10173. That is redaction, not tracking: routing it through `recordScan` would
 * be nonsense, and forbidding it would break erasure. The opt-out governs
 * whether a scan is RECORDED, so the verbs that matter are the ones that make a
 * row. Erasure's own writes are guarded by `tests/db/erasure-completeness`.
 *
 * Sources arrive comment-stripped (`loadSources`): four guards in this repo
 * have been satisfied by a docblock ABOUT the thing instead of the thing, and
 * every file below carries prose naming `scan_events`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { loadSources, type Source } from './gate-writers';

const WEB = path.join(__dirname, '..');
const DOOR = 'lib/scan-trail.ts';

/**
 * Files allowed to name `scan_events` without CREATING a row — they read the
 * trail or redact it — each with its reason. A BILL, not a decision: adding a
 * line here is allowed and lands where a reviewer can disagree with it.
 */
const TOUCHES_WITHOUT_CREATING: Record<string, string> = {
  'app/[slug]/_lib/loaders.ts':
    'READS — the first-arrival greeting, the only reader of the trail in the product',
  'lib/erasure/coverage.ts': 'DECLARES — RA 10173 erasure, which columns are nulled',
  'lib/erasure/purge.ts': 'REDACTS — RA 10173 erasure, nulls the scanner identity + device trail',
};

const sources: Source[] = loadSources(WEB);
const mentions = (s: Source) => /scan_events/.test(s.code);

test('ANCHOR — the tree was actually read', () => {
  // A loader that returned nothing would make every assertion below vacuous:
  // zero files trivially satisfy "no file writes scan_events".
  assert.ok(sources.length > 500, `only ${sources.length} sources loaded — the walk is broken`);
  assert.ok(
    sources.some((s) => s.path === DOOR),
    `${DOOR} was not among the loaded sources — the guard is pointing at nothing`,
  );
  assert.ok(
    sources.filter(mentions).length >= 4,
    'nothing in the tree mentions scan_events — the comment stripper ate the code',
  );
});

test('the door itself still writes the table — otherwise this guard is vacuous', () => {
  // Every assertion in this file is of the form "nobody else does X". If the
  // door stopped doing X too, the whole set would pass on a product that no
  // longer records a single scan.
  const door = sources.find((s) => s.path === DOOR);
  assert.ok(door, `${DOOR} is missing`);
  assert.match(
    door.code,
    /from\('scan_events'\)[\s\S]{0,80}?\.insert\(/,
    'the one door no longer inserts into scan_events',
  );
});

test('the door reads the opt-out, and reads it on a POSITIVE false', () => {
  const door = sources.find((s) => s.path === DOOR)!;
  assert.match(door.code, /scan_tracking_opt_out/, 'the door no longer reads the guest flag');
  assert.match(
    door.code,
    /optOut !== false/,
    'the door no longer requires a positive false — an unreadable flag now records a scan',
  );
  // And the dangerous spelling must be ABSENT, not merely un-preferred: `??`
  // would turn a failed read into "they did not opt out".
  assert.equal(
    (door.code.match(/scan_tracking_opt_out\s*\?\?/g) ?? []).length,
    0,
    'the opt-out is being defaulted with ?? — a failed read would read as consent',
  );
});

test('NET 1 — no file outside the door creates a scan_events row', () => {
  const offenders = sources
    .filter((s) => s.path !== DOOR)
    .filter((s) =>
      /from\(\s*['"]scan_events['"]\s*\)[\s\S]{0,400}?\.\s*(insert|upsert)\s*\(/.test(s.code),
    )
    .map((s) => s.path);

  assert.deepEqual(
    offenders,
    [],
    'These files create scan_events rows directly. Route them through recordScan() in ' +
      `${DOOR} — a direct insert ignores guests.scan_tracking_opt_out:\n  ` +
      offenders.join('\n  '),
  );
});

test('NET 2 — only the door and the named readers mention the table at all', () => {
  const unexpected = sources
    .filter((s) => s.path !== DOOR && mentions(s))
    .map((s) => s.path)
    .filter((p) => !(p in TOUCHES_WITHOUT_CREATING));

  assert.deepEqual(
    unexpected,
    [],
    'These files touch scan_events and are neither the one door nor a declared ' +
      'reader. If it RECORDS a scan, call recordScan(). If it reads or redacts, ' +
      `add a line to TOUCHES_WITHOUT_CREATING in this file saying why:\n  ${unexpected.join('\n  ')}`,
  );
});

test('the declared readers are still real — a stale allowlist hides the next writer', () => {
  const present = new Set(sources.filter(mentions).map((s) => s.path));
  const stale = Object.keys(TOUCHES_WITHOUT_CREATING).filter((p) => !present.has(p));
  assert.deepEqual(
    stale,
    [],
    `These allowlist lines no longer match a file that mentions scan_events and ` +
      `should be deleted:\n  ${stale.join('\n  ')}`,
  );
});

test('the four doors that existed before all call recordScan', () => {
  // Named individually, because "nobody writes the table" is also satisfied by
  // a PR that deletes the scan trail entirely. All four kinds are live in
  // production (measured 2026-09-02: 22 invite_link · 4 personal_qr_scan ·
  // 1 self_join · 1 self_join_bound_seed).
  const doors = [
    'app/[slug]/redeem/route.ts',
    'app/[slug]/seat/claim/route.ts',
    'app/[slug]/welcome/actions.ts',
    'app/join/[eventId]/actions.ts',
  ];
  for (const door of doors) {
    const src = sources.find((s) => s.path === door);
    assert.ok(src, `${door} is gone — was the scan trail removed?`);
    assert.match(
      src.code,
      /recordScan\(/,
      `${door} no longer records a scan through the one door`,
    );
  }
});
