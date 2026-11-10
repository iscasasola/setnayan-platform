/**
 * ✍ THE WEDDING IS NAMED IN ONBOARDING — prefilled from the names, editable, and what is shown is what is saved.
 *
 * Owner, 10 Nov (Build 5 Lane P, Step 0 row 37), verbatim: *"Also we want the event name to be set on the
 * onboarding. And the other required parts so when they login, and enter."* Before this, `wedding/actions.ts`
 * derived `display_name = joinCoupleNames(brideFirst, groomFirst) || 'Our Wedding'` and the couple never saw
 * it until Event Details (the dashboard's "Event Hub address · Not set yet" row then asked).
 *
 * Approved prototype `onboarding_every_step_2026-11-10` § B, "2 of 10 · Name your wedding". Same column
 * (`events.display_name`), nothing new in the schema; the slug is seeded from it as before.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  WEDDING_FLOW_ORDER,
  weddingEventName,
  weddingEventNameReady,
} from '@/lib/onboarding/wedding-cards';

const web = process.cwd();
const read = (p: string) => readFileSync(join(web, p), 'utf8');
const names = { brideFirstName: 'Claire', groomFirstName: 'Indalecio' };

test('"Name your wedding" comes right after the names it is written from', () => {
  const order = WEDDING_FLOW_ORDER as readonly string[];
  assert.equal(order.indexOf('w_eventname'), order.indexOf('w_names') + 1);
});

test('it follows the names until typed, then it is theirs — even emptied', () => {
  assert.equal(weddingEventName({ ...names, eventName: null }), 'Claire & Indalecio', 'the first person first');
  assert.equal(weddingEventName({ ...names, eventName: 'The Casasola Wedding' }), 'The Casasola Wedding');
  assert.equal(weddingEventName({ ...names, eventName: '' }), '', 'an emptied name is not refilled under their fingers');
  assert.equal(weddingEventNameReady({ ...names, eventName: null }), true, 'prefilled, so it starts ready');
  assert.equal(weddingEventNameReady({ ...names, eventName: '   ' }), false, 'Continue waits for a real name');
});

test('the shell gates the step and sends exactly the name the step showed', () => {
  const shell = read('app/onboarding/wedding/_components/onboarding-shell.tsx');
  assert.match(shell, /case 'w_eventname':[\s\S]{0,160}return weddingEventNameReady\(state\);/);
  assert.match(shell, /eventName: weddingEventName\(s\),/);
});

test('the commit writes it to display_name through the page name’s cleaner, the names as the fallback', () => {
  const action = read('app/onboarding/wedding/actions.ts');
  assert.match(action, /const namedInOnboarding = cleanDisplayName\(payload\.eventName\);/);
  assert.match(action, /const displayName = namedInOnboarding \|\| joinCoupleNames\(brideFirst, groomFirst\) \|\| 'Our Wedding';/);
  assert.match(action, /const slug = await generateUniqueSlug\(admin, displayName\);/, 'the address is seeded from the name');
});

test('the step draws the name in the one Field template (TypedRow boxed), with its Event Hub address under it', () => {
  const cards = read('app/onboarding/wedding/_components/wedding-cards.tsx');
  const at = cards.indexOf("if (card === 'w_eventname') {");
  const step = cards.slice(at, cards.indexOf("if (card === 'w_kind') {", at));
  assert.match(step, /title="Name your wedding"/);
  assert.match(step, /<TypedRow\s+boxed\s+name="Event name"\s+value=\{name\}/);
  assert.doesNotMatch(step, /<input\b|<StepInput\b/, 'no second input');
  assert.match(step, /setnayan\.com\/\{address\}/);
});
