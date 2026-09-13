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
import {
  PUBLISH_COACH_MESSAGE,
  canPublishService,
  unmetPublishRequirements,
} from '@/lib/service-publish-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(resolve(HERE, rel), 'utf8'));

const EDITOR = read('../app/vendor-dashboard/services/_components/services-manager.tsx');
const GATE = read('../app/vendor-dashboard/services/_components/publish-gate-submit.tsx');

test('the editor’s Save routes through the gate, not a bare SubmitButton', () => {
  assert.match(EDITOR, /<PublishGateSubmit/, 'the Save button no longer consults the gate');
  assert.ok(
    !/<SubmitButton[^>]*>\s*\n?\s*Save changes/.test(EDITOR),
    'a bare SubmitButton is offering "Save changes" again — it can only fail on a live card',
  );
});

test('the gate button reuses the shared module — copy cannot drift from the trigger', () => {
  assert.match(GATE, /from '@\/lib\/service-publish-gate'/, 'it forked the requirement list');
  // A LIVE card is held to its price only (`unmetForALiveCard`) and FLAGGED for
  // the cover and what's included (`liveCardHealthFlags`) — H2, 2026-09-11.
  assert.match(GATE, /setUnmet\(unmetForALiveCard\(facts\)\)/, 'it stopped asking what is missing');
  assert.match(GATE, /setFlags\(liveCardHealthFlags\(facts\)\)/, 'a live card stopped being flagged');
  assert.match(GATE, /PUBLISH_COACH_MESSAGE\[/, 'it hand-wrote its own copy');
});

test('🔑 a DRAFT is never blocked — that is the trigger’s own first branch', () => {
  // enforce_service_publish_gate: IF NEW.is_active IS NOT TRUE THEN RETURN NEW.
  assert.match(GATE, /isActive && unmet\.length > 0/, 'the block no longer depends on is_active');
  assert.match(EDITOR, /isActive=\{svc\.is_active\}/, 'the button is not told whether the row is live');
});

test('the predicate agrees with the trigger on every combination', () => {
  // ⚖ The Setnayan gift left the gate on 2026-09-09 (owner: it is optional), so
  // the only combination left is the price — and the trigger agrees, because
  // migration 20271215941485 removed the same check from the same function in
  // the same change. See `the-setnayan-gift-is-optional.test.ts`, which derives
  // that agreement from the SQL rather than restating it.
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
  assert.deepEqual(
    unmetPublishRequirements({ hasPrice: false, hasCover: true, hasInclusions: true }),
    ['price'],
  );
  assert.match(PUBLISH_COACH_MESSAGE.price, /required to publish/i);
});

test('a blank or non-numeric price box never reads as a set price', () => {
  // The form field is a string. `Number('')` is 0 and `Number('abc')` is NaN —
  // either one silently passing as "priced" would re-open the exact hole.
  assert.match(GATE, /Number\.isFinite/, 'NaN could pass as a price');
  assert.match(GATE, /trim\(\) === ''/, 'an empty box could pass as a price');
});
