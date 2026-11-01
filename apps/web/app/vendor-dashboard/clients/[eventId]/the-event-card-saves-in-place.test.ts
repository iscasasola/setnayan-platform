/**
 * 💾 THE EVENT CARD SAVES IN PLACE (owner 2026-10-29: *"it should not jump to old pages but everything working similar
 * to event dashboard"*; S8). Every exported action in `actions.ts` either saves IN PLACE (revalidates, no redirect on
 * success) or is on the reasoned allow-list below — each entry says why it still navigates and what converting it
 * needs. A NEW action lands in neither and fails here, so the list can only shrink.
 *
 * A refused write is still SAID: the notes' failure goes back to the notes with `?note=error`, which the list prints.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(readFileSync(join(import.meta.dirname, 'actions.ts'), 'utf8'));

/** Saves in place: no `redirect(` after its last guard — success revalidates. */
const IN_PLACE = ['createClientNote', 'toggleClientNoteDone', 'deleteClientNote', 'createVendorChallengeAction'];

/**
 * Still navigates on success — WHY, and what converting needs (queued for the next pass, controller 2026-10-29 S8):
 * each one's OUTCOME rides the redirect as a flag the page/Today reads to print the result (sent · error · hall taken ·
 * fee held …). Dropping the redirect without moving that word into a returned result + a client caller
 * (`useActionState`) would make the result silent — worse than the jump.
 */
const STILL_NAVIGATES: Record<string, string> = {
  vendorMarkServiceComplete: '?completed= flag → VendorCompletionCard; 4 callers incl. Today',
  vendorAcknowledgeDeposit: 'returns to the caller’s page (`back`) — the deposit answer on Today/the card',
  vendorRejectDeposit: '?deposit_answer= flag read by Today',
  suggestScheduleChange: '?suggest=sent|notyours|error banner on the card',
  vendorPostHandover: '?handover= outcome banner on the card',
  vendorRaiseChangeOrder: '?change_order=sent|error banner',
  vendorRespondChangeOrder: '?change_order_resp= banner',
  vendorWithdrawChangeOrder: '?change_order_resp= banner',
  vendorAgreeToLock: '?lock_agree= (hall_taken · competing · fee held) — 12 callers across chat/Today/card',
  vendorDeclineLock: '?lock_decline= flag — 11 callers',
  vendorAnswerDateChange: '?date_answer= flag read by Today',
  vendorAgreeToDeletion: '?deletion= flag read by Today',
  vendorDeclineDeletion: '?deletion= flag read by Today',
  vendorAskForPayment: '?ask= flag → PaymentAsksPanel',
  vendorWithdrawPaymentAsk: '?ask=withdrawn|error flag → PaymentAsksPanel',
};

function bodyOf(name: string): string {
  const start = SRC.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is gone — update this guard`);
  const next = SRC.indexOf('\nexport ', start + 10);
  return SRC.slice(start, next < 0 ? undefined : next);
}

test('the in-place saves end on a revalidate, not a redirect', () => {
  for (const name of IN_PLACE) {
    const body = bodyOf(name);
    const lastRedirect = body.lastIndexOf('redirect(');
    const lastSave = Math.max(body.lastIndexOf('revalidatePath('), body.lastIndexOf('noteSaved('));
    assert.ok(lastSave > lastRedirect, `${name} still redirects after it saves`);
  }
  // A refused note write is said, never silent.
  assert.match(SRC, /function noteSaved\([\s\S]*?if \(error\) \{[\s\S]*?query: \{ note: 'error' \}/);
  const notes = stripComments(readFileSync(join(import.meta.dirname, '_components', 'customer-card-notes.tsx'), 'utf8'));
  assert.match(notes, /\{failed \? \(\s*<p role="alert"/);
});

test('every exported action is either in place or on the reasoned list (the list only shrinks)', () => {
  const exported = [...SRC.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]!);
  for (const name of exported) {
    if (IN_PLACE.includes(name) || name in STILL_NAVIGATES) continue;
    const body = bodyOf(name);
    // An exported helper that never navigates (e.g. a resolver) is in place by definition.
    assert.doesNotMatch(body.replace(/redirect\('\/login'\)|redirect\('\/vendor-dashboard(\/clients)?'\)/g, ''), /redirect\(/, `${name} navigates and is on no list`);
  }
  for (const name of Object.keys(STILL_NAVIGATES)) assert.ok(exported.includes(name), `${name} is on the list but not exported — drop it`);
});
