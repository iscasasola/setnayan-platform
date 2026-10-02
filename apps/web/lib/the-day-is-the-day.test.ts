/**
 * ⚖ Owner tracker d25 (2026-10-02, first-timer test fix list): **"The Day"
 * everywhere** — the stage after the Invitation is named "The Day"; "On the Day"
 * retires (lib/public-site-stage-labels.ts, the owner ribbon, the Maker, the tours).
 *
 * 🔑 THE PROPERTY: the exact spelling "On the Day", and a label that is nothing but
 * "On the day", never reach a screen. The plain-English phrase inside a sentence
 * ("captured on the day", "Guests see their table on the day") is ordinary English,
 * not the stage's name, and stays — which is why this guard reads exact spelling and
 * whole-label shape instead of the phrase.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { RetiredName } from './retired-names-scan';
import { allowlistProblems, scanSource, scanTree, type WordAllow } from './retired-word-guard';
import { PUBLIC_STAGE_LABELS } from './public-site-stage-labels';

const NAMES: readonly RetiredName[] = [
  { was: 'On the Day', now: 'The Day', pattern: 'On the Day', caseSensitive: true },
  { was: 'On the day', now: 'The Day', pattern: '^\\s*on the day\\s*[·:]?\\s*$' },
];

const ALLOW: readonly WordAllow[] = [
  { prefix: 'app/[slug]/_components/editorial/compose.ts', why: 'a sentence opener when the date is unknown ("On the day, …") — English, not the stage name' },
  { prefix: 'app/[slug]/hub/page.tsx', text: /^On the day$/, why: 'the guest’s seat placeholder: the seat shows "on the day" — a time, not the stage' },
  { prefix: 'app/onboarding/[type]/_components/generic-onboarding.tsx', why: 'a date choice — "On the day · Sat 5 Oct" is the celebration day itself, not the stage' },
  { prefix: 'lib/face-tagging-wish.ts', why: 'a sentence fragment (" on the day") inside the face-tagging hint' },
  { prefix: 'app/dev/', why: 'internal lab pages — a toggle named for the day, never shown to a couple or supplier' },
];

test('the stage is called "The Day"', () => {
  assert.equal(PUBLIC_STAGE_LABELS.event, 'The Day');
});

test('the scanner flags the old stage name where a person reads it', () => {
  const visible = [
    ['a.tsx', `export const A = () => <h2>On the Day</h2>;`],
    ['b.ts', `export const t = { event: 'On the Day' };`],
    ['c.ts', `export const t = 'Save the Date · Invitation · On the Day · Post Event';`],
    ['d.ts', `export const t = { label: 'On the day' };`],
    ['e.tsx', `export const E = () => <p className="eyebrow">On the day</p>;`],
  ] as const;
  for (const [f, s] of visible) assert.ok(scanSource(f, s, NAMES).length >= 1, `missed a visible word in: ${s}`);
});

test('the scanner leaves plain English, identifiers and comments alone', () => {
  const code = [
    `export const t = 'Guests see their table on the day, not before.';`,
    `export const u = 'Check in who came on the day.';`,
    `export const r = '/vendor-dashboard/on-the-day';`,
    `export const k = { key: 'on-the-day' };`,
    `// On the Day, in a comment`,
    `export const log = () => console.warn('On the Day read refused');`,
  ];
  for (const s of code) assert.deepEqual(scanSource('x.tsx', s, NAMES), [], `flagged code as copy: ${s}`);
});

test('no screen names the stage "On the Day"', () => {
  const r = scanTree(NAMES, ALLOW, new Set(['lib/the-day-is-the-day.test.ts']));
  console.log(`[the-day] ${r.scanned} files · ${r.findings.length} findings · ${r.excused} excused`);
  assert.ok(r.scanned > 1000, `walked only ${r.scanned} files — the walk is broken`);
  assert.ok(r.excused >= 4, 'the allowlist matched almost nothing — the scan is not reading the tree');
  assert.deepEqual(
    r.findings,
    [],
    'The stage is "The Day", never "On the Day" (owner d25). Change the WORD, never the key or the route:\n  ' +
      r.findings.join('\n  '),
  );
});

test('every allowlist row is real, reasoned and still needed', () => {
  assert.deepEqual(allowlistProblems(ALLOW, scanTree(NAMES, ALLOW).used), []);
});
