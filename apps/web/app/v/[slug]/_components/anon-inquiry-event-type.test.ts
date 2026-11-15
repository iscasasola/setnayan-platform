/**
 * Guard: a visitor who inquires from a vendor's public page and has no event yet
 * is asked what kind of event they are planning — and is never silently routed
 * into a WEDDING.
 *
 * Why this test exists: this screen once hard-coded `/onboarding/wedding` for every
 * visitor. Someone asking a caterer about their mother's 60th birthday was
 * marched into planning a wedding, and nothing anywhere failed — the flow
 * completed, the vendor got the inquiry, the event was simply the wrong kind.
 * A silent wrong answer has no natural detector, so it gets one here.
 *
 * Owner ruling 2026-08-06, verbatim shape: "logged in? if yes proceed. if no,
 * create account · for what type of event? then onboarding."
 *
 * 13 Nov 2026 (owner, "Yes, only one"): the inline compose-first `AnonInquiryComposer` was RETIRED with the shop
 * page's second Inquire; its file is deleted. The shop's ONE Inquire is the pop-up (`inquire-sheet.tsx`), which signs
 * a stranger in first (the shipped sign-in sheet) and then offers their events or "Start a new event". That button
 * hands off to the create-event PICKER — which is where "what kind of event?" is now asked, from the live vocab — so
 * the guard follows the behaviour there. The composer-local claims (its own event-type dropdown starting empty, its
 * own refusal line) were retired with the composer: there is no second event-type field left to default.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

const sheet = stripComments(readFileSync(join(HERE, 'inquire-sheet.tsx'), 'utf8'));
const page = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));

test('a new event from the Inquire pop-up goes to the create-event picker, which asks the kind', () => {
  assert.match(
    sheet,
    /\/dashboard\/create-event\?next=\$\{encodeURIComponent\(/,
    '"Start a new event" must hand off to the create-event picker (it asks what kind of event and resolves the ' +
      'correct onboarding), carrying this shop back in `next`',
  );
});

test('nothing on the Inquire path hard-codes a wedding', () => {
  assert.doesNotMatch(sheet, /\/onboarding\/wedding/, 'the Inquire pop-up hard-codes the wedding onboarding');
  assert.doesNotMatch(
    sheet,
    /['"]birthday['"]\s*[,:]|['"]debut['"]\s*[,:]/,
    'the Inquire pop-up appears to hard-code event types — the picker owns them, from the vocab',
  );
});

test('the page no longer reads the event-type roster for a composer it no longer mounts', () => {
  assert.doesNotMatch(page, /getCreatableEventTypes\(\)/, 'a dead read of the event-type roster came back on the shop page');
});

test('the shop page no longer mounts the inline composer (one Inquire, the pop-up)', () => {
  assert.doesNotMatch(page, /<AnonInquiryComposer\b/, 'a second, inline Inquire form came back on the shop page');
  assert.equal(existsSync(join(HERE, 'anon-inquiry-composer.tsx')), false, 'the retired inline composer file came back');
});
