/**
 * 📵 NO CALLS IN THE CHAT (owner 2026-10-28, verbatim: *"remove both voice and video call"*; chat prototype
 * 2026-10-28 frames B–D: the head is ‹ · avatar · name · event line · ⓘ, and neither ＋ sheet has a call row).
 *
 * Executed where it can be (the registries), counted where it must be read (the pages). The call SERVER code stays in
 * place, unused by the chat, for the owner to decide on — so this guard also fails if it silently disappears.
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
