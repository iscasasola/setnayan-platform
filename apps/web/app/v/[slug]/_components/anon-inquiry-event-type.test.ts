/**
 * Guard: a visitor who inquires from a vendor's public page WITHOUT an account
 * is asked what kind of event they are planning — and is never silently routed
 * into a WEDDING.
 *
 * Why this test exists: this screen hard-coded `/onboarding/wedding` for every
 * visitor. Someone asking a caterer about their mother's 60th birthday was
 * marched into planning a wedding, and nothing anywhere failed — the flow
 * completed, the vendor got the inquiry, the event was simply the wrong kind.
 * A silent wrong answer has no natural detector, so it gets one here.
 *
 * Owner ruling 2026-08-06, verbatim shape: "logged in? if yes proceed. if no,
 * create account · for what type of event? then onboarding."
 *
 * Two of the three assertions are STATIC source scans (the established pattern
 * in this repo for a client component with no DB): the third is a real unit
 * test of the destination rule, which is pure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Strip comments so assertions test CODE, not the prose describing the fix. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
}

const composer = stripComments(readFileSync(join(HERE, 'anon-inquiry-composer.tsx'), 'utf8'));
const page = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));

test('the composer asks what kind of event', () => {
  assert.match(
    composer,
    /What kind of event/,
    'the event-type question disappeared from the anon inquiry composer',
  );
  assert.match(
    composer,
    /eventTypes/,
    'the composer no longer takes the event-type roster',
  );
});

test('the offered event types come from the live vocab, never a hard-coded list', () => {
  // 13 Nov 2026 ("Yes, only one"): the page no longer mounts this composer, so it no longer reads the roster for it —
  // a read that feeds nothing on the page is exactly the dead fetch this PR removed.
  assert.doesNotMatch(page, /getCreatableEventTypes\(\)/, 'the page reads the event-type roster for a composer it no longer mounts');
  // A literal roster in the composer is the exact failure this guards against.
  assert.doesNotMatch(
    composer,
    /['"]birthday['"]\s*[,:]|['"]debut['"]\s*[,:]/,
    'the composer appears to hard-code event types — feed them from the vocab instead',
  );
});

test('an unanswered event type is refused, not defaulted to a wedding', () => {
  // The empty-string initial state plus the membership check is what stops a
  // blank answer becoming `wedding`. Both halves must survive together: with
  // either one gone, an untouched dropdown silently books a wedding.
  // Must name the event-type state specifically. A bare /useState\(''\)/ also
  // matches the email and message fields, so it stayed green while the
  // event-type default was changed to eventTypes[0] — a guard that could not
  // fire on the very bug it was written for.
  assert.match(
    composer,
    /const\s*\[\s*eventTypeKey\s*,\s*setEventTypeKey\s*\]\s*=\s*useState\(\s*''\s*\)/,
    'the event-type field must start EMPTY — a pre-selected first option means a visitor ' +
      'who never touched it gets whatever happened to sort first',
  );
  assert.match(
    composer,
    /Please choose what kind of event this is/,
    'nothing refuses an unanswered event type any more',
  );
});

test('a non-wedding type routes through the picker, which owns the real rule', () => {
  // Re-deriving the onboarding path here would be a second copy of a
  // three-branch rule whose third branch is not a URL at all. The picker
  // auto-advances on its `preselect` prop, so handing it the key is enough.
  assert.match(
    composer,
    /\/dashboard\/create-event\?event_type=/,
    'non-wedding types must hand off to the create-event picker (it resolves the correct ' +
      'onboarding, including the inline fallback when the generic flow is switched off)',
  );
  assert.match(
    composer,
    /encodeURIComponent\(eventTypeKey\)/,
    'the event type must be URL-encoded into the destination',
  );
});

// 13 Nov 2026 (owner, "Yes, only one"): the shop page no longer mounts the inline composer — its one Inquire opens the
// pop-up, which signs a stranger in first and then offers their events or a new one. The composer keeps its question
// (tests above) for wherever it is mounted; the page must not mount it as a second, inline Inquire.
test('the shop page no longer mounts the inline composer (one Inquire, the pop-up)', () => {
  assert.doesNotMatch(page, /<AnonInquiryComposer\b/, 'a second, inline Inquire form came back on the shop page');
});
