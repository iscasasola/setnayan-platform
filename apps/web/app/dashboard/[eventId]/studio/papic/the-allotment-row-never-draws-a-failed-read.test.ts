/**
 * Guard: the couple's Papic controls never turn a failed read into a number,
 * an empty list or a missing control.
 *
 * WHAT WAS WRONG (AREA-PAPIC, 2026-09-19). "How many credits each guest gets"
 * reads five things and does arithmetic over all of them. Every failure became
 * a real-looking value:
 *   • a refused guest list read `[]`, so the sheet said "Your guest list is
 *     empty" to a couple with a full list;
 *   • refused allotments read as "nobody named", so the share was worked out as
 *     if the named guests did not exist;
 *   • a refused pot read `0`, which showed as "0 credits each";
 *   • a refused camera check (`eventPapicGuestActive`, the two-state gate) hid
 *     the whole row, and "When guests can shoot" with it. That looks the same
 *     as a celebration with no guest cameras.
 * The moderation page told the couple their guests' photos would appear "once
 * Papic is on" whenever the same check failed.
 *
 * The decision is one pure function (`allotmentRowState`), EXECUTED here over
 * every combination. The source checks only pin that each surface feeds it the
 * real reads and renders its answer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { allotmentRowState, type AllotmentReads } from '@/lib/papic-guest-allotments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

test('🔴 the row draws numbers only when every read answered and cameras are on', () => {
  const accesses: AllotmentReads['access'][] = ['on', 'off', 'unknown'];
  let shown = 0;
  let cases = 0;
  for (const access of accesses) {
    for (let bits = 0; bits < 16; bits++) {
      const r: AllotmentReads = {
        access,
        poolOk: Boolean(bits & 1),
        headcountOk: Boolean(bits & 2),
        guestsOk: Boolean(bits & 4),
        allotmentsOk: Boolean(bits & 8),
      };
      cases += 1;
      const got = allotmentRowState(r);
      const allOk = bits === 15;
      const want = access === 'off' ? 'hidden' : access === 'on' && allOk ? 'show' : 'unknown';
      assert.equal(got, want, `${JSON.stringify(r)} → ${got}, expected ${want}`);
      if (got === 'show') shown += 1;
    }
  }
  assert.equal(cases, 48, 'expected 3 × 16 combinations');
  assert.equal(shown, 1, `only one combination may draw numbers, ${shown} did`);
});

test('🔌 the allotment row feeds the decision its real reads and renders the answer', () => {
  const src = read('_components', 'guest-allotments-choice.tsx');
  const args = src.match(/allotmentRowState\(\{([\s\S]*?)\}\)/);
  assert.ok(args, 'guest-allotments-choice.tsx must ask allotmentRowState');
  const body = args![1]!;
  for (const [field, expr] of [
    ['poolOk', /poolOk:\s*pool\.ok === true/],
    ['headcountOk', /headcountOk:\s*!headcountResult\.error/],
    ['guestsOk', /guestsOk:\s*!guestsResult\.error/],
    ['allotmentsOk', /allotmentsOk:\s*!allotmentsResult\.error/],
  ] as const) {
    assert.match(body, expr, `${field} must be bound to its own read's result`);
  }
  assert.match(body, /\baccess,/, 'access must be the three-state answer');
  assert.match(
    src,
    /const access = await eventPapicGuestAccess\(admin, eventId\);/,
    'the row must ask the three-state gate',
  );
  assert.match(
    src,
    /if \(rowState === 'unknown'\) \{[\s\S]*?return <AllotmentsCouldNotLoad variant=\{variant\} \/>;\s*\}/,
    "an 'unknown' row must render the couldn't-load state, never null",
  );
  const catchers = src.match(/readEventPoolStatus\(admin, eventId\)\.catch\(\(\) => null\)/g) ?? [];
  assert.equal(catchers.length, 0, 'a thrown pool read must be ok:false, not null');
});

test('🔴 no couple-side Papic surface asks the two-state gate', () => {
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) files.push(p);
    }
  })(HERE);
  assert.ok(files.length >= 30, `floor: expected 30+ files under studio/papic, found ${files.length}`);
  const twoState = files
    .filter((f) => /\beventPapicGuestActive\s*\(/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(HERE.length + 1));
  assert.deepEqual(
    twoState,
    [],
    'a couple-side Papic surface asks eventPapicGuestActive, so a failed check ' +
      'reads as "guest cameras are off". Ask eventPapicGuestAccess.',
  );
});

test("🔴 moderation says it couldn't check, and keeps its own capture list", () => {
  const src = read('moderation', 'page.tsx');
  assert.match(src, /const guestAccess = await eventPapicGuestAccess\(admin, eventId\);/);
  assert.match(
    src,
    /\{guestAccess === 'unknown' \? \([\s\S]{0,200}couldn&rsquo;t check whether guest cameras are on/,
    "the unknown state must be worded as a failed check",
  );
  assert.match(
    src,
    /\{guestAccess === 'off' \? \(/,
    '"once Papic is on" may render only when the check answered off',
  );
  const cams = read('_components', 'guest-cameras-choice.tsx');
  assert.match(cams, /if \(access === 'off'\) return null;/);
  assert.match(cams, /if \(access !== 'on'\) \{[\s\S]{0,900}value="Couldn’t check"/);
});
