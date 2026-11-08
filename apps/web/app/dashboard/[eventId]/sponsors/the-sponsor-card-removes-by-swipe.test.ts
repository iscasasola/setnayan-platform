/**
 * 👈 A SPONSOR'S REMOVE IS THE CARD'S SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
 * VISIBLE ✕ ON ROWS") — the same `removeSponsor` with the same FormData, after the Undo window; a refused remove
 * (`?error=…`) draws the card again.
 *
 * SABOTAGE (seen RED, then restored, 2026-11-03): the trash form put back on the card → test 1 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

test('1 · no trash on the card — the card is the swipe', () => {
  // The card lives in its own file (so the lab can draw it); the page draws it and nothing else removes a sponsor.
  const page = read('page.tsx');
  const card = read('_components/sponsor-card.tsx');
  assert.doesNotMatch(page, /<form action=\{removeSponsor\}>/);
  assert.doesNotMatch(card, /<form action=\{removeSponsor\}>/);
  assert.match(page, /<SponsorCard\b/);
  assert.match(card, /<SponsorSwipe eventId=\{eventId\} sponsorId=\{sponsor\.id\} name=\{sponsor\.full_name\}>\s*\{card\}\s*<\/SponsorSwipe>/);
});

test('2 · the swipe is the same removeSponsor, with Undo, and a refusal brings the card back', () => {
  const swipe = read('_components/sponsor-swipe.tsx');
  assert.match(swipe, /deleteWithUndo\(\{[\s\S]*?fd\.set\('event_id', eventId\);\s*fd\.set\('sponsor_id', sponsorId\);\s*return removeSponsor\(fd\);/);
  assert.match(swipe, /useSearchParams\(\)\?\.get\('error'\)[\s\S]*?if \(refused\) setGone\(false\);/);
  assert.match(swipe, /<UndoToastHost \/>/);
});
