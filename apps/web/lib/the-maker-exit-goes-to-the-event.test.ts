/**
 * ✕ THE MAKER'S EXIT GOES TO THIS EVENT'S DASHBOARD — owner, 25 Oct, verbatim, over the "LEAVE THE MAKER · Back to
 * this event · All events" sheet: *"It just needs to go back to the event's dashboard"*.
 *
 * This file replaces `the-maker-exit-offers-events.test.ts` (08 Oct), which pinned the opposite rule — ✕ opened a
 * two-door sheet (owner then: *"why can't i go back to events?"* → *"Okay, fix the three step."*). The owner has now
 * ruled the choice away; the sheet and its lazy door are deleted, not hidden.
 *
 *   1 · ✕ is ONE link, to `/dashboard/<eventId>` — no button, no dialog, no open/closed state.
 *   2 · no choice sheet exists: the file is gone, nothing imports it, the lazy door is gone.
 *   3 · the ✕ is the same on the shipped Maker and the new one — nothing gates it on the stages flag.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const LAUNCH = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SHELL = src(`${LAUNCH}/maker-shell.tsx`);

function exitPill(): string {
  const at = SHELL.indexOf('data-maker-toolbar=""');
  assert.ok(at > 0, 'precondition: the Maker toolbar was found');
  const bar = SHELL.slice(at, at + 2600);
  const pill = bar.slice(bar.indexOf('<IconPill tone="exit">'), bar.indexOf('</IconPill>'));
  assert.ok(pill.length > 150, 'precondition: the ✕ pill was found — this scan is blind');
  return pill;
}

test('1 · ✕ is one link to this event’s dashboard — nothing opens, nothing asks', () => {
  const pill = exitPill();
  assert.match(pill, /<Link\s+href=\{`\/dashboard\/\$\{eventId\}`\}\s+aria-label="Exit"/, '✕ does not go straight to /dashboard/<eventId>');
  assert.match(pill, /data-maker-tool="exit"/);
  assert.equal((pill.match(/\bhref=/g) ?? []).length, 1, '✕ offers more than one way out');
  assert.doesNotMatch(pill, /<button\b|onClick=|aria-haspopup|aria-expanded/, '✕ opens something instead of leaving');
  assert.doesNotMatch(pill, /href=\{?['"`]\/dashboard['"`]/, '✕ goes to All events, not this event');
  assert.match(SHELL, /^import Link from 'next\/link';$/m);
});

test('2 · no choice sheet: the file, its lazy door and the shell’s open state are gone', () => {
  assert.equal(existsSync(join(WEB, `${LAUNCH}/maker-exit-sheet.tsx`)), false, 'the Leave the Maker sheet is back');
  assert.doesNotMatch(src(`${LAUNCH}/details-lazy.tsx`), /MakerExitSheet|maker-exit-sheet/);
  assert.doesNotMatch(SHELL, /MakerExitSheet|exitOpen|setExitOpen|Leave the Maker|All events/);
});

test('3 · one ✕ for both Makers — nothing gates it on the stages flag', () => {
  assert.doesNotMatch(exitPill(), /stagesStudio/);
});
