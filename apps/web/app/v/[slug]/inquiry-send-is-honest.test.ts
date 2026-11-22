/**
 * inquiry-send-is-honest.test.ts — a couple's inquiry never says "Sent" when it was not sent.
 *
 * ── The defect (supplier launch walk, 22 Nov 2026, step 6 · Gap 2) ──────────
 * `startServiceInquiry` opened the thread, posted the opening note, and IGNORED the note's delivery result whenever no
 * package build rode along ("otherwise the note stays best-effort"). A refused or failed first note still returned
 * `{ status: 'ok' }`, so the shop's Inquire pop-up said "Sent ✓", the thread stayed empty, and the supplier was never
 * notified. The couple waited on a reply that could not come. Three more ways to the same false "Sent":
 *
 *   · the message-count read failing was read as "no messages" (data: null → 0), never as a failure;
 *   · on a chat already under way, the couple's TYPED words (Inquire's "Anything to add?", Check a date's "Is <day>
 *     open?") were dropped while the sheet still said "Sent ✓";
 *   · both shop sheets treated `ok_build_not_sent` — "the words did not post" — as sent.
 *
 * ── What this pins ─────────────────────────────────────────────────────────
 * 1. BEHAVIOUR: the ONE reading of the send's result (`inquireSendOutcome`) is driven with every failure the action can
 *    return. Only `status: 'ok'` may reach the Sent step; every failure carries a non-empty reason.
 * 2. THE ACTION: every way the first note (or the new words) can fail returns a failure — bound, said, never collapsed
 *    into `ok` — and every `ok` says whether a message actually posted (`posted`) and whether the shop is on the
 *    event's Suppliers (`listed`).
 * 3. THE SHEETS: both read the result through that one reading, and the typed words stay in the box on a failure.
 *
 * Same shape as `app/vendor-dashboard/reads-are-honest.test.ts` and `lib/guests-read-is-honest.test.ts`: behaviour
 * against injected results, source rules on comment-stripped code.
 *
 * 🛡 Mutation-checked: each rule below was broken on purpose (the `!delivery.ok` return deleted, the count error
 * unbound, `ok_build_not_sent` put back into a sheet's sent branch, `inquireSendOutcome`'s error case returning sent),
 * the test went RED, and the code was restored.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INQUIRY_NOT_SENT, inquireSendOutcome, inquiryNotSentLine } from '@/lib/shop-inquire';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

const action = read('inquiry-actions.ts');
const inquireSheet = read('_components/inquire-sheet.tsx');
const checkDate = read('dates/_components/check-a-date-calendar.tsx');

type Res = Parameters<typeof inquireSendOutcome>[0];
const SIGN_IN = 'Sign in to send this — your picks are kept.';

// ── 1 · Behaviour: inject every failure the action can return ───────────────

const FAILURES: Array<[string, Res]> = [
  ['the first note did not post (plain failure)', { status: 'error', message: INQUIRY_NOT_SENT }],
  ['an error with no words at all', { status: 'error', message: '' }],
  ['an error of only spaces', { status: 'error', message: '   ' }],
  ['the contact filter refused the words', { status: 'error', message: inquiryNotSentLine('contact_blocked', 'Keep contact details in Setnayan.') }],
  ['the build did not post · failed', { status: 'ok_build_not_sent', reason: 'failed', message: 'insert failed: 42501' }],
  ['the build did not post · follow-up used', { status: 'ok_build_not_sent', reason: 'followup_used', message: 'You already sent your one follow-up.' }],
  ['the build did not post · declined', { status: 'ok_build_not_sent', reason: 'declined', message: 'This supplier declined the inquiry.' }],
  ['the build did not post · contact blocked', { status: 'ok_build_not_sent', reason: 'contact_blocked', message: 'Keep contact details in Setnayan.' }],
  ['signed out', { status: 'not_signed_in' }],
  ['not secured', { status: 'not_secured' }],
  ['not their event', { status: 'no_event' }],
];

for (const [name, res] of FAILURES) {
  test(`📨 a failure is never the Sent step — ${name}`, () => {
    const out = inquireSendOutcome(res, SIGN_IN);
    assert.equal(out.sent, false, `${name} must not reach "Sent"`);
    if (out.sent) return;
    assert.ok(out.note.trim().length > 0, `${name} must say why — never an empty note`);
  });
}

test('📨 a status nobody has mapped yet is not a delivery', () => {
  const out = inquireSendOutcome({ status: 'queued' } as unknown as Res, SIGN_IN);
  assert.equal(out.sent, false);
  if (!out.sent) assert.equal(out.note, INQUIRY_NOT_SENT);
});

test('📨 a plain failure says the one sentence; a raw database error never reaches the couple', () => {
  assert.equal(INQUIRY_NOT_SENT, 'Your message didn’t send. Try again.');
  const out = inquireSendOutcome({ status: 'ok_build_not_sent', reason: 'failed', message: 'insert failed: 42501' }, SIGN_IN);
  assert.equal(out.sent, false);
  if (!out.sent) assert.equal(out.note, INQUIRY_NOT_SENT);
  assert.equal(inquiryNotSentLine('failed', 'duplicate key value violates unique constraint'), INQUIRY_NOT_SENT);
  // A refusal the couple can act on keeps the server's own teaching copy, after the same opening words.
  assert.equal(
    inquiryNotSentLine('contact_blocked', 'Keep contact details in Setnayan.'),
    'Your message didn’t send. Keep contact details in Setnayan.',
  );
  assert.equal(inquiryNotSentLine('declined', '  '), INQUIRY_NOT_SENT);
});

test('📨 only a delivery is sent — and it carries what actually happened', () => {
  const out = inquireSendOutcome({ status: 'ok', threadId: 't', eventId: 'e', listed: false, posted: true }, SIGN_IN);
  assert.deepEqual(out, { sent: true, eventId: 'e', threadId: 't', listed: false, posted: true });
  const resumed = inquireSendOutcome({ status: 'ok', threadId: 't', eventId: 'e', listed: true, posted: false }, SIGN_IN);
  assert.equal(resumed.sent && resumed.posted, false, 'nothing new posted → the sheet must not say "Sent"');
});

// ── 2 · The action: every failure path returns a failure ───────────────────

test('📨 the first note’s delivery is read — a failure returns a failure, not ok', () => {
  assert.match(action, /const delivery = await postThreadMessage\(/, 'the first note’s outcome must be captured');
  assert.match(
    action,
    /else if \(!delivery\.ok\) \{[\s\S]{0,400}?return \{ status: 'error', message: inquiryNotSentLine\(delivery\.reason, delivery\.message\) \};/,
    'a first note that did not post must return status error — never fall through to ok',
  );
});

test('📨 a failed message count is a failure, never "no messages"', () => {
  assert.match(action, /const \{ count: msgCount, error: msgCountErr \} = await admin/, 'the count’s error must be bound');
  assert.match(
    action,
    /if \(msgCountErr\) \{[\s\S]{0,400}?return \{ status: 'error', message: INQUIRY_NOT_SENT \};/,
    'a refused count must return the not-sent failure',
  );
});

test('📨 the couple’s new words on a chat already under way are posted, and a refusal is said', () => {
  assert.match(action, /const words = await postThreadMessage\(supabase, threadId, requirementsBlock\.trim\(\)\);/);
  assert.match(
    action,
    /if \(!words\.ok\) \{[\s\S]{0,400}?return \{ status: 'error', message: inquiryNotSentLine\(words\.reason, words\.message\) \};/,
  );
});

test('📨 a conversation that did not open never shows the couple a raw database error', () => {
  assert.doesNotMatch(action, /threadErr\?\.message \?\? 'Could not open the conversation\.'/);
  assert.match(action, /return \{ status: 'error', message: demo \?\? INQUIRY_NOT_SENT \};/);
});

test('📨 every ok says whether a message posted and whether the shop is listed', () => {
  const oks = action.match(/return \{ status: 'ok'[\s\S]{0,400}?\}/g) ?? [];
  assert.ok(oks.length >= 2, 'expected the general-question ok and the final ok');
  for (const ok of oks) {
    // The measured values, by name — never a literal that claims a post or a listing nobody saw.
    assert.match(ok, /\blisted, posted \}$/, `an ok must carry the measured listed + posted: ${ok}`);
    assert.doesNotMatch(ok, /\b(posted|listed): (true|!)/, `an ok may not hard-code posted/listed: ${ok}`);
  }
  assert.match(action, /posted = delivery\.ok;/);
  assert.doesNotMatch(action, /let listed = true/, 'listed starts false — it is set only by a write the action saw');
});

// ── 3 · The sheets: one reading, words kept ─────────────────────────────────

for (const [name, src, step] of [
  ['Inquire pop-up', inquireSheet, "setStep('sent')"],
  ['Check a date', checkDate, "setStep('sent')"],
] as const) {
  test(`📨 ${name} reads the result through inquireSendOutcome — ok_build_not_sent is never sent`, () => {
    assert.match(src, /const outcome = inquireSendOutcome\(res, /, `${name} must use the one reading`);
    assert.doesNotMatch(src, /res\.status === 'ok_build_not_sent'/, `${name} must not treat a not-sent build as sent`);
    assert.doesNotMatch(src, /res\.status === 'ok'/, `${name} must not read the status by hand`);
    // The Sent step is reached from exactly one place: a delivery.
    const sentCalls = src.split(step).length - 1;
    assert.equal(sentCalls, 1, `${name} reaches the Sent step from one place only`);
    assert.match(src, /if \(outcome\.sent\) \{[\s\S]{0,400}?setStep\('sent'\);/, `${name}: the Sent step only behind outcome.sent`);
    // A failure is drawn as one, and the catch says the same sentence.
    assert.match(src, /setNoteFailed\(true\);\s*setNote\(outcome\.note\);/);
    assert.match(src, /catch \{\s*setStep\('event'\);\s*setNoteFailed\(true\);\s*setNote\(INQUIRY_NOT_SENT\);/);
    assert.match(src, /text-danger/);
    // "Sent ✓" is only the heading when a message posted.
    assert.match(src, /sent\?\.posted === false \? 'In your chat ✓' : 'Sent ✓'/);
  });
}

test('📨 the typed words stay in the box on a failure', () => {
  assert.doesNotMatch(inquireSheet, /setMessage\(''\)/, 'nothing may clear the couple’s words');
  assert.match(inquireSheet, /value=\{message\}/, 'the box shows the kept words');
});
