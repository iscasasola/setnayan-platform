/**
 * the-lab-never-ships.test.ts — /dev/onboarding-lab 404s in production, draws the REAL flow, and sends nothing to
 * the server (the pattern is `app/dev/guests-lab/the-lab-never-ships.test.ts`).
 *
 *   1. The production check is the FIRST thing the page does.
 *   2. What it draws is the shipped `OnboardingShell` — its own `.onbw` wrapper and its own stylesheets. The lab
 *      carries no copy of the markup and no stylesheet of its own, so a spacing fault seen here is the product's.
 *   3. The shell is drawn INSIDE `LabNoActions`, and `LabNoActions` refuses a request that carries a server action
 *      (the shell's last button is the real commit — it creates a real event for whoever is signed in).
 *
 * NOT CLAIMED: that a refused action leaves every screen in a tidy state — a rejected venue search surfaces as an
 * unhandled rejection in the console (seen in Chromium); nothing is written anywhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { carriesAnAction } from './lab-no-actions';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const LAB = read('page.tsx');

test('the onboarding lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function OnboardingLabPage('));
  assert.ok(page.length > 0 && LAB.includes('export default async function OnboardingLabPage('), 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, 'the production 404 is not the first statement — the lab can render on the live site');
});

test('the lab draws the shipped shell — no copy of its markup, no stylesheet of its own', () => {
  assert.match(LAB, /import \{ OnboardingShell \} from '@\/app\/onboarding\/wedding\/_components\/onboarding-shell';/, 'the lab no longer mounts the real OnboardingShell');
  const files = readdirSync(HERE).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
  assert.ok(files.length >= 2, 'the lab’s files could not be listed');
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /\.css['"]/, `${f} imports a stylesheet — the lab must show the product’s own`);
    assert.doesNotMatch(src, /className=["'`{][^>]*\bonbw\b/, `${f} draws its own .onbw wrapper — a copy, not the shell’s`);
    assert.doesNotMatch(src, /data-setup-card|SetupFrame|WeddingCard\b/, `${f} draws a card itself instead of letting the shell draw it`);
  }
});

test('the shell is drawn inside LabNoActions, which refuses a server action', () => {
  assert.match(LAB, /<LabNoActions>\s*<OnboardingShell[\s\S]*?\/>\s*<\/LabNoActions>/, 'the shell is not drawn inside <LabNoActions>');
  assert.equal((LAB.match(/<OnboardingShell\b/g) ?? []).length, 1, 'a second shell is drawn outside the guard');
  const guard = read('lab-no-actions.tsx');
  assert.match(guard, /window\.fetch = \(input, init\) =>\s*carriesAnAction\(input, init\)\s*\? Promise\.reject\(/, 'LabNoActions no longer refuses before sending');
  assert.match(guard, /return \(\) => \{\s*window\.fetch = real;/, 'leaving the lab does not put the browser’s fetch back');
  // The test itself: every way a caller can attach the header.
  assert.equal(carriesAnAction('/dev/onboarding-lab', { method: 'POST', headers: { 'Next-Action': 'abc' } }), true);
  assert.equal(carriesAnAction('/dev/onboarding-lab', { method: 'POST', headers: [['next-action', 'abc']] }), true);
  assert.equal(carriesAnAction('/dev/onboarding-lab', { method: 'POST', headers: new Headers({ 'next-action': 'abc' }) }), true);
  assert.equal(carriesAnAction(new Request('http://localhost/dev/onboarding-lab', { method: 'POST', headers: { 'next-action': 'abc' } })), true);
  assert.equal(carriesAnAction('/dev/onboarding-lab?_rsc=1', { headers: { RSC: '1' } }), false, 'an ordinary page request is refused');
  assert.equal(carriesAnAction('/api/health'), false);
});
