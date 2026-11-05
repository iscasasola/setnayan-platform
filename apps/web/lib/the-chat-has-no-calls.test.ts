/**
 * 📵 NO CALLS IN THE CHAT (owner 2026-10-28, verbatim: *"remove both voice and video call"*; chat prototype
 * 2026-10-28 frames B–D: the head is ‹ · avatar · name · event line · ⓘ, and neither ＋ sheet has a call row).
 *
 * Executed where it can be (the registries), counted where it must be read (the pages). The call SERVER code stays in
 * place, unused by the chat, for the owner to decide on — so this guard also fails if it silently disappears.
 *
 * 📞 WHAT IT DOES NOT FORBID (owner 2026-11-04, DECISION_LOG "SIX OWNER ANSWERS" item 2: *"We can call and video call
 * suppliers as well on the chat"*): a hand-off OUT of the app — `tel:` and Viber — to a BOOKED supplier, in the chat
 * head's `BookedCallRow` (`app/_components/chat/booked-call-row.tsx`). That is the phone's own dialler, not a call in
 * the chat; the last test below holds it to exactly that, and `lib/a-booked-supplier-is-the-only-call.test.ts` holds
 * it to booked suppliers only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { VENDOR_THREAD_IN_PAGE_ANCHORS, VENDOR_THREAD_PANELS, VENDOR_THREAD_TOOLS } from './vendor-thread-tools';
import { CHAT_BOX_AFFORDANCES, SHARED_THREAD_PANEL_IDS, coupleThreadTools } from './chat-box-tools';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGES = ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx'];
const SHEET = 'app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx';

test('the registries carry no call — no panel, no anchor, no tool, no composer affordance', () => {
  assert.ok(VENDOR_THREAD_TOOLS.length >= 10, 'the tool list read short');
  for (const p of VENDOR_THREAD_PANELS) assert.ok(!/call/i.test(p.id) && !/call/i.test(p.label), `a call panel: ${p.id}`);
  for (const a of VENDOR_THREAD_IN_PAGE_ANCHORS) assert.ok(!a.startsWith('thread-call'), `a call anchor: ${a}`);
  for (const t of VENDOR_THREAD_TOOLS) {
    assert.ok(!/\bcall them\b|\bvoice\b|video call|\bphone\b/i.test(`${t.label} ${t.line}`), `a call row in the supplier's ＋: ${t.label}`);
    for (const id of t.reveal ?? []) assert.ok(!id.startsWith('thread-call'), `${t.key} reveals a call`);
  }
  assert.deepEqual(Object.keys(CHAT_BOX_AFFORDANCES), ['deal'], 'a composer affordance other than the deal is back');
  assert.ok(!(SHARED_THREAD_PANEL_IDS as readonly string[]).includes('thread-call'), 'the couple mounts a call panel again');
  for (const t of coupleThreadTools(['deal-or-meeting'])) assert.ok(!/\bcall them\b|\bvoice\b|video call|\bphone\b/i.test(`${t.label} ${t.line}`), `a call row in the couple's ＋: ${t.label}`);
});

test('neither thread page mounts a call, reads the calls gate, or draws a phone or video icon', () => {
  for (const rel of PAGES) {
    const s = read(rel);
    assert.ok(s.length > 10_000, `${rel} read short`);
    assert.equal((s.match(/<ThreadCallLauncher\b/g) ?? []).length, 0, `${rel} mounts a call launcher`);
    assert.doesNotMatch(s, /thread-call-launcher|thread-call-room|thread-call-actions/, `${rel} imports the call code again`);
    assert.doesNotMatch(s, /thread-calls-gate|resolveThreadCallsEnabled/, `${rel} still reads the calls gate`);
    assert.doesNotMatch(s, /\b(Phone|PhoneCall|Video)\b[,\s]*[}\w]*\s*from 'lucide-react'|<(Phone|PhoneCall|Video)\b/, `${rel} draws a call icon`);
  }
  const sheet = read(SHEET);
  assert.doesNotMatch(sheet, /\bPhone\b/, 'the ＋ sheet still has a phone icon');
  // The supplier's customer page no longer deep-links a call panel that does not exist.
  assert.doesNotMatch(read('app/vendor-dashboard/clients/[eventId]/page.tsx'), /#thread-call\b/, 'a door still opens the chat call panel');
});

test('the call server code is LEFT IN PLACE, unused by the chat — the owner decides whether to delete it', () => {
  for (const rel of ['app/_actions/thread-call-actions.ts', 'app/_components/thread-call-room.tsx', 'lib/thread-calls-gate.ts']) {
    assert.ok(existsSync(join(WEB, rel)), `${rel} was deleted — that is the owner's call, not this slice's`);
  }
});

test('the ONE call affordance left is the hand-off OUT to a booked supplier — never an in-app call', () => {
  const row = read('app/_components/chat/booked-call-row.tsx');
  assert.doesNotMatch(row, /thread-call-launcher|thread-call-room|thread-call-actions|ThreadCallLauncher|startThreadCall/, 'the hand-off row starts an in-app call');
  // Its doors are the phone's own apps, from the booked reader's links — and nothing else.
  assert.deepEqual([...row.matchAll(/href=\{([^}]*)\}/g)].map((m) => m[1]), ['tel', 'viber'], 'the hand-off row opens something other than tel:/Viber');
  for (const rel of PAGES) {
    const s = read(rel);
    // Mounted only in the HEAD (its `below` slot), never as a ＋ tool or a panel.
    const mounts = s.match(/<BookedCallRow\b/g) ?? [];
    if (mounts.length) assert.match(s, /below=\{\s*<BookedCallRow\b/, `${rel} mounts the hand-off somewhere other than the chat head`);
  }
});
