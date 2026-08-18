/**
 * A BIRTHDAY IS NOT HANDED A WEDDING.
 *
 * The words half of the owner's ruling (S13) is done. This is the other half:
 * the parts that exist BECAUSE it is a wedding must not appear elsewhere at
 * all. **Wording them generically would be the wrong fix** — a seven-year-old
 * does not need a neutrally-phrased love story, he needs no love story.
 *
 * The leak, re-measured 2026-08-18 rather than inherited: the profile has
 * recorded since the type engine shipped that Save-the-Date and monogram are
 * wedding-only, and the guest tree called `surfaceEnabled` with `'website'`
 * eleven times, `'seating'` once, and those two NEVER. `site-body-plan.ts` did
 * not mention the event type at all.
 */
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

import {
  resolveWeddingOnlyParts,
  WEDDING_ONLY_PARTS,
  type WeddingOnlyPart,
} from './wedding-only-parts';
import {
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  type EventTypeProfile,
} from './event-type-profile';
import { resolveSiteBodyPlan } from './site-body-plan';

const birthday: EventTypeProfile = {
  ...GENERIC_PROFILE,
  eventType: 'birthday',
  terminology: {
    ...GENERIC_PROFILE.terminology,
    organizerNoun: 'celebrant',
    eventWord: 'birthday',
    personA: null,
    personB: null,
  },
};

test('a wedding may show every wedding-only part', () => {
  const p = resolveWeddingOnlyParts(WEDDING_PROFILE);
  for (const part of WEDDING_ONLY_PARTS) {
    assert.equal(p[part], true, `a wedding lost its ${part}`);
  }
});

test('a birthday may show NONE of them', () => {
  const p = resolveWeddingOnlyParts(birthday);
  for (const part of WEDDING_ONLY_PARTS) {
    assert.equal(p[part], false, `a birthday is being handed ${part}`);
  }
});

test('the film and the monogram follow the profile SURFACES, which an admin owns', () => {
  // Not a hardcoded event-type string: an admin can change these without a
  // deploy, and the profile has carried the answer all along.
  const weddingWithoutStd: EventTypeProfile = {
    ...WEDDING_PROFILE,
    enabledSurfaces: WEDDING_PROFILE.enabledSurfaces.filter((s) => s !== 'save_the_date'),
  };
  assert.equal(resolveWeddingOnlyParts(weddingWithoutStd).save_the_date_film, false);
  // …and the other parts are untouched by that
  assert.equal(resolveWeddingOnlyParts(weddingWithoutStd).love_story, true);
});

test('the love story follows TWO NAMED PEOPLE, not the word "wedding"', () => {
  // 🔑 A hardcoded `eventType === 'wedding'` would be wrong the day a
  // vow-renewal type is added: not a wedding, wants every one of these.
  const vowRenewal: EventTypeProfile = {
    ...GENERIC_PROFILE,
    eventType: 'vow_renewal',
    terminology: { ...GENERIC_PROFILE.terminology, personA: 'partner', personB: 'partner' },
  };
  assert.equal(resolveWeddingOnlyParts(vowRenewal).love_story, true);
  assert.equal(resolveWeddingOnlyParts(vowRenewal).side_labels, true);
  // and it still has no film, because its surfaces say so
  assert.equal(resolveWeddingOnlyParts(vowRenewal).save_the_date_film, false);
});

test('a blank person name is not a person', () => {
  const blank: EventTypeProfile = {
    ...GENERIC_PROFILE,
    terminology: { ...GENERIC_PROFILE.terminology, personA: '  ', personB: 'groom' },
  };
  assert.equal(resolveWeddingOnlyParts(blank).love_story, false);
});

test('the part list is exhaustive — a new part cannot be added without a rule', () => {
  // PART_RULE is a Record over the union, so this is enforced by the compiler.
  // Pinning the count makes a silent addition visible in review as well.
  assert.equal(WEDDING_ONLY_PARTS.length, 4);
  const expected: WeddingOnlyPart[] = [
    'save_the_date_film',
    'monogram_letters',
    'love_story',
    'side_labels',
  ];
  assert.deepEqual([...WEDDING_ONLY_PARTS].sort(), [...expected].sort());
});

// ── the chokepoint ──────────────────────────────────────────────────────────

function plan(over: Record<string, unknown> = {}) {
  return resolveSiteBodyPlan({
    identity: 'anonymous',
    phasesEnabled: true,
    lifecyclePhase: 'save_the_date',
    stdFilm: true,
    isSample: false,
    hasHeroMedia: true,
    hasBgMusic: false,
    liveMediaPublic: true,
    widgets: [],
    ...over,
  } as Parameters<typeof resolveSiteBodyPlan>[0]);
}

test('a birthday far ahead does NOT get the wedding Save-the-Date film', () => {
  // 🔴 THE LIVE DEFECT. The body was chosen from the calendar alone.
  assert.equal(plan().body, 'save_the_date', 'a wedding still gets its film');
  assert.equal(
    plan({ weddingOnlyParts: resolveWeddingOnlyParts(birthday) }).body,
    'normal',
    'a birthday is still being handed the wedding film',
  );
});

test('the Story tab itself is gated — the one the owner actually SAW', () => {
  // 🪤 THE FIRST CUT OF THIS FILE DID NOT CATCH THIS. It tested the resolver and
  // the body-plan chokepoint, and ungating the Story tab in `site-body.tsx`
  // stayed GREEN — the exact defect the owner found by opening the page, left
  // unguarded by the tests written to close it. **Test the thing that was seen,
  // not only the machinery underneath it.**
  const body = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../app/[slug]/_components/site-body.tsx'),
    'utf8',
  );
  assert.match(
    body,
    /story:\s*\n?\s*weddingOnly\.love_story/,
    'the Story tab is no longer gated on the love story being allowed — a ' +
      'seven-year-old is being offered one again',
  );
  assert.match(
    body,
    /weddingOnlyParts: weddingOnly/,
    'the body plan is no longer told which wedding-only parts are allowed',
  );
});

test('absent gate ⇒ every part allowed ⇒ byte-identical to before', () => {
  // Every existing caller and golden test omits it; none of them may move.
  assert.equal(plan({ weddingOnlyParts: undefined }).body, 'save_the_date');
});
