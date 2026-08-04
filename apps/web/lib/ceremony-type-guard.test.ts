/**
 * ⭐ ONE ceremony-type guard — the write path can never accept a faith the read
 * path rejects.
 *
 * The defect this pins (found 2026-07-27, live on origin/main @ 8af306bf3):
 * `CeremonyType` is a 16-member union in lib/auspicious-date.ts, but FOUR
 * hand-rolled runtime guards narrowed it differently, and TypeScript could not
 * see it because every list was a legal SUBSET of the union:
 *
 *   - date-selection/actions.ts   (WRITE) → 16 members
 *   - date-selection/page.tsx     (READ)  →  8 members
 *   - wizard-actions.ts           (READ)  →  8 members
 *   - wedding-plan-groups.ts      (dead)  →  8 members, zero importers
 *
 * Reachable harm: a host picks Hindu (or Aglipayan/LDS/SDA/JW/Sikh/Buddhist)
 * in the guided flow, `setCeremonyTypeFromFlow` accepts it, `ceremony_type` is
 * persisted and `ceremony_type_locked_at` stamped — then the next render's
 * 8-member guard returns false, `ceremonyType` collapses to `null`, the radio
 * group shows NOTHING selected even though it is locked, and
 * `suggestMeaningfulDates` routes the host into the
 * `ceremonyType === 'catholic' || ceremonyType === null` seed-date branch.
 *
 * (Deliberately NOT claimed here: that faith-specific date *reasons* vanish.
 * `ceremonyOverlay` has no branch for those 8 faiths, so their reasons are
 * identical to `null`'s today. The harm is the lost selection + the Catholic
 * seed-date routing.)
 *
 * NEUTRALISATION: restore any 8-member local guard and
 *   · "every live ceremony_type guard is THE canonical import"  fails, and
 *   · "a locked hindu event does not collapse to the Catholic branch" fails.
 *
 * Run: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CEREMONY_TYPES,
  computeAuspiciousReasons,
  isCeremonyType,
  suggestMeaningfulDates,
  type CeremonyType,
} from './auspicious-date';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

const LIB = 'lib/auspicious-date.ts';
const WRITE_PATH = 'app/dashboard/[eventId]/date-selection/actions.ts';
const READ_PAGE = 'app/dashboard/[eventId]/date-selection/page.tsx';
const READ_WIZARD = 'app/dashboard/[eventId]/wizard-actions.ts';
const DEAD_CANONICAL = 'lib/wedding-plan-groups.ts';

/** The 8 worldwide-expansion faiths (PR #1275) the short guards dropped. */
const DROPPED_BY_THE_SHORT_GUARDS = [
  'aglipayan',
  'lds',
  'sda',
  'jw',
  'hindu',
  'sikh',
  'buddhist',
  'orthodox',
] as const;

/** Exactly the list the two READ paths used to carry. */
const THE_OLD_EIGHT = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'chinese',
  'mixed',
] as const;

/* ── 1 · The guard itself ─────────────────────────────────────────────────── */

test('isCeremonyType accepts every member of the canonical union', () => {
  for (const key of CEREMONY_TYPES) {
    assert.ok(isCeremonyType(key), `canonical member "${key}" must be accepted`);
  }
  // 18 = the `events_ceremony_type_check` DB CHECK, pinned exactly by
  // tests/db/ceremony-type-check-parity.db.test.ts.
  assert.equal(CEREMONY_TYPES.length, 18);
  assert.equal(new Set(CEREMONY_TYPES).size, CEREMONY_TYPES.length, 'duplicate member');
});

test('born_again — the LIVE victim — is accepted and survives a read', () => {
  // `born_again` is `status='active'` in wedding_type_launch_status (owner
  // activated 2026-06-04, migration 20260808000000): a live, pickable chip.
  // `setEventCeremonyType` accepts it (faith-registry's 18 values) and the DB
  // CHECK stores it — but this union used to omit it, so the date-selection
  // read collapsed it to null and served the Catholic seed dates.
  assert.ok(isCeremonyType('born_again'));
  assert.equal(readBack('born_again'), 'born_again');
  assert.ok(isCeremonyType('jewish'), 'jewish is coming_soon but the DB stores it');
  assert.equal(readBack('jewish'), 'jewish');
});

test('isCeremonyType accepts the 8 faiths the short guards silently dropped', () => {
  for (const key of DROPPED_BY_THE_SHORT_GUARDS) {
    assert.ok(
      isCeremonyType(key),
      `"${key}" is written by the guided flow — a read guard must not reject it`,
    );
  }
});

test('isCeremonyType rejects non-members', () => {
  for (const bad of [
    'protestant',
    'Catholic',
    'CATHOLIC',
    ' catholic',
    'catholic ',
    '',
    'undecided',
  ]) {
    assert.equal(isCeremonyType(bad), false, `"${bad}" must be rejected`);
  }
  for (const bad of [null, undefined, 123, {}, [], true]) {
    assert.equal(isCeremonyType(bad), false, `${String(bad)} must be rejected`);
  }
});

/* ── 2 · The array and the union cannot drift ─────────────────────────────── */

test('CEREMONY_TYPES mirrors the CeremonyType union exactly — no drift', () => {
  // The `as const satisfies readonly CeremonyType[]` + exhaustiveness assertion
  // in lib/auspicious-date.ts make BOTH drift directions a `tsc --noEmit`
  // failure (proven by hand: adding a union member without the value yields
  //   TS2322: Type 'boolean' is not assignable to type
  //   '["CEREMONY_TYPES is missing a CeremonyType member", "jewish"]'
  // and adding a value without the union member yields
  //   TS2322: Type '"jewish"' is not assignable to type 'CeremonyType').
  // This test is the runtime belt to that compile-time suspender, so the
  // invariant also fails LOUDLY in `pnpm test:unit`.
  const src = repoFile(LIB);
  const unionBlock = /export type CeremonyType =([\s\S]*?);\n/.exec(src)?.[1];
  assert.ok(unionBlock, 'could not locate the CeremonyType union declaration');
  // Only true union arms (`| 'x'` at the start of a line) — the block also
  // carries `//` comments that can contain quoted strings.
  const unionMembers = [...unionBlock.matchAll(/^\s*\|\s*'([a-z_]+)'\s*$/gm)].map((m) => m[1]);

  assert.ok(unionMembers.length > 0, 'parsed no union members');
  assert.deepEqual(
    [...unionMembers].sort(),
    [...CEREMONY_TYPES].sort(),
    'CEREMONY_TYPES and the CeremonyType union have diverged',
  );
});

/* ── 3 · Write-then-read round trip ───────────────────────────────────────── */

/**
 * The read paths' exact shape: `isCeremonyType(row.ceremony_type) ?
 * row.ceremony_type : null`. Modelled here so the round trip is tested through
 * the same guard the app uses, with no DB.
 */
function readBack(persisted: unknown): CeremonyType | null {
  return isCeremonyType(persisted) ? persisted : null;
}

test('write-then-read round trip keeps every faith the write path accepted', () => {
  for (const key of CEREMONY_TYPES) {
    // The write path (setCeremonyTypeFromFlow) gates on the SAME guard.
    assert.ok(isCeremonyType(key), `write path would reject "${key}"`);
    assert.equal(
      readBack(key),
      key,
      `"${key}" was persisted by the write path and read back as ${String(readBack(key))}`,
    );
  }
});

test('a locked hindu event does not collapse to the Catholic seed-date branch', () => {
  const YEAR = 2030;
  const hindu = suggestMeaningfulDates([], 'hindu', YEAR);
  const nulled = suggestMeaningfulDates([], null, YEAR);
  const catholic = suggestMeaningfulDates([], 'catholic', YEAR);

  // What `null` gets is the Catholic branch — that IS the routing bug's payload
  // (auspicious-date.ts: `ceremonyType === 'catholic' || ceremonyType === null`).
  assert.deepEqual(
    nulled.map((s) => s.date),
    catholic.map((s) => s.date),
    'precondition: null already routes into the Catholic seed dates',
  );

  // With the guard fixed, hindu survives the read and gets its OWN (non-Catholic)
  // seed set.
  assert.notDeepEqual(
    hindu.map((s) => s.date),
    catholic.map((s) => s.date),
    'a hindu event is being served the Catholic seed dates',
  );

  // And the collapse the 8-member guard caused: read back as null → Catholic.
  const collapsed = (THE_OLD_EIGHT as readonly string[]).includes('hindu')
    ? ('hindu' as CeremonyType)
    : null;
  assert.equal(collapsed, null, 'the old 8-member guard did collapse hindu to null');
  assert.deepEqual(
    suggestMeaningfulDates([], collapsed, YEAR).map((s) => s.date),
    catholic.map((s) => s.date),
    'the old collapse routed hindu into the Catholic seed dates',
  );
});

test('a born_again event does not collapse to the Catholic seed-date branch', () => {
  // The LIVE case (born_again is an active launch row). Same assertion as the
  // hindu one, for the faith the union used to omit entirely.
  const YEAR = 2030;
  const bornAgain = suggestMeaningfulDates([], 'born_again', YEAR).map((s) => s.date);
  const catholic = suggestMeaningfulDates([], 'catholic', YEAR).map((s) => s.date);
  const nulled = suggestMeaningfulDates([], null, YEAR).map((s) => s.date);

  assert.notDeepEqual(bornAgain, catholic, 'born_again is being served the Catholic seed dates');
  assert.notDeepEqual(bornAgain, nulled, 'born_again is still collapsing to the null branch');
});

test('widening the union to 18 was INERT — the two new members behave like an existing one', () => {
  // `hindu` is an existing member with no branch in ceremonyOverlay,
  // sensitiveReframes or the seed-date fallbacks. If the new members are
  // byte-identical to it across a full year and both chineseTradition flags,
  // they added no behaviour — nothing changed for any existing couple.
  const probe = (key: CeremonyType | null) => {
    const out: unknown[] = [];
    for (const chinese of [false, true]) {
      for (let i = 0; i < 366; i++) {
        out.push(computeAuspiciousReasons(new Date(2030, 0, 1 + i), key, [], chinese));
      }
      for (const year of [2030, 2031]) {
        out.push(suggestMeaningfulDates([], key, year, chinese));
      }
    }
    return JSON.stringify(out);
  };

  const inertBaseline = probe('hindu');
  assert.equal(probe('born_again'), inertBaseline, 'born_again added behaviour');
  assert.equal(probe('jewish'), inertBaseline, 'jewish added behaviour');
  // ...and is distinguishable from the branch it used to be misrouted into.
  assert.notEqual(probe('catholic'), inertBaseline);
  assert.notEqual(probe(null), inertBaseline);
});

/* ── 4 · One guard, imported — no local subsets anywhere ──────────────────── */

test('every live ceremony_type guard is THE canonical import, not a local copy', () => {
  for (const path of [WRITE_PATH, READ_PAGE, READ_WIZARD]) {
    const src = repoFile(path);

    assert.match(
      src,
      /import \{[\s\S]*?\bisCeremonyType\b[\s\S]*?\} from '@\/lib\/auspicious-date';/,
      `${path} does not import the canonical isCeremonyType`,
    );
    assert.doesNotMatch(
      src,
      /function isCeremonyType\s*\(/,
      `${path} re-declares a LOCAL isCeremonyType — that is the divergence`,
    );
    assert.doesNotMatch(
      src,
      /const (CEREMONY_TYPES|VALID_CEREMONY_TYPES)\b/,
      `${path} re-declares a LOCAL ceremony-type value list — that is the divergence`,
    );
  }
});

test('the dead 8-member canonical in wedding-plan-groups.ts stays deleted', () => {
  // It had ZERO importers, so a future "dedupe onto the lib helper" would have
  // adopted the SHORT list and broken the write path too.
  const src = repoFile(DEAD_CANONICAL);
  assert.doesNotMatch(
    src,
    /export function isCeremonyType\s*\(/,
    'the dead 8-member guard is back in wedding-plan-groups.ts',
  );
  assert.doesNotMatch(
    src,
    /export type CeremonyType\s*=/,
    'the dead 8-member CeremonyType union is back in wedding-plan-groups.ts',
  );
});

test('the stale "matches the union / matches actions.ts" comment is gone', () => {
  const src = repoFile(READ_WIZARD);
  assert.doesNotMatch(
    src,
    /Inline here \(vs imported\) because the lib doesn't export a runtime/,
    'wizard-actions.ts still claims the lib exports no runtime array — it does now',
  );
});
