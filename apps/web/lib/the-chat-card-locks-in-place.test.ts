/**
 * BOTH ENDS OF ONE CONNECTION, ON THE QUOTE CARD IN THE CHAT.
 *
 * ── WHAT THIS EXISTS TO CATCH (owner, live, 2026-09-19) ─────────────────────
 * As the couple: *"the lock attempt was from the chat. it should also work
 * there."* The accepted quote card's "🔒 Ask <shop> to lock" was a LINK — to the
 * workspace (no Lock; after #5614 a loop back to the card), then to the bench
 * (#5677). Nothing was written from the chat; `lock_requested_at` stayed null.
 *
 * As the supplier: the card read "Accepted · the couple has asked you to lock"
 * and offered only "View proposal" — *"there is no agree and confirm booking"*.
 *
 * ── THE PROPERTY ─────────────────────────────────────────────────────────────
 * One lock mechanism, reachable from two rooms; one answer, reachable from
 * three. The couple's card MOUNTS the bench's own `AccordionLockButton` (whose
 * one server call is `finalizeVendor`); the supplier's card mounts the SAME
 * `vendorAgreeToLock` / `vendorDeclineLock` the Overview posts. Neither card
 * grows a lock or answer of its own, and neither result can render as nothing:
 * the lock button names 'lock_requested' and fails loud on any status it does
 * not name, and the answer lands back in the thread, which says the sentence.
 *
 * ⚠ "Exactly one lock action in the codebase" is NOT true and this guard does
 * not claim it. `lock_request_state: 'pending'` has four TypeScript writers —
 * finalizeVendor, the package lock, the wizard, and the chat amendment's
 * lockDeal — and they predate this change. What is pinned is that the set did
 * not grow: the chat card added a mount, not a writer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { lockAnswerReturnTo } from '@/lib/lock-answer-notice';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

const STREAM = 'app/_components/chat-message-stream.tsx';
const LOCK = 'app/dashboard/[eventId]/vendors/_components/accordion-lock.tsx';
const BENCH = 'app/dashboard/[eventId]/vendors/_components/bench-vendor-actions.tsx';
const COUPLE = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const SUPPLIER = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const OVERVIEW = 'app/vendor-dashboard/page.tsx';
const ANSWER = 'app/_components/lock-answer-forms.tsx';
const ACTIONS = 'app/vendor-dashboard/clients/[eventId]/actions.ts';

const stream = read(STREAM);
const lock = read(LOCK);
const bench = read(BENCH);
const couple = read(COUPLE);
const supplier = read(SUPPLIER);
const overview = read(OVERVIEW);
const answer = read(ANSWER);
const actions = read(ACTIONS);

/** The proposal card's branch of the stream — where both ends must mount. */
const card = stream.slice(
  stream.indexOf('if (m.proposal_id) {'),
  stream.indexOf('if (negotiationOn && m.appointment_id)'),
);

test('the scan reads every file (an empty read is a green lie)', () => {
  for (const [rel, src] of [
    [STREAM, stream], [LOCK, lock], [BENCH, bench], [COUPLE, couple],
    [SUPPLIER, supplier], [OVERVIEW, overview], [ANSWER, answer], [ACTIONS, actions],
  ] as const) {
    assert.ok(src.length > 1000, `${rel} read as ${src.length} chars`);
  }
  assert.ok(card.length > 2000, `the proposal card window is ${card.length} chars — slid?`);
});

/* ── THE COUPLE'S END ───────────────────────────────────────────────────── */

test('couple · the card mounts the bench’s own lock component — the same module the bench imports', () => {
  assert.equal(
    count(stream, /import \{ AccordionLockButton \} from '@\/app\/dashboard\/\[eventId\]\/vendors\/_components\/accordion-lock';/g),
    1,
    'the stream does not import the bench’s AccordionLockButton',
  );
  assert.equal(count(bench, /import \{ AccordionLockButton \} from '\.\/accordion-lock';/g), 1, 'the bench no longer uses the same component');
  assert.equal(count(card, /<AccordionLockButton\b/g), 1, 'the card must mount the lock exactly once');
  // Gated on the shared rule, and fed the target the server resolved.
  assert.equal(count(card, /quoteState\.offerLock && lockTarget \?/g), 1, 'the lock is not gated on quoteCardState');
  assert.equal(count(card, /vendorId=\{lockTarget\.vendorId\}/g), 1);
  assert.equal(count(card, /groupId=\{lockTarget\.groupId\}/g), 1);
});

test('couple · the card grows no lock of its own — no action import, no form, no fetch', () => {
  assert.equal(count(stream, /finalizeVendor/g), 0, 'the stream calls finalizeVendor directly — a second caller of the lock');
  assert.equal(count(card, /action=\{lockDeal\}/g), 0, 'the quote card mounts the amendment lock');
  assert.equal(count(stream, /from '@\/app\/dashboard\/\[eventId\]\/vendors\/actions'/g), 0, 'the stream imports the vendors actions');
  // The component the card mounts has exactly one server call: finalizeVendor.
  assert.equal(count(lock, /await finalizeVendor\(fd\)|finalizeVendor\(fd\)/g), 1, 'AccordionLockButton no longer calls finalizeVendor exactly once');
});

test('couple · a lock request can never render as nothing', () => {
  // 'lock_requested' is named, says so, and re-reads the page (the chat mount
  // is not revalidated by finalizeVendor's own revalidatePath).
  assert.equal(count(lock, /case 'lock_requested':/g), 1, 'the ask falls through the switch again');
  assert.equal(count(lock, /Lock requested — waiting for \{state\.vendorName\} to agree\./g), 1, 'the ask has no visible state');
  assert.ok(count(lock, /router\.refresh\(\)/g) >= 2, 'a success no longer re-reads the page the button sits on');
  // Any status the switch does not name is a compile error AND a visible error.
  assert.match(lock, /default: \{\s*const unhandled: never = result;\s*setState\(\{\s*kind: 'error'/, 'an unnamed result renders nothing');
  // The failure line the card shows is the button's own alert.
  assert.equal(count(lock, /state\.kind === 'error' \? \(\s*<p\s+role="alert"/g), 1, 'the lock error is not rendered as an alert');
});

test('couple · the target comes from the shared rule, and the page never hands the card a guessed row', () => {
  assert.equal(count(couple, /quoteLockTarget = coupleLockTarget\(/g), 1);
  assert.equal(count(couple, /lockTarget=\{quoteLockTarget\}/g), 1);
  // The same anchor row the handshake read reads — or the card could lock one
  // row and report another's state.
  assert.equal(count(couple, /\.or\('package_role\.is\.null,package_role\.eq\.anchor'\)/g), 1);
  // The couple's page never receives the supplier's answer.
  assert.equal(count(couple, /agreeLock|declineLock|vendorAgreeToLock/g), 0, 'the couple page can answer its own ask');
});

/* ── THE SUPPLIER'S END ─────────────────────────────────────────────────── */

test('supplier · the card mounts the answer, gated on the rule, fed the SAME two actions as the Overview', () => {
  assert.equal(count(card, /<LockAnswerForms\b/g), 1, 'the supplier’s card has no Agree / Turn it down');
  assert.equal(count(card, /quoteState\.offerLockAnswer &&/g), 1, 'the answer is not gated on quoteCardState');
  assert.equal(count(card, /agreeLock=\{supplierReplyActions\.agreeLock\}/g), 1);
  assert.equal(count(card, /declineLock=\{supplierReplyActions\.declineLock\}/g), 1);
  assert.equal(count(card, /eventVendorId=\{lockHandshake\.eventVendorId\}/g), 1, 'the answer does not post the row the handshake was read from');
  // The supplier's thread hands in exactly the Overview's actions, from their one module.
  assert.equal(count(supplier, /agreeLock: vendorAgreeToLock,/g), 1);
  assert.equal(count(supplier, /declineLock: vendorDeclineLock,/g), 1);
  assert.equal(count(supplier, /import \{ vendorAgreeToLock, vendorDeclineLock \} from '\.\.\/\.\.\/clients\/\[eventId\]\/actions';/g), 1);
  assert.equal(count(overview, /agreeLock=\{vendorAgreeToLock\}/g), 1, 'the Overview stopped posting the same action');
  // Exactly one definition of each answer.
  const defs = (name: string) => count(actions, new RegExp(`export async function ${name}\\(`, 'g'));
  assert.equal(defs('vendorAgreeToLock'), 1);
  assert.equal(defs('vendorDeclineLock'), 1);
});

test('supplier · both forms post only the row id and the way home — the same shape as the Overview', () => {
  assert.equal(count(answer, /<form action=\{agreeLock\}>/g), 1);
  assert.equal(count(answer, /<form action=\{declineLock\}/g), 1);
  assert.equal(count(answer, /name="vendor_id" value=\{eventVendorId\}/g), 2);
  assert.equal(count(answer, /name="return_to" value=\{returnTo\}/g), 2);
  assert.equal(count(answer, /name="event_id"/g), 0, 'an answer form posts event_id — the confused-deputy rule');
  assert.equal(count(answer, /name="reason"/g), 1, 'the decline lost its reason');
  assert.equal(count(card, /returnTo=\{`\/vendor-dashboard\/messages\/\$\{threadId\}`\}/g), 1);
});

test('supplier · the answer lands back in the thread, and the thread says what happened', () => {
  assert.equal(count(actions, /const back = lockAnswerReturnTo\(formData\.get\('return_to'\)\);/g), 2);
  assert.equal(count(actions, /redirect\(`\$\{back\}\?lock_agree=\$\{flag\}\$\{competing\}`\);/g), 1);
  assert.equal(count(actions, /redirect\(`\$\{back\}\?lock_decline=\$\{flag\}`\);/g), 1);
  assert.equal(count(actions, /redirect\(`\/vendor-dashboard\?lock_(agree|decline)=/g), 0, 'an answer is hard-wired to the Overview again');
  // The thread page reads both and renders the sentence, a refusal as an alert.
  assert.match(supplier, /lockAgreeNotice\(sp\?\.lock_agree,/);
  assert.match(supplier, /lockDeclineNotice\(sp\?\.lock_decline\)/);
  assert.equal(count(supplier, /\{lockAnswer\.text\}/g), 1, 'the thread never says the answer');
  assert.match(supplier, /role=\{lockAnswer\.tone === 'refused' \? 'alert' : 'status'\}/);
});

test('supplier · the way home is an allowlist of one shape — executed', () => {
  assert.equal(lockAnswerReturnTo('/vendor-dashboard/messages/2f1c-abc_9'), '/vendor-dashboard/messages/2f1c-abc_9');
  for (const bad of [
    undefined, null, 42, '', '/vendor-dashboard', 'https://evil.example/vendor-dashboard/messages/x',
    '//evil.example/vendor-dashboard/messages/x', '/vendor-dashboard/messages/x?y=1',
    '/vendor-dashboard/messages/../clients/x', '/vendor-dashboard/messages/x/y',
    '/dashboard/e/messages/x', ' /vendor-dashboard/messages/x',
  ]) {
    assert.equal(lockAnswerReturnTo(bad), '/vendor-dashboard', `${String(bad)} was honoured`);
  }
});

/* ── ONE MECHANISM: THE SET OF ASK-WRITERS DID NOT GROW ─────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(abs) && !/\.test\.tsx?$/.test(abs)) out.push(abs);
  }
  return out;
}

test('the TypeScript writers of a lock ask are the four that predate the chat card — the card added none', () => {
  const writers = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((abs) => /lock_request_state:\s*'pending'/.test(stripComments(readFileSync(abs, 'utf8'))))
    .map((abs) => abs.slice(WEB.length + 1))
    .sort();
  assert.deepEqual(writers, [
    'app/dashboard/[eventId]/vendors/actions.ts',
    'app/dashboard/[eventId]/vendors/packages/actions.ts',
    'app/dashboard/[eventId]/wizard-actions.ts',
    'lib/chat-lock-booking.server.ts',
  ]);
});
