/**
 * the-wedding-exists-only-when-it-does.test.ts
 *
 * The onboarding summary told every couple *"This is the Reyes–Cruz wedding —
 * and it already exists."* Measured live on 2026-09-07 at the moment that
 * screen rendered: **no event row existed anywhere in the database.** The
 * commit runs in `handleFinish`, when the couple taps through; the row appears
 * ~30 seconds later. The sentence was false for exactly the window in which it
 * was shown.
 *
 * 🔑 Harmless here, and the same class this codebase guards everywhere else: a
 * statement of fact that nothing measured. `committedEventId` is the only thing
 * that knows — set in `handleFinish` right before navigating — so it is
 * non-null precisely on the back-then-forward path where the wedding really
 * does already exist.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = stripComments(
  readFileSync(resolve(HERE, '_components/onboarding-shell.tsx'), 'utf8'),
);

test('the "already exists" claim is gated on committedEventId', () => {
  const idx = SHELL.indexOf('already exists');
  assert.ok(idx > -1, 'the summary line is gone — re-point this guard');
  const line = SHELL.slice(Math.max(0, idx - 400), idx + 120);
  assert.match(
    line,
    /committedEventId\s*\?/,
    'the summary states the wedding exists without checking whether it does',
  );
});

test('the un-committed branch claims nothing about existence', () => {
  const idx = SHELL.indexOf('already exists');
  const after = SHELL.slice(idx, idx + 200);
  assert.ok(
    !/(exists|created|saved|is live)/i.test(after.replace('already exists', '')),
    `the fallback branch makes an existence claim too: ${after.slice(0, 120)}`,
  );
});

test('the commit still happens in handleFinish, not before the summary', () => {
  // If the commit ever moves earlier, this guard should be revisited rather
  // than left asserting a gate that no longer matters.
  const finish = SHELL.indexOf('committingRef.current = true');
  const summary = SHELL.indexOf('already exists');
  assert.ok(finish > -1, 'the commit path changed shape');
  assert.ok(
    finish < summary,
    'the commit now runs after the summary renders — re-check whether the ' +
      'gate is still the right fix',
  );
});
