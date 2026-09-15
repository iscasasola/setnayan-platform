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

test('My Shop never claims the website appears on the shop page', () => {
  // The unbounded set is "ways to phrase the promise", so this checks the two
  // spellings that actually shipped and would ship again from the same instinct:
  // "couples … website" in one sentence, or "shown/shows … website".
  const src = visibleCopy();
  const sentences = src.split(/[.<>]/).map((t) => t.replace(/\s+/g, ' ').trim());
  for (const sentence of sentences) {
    if (!/website/i.test(sentence)) continue;
    assert.doesNotMatch(
      sentence,
      /couples\s+(read|see|find|get)\b/i,
      `My Shop tells the shop couples see its website: "${sentence}"`,
    );
  }
});
