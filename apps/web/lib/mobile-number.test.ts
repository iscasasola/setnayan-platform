/**
 * A YES NEEDS A MOBILE NUMBER OF AT LEAST SEVEN DIGITS — IN THE BROWSER AND ON THE SERVER.
 *
 * A guest's walk, 2026-10-11 (fault N18): the reply card marks Mobile "(required)" for a yes, and "abc" went
 * through — both halves only asked whether the box was empty. Owner the same day: at least 7 digits (counted after
 * spaces, dashes, + and brackets are taken away); a no does not need one.
 *
 * WHAT IS HELD:
 *   (1) THE RULE, RUN — what counts and what does not.
 *   (2) THE SERVER refuses a yes without it — and ONLY a yes, on an open list, when the couple asks for a mobile —
 *       and sends the guest back with the sentence, before anything is written.
 *   (3) THE BROWSER does not send it either: the form's own handler stops the press on the same rule, reads the one
 *       fact the card already states (the box is `required`), and says the same sentence.
 *   (4) ONE SENTENCE — the words are the pages' own for a yes with no number.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): `mobileIsEnough` made to accept any
 * non-empty text → (1) red; the server's check put back to `!contactMobile` → (2) red; the handler's check removed
 * from `reply-form.tsx` → (3) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MOBILE_MIN_DIGITS, MOBILE_NEEDED, mobileDigits, mobileIsEnough } from './mobile-number';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) seven digits, counted after what people type around a number is taken away', () => {
  assert.equal(MOBILE_MIN_DIGITS, 7);
  for (const ok of ['+63 917 123 4567', '(0917) 123-4567', '09171234567', '8123 4567', '812-3456', '8 1 2 3 4 5 6', '+63.917.123.4567', '[02] 8123 4567']) {
    assert.equal(mobileIsEnough(ok), true, `${JSON.stringify(ok)} is turned away`);
  }
  for (const no of ['abc', '', '   ', null, undefined, '123456', '+63', '(0917)', 'call me', '12-34-56', 'n/a']) {
    assert.equal(mobileIsEnough(no), false, `${JSON.stringify(no)} is accepted as a mobile number`);
  }
  assert.equal(mobileDigits('+63 (917) 123-4567'), 12);
  assert.equal(mobileDigits('abc'), 0);
  // The edge itself.
  assert.equal(mobileIsEnough('123456'), false);
  assert.equal(mobileIsEnough('1234567'), true);
});

test('(2) the server refuses a yes without it — only a yes, only on an open list, only when the couple asks — before any write', () => {
  const actions = code('app/[slug]/actions.ts');
  const top = actions.indexOf('export async function submitRsvp(');
  assert.ok(top > 0);
  const body = actions.slice(top);
  const at = body.indexOf("if (!replyLocked && status === 'attending' && ask.mobile && !mobileIsEnough(contactMobile)) {");
  assert.ok(at > 0, 'submitRsvp accepts a yes with fewer than seven digits (or asks one of a no, or of a closed list)');
  const refusal = body.slice(at, at + 420);
  assert.equal((refusal.match(/\?rsvp=mobile/g) ?? []).length, 2, 'the refusal does not come back to BOTH pages that send the form');
  assert.match(refusal, /redirect\(/);
  // Nothing is written before it: the first write to the guest's row comes after.
  const firstWrite = body.search(/\.from\('guests'\)\s*\.update\(/);
  assert.ok(firstWrite > at, 'the reply is written before the number is checked');
  // The number checked is the one the form posted.
  assert.match(body, /const contactMobile = clean\(formData\.get\('contact_mobile'\)\) \|\| null;/);
});

test('(3) the browser does not send it either: the form stops the press on the same rule and says why', () => {
  const form = code('app/[slug]/_components/reply-form.tsx');
  const handler = form.slice(form.indexOf('function onSubmit('), form.indexOf('return (', form.indexOf('function onSubmit(')));
  const check = handler.indexOf('if (mobile && mobile.required && !mobileIsEnough(mobile.value)) {');
  assert.ok(check > 0, 'the form sends a yes without asking the rule');
  assert.match(handler, /e\.currentTarget\.querySelector<HTMLInputElement>\('input\[name="contact_mobile"\]:not\(\[type="hidden"\]\)'\)/, 'the box read is not the one the guest types in');
  // It stops BEFORE the send is started, and before the form is marked as pressed (so the next press works).
  assert.ok(check < handler.indexOf('pressed.current = true;'), 'a refused press leaves the form unable to send again');
  assert.ok(check < handler.indexOf('.press('), 'the reply is sent before the number is checked');
  assert.match(handler.slice(check, check + 220), /setMobileNeeded\(true\);[\s\S]*?return;/);
  assert.match(form, /\{MOBILE_NEEDED\}/, 'the refusal is not said');
  // The card marks the box required for a yes only (the fact the handler reads) — and never on a closed list.
  const widget = code('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(widget, /m\.required=!!\(r&&r\.checked\)/, 'the box is no longer required exactly when the answer is yes');
  assert.match(widget, /const mobileRequiredOnYes = askMobile && !replyLocked && !previewEveryQuestion;/);
});

test('(4) one sentence: the form says what the pages say for the same refusal', () => {
  for (const rel of ['app/[slug]/page.tsx', 'app/[slug]/invite/reply/page.tsx']) {
    assert.ok(code(rel).includes(`text: '${MOBILE_NEEDED}'`), `${rel} says something else for a yes with no number`);
  }
});
