/**
 * landing.test.ts — the LANDING check (Root map part 2, slice 4), on a fixture.
 *
 * Both sides of each rule: a "Messages" door that opens the roster IS a
 * finding and one that opens Messages is NOT; a door to a #section the page
 * never draws IS a finding and one it draws is NOT; a door through a
 * forwarding stub IS "retarget" and a direct one is NOT; a generic "Open" is
 * never judged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { labelAt, scanLandings, wordsMatch } from './scan-landings';
import { scanScreens } from './scan-screens';

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ugat-landing-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

const FILES: Record<string, string> = {
  'app/page.tsx': `export default function P() { return (<main>
    <Link href="/messages">Messages</Link>
    <Link href="/guests">Messages</Link>
    <Link href="/guests#plus-ones">Plus-ones</Link>
    <Link href="/guests#table-view">Tables</Link>
    <Link href="/old-guests">Guests</Link>
    <Link href="/messages">Open</Link>
    <a href="#nowhere">Jump</a>
    <section id="here" />
  </main>); }\n`,
  'app/messages/page.tsx': `export const metadata = { title: 'Messages' };\nexport default function P() { return <main />; }\n`,
  'app/guests/page.tsx': `export const metadata = { title: 'Guest list' };\nimport { Roster } from './_components/roster';\nexport default function P() { return <Roster />; }\n`,
  'app/guests/_components/roster.tsx': `export function Roster() { return <section id="plus-ones" />; }\n`,
  'app/old-guests/page.tsx': `import { redirect } from 'next/navigation';\nexport default function P() { redirect('/guests'); }\n`,
};

function run() {
  const root = fixture(FILES);
  const screens = scanScreens({ webRoot: root, builders: new Map(), tableNodes: new Map() });
  return scanLandings({ webRoot: root, screens, builders: new Map(), tableNodes: new Map() });
}

test('a "Messages" door that opens the guest list is a finding; one that opens Messages is not', () => {
  const words = run().filter((f) => f.check === 'wrong-words').map((f) => f.key);
  assert.deepEqual(words, ['app/page.tsx "Messages" → /guests']);
});

test('a door to a #section the page never draws is a finding; one it draws (in a child) is not', () => {
  const keys = run().filter((f) => f.check === 'missing-section').map((f) => f.key);
  assert.ok(keys.includes('app/page.tsx → /guests#table-view'));
  assert.ok(!keys.some((k) => k.includes('plus-ones')), 'drawn by the Roster component the page imports');
  assert.ok(keys.includes('app/page.tsx → #nowhere'), 'a same-page jump to a missing section');
});

test('a door through a forwarding stub is "retarget"', () => {
  const keys = run().filter((f) => f.check === 'retarget').map((f) => f.key);
  assert.deepEqual(keys, ['app/page.tsx → /old-guests']);
});

test('words: synonyms land, generic calls to action are not judged', () => {
  assert.equal(wordsMatch('Your suppliers', ['Bench', '/dashboard vendors']), true);
  assert.equal(wordsMatch('See all', ['Messages']), true);
  assert.equal(wordsMatch('Budget', ['Guest list', 'guests']), false);
  assert.equal(labelAt(`x = { label: 'Seating', href: '/seat' }`, 'x = { label: \'Seating\', '.length), 'Seating');
});
