/**
 * An add-on whose switch is OFF is not shown — no "Coming soon" card.
 *
 * Supplier sign-up sweep (2026-11-05): the Plan page's Vendor AI, 3D Booth and
 * Papic Challenges cards, and My Shop's Instagram card, each rendered a
 * "Coming soon" placeholder when their flag was off. A new supplier reading
 * four of those on their first visit reads an unfinished product. With the
 * switch off there is nothing to buy or connect, so the card renders nothing
 * (each server action still refuses on its own).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';

const CARDS: Array<[file: string, flag: string]> = [
  ['app/vendor-dashboard/subscription/_components/ai-addon-card.tsx', 'assistantLive'],
  ['app/vendor-dashboard/subscription/_components/booth-addon-card.tsx', 'available'],
  ['app/vendor-dashboard/subscription/_components/papic-challenge-card.tsx', 'available'],
  ['app/vendor-dashboard/_components/instagram-connect-card.tsx', 'configured'],
];

for (const [file, flag] of CARDS) {
  const code = stripComments(readFileSync(file, 'utf8'));
  test(`${file.split('/').pop()}: switch off → nothing, never "Coming soon"`, () => {
    assert.doesNotMatch(code, /coming soon/i, 'a "Coming soon" placeholder is back');
    assert.match(code, new RegExp(`if \\(!${flag}\\) return null;`), `the card no longer hides itself when ${flag} is false`);
  });
}

test('My Shop draws no empty Instagram divider when the card is hidden', () => {
  const g = stripComments(readFileSync('app/vendor-dashboard/shop/_components/gallery-media.tsx', 'utf8'));
  assert.match(g, /\{igConfigured \|\| igUnavailable \? \(/);
});
