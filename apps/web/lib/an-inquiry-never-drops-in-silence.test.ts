/**
 * 📨 OWN-02 (W1 re-walk, live 5cbf166 · 14 Nov): the first inquiry Send silently didn't go, and back from "Start a new
 * event" the new event wasn't picked.
 *   · Closing the sheet during "Sending in N s…" cleared the timer and closed — nothing sent, last words "Sending".
 *     Undo is the one way not to send; closing now SENDS NOW and the sheet stays to say whether it went.
 *   · (The new-event half — back from "Start a new event", that event is picked — shipped on main in d91c199 via the
 *     resume URL's event id; its guard is `the-event-dash-round-holds.test.ts`.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const SHEET = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/_components/inquire-sheet.tsx'), 'utf8'));

test('closing during the countdown sends now — it never drops the ask', () => {
  const close = SHEET.slice(SHEET.indexOf('const close = () => {'), SHEET.indexOf('const fire = async'));
  assert.match(close, /if \(step === 'sending'\) \{\s*void fire\(\);\s*return;\s*\}/, 'closing mid-countdown still drops the ask');
  // …and only Undo says "Not sent."
  assert.equal((SHEET.match(/setNote\('Not sent\.'\)/g) ?? []).length, 1);
});
