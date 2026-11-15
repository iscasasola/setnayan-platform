/**
 * 🛑 BOOK ASKS ONE CONFIRM BEFORE IT SENDS (owner 2026-11-16, DECISION_LOG 75a46e3c). Walk EB-175: a Find card's
 * **Book** sent a booking request to a supplier on the first tap ("Requesting…" then ASKED), with no confirm step.
 *
 * Every Book press in the app goes through `AccordionLockButton` (the Find card, the build's booked tab, the chat
 * card, the proposal page). It now asks once, with the shipped `useConfirm` box (`app/_components/confirm-dialog.tsx`),
 * the same box the card's Remove uses. No new dialog is drawn.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { bookConfirmCopy } from './explore-info-copy';
import { stripComments } from './strip-comments';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));
const LOCK = 'app/dashboard/[eventId]/vendors/_components/accordion-lock.tsx';

test('the confirm names the supplier, says it sends a request, and never says booked', () => {
  const c = bookConfirmCopy('Liwanag Lights & Sound');
  assert.match(c.title, /Liwanag Lights & Sound/);
  assert.match(c.body, /booking request/);
  assert.match(c.body, /until they say yes/);
  assert.doesNotMatch(`${c.title} ${c.body} ${c.confirmLabel}`, /\bbooked\b/i, 'the confirm claims a booking that does not exist yet');
  assert.ok(c.cancelLabel, 'the confirm has no way out');
});

test('the Book press waits for that confirm before anything is sent', () => {
  const src = read(LOCK);
  assert.match(src, /import \{ useConfirm \} from '@\/app\/_components\/confirm-dialog';/, 'not the shipped confirm box');
  assert.match(src, /const \{ confirm, dialog: confirmDialog \} = useConfirm\(\);/);
  assert.match(src, /\{confirmDialog\}/, 'the confirm box is never mounted, so it can never open');
  const press = src.match(/onClick=\{async \(\) => \{([\s\S]*?)\n {8}\}\}/);
  assert.ok(press, 'the Book press is no longer an async handler that can wait for the confirm');
  const body = press![1]!;
  const asked = body.indexOf('await confirm(bookConfirmCopy(vendorName))');
  const sent = body.indexOf('requestLock()');
  assert.ok(asked >= 0, 'the Book press sends without asking');
  assert.ok(sent > asked, 'the Book press sends before the confirm answers');
  assert.match(body, /if \(!\(await confirm\(bookConfirmCopy\(vendorName\)\)\)\) return;/, '"Not yet" still sends');
});

test('every Book door goes through that one button', () => {
  for (const p of [
    'app/dashboard/[eventId]/vendors/_components/bench-vendor-actions.tsx',
    'app/dashboard/[eventId]/vendors/_components/build-locked.tsx',
    'app/_components/chat-message-stream.tsx',
    'app/proposals/[publicId]/page.tsx',
  ]) {
    assert.match(read(p), /<AccordionLockButton\b/, `${p} no longer books through AccordionLockButton`);
  }
});
