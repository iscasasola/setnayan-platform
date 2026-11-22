/**
 * 🚫 A REFUSED CHAT SEND SAYS WHY, WHERE THE PRESS WAS (chat walk, 22 Nov 2026 — "i want chat working").
 *
 * The walk found three presses that a person makes and then cannot read the answer of:
 *
 *   1 · the composer strips `return_to`, so a send the server refused (an unverified shop's file, a host's second
 *       follow-up before the shop accepted, off-platform contact…) returned NOTHING — the bubble read as sent, then
 *       turned a reason-less "Not sent" six seconds later. The action now hands the reason back and the bubble says it;
 *   2 · the mic was drawn for an unverified shop, whose every voice note the server refuses (`plus_unverified`) — it
 *       now follows the ＋ sheet's rule (`verified === false` locks it; unknown leaves it to the server);
 *   3 · "Accept the update" on a quote past its Valid until redirected with `?notice=quote_expired`, which the in-chat
 *       form did not refuse on — an expired quote read as accepted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the action hands a refusal back on the JS path, and the bubble says it', () => {
  const action = read('lib/chat-actions.ts');
  const send = action.slice(action.indexOf('export async function sendChatMessage'), action.indexOf('export async function notifyOtherParty'));
  assert.ok(send.length > 0, 'sendChatMessage moved — re-point this guard');
  assert.match(send, /Promise<void \| ChatSendRefusal>/, 'the action no longer says it can answer with a refusal');
  for (const code of ['plus_unverified', 'contact_blocked', 'fee_words_only', 'followup_used', 'attachment_invalid']) {
    assert.match(send, new RegExp(`result\\.code === '${code}'`), `a ${code} refusal is not said back in words`);
  }
  assert.match(send, /return \{ ok: false, reason: result\.message \};/, 'a refused send returns nothing — the bubble reads it as sent');

  const form = read('app/_components/chat-send-form.tsx');
  assert.match(form, /sendAction: \(formData: FormData\) => Promise<void \| \{ ok: false; reason: string \}>/);
  assert.match(form, /if \(r && r\.ok === false\) refused = r\.reason;/, 'the composer ignores the refusal it is handed');
  assert.match(form, /if \(refused\) \{\s*forgetRetry\(pending\.tempId\);\s*settle\(false, refused\);\s*return;\s*\}/, 'the bubble does not say the refusal');
  // The refusal is said BEFORE the success line, so a refused send is never settled as sent.
  assert.ok(form.indexOf('settle(false, refused)') < form.indexOf('settle(true)'), 'a refused send is settled as sent first');
});

test('2 · an unverified shop has no mic — the same rule as its ＋ tiles', () => {
  const page = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(page, /verified=\{shopVerified\}/, 'the ＋ sheet lost the verified rule this mirrors');
  assert.match(page, /voice=\{shopVerified !== false\}/, 'the mic is drawn for a shop whose every voice note is refused');
  assert.doesNotMatch(page, /^\s*voice\s*$/m, 'a bare `voice` draws the mic for an unverified shop');
});

test('3 · an expired quote’s Accept says so in the chat', () => {
  const words = read('app/_actions/stay-registry/svProposals.ts');
  assert.match(words, /n === 'quote_expired'\) return '[^']+'/, 'Accept on an expired quote reads as accepted');
  assert.match(words, /n === 'respond_failed'\) return '[^']+'/);
  // The action still names the expiry on that notice — the refusal above is the only reader on the chat's form.
  assert.match(read('app/vendor-dashboard/proposals/actions.ts'), /'quote_expired' : 'respond_failed'/, 'the action no longer names an expired quote');
});
