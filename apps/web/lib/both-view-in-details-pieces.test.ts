/**
 * 🖥📱 "BOTH" INSIDE THE DETAILS PIECES (owner 2026-09-29, DECISION_LOG "OWNER
 * ANSWERS — TEN OPEN QUESTIONS" (8): YES). View ▾ Both draws the Hero and the
 * Reveal pieces as the stage does — desktop and phone side by side — instead of
 * collapsing to Desktop. (The Love Story piece is its in-place book editor, not
 * a page frame, so it has no device to show twice.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(
  readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-look-pages.tsx'), 'utf8'),
);

test('Both draws two frames — desktop (holding the ref) and phone — never collapses to Desktop', () => {
  assert.doesNotMatch(SRC, /device=\{maker\.device === 'both' \? 'desktop'/, 'Both collapses to Desktop again');
  const at = SRC.indexOf("{maker.device === 'both' ? (");
  assert.ok(at > -1, 'no Both arm in the Details look pages');
  const both = SRC.slice(at, SRC.indexOf(') : (', at));
  assert.match(both, /<MakerPageFrame[^>]*device="desktop"[^>]*frameRef=\{frameRef\}/);
  assert.match(both, /<MakerPageFrame[^>]*device="phone"[^>]*frameKey=\{`\$\{frameKey\}:phone`\}/);
  assert.equal((both.match(/<MakerPageFrame\b/g) ?? []).length, 2);
});
