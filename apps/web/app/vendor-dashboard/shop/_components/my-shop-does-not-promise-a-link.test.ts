import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * SUP-30 · MY SHOP MAY NOT PROMISE A DOOR THE PRODUCT REFUSES TO OPEN.
 *
 * `lib/no-door-out-of-the-app.test.ts` already stops a website HREF reaching a
 * couple-facing surface. It cannot stop My Shop from TELLING a shop that couples
 * see its website — which is what the public-line card did, four days after the
 * owner ruled otherwise (2026-09-11, "SEVEN SUPPLIER-SIDE QUESTIONS" Q3:
 * "Never show links"). A promise and a link are different failures and need
 * different guards: one ships a door, the other ships a lie about one.
 *
 * Asserted against the VISIBLE copy only — comments are stripped, so the
 * docblock above the sentence (which necessarily quotes the old wording) cannot
 * satisfy or trip these.
 */

const CARD = join(
  process.cwd(),
  'app/vendor-dashboard/shop/_components/public-line-card.tsx',
);

function visibleCopy(): string {
  const raw = readFileSync(CARD, 'utf8');
  const stripped = stripComments(raw);
  assert.ok(
    stripped.length > raw.length * 0.15,
    `stripping removed too much (${raw.length} -> ${stripped.length})`,
  );
  return stripped;
}

test('the public-line blurb no longer files the website under what couples read', () => {
  const src = visibleCopy();
  const blurb =
    src.match(/The one line couples read[^<]*/)?.[0].replace(/\s+/g, ' ').trim() ?? '';
  assert.ok(blurb, 'the public-line blurb is gone — re-aim this guard');
  assert.doesNotMatch(
    blurb,
    /website/i,
    `the blurb puts the website inside what couples read again: "${blurb}"`,
  );
});

test('the website field says plainly that couples do not see it', () => {
  // The shop should learn where the value goes, not just that it is optional —
  // the same courtesy /v/[slug] already extends when it tells a shop previewing
  // itself why its email and phone are absent.
  const src = visibleCopy();
  assert.match(
    src,
    /Couples don.{0,8}t see this/i,
    'the website field no longer tells the shop that couples do not see it',
  );
});

test('My Shop never claims a link of the shop\u2019s own reaches couples', () => {
  /*
    ⚠ THIS KEYED ON THE WORD "website" AND A MUTATION WALKED PAST IT. Rewording
    the field's helper to "Your own site — couples find it on your shop page"
    made the same false promise without the word, so the filter skipped the
    sentence and the guard passed 3 of 3.

    The set of NOUNS for the thing is unbounded too — website, site, link, page,
    URL — so key on the PROMISE: couples + a verb of seeing + anything that is a
    door out. The one sentence legitimately pairing couples with a verb of
    seeing is the tagline blurb, which names no door, so it passes without an
    exception carved for it.
  */
  const src = visibleCopy();
  const sentences = src
    .split(/[.<>]/)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    if (!/\bcouples\b/i.test(sentence)) continue;
    if (!/\b(read|see|sees|find|finds|get|gets|visit|visits)\b/i.test(sentence)) continue;
    assert.doesNotMatch(
      sentence,
      /\b(website|site|link|url)\b/i,
      `My Shop promises couples reach a door out of the app: "${sentence}"`,
    );
  }
});
