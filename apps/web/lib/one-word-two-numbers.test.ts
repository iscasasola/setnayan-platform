import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * one-word-two-numbers.test.ts
 *
 * 🚨 HOME AND THE EVENT PAGE REPORTED DIFFERENT "% planned" FIGURES for the
 * same wedding. Neither was broken. They are two different measures wearing one
 * word: the account home reports the event CHECKLIST's real done/total, the
 * event focal reports the LOCKED SHARE OF VENDOR CATEGORIES.
 *
 * The fix is the caption, not the arithmetic — and the honest caption already
 * shipped twice for this exact value, so no third phrase was invented.
 *
 * ⛔ NOT "compute it once and show it everywhere". That decides which measure is
 * the real answer to "how planned is this wedding", which is a product ruling.
 *
 * 🛡 Mutation-checked by occurrence count.
 */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const FOCAL = 'app/dashboard/[eventId]/_components/event-dashboard.tsx';
const HOME = 'app/dashboard/(launcher)/page.tsx';

test('the focal names what it counts — the locked share, not "planned"', () => {
  const focal = code(FOCAL);
  assert.match(focal, /\{Math\.round\(lockedInPct\)\}%[\s\S]{0,80}locked in/);
  assert.ok(
    !/planned/.test(focal),
    'the word that made two different numbers look like one measure',
  );
});

test('and it reuses the wording the product already has for this value', () => {
  // Inventing a third phrase for a number named twice already is how a product
  // ends up with three vocabularies for one fact.
  assert.match(code('lib/setnayan-ai-activity.ts'), /% locked in/);
  assert.match(
    code('app/dashboard/[eventId]/studio/setnayan-ai/_components/setnayan-ai-value.tsx'),
    /% locked in/,
  );
});

test('home still reports its CHECKLIST share — the measure is pinned, not the wording', () => {
  /*
    🚨 THIS ASSERTION USED TO PIN THE LITERAL `${pct}% planned`, AND THAT MADE IT
    A GUARD AGAINST A FIX.

    Its job is to stop home quietly ADOPTING THE VENDOR-LOCK MEASURE — the whole
    point of this file is that two different numbers were wearing one word. That
    job says nothing about how home CAPTIONS its own figure.

    The board then had to remove that exact caption for an unrelated and correct
    reason (D-6: the ring already prints the number, so "7%" sat beside "7%
    planned"), and this assertion failed a change it has no opinion about — the
    one thing a guard must never do.

    🔑 PIN THE MEASURE, NOT THE WORDING. `pct` is home's checklist done/total and
    is what must keep feeding the card; the sibling test below already holds the
    other half (home must not read `briefing.lockedPct`). Between them the
    original harm is fully covered, and a caption may change without asking this
    file's permission.
  */
  const home = code(HOME);
  assert.match(
    home,
    /const \[checklistByEvent|progressByEvent|pct/,
    'home must still derive its own checklist figure',
  );
  assert.match(
    home,
    /pct: Math\.round\(\(done \/ items\.length\) \* 100\)/,
    'and it must still be the CHECKLIST done/total — the measure, not the caption',
  );
});

test('the two still read DIFFERENT sources, and that is the point', () => {
  // If one ever starts reading the other, the caption split becomes a lie in the
  // opposite direction.
  assert.match(code(FOCAL), /cockpitModel\.briefing\.lockedPct/);
  assert.ok(
    !/briefing\.lockedPct/.test(code(HOME)),
    'home must not adopt the vendor-lock measure without an owner ruling',
  );
});
