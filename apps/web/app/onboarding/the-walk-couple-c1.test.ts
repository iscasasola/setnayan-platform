/**
 * the-walk-couple-c1.test.ts — the couple walkthrough of 13 Nov 2026 (390 px), round C1: what each fix holds.
 *
 * SABOTAGE (each run once and reverted before commit):
 *   F-W2-12 — put the "bride + and + groom" slug back in the summary → RED.
 *   F-W2-03 — call `main.onClick()` without the hold in StepBar → RED; drop `stepKey={activeId}` → RED.
 *   F-W2-01 — drop `undated` from the Home schedule read → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { slugify } from '@/lib/slugs';
import { weddingEventName } from '@/lib/onboarding/wedding-cards';

const WEB = join(import.meta.dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('F-W2-12 · the summary gives the address step 2 promised and the commit mints', () => {
  const shell = code('app/onboarding/wedding/_components/onboarding-shell.tsx');
  assert.match(shell, /const coupleSlug = slugify\(weddingEventName\(state\)\)/);
  assert.doesNotMatch(shell, /\.join\('and'\)/, 'the made-up "brideandgroom" address is back');
  const cards = code('app/onboarding/wedding/_components/wedding-cards.tsx');
  assert.match(cards, /const address = slugify\(name\)/, 'step 2 no longer shows slugify(event name)');
  // The commit: generateUniqueSlug(displayName) → slugify(displayName) for a free address.
  assert.match(code('app/onboarding/wedding/actions.ts'), /generateUniqueSlug\(admin, displayName\)/);
  assert.equal(slugify(weddingEventName({ eventName: null, brideFirstName: 'Wanda', groomFirstName: 'Indigo' })), 'wanda-indigo');
});

test('F-W2-03 · the step bar takes one press per step', () => {
  const bar = code('app/onboarding/_shared/step-bar.tsx');
  assert.match(bar, /if \(held\.current\) \{\s*e\.preventDefault\(\);\s*return;\s*\}/, 'a second press is not ignored');
  assert.match(bar, /held\.current = true;[\s\S]{0,200}main\.onClick\(\);/, 'the hold is not taken before the press runs');
  assert.match(bar, /data-busy=\{pressed/, 'the press is not drawn');
  assert.match(bar, /useEffect\(\(\) => \{\s*release\(\);\s*\}, \[stepKey\]\)/, 'a new step does not release the hold');
  assert.match(code('app/onboarding/wedding/_components/onboarding-shell.tsx'), /stepKey=\{activeId\}/);
  assert.match(code('app/onboarding/[type]/_components/generic-onboarding.tsx'), /stepKey=\{step\}/);
  assert.match(code('app/onboarding/simple/_components/simple-setup-flow.tsx'), /stepKey=\{step\}/);
});

test('F-W2-01 · Home’s schedule says no invented day for an event with no date', () => {
  assert.match(code('app/dashboard/[eventId]/page.tsx'), /undated: !\(event as \{ event_date\?: string \| null \}\)\.event_date/);
  assert.match(code('lib/home-schedule.server.ts'), /undated: opts\.undated/);
});
