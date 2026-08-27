/**
 * ONE RULE FOR A CLOSED CELEBRATION — and one answer to "did they book you?".
 *
 * ── WHAT WENT WRONG ─────────────────────────────────────────────────────────
 * "May this person read this celebration?" was answered in TWO files from the
 * same five facts: inline in `app/[slug]/page.tsx` for its own lock screen, and
 * in `canViewSlugEvent` for the seven sub-routes (venue · recap · find-seat ·
 * find-my-table · hub · pabuya · print). On 2026-08-17 the page grew a fifth
 * way in — a supplier the couple had BOOKED — and the shared gate did not.
 *
 * So the photographer working a private wedding could open the couple's page
 * and was then refused every single sub-page of it: no venue address, no
 * recap, no seat finder, no live hub. Measured in production 2026-08-27:
 * **3 of the 5 events are private**, and none is 'invited_accounts'.
 * 🔑 NOTHING REPORTED IT, AND NOTHING COULD. Each refusal is byte-identical to
 * what a stranger gets, deliberately — a refusal that explains itself is how
 * the existence of somebody's private celebration leaks. A gate that is wrong
 * in this direction is SILENT by design.
 *
 * ── AND THE SAME SHAPE AGAIN, ONE LEVEL DOWN ────────────────────────────────
 * "Is this viewer a booked supplier?" was answered in THREE places and two of
 * them asked whether a LINK EXISTED rather than whether the couple had booked
 * anybody. `lib/reusable-bookings.server.ts` mints a linked row at
 * 'shortlisted' for a reuse offer the couple has still to lock, so on those two
 * a supplier the couple was merely CONSIDERING was told "You are booked here"
 * and counted as one of "the people of this celebration" — which is the entire
 * gate on a keepsake story the couple restricted to those people.
 *
 * ── WHY THIS FILE IS SHAPED THE WAY IT IS ───────────────────────────────────
 * The obvious guard — feed one fixture to both gates and assert they agree —
 * CANNOT BE WRITTEN HERE. `lib/slug-access.ts` is `server-only`, which in this
 * repo cannot be imported by a `node:test` file at all (Next aliases the
 * package at build time; plain node throws MODULE_NOT_FOUND), and the page's
 * copy lives inside a 1,000-line server component. So the rule was made ONE
 * rule instead, and this file pins two things:
 *
 *   1. THE RULE — every identity, on every visibility, in a pure function.
 *   2. THAT BOTH SIDES STILL ASK IT, and still resolve every fact it takes.
 *      The fact list is DERIVED from `NO_CLAIM`, never hand-typed: a sixth fact
 *      added later fails this test until both sides resolve it.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  closedEventAdmits,
  NO_CLAIM,
  type ClosedEventFacts,
} from './closed-event-admission';
import { EVENT_VISIBILITIES, openToStrangers } from './event-visibility';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/** The two files that decide who reads a celebration. Both must ask the rule. */
const GATES = ['lib/slug-access.ts', 'app/[slug]/page.tsx'] as const;

function source(rel: string): string {
  return stripComments(readFileSync(join(WEB, rel), 'utf8'));
}

function count(haystack: string, needle: RegExp): number {
  return haystack.match(needle)?.length ?? 0;
}

/** One claim proved, everything else unestablished. */
function only(fact: keyof ClosedEventFacts): ClosedEventFacts {
  return { ...NO_CLAIM, [fact]: true };
}

const CLOSED = EVENT_VISIBILITIES.filter((v) => !openToStrangers(v));
const OPEN = EVENT_VISIBILITIES.filter((v) => openToStrangers(v));

// ── 1 · THE RULE ───────────────────────────────────────────────────────────

test('the closed set is exactly private + invited_accounts, derived not typed', () => {
  assert.deepEqual([...CLOSED].sort(), ['invited_accounts', 'private']);
  assert.deepEqual([...OPEN].sort(), ['public', 'unlisted']);
});

test('a stranger reads an open celebration and never a closed one', () => {
  for (const v of OPEN) assert.equal(closedEventAdmits(v, NO_CLAIM), true, v);
  for (const v of CLOSED) assert.equal(closedEventAdmits(v, NO_CLAIM), false, v);
});

test('the default is a stranger — a caller that establishes nothing gets no', () => {
  for (const v of CLOSED) assert.equal(closedEventAdmits(v), false, v);
});

test('four claims admit on BOTH closed visibilities', () => {
  // The guest pass, the host, the seat-holder — and the supplier the couple
  // booked, which is the arm the shared gate never had.
  for (const fact of [
    'holdsGuestPass',
    'isSignedInHost',
    'isSeatHolder',
    'isBookedSupplier',
  ] as const) {
    for (const v of CLOSED) {
      assert.equal(closedEventAdmits(v, only(fact)), true, `${fact} on ${v}`);
    }
  }
});

test('BEING ON THE LIST admits on invited_accounts ONLY — private is unchanged', () => {
  // 'private' has always meant the hosts plus a redeemed invitation. Honouring
  // this fact there would quietly change a promise the couple made to
  // themselves, so the VISIBILITY has to allow it, not only the fact.
  assert.equal(closedEventAdmits('invited_accounts', only('isInvitedAccount')), true);
  assert.equal(closedEventAdmits('private', only('isInvitedAccount')), false);
});

test('a visibility invented later is CLOSED until somebody opens it on purpose', () => {
  // The exclusion spelling (`!== 'private'`) is what once made 'invited_accounts'
  // fully public across 31 call sites the day the value was added.
  const future = 'members_of_my_church' as (typeof EVENT_VISIBILITIES)[number];
  assert.equal(closedEventAdmits(future, NO_CLAIM), false);
  assert.equal(closedEventAdmits(future, only('isInvitedAccount')), false);
  assert.equal(closedEventAdmits(future, only('isBookedSupplier')), true);
});

// ── 2 · BOTH SIDES STILL ASK IT ────────────────────────────────────────────

test('both gates decide through the shared rule', () => {
  for (const gate of GATES) {
    const src = source(gate);
    assert.ok(
      count(src, /closedEventAdmits\s*\(/g) > 0,
      `${gate} no longer asks closedEventAdmits — the rule is written twice again, ` +
        'and the last time that happened a booked supplier was bounced off seven pages.',
    );
  }
});

test('both gates resolve EVERY fact the rule takes — the list is derived', () => {
  // 🔑 From NO_CLAIM, so a sixth fact added to the rule fails here until both
  // sides establish it. A hand-typed list is a list of the facts somebody
  // thought of.
  const facts = Object.keys(NO_CLAIM) as (keyof ClosedEventFacts)[];
  assert.equal(facts.length, 5, 'the fact list changed — read the rule, then this test');
  for (const gate of GATES) {
    const src = source(gate);
    for (const fact of facts) {
      assert.ok(
        count(src, new RegExp(`\\b${fact}\\b`, 'g')) > 0,
        `${gate} never resolves ${fact}. The rule would still be correct and this ` +
          'surface would silently stop admitting somebody it was written to admit.',
      );
    }
  }
});

test('the supplier arm is resolved through the shared predicate, not re-typed', () => {
  for (const gate of GATES) {
    const src = source(gate);
    assert.ok(
      count(src, /viewerIsBookedSupplier\s*\(/g) > 0,
      `${gate} decides "booked" for itself. Three copies of that question is how ` +
        'two of them came to admit a shortlisted supplier.',
    );
  }
});

// ── 3 · NOBODY ADMITS ON THE LINK ALONE ────────────────────────────────────

/** Every source file under app/ + lib/ that touches the booking read. DERIVED,
 *  because a hand-typed list is a list of the surfaces somebody thought of —
 *  and the two that were wrong were both surfaces nobody had thought about. */
function filesTouchingTheBookingRead(): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;
      const raw = readFileSync(full, 'utf8');
      if (raw.includes('loadVendorBooking') || raw.includes('isBookedSupplier')) {
        hits.push(relative(WEB, full));
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  return hits.sort();
}

test('no surface treats a mere LINK as a booking', () => {
  // The banned shape: the read's RESULT compared against null, with nothing
  // asking the row's status. It shipped in two spellings and both are covered —
  // the regex expands across nested calls, because the historical one wrapped a
  // `createAdminClient()` argument and a `[^)]*` version walks straight past it.
  const files = filesTouchingTheBookingRead();
  assert.ok(
    files.length >= 4,
    `the scan found only ${files.length} files — it has stopped seeing the tree, ` +
      'which is indistinguishable from a clean result.',
  );
  for (const rel of files) {
    const src = source(rel);
    assert.equal(
      count(src, /loadVendorBooking\s*\([\s\S]{0,200}?\)\s*!==\s*null/g),
      0,
      `${rel} admits on the link alone. A 'shortlisted' reuse row is linked and is ` +
        'not a booking — the status is what must decide.',
    );
  }
});

/**
 * The only expressions that may establish "this viewer is a booked supplier".
 *
 * TWO real ways, and no third: ask the shared question, or take it from a
 * `VendorCapability`, which exists only after `resolveVendorCapability` asked
 * that same question (pinned below). The rest are declarations — a type, or the
 * safe default — which establish nothing and are allowed for that reason.
 */
const WAYS_TO_ESTABLISH_IT = [
  /^(await\s+)?viewerIsBookedSupplier\(/,
  /^vendorCapability !== null$/,
  /^(false|true|boolean)$/,
];

test('every surface that resolves the supplier fact asks the shared question', () => {
  // Positive half of the rule above: not merely "the wrong shape is absent" but
  // "the right call is present", checked at every ASSIGNMENT of the fact.
  //
  // 🔑 THE SCAN FOUND A SURFACE THE HAND LIST HAD MISSED. This test began with
  // three files named by hand; the walk turned up `_components/site-body.tsx`,
  // which feeds the fact straight into `belongsToThisEvent` — the gate on a
  // story the couple kept to the people of their day — and nobody had thought
  // of it. *A hand-typed list is a list of the surfaces somebody thought of.*
  const files = filesTouchingTheBookingRead();
  let established = 0;
  for (const rel of files) {
    const src = source(rel);
    for (const m of src.matchAll(/\bisBookedSupplier\s*[:=]\s*([^,;\n]+)/g)) {
      // Trailing `}` / `)` from a one-line object literal is punctuation, not
      // part of the expression.
      const rhs = (m[1] ?? '').trim().replace(/[})\s]+$/, '');
      established += 1;
      assert.ok(
        WAYS_TO_ESTABLISH_IT.some((allowed) => allowed.test(rhs)),
        `${rel} establishes isBookedSupplier from \`${rhs}\` — a fourth opinion ` +
          'about who was booked. Two of the first three admitted a supplier the ' +
          'couple had only shortlisted.',
      );
    }
  }
  assert.ok(
    established >= 5,
    `only ${established} assignments found — the scan has stopped seeing them, ` +
      'which is indistinguishable from a clean result.',
  );
});

test('the one read pairs itself with the one predicate', () => {
  const src = source('lib/booked-supplier.ts');
  assert.ok(
    count(src, /vendorBookingIsCommitted\s*\(/g) > 0,
    'viewerIsBookedSupplier stopped asking the status — every surface that trusts ' +
      'it would then admit a supplier the couple never booked.',
  );
  assert.equal(
    count(src, /return\s+booking\s*!==\s*null\s*;/g),
    0,
    'the boolean is back to "a link exists".',
  );
});

test('the capability behind the doorway asks it too', () => {
  // `resolveVendorCapability` produces the strip that says, in words, "You are
  // booked here" — and it feeds `belongsToThisEvent`, the single boolean that
  // gates a story the couple kept to the people of their day.
  const src = source('app/[slug]/_lib/site-identity.ts');
  assert.ok(
    count(src, /if \(!vendorBookingIsCommitted\(booked\.bookingStatus\)\) return null;/g) > 0,
    'The doorway gate admits on the link again. It tells a supplier the couple is ' +
      'still only considering that they are booked, and hands them the day’s ' +
      'restricted story.',
  );
});
