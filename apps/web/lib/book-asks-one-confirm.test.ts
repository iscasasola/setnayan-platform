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
  assert.match(body, /const copy = bookConfirmCopy\(vendorName\);/, 'the confirm does not use the one copy');
  const asked = body.indexOf('await confirm({ ...copy, body })');
  const sent = body.indexOf('requestLock()');
  assert.ok(asked >= 0, 'the Book press sends without asking');
  assert.ok(sent > asked, 'the Book press sends before the confirm answers');
  assert.match(body, /if \(!\(await confirm\(\{ \.\.\.copy, body \}\)\)\) return;/, '"Not yet" still sends');
});

test('owner 16 Nov: the confirm TELLS the couple a shop is not yet verified — with the shipped line, never blocking', () => {
  const src = read(LOCK);
  assert.match(src, /import \{ NotYetVerifiedThreadLine \} from '@\/app\/_components\/chat\/not-yet-verified-line';/, 'not the shipped line');
  const press = src.match(/onClick=\{async \(\) => \{([\s\S]*?)\n {8}\}\}/)![1]!;
  assert.match(press, /const notYetVerified = isVerified !== undefined && !isVerified;/, 'the line is drawn from an absence, or not at all');
  assert.match(press, /notYetVerified \? \(\s*<>\s*\{copy\.body\}\s*<NotYetVerifiedThreadLine renewing=\{papersRenewing\} \/>/, 'the confirm drops the not-yet-verified line');
  // Told, never blocked: the only early return in the press is the couple's own "Not yet".
  assert.equal((press.match(/return;/g) ?? []).length, 1, 'something besides "Not yet" stops the press');
  // Every door that knows the shop is not verified hands it to the button.
  for (const p of ['app/_components/chat-message-stream.tsx', 'app/proposals/[publicId]/page.tsx']) {
    assert.match(read(p), /isVerified=\{lockTarget\.notYetVerified \? false : undefined\}/, `${p} never tells the button`);
  }
  assert.match(read('app/dashboard/[eventId]/messages/[threadId]/page.tsx'), /if \(quoteLockTarget\) \{\s*quoteLockTarget\.notYetVerified = shopNotYetVerified;/);
  assert.match(read('app/proposals/[publicId]/page.tsx'), /const note = await readThreadShopVerifiedNote\([\s\S]{0,80}lockTarget\.notYetVerified = note !== null;/);
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
