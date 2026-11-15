/**
 * 🧾 OWN-03 (W1 re-walk, live 5cbf166 · 14 Nov), on testnayan2's "TEST own-link 14 Nov":
 *   · "They added this to their plan" sat beside services the couple never picked — "their plan" counted the shop's OWN
 *     row, which the inquiry itself wrote under the first pick's category;
 *   · the Celebrant read "Someone —" — the stand-in was SAVED as the celebrant (a birthday "for you" took the account's
 *     display name, which was the stand-in) and read back as a name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { alsoOfferFrom, eventCelebrantWords } from './supplier-event-lines';
import { stripComments } from './strip-comments';

const code = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

test('"their plan" is the couple’s rows — never this shop’s own', () => {
  const server = code('lib/supplier-event-lines.server.ts');
  assert.match(
    server,
    /const eventCategories = \(planOf\.get\(eventId\) \?\? \[\]\)\s*\.filter\(\(r\) => r\.marketplace_vendor_id !== me\)/,
    'the shop’s own plan row counts as the couple’s plan again',
  );
  // With only the shop's own row's category, nothing is offered as "they added this".
  const offers = alsoOfferFrom({
    stage: 'asking',
    services: [{ id: 'svc-2', name: 'Uplighting add-on', category: 'lights_and_sound', fromPhp: 8000 }],
    requestedIds: new Set(['svc-1']),
    eventCategories: [],
  });
  assert.deepEqual(offers, []);
});

test('a stand-in is never a celebrant', () => {
  assert.equal(eventCelebrantWords({ honorees: [], signatureDetails: { celebrant_name: 'Someone —' }, honoreeLabel: null }), null);
  assert.equal(eventCelebrantWords({ honorees: [], signatureDetails: { celebrant_name: 'Someone —' }, honoreeLabel: 'Ana' }), 'Ana');
  assert.equal(eventCelebrantWords({ honorees: [], signatureDetails: { celebrant_name: 'Ana Reyes' }, honoreeLabel: null }), 'Ana Reyes');
  // …and the onboarding no longer saves it: the account's own name passes the same rule.
  assert.match(code('lib/self-personalization.ts'), /displayName: typeof data\.display_name === 'string' \? realNameOrNull\(data\.display_name\.trim\(\)\) : null,/);
});
