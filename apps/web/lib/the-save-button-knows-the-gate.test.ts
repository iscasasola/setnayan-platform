/**
 * the-save-button-knows-the-gate.test.ts — the editor's Save button may not
 * offer a save the database will refuse.
 *
 * Owner, 2026-09-07, after hitting it in production: *"the exclusive perk is
 * blank. this means, we should not have the save changes be available for
 * save."*
 *
 * 🔑 THE MESSAGE EXISTED EVERYWHERE EXCEPT WHERE THE VENDOR WAS LOOKING. The
 * trigger `enforce_service_publish_gate` refuses with a sentence written for a
 * human; `PUBLISH_REFUSAL_MESSAGE` mirrors it; the WIZARD already coaches with
 * `PUBLISH_COACH_MESSAGE`. The editor — which renders the very field — imported
 * none of it, so the supplier got "there was an error" and a card that would
 * never save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { canPublishService } from '@/lib/service-publish-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(resolve(HERE, rel), 'utf8'));

// Since 2026-10-14 an existing card is edited in the SAME maker as a new one (the edit sheet,
// /vendor-dashboard/services/[serviceId]) — the inline editor and its `PublishGateSubmit` retired with it.
const MAKER = read('../app/vendor-dashboard/services/_components/canvas-maker.tsx');
const STATUS = read('./service-card-maker.ts');
const SNAPSHOT = read('./canvas-form-snapshot.ts');

test('the edit sheet’s Save waits on a LIVE card with no price — it would only fail at the trigger', () => {
  assert.match(
    MAKER,
    /const liveNeedsPrice = isEdit && liveOn && editing\?\.isActive === true && !snap\.hasPrice;/,
    'a live card can be saved priceless again',
  );
  assert.match(MAKER, /const saveBlocked = unread\.length > 0 \|\| liveNeedsPrice;/);
  assert.match(MAKER, /if \(saveBlocked\) \{\s*e\.preventDefault\(\);/, 'the form still submits while Save waits');
  assert.match(MAKER, /waiting=\{pending \|\| saveBlocked\}/, 'the Save button no longer shows that it waits');
});

test('a live card is FLAGGED for what it lacks, not hidden — the gate’s own rule for a live card', () => {
  assert.match(STATUS, /if \(opts\.live\) return \{ tone: 'warn', lead: 'Couples can see it · still missing:'/);
  assert.match(MAKER, /live: isEdit \? liveOn : undefined/, 'the status line is not told whether the card is live');
});

test('🔑 a DRAFT is never blocked — that is the trigger’s own first branch', () => {
  // enforce_service_publish_gate: IF NEW.is_active IS NOT TRUE THEN RETURN NEW.
  const rule = MAKER.slice(MAKER.indexOf('const liveNeedsPrice ='), MAKER.indexOf(';', MAKER.indexOf('const liveNeedsPrice =')));
  assert.match(rule, /liveOn/, 'the block no longer depends on the card being shown');
  assert.match(rule, /editing\?\.isActive === true/, 'the block no longer depends on is_active');
});

test('the predicate agrees with the trigger on every combination', () => {
  const cases = [
    { hasPrice: true, publishable: true },
    { hasPrice: false, publishable: false },
  ];
  for (const c of cases) {
    assert.equal(
      canPublishService({ hasPrice: c.hasPrice, hasCover: true, hasInclusions: true }),
      c.publishable,
      `price=${c.hasPrice}`,
    );
  }
});

test('a blank or non-numeric price box never reads as a set price', () => {
  // The form field is a string; `Number('')` is 0 and `Number('abc')` is NaN — the maker's snapshot asks the gate's
  // own `priceIsSet`, so neither can pass as "priced".
  assert.match(SNAPSHOT, /return priceIsSet\(n\) \? n : null;/, 'the maker stopped asking the gate whether a price is set');
});
