/**
 * details-adapts-to-the-event-type.test.ts — owner 2026-09-29 (DECISION_LOG
 * "THE PLAN ADAPTS TO EVERY EVENT TYPE — BUILT IN, NOT BOLTED ON"). Details'
 * items and switches are decided from the shipped event-type data, and part 1
 * types no wedding word into its items.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE } from './event-type-profile';
import { eventWordsFromProfile } from '../app/[slug]/_lib/event-words';
import { DETAILS_ITEM_KEYS, detailsNavigatorKeys, detailsSwitchesFor, type DetailsItemContext, type DetailsItemKey } from './maker-details-items';
import { stripComments } from './strip-comments';

const ctx = (profile: typeof WEDDING_PROFILE): DetailsItemContext => ({ profile, solemn: eventWordsFromProfile(profile).solemn });
const ALL = new Set<DetailsItemKey>(DETAILS_ITEM_KEYS);
const BIRTHDAY = { ...GENERIC_PROFILE, eventType: 'birthday' };

test('a birthday and a wake get every part-1 item — the theme, the address, the QR and every print', () => {
  // Part 2b's one rule: the Love Story is drawn only where the type has two
  // named people (`details-words-and-plans-fit-every-event.test.ts`); every
  // other item — part 1's included — reaches every celebration.
  for (const p of [BIRTHDAY, WAKE_PROFILE, WEDDING_PROFILE]) {
    const keys = detailsNavigatorKeys(ctx(p), ALL).flatMap((g) => g.keys);
    const expected = p === WEDDING_PROFILE ? [...DETAILS_ITEM_KEYS] : DETAILS_ITEM_KEYS.filter((k) => k !== 'love-story');
    assert.deepEqual(keys, expected, `${p.eventType} lost an item`);
  }
  assert.equal(ctx(WAKE_PROFILE).solemn, true, 'the wake fixture is not the solemn register');
});

test('"Parents on the invitation" exists only where the type offers a parent role', () => {
  assert.equal(detailsSwitchesFor(ctx(WEDDING_PROFILE)).parents, true);
  assert.equal(detailsSwitchesFor(ctx(BIRTHDAY)).parents, false, 'a birthday was offered the wedding parents');
  assert.equal(detailsSwitchesFor(ctx(WAKE_PROFILE)).parents, false, 'a wake was offered the wedding parents');
  // …and the page asks the rule, never a "wedding" test of its own.
  const details = stripComments(readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'launch', '_components', 'maker-details.tsx'), 'utf8'));
  assert.match(details, /\{switches\.parents \? \(/);
  assert.doesNotMatch(details, /=== 'wedding'|isWedding/);
});

test('part 1 types no wedding word into its own items', () => {
  const files = ['maker-details.tsx', 'maker-theme-picker.tsx', 'details-workspace.tsx', 'theme-preview-overlay.tsx', 'maker-prints.tsx'];
  for (const f of files) {
    const src = stripComments(readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'launch', '_components', f), 'utf8'));
    assert.doesNotMatch(src, /\b(wedding|couple|bride|groom)\b/i, `${f} types a wedding word`);
  }
});
