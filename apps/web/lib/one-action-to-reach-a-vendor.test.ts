/**
 * A couple reaches a supplier in ONE action.
 *
 * ── WHAT WAS THERE (owner, 2026-09-08, looking at four buttons) ────────────
 * *"this seems confusing. follow and save — what are the only buttons that we
 * really need?"*
 *
 * The explore card carried Follow · "Follow to message" (greyed) · Save · View
 * vendor. Two of them read as "keep this vendor" and did unrelated things, and
 * the Message button was a puzzle whose answer was a DIFFERENT button — a
 * heart, sitting next to a bookmark that meant something else.
 *
 * ── WHAT THE GATE ACTUALLY IS, AND WHY IT STAYS ───────────────────────────
 * "Iteration 0019 § Gate — couple must follow the vendor before opening a new
 * thread" is a **restrictive INSERT policy on `chat_threads`**. It is enforced
 * by the database, not by the button, so removing the button would not have
 * removed the gate — it would have produced an unexplained failure one step
 * later.
 *
 * 🔑 THE OTHER DOOR ALREADY DID THIS. `app/v/[slug]/inquiry-actions.ts` lists
 * its steps as "…2. follow the vendor (satisfies the iteration 0019 follow-gate
 * RLS)" — the inquiry path has always followed on the couple's behalf. The two
 * doors disagreed and the messages one was the odd one out. Pressing Message IS
 * the couple declaring interest; the follow is recorded for them.
 *
 * ⚠ RETIRING THE REQUIREMENT ITSELF is a different, bigger act — a migration
 * against that RLS policy plus a decision logged against Iteration 0019. These
 * tests exist partly so that stays a deliberate choice rather than something
 * that erodes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => stripComments(readFileSync(resolve(HERE, p), 'utf8'));

const gate = src('../app/_components/follow-gate.tsx');
const messages = src('../app/dashboard/[eventId]/messages/actions.ts');

test('Message no longer waits on the couple having followed', () => {
  // Scoped to the two expressions that decide the Message control. A blanket
  // search for `following` is wrong here — the Follow toggle on the PROFILE
  // variant legitimately reads and flips it, and a guard that fires on that is
  // a guard nobody keeps.
  const disabled = gate.slice(
    gate.indexOf('const messageDisabled'),
    gate.indexOf(';', gate.indexOf('const messageDisabled')),
  );
  const href = gate.slice(
    gate.indexOf('const messageHref'),
    gate.indexOf(';', gate.indexOf('const messageHref')),
  );
  assert.ok(disabled.length > 0 && href.length > 0, 're-point this guard');
  assert.ok(
    !/following/.test(disabled),
    'the Message control is disabled on `following` again — the puzzle whose ' +
      'answer was a different button',
  );
  assert.ok(
    !/following/.test(href),
    'the Message link is gated on `following` again',
  );
  assert.ok(
    !/Follow to message/.test(gate),
    'the "Follow to message" caption is back',
  );
});

test('…but the DB gate is still satisfied — the thread path records the follow', () => {
  assert.match(
    messages,
    /followVendor\(/,
    'startThreadByVendorEmail no longer follows on the couple’s behalf, so the ' +
      'restrictive INSERT policy on chat_threads will refuse the thread',
  );
  const call = messages.slice(messages.indexOf('isFollowingVendor('));
  const beforeInsert = call.slice(0, call.indexOf(".from('chat_threads')"));
  assert.match(
    beforeInsert,
    /followVendor\(/,
    'the follow happens AFTER the insert, so the insert it exists to permit is ' +
      'still refused',
  );
});

test('a failed follow fails LOUD, never silently into a refused insert', () => {
  assert.match(
    messages,
    /if \(!followed\.ok\)/,
    'the follow result is unchecked; a failure would surface as an unexplained ' +
      '"could not start the thread" one step later',
  );
});

test('the search-result card carries no Follow button', () => {
  assert.match(
    gate,
    /isCard \? null : \(/,
    'the Follow control is back on the search-result card — two buttons that both ' +
      'read as "keep this vendor"',
  );
});

test('Save says WHICH event it saved into', () => {
  // Save is event-scoped and /explore is not. The action resolves the couple's
  // PRIMARY host event and writes there; a couple planning two events had no
  // way to learn which one gained a supplier.
  const button = src('../app/(shell)/explore/_components/save-vendor-button.tsx');
  const action = src('../app/(shell)/explore/actions.ts');
  assert.match(action, /eventName/, 'the save action stopped returning the event it wrote to');
  assert.match(
    button,
    /Saved to \$\{savedEventName\}/,
    'the Save button stopped naming the event it saved into',
  );
  assert.match(
    button,
    /savedEventName \?[^:]*: 'Saved'/,
    'no fallback when the name could not be read — the save still happened, and ' +
      'claiming an event we cannot name would be worse than not naming one',
  );
});
