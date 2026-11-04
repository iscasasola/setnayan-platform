/**
 * rehearsal-dinner-stays-as-it-ships.test.ts — 🍽 event chapters slice 7: DO NOT CHANGE REHEARSAL DINNER.
 *
 * Owner's brief for the event-chapters build (2026-11-04), item 7: "Do NOT change Rehearsal dinner." Whether Rehearsal
 * dinner becomes a chapter, stays a per-guest invited-to block, or goes is an OPEN OWNER CALL — not a build's.
 * Measured 2026-11-04 against slices 1–6: none of them changed a line that names it. This pins it as it ships, so the
 * next build that touches it has to say so:
 *
 *   1 · it is one of the per-guest "Invited to" blocks, worded "Rehearsal dinner";
 *   2 · the inner circle is invited to it by default, and everyone else is not;
 *   3 · it is NOT one of the four default chapters a new event starts with (slice 1);
 *   4 · a caterer's production sheet still counts its portions.
 *
 * 🔑 When the owner rules on Rehearsal dinner, change this file in the same PR as the change — with the ruling quoted.
 * Never delete it to go green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { INVITED_TO_BLOCKS, INVITED_TO_LABELS, defaultInvitedToForRole } from '@/lib/guests';
import { DEFAULT_CHAPTER_LABELS } from '@/lib/schedule';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const OPEN = 'Rehearsal dinner is an open owner call (event chapters brief, item 7: "Do NOT change Rehearsal dinner")';

test('1 · Rehearsal dinner is a per-guest Invited-to block, worded as it ships', () => {
  assert.ok((INVITED_TO_BLOCKS as readonly string[]).includes('rehearsal_dinner'), `${OPEN} — it left the Invited-to blocks`);
  assert.equal(INVITED_TO_LABELS.rehearsal_dinner, 'Rehearsal dinner', `${OPEN} — its words changed`);
});

test('2 · the inner circle is invited to it by default; a plain guest is not', () => {
  for (const role of ['bride', 'groom', 'bride_parents', 'principal_sponsor_ninang'] as const) {
    assert.ok(defaultInvitedToForRole(role).includes('rehearsal_dinner'), `${OPEN} — ${role} is no longer invited by default`);
  }
  assert.ok(!defaultInvitedToForRole('guest').includes('rehearsal_dinner'), `${OPEN} — every guest is now invited by default`);
});

test('3 · it is not one of the four default chapters', () => {
  const labels = Object.values(DEFAULT_CHAPTER_LABELS).map((l) => l.toLowerCase());
  assert.ok(!labels.some((l) => l.includes('rehearsal')), `${OPEN} — it became a default chapter`);
  assert.equal(labels.length, 4, 'a new event no longer starts with four chapters (slice 1)');
});

test('4 · a production sheet still counts its portions', () => {
  const actions = code('app/vendor-dashboard/clients/[eventId]/production-sheet/actions.ts');
  assert.match(actions, /const BLOCKS = \[[^\]]*'rehearsal_dinner'[^\]]*\];/, `${OPEN} — a portion rule can no longer name it`);
  const page = code('app/vendor-dashboard/clients/[eventId]/production-sheet/page.tsx');
  assert.match(page, /rehearsal_dinner: 'Rehearsal dinner',/, `${OPEN} — the production sheet no longer names it`);
});
