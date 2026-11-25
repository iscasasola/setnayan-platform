/**
 * free-fee-only-for-you.test.ts — a booking fee is waived ONLY on a "For you" event, and the answer is locked once a
 * supplier joins (owner 2026-11-23, specs DECISION_LOG "Free booking fee only on 'For you' events, locked once a
 * supplier joins").
 *
 *   1 · the stored answer: only a blank-honoree "self" is stored as self; a wedding's bride / groom is self.
 *   2 · the pure twin of the charge: every free path is withheld on an event made for someone else; the two waivers
 *       already granted (a frozen free place, a launch place held) are kept.
 *   3 · every create path writes `for_whom`, and NOTHING ELSE in the app writes it — so no server action can change
 *       the answer after create; the DB trigger refuses it for every writer
 *       (tests/db/free-fee-only-for-you-events.db.test.ts, which also pins the SQL against this twin).
 *   4 · the supplier's fee preview asks the same reader as the charge, so it never promises a waiver the bill won't
 *       give.
 *
 * SABOTAGE (2026-11-23): dropping `&& forYou` from the import arm of `decideLockFee` turned test 2 RED; restored →
 * GREEN.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { BOOKING_FEE } from './booking-fee';
import { decideLockFee } from './booking-fee-lock';
import { forWhomForWeddingRole, forWhomToStore, isForYouEvent, readForWhom } from './event-for-whom';
import { stripComments } from './strip-comments';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');

test('1 · only a blank-honoree "For you" is stored as self; a contradiction is stored toward the fee', () => {
  const blank = { honoreeLabel: null, honoreeDependentId: null };
  assert.equal(forWhomToStore({ claimed: 'self', ...blank }), 'self');
  assert.equal(forWhomToStore({ claimed: 'self', honoreeLabel: 'Maria', honoreeDependentId: null }), 'someone');
  assert.equal(forWhomToStore({ claimed: 'self', honoreeLabel: '  ', honoreeDependentId: 'd1' }), 'someone');
  assert.equal(forWhomToStore({ claimed: 'self', ...blank, communityId: 'c1' }), 'someone', 'a group is not you');
  for (const w of ['someone', 'memorial', 'business'] as const) {
    assert.equal(forWhomToStore({ claimed: w, ...blank }), w, `"${w}" is taken as said`);
  }
  for (const junk of [null, undefined, '', 'me', 'SELF', 1, {}]) {
    assert.equal(forWhomToStore({ claimed: junk, ...blank }), null, `${String(junk)} must not be recorded`);
    assert.equal(readForWhom(junk), null);
  }
  assert.equal(forWhomForWeddingRole('bride'), 'self');
  assert.equal(forWhomForWeddingRole('groom'), 'self');
  assert.equal(forWhomForWeddingRole('helper'), 'someone');
  assert.equal(forWhomForWeddingRole(null), null);
  assert.equal(isForYouEvent('self'), true);
  for (const w of [null, undefined, 'someone', 'memorial', 'business', 'Self']) assert.equal(isForYouEvent(w), false);
});

const BASE: Parameters<typeof decideLockFee>[0] = {
  flagEnabled: true,
  onPlatform: true,
  attribution: 'sourced',
  forYou: false,
  shopVerified: true,
  frozenFree: false,
  launchOffer: false,
  promoWindow: false,
  agreedTotalPhp: 100_000,
  schedule: BOOKING_FEE,
  nextPlatformNumber: 15,
  freeEveryNth: 100_000,
  ticketWaiting: false,
};

test('2 · every free path waives only For you; the waivers already granted are kept', () => {
  const paths: Array<[string, Partial<typeof BASE>, string]> = [
    ['import', { attribution: 'import' }, 'not_sourced'],
    ['launch offer', { launchOffer: true }, 'launch_offer'],
    ['free-fee window', { promoWindow: true }, 'promo'],
    ['every Nth', { freeEveryNth: 5 }, 'every_nth'],
    ['ticket', { ticketWaiting: true }, 'ticket'],
  ];
  for (const [name, arm, freeReason] of paths) {
    const mine = decideLockFee({ ...BASE, ...arm, forYou: true });
    assert.equal(mine.reason, freeReason, `${name}: For you lost its waiver`);
    assert.equal(mine.feePhp, 0);
    const theirs = decideLockFee({ ...BASE, ...arm, forYou: false });
    assert.equal(theirs.reason, 'billed', `${name}: an event made for someone else was waived`);
    assert.equal(theirs.feePhp, 5_000, `${name}: billed ${theirs.feePhp}`);
    assert.equal(theirs.createOrder, true);
  }
  // Everything at once, for someone else: still billed.
  const all = decideLockFee({
    ...BASE,
    attribution: 'import',
    launchOffer: true,
    promoWindow: true,
    freeEveryNth: 5,
    ticketWaiting: true,
  });
  assert.equal(all.reason, 'billed');
  // A booking for someone else still takes its place in Setnayan's count (it carries a fee).
  assert.equal(all.takesPlatformNumber, true);
  // Never taken back.
  assert.equal(decideLockFee({ ...BASE, frozenFree: true }).reason, 'frozen_free');
  assert.equal(decideLockFee({ ...BASE, launchOfferHeld: true }).reason, 'launch_offer');
  // A ₱0 booking is not a waiver — it simply has no fee, for anyone.
  assert.equal(decideLockFee({ ...BASE, agreedTotalPhp: 0 }).reason, 'zero');
});

/** Every .ts/.tsx under app/ and lib/, tests excluded. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(web, p));
  }
  return out;
}

const CREATE_PATHS: Record<string, RegExp> = {
  'app/dashboard/(account)/create-event/actions.ts': /for_whom: forWhomToStore\(\{\s*claimed: formData\.get\('for_whom'\)/,
  'app/onboarding/simple/actions.ts': /for_whom: forWhomToStore\(\{\s*claimed: formData\.get\('for_whom'\)/,
  'app/onboarding/wedding/actions.ts': /for_whom: forWhomForWeddingRole\(payload\.role\)/,
  'lib/onboarding/event-insert.ts': /for_whom: forWhomToStore\(\{\s*claimed: payload\.forWhom \?\? null/,
};

test('3 · every create path writes for_whom, and nothing else in the app writes it', () => {
  for (const [file, shape] of Object.entries(CREATE_PATHS)) {
    assert.match(stripComments(read(file)), shape, `${file} no longer records who the event is for`);
  }
  // The forms post the answer the server re-checks.
  assert.match(
    stripComments(read('app/dashboard/(account)/create-event/_components/event-type-picker.tsx')),
    /name="for_whom" value=\{forWhomModeOf\(subject\)\}/,
  );
  assert.match(stripComments(read('app/onboarding/simple/_components/carried-honoree-fields.tsx')), /name="for_whom" value="self"/);
  assert.match(stripComments(read('app/onboarding/[type]/_components/generic-onboarding.tsx')), /forWhom: asksHonoree/);

  const writers = [...sources(join(web, 'app')), ...sources(join(web, 'lib'))].filter((f) =>
    /\bfor_whom\s*:/.test(stripComments(read(f))),
  );
  // Same column NAME, other tables — never `events`.
  const otherTables: Record<string, string> = {
    'lib/event-types-mutations.ts': 'event_type_vocab.for_whom — which types each answer may pick (Admin › Event types)',
    'lib/event-types-db.ts': 'reads event_type_vocab.for_whom',
    'app/admin/categories/_components/load.ts': 'reads event_type_vocab.for_whom',
    'app/onboarding/wedding/_data/experience-personas.ts': 'the wedding quiz axis (couple · guests · both)',
  };
  const allowed = new Set([...Object.keys(CREATE_PATHS), ...Object.keys(otherTables)]);
  const strays = writers.filter((f) => !allowed.has(f));
  assert.deepEqual(
    strays,
    [],
    'a file other than the create paths writes events.for_whom — the answer is LOCKED once a supplier joins and is ' +
      'never edited from a screen (owner 2026-11-23). If this is a new create path, add it to CREATE_PATHS.',
  );
});

test('4 · the supplier’s fee preview asks the same "For you" reader as the charge, and fails closed', () => {
  const src = stripComments(read('lib/booking-fee-disclosure.server.ts'));
  assert.match(src, /admin\.rpc\('booking_fee_event_is_for_you', \{ p_event_id: args\.eventId \}\)/);
  assert.match(src, /if \(forYouRead\.error \|\| typeof forYouRead\.data !== 'boolean'\) \{[\s\S]{0,160}?return \{ kind: 'unreadable' \}/);
  assert.match(src, /attribution === 'import' && forYou/, 'an import is said free only For you');
  assert.match(src, /isLaunchBooking \|\| \(ordinal === null && forYou\)/, 'a new launch place only For you');
  assert.match(src, /forYou && isBookingFeeFreeWindowActive/, 'a window only For you');
  assert.match(src, /badgeRead === 'next' && !forYou \? null/, 'a waiting ticket is not promised for someone else');
});
