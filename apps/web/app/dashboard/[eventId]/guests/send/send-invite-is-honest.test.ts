/**
 * send-invite-is-honest.test.ts — SEND INVITE · COPY MESSAGE · ONE BY ONE.
 *
 * Owner 2026-09-29: *"maybe we can create a copy text"* → each guest's
 * PERSONAL link + QR → *"something we can copy and send to them via third
 * party apps like messenger"*. What these hold, and why each is a property
 * rather than a phrasing:
 *
 *   ⓵ THE THREE PATHS ARE THE ONES PROMISED — files+text where the share sheet
 *     takes a file, text alone where it does not, a copy where there is no
 *     share sheet. Executed on the pure decision, then pinned to the component
 *     that must use it.
 *   ⓶ SENT ✓ IS WRITTEN — through the ONE writer, and it counts its rows.
 *   ⓷ A COPY IS NOT A SEND — Copy message never stamps by itself; it offers
 *     Mark as sent. A dismissed share sheet stamps nothing.
 *   ⓸ THE QR FILE IS FETCHED BEFORE THE TAP (iOS spends the tap's user
 *     activation on an await between the tap and navigator.share).
 *   ⓹ THE COUPLE'S WORDING SURVIVES EVERY OTHER WRITER of `print_details`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { inviteSendPath } from '@/lib/guest-invite-message';
import { parsePrintDetails, serializePrintDetails } from '@/lib/print-pieces';
import { PASS_CARD_ROUTE } from '@/lib/pass-card';

const WEB = join(__dirname, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SEND = 'app/dashboard/[eventId]/guests/_components/send-invite.tsx';
const WRITER = 'app/dashboard/[eventId]/invitation/actions.ts';
const PRINT_ROUTE = 'app/api/hub-print/[piece]/route.ts';
const CELL = 'app/dashboard/[eventId]/guests/_components/guest-invite-cell.tsx';

/** The body of `function <name>(…) {…}` in `src`, brace-matched. */
function body(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  // The body's brace is the first one that ENDS a line — a return type such as
  // `Promise<{ ok: true } | { ok: false }>` opens braces mid-line.
  const open = src.indexOf('{\n', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${name} never closes`);
}

test('⓵ the three paths: files where the sheet takes a file, text where not, copy with no sheet', () => {
  assert.equal(inviteSendPath({ share: true, filesOk: true }), 'files');
  assert.equal(inviteSendPath({ share: true, filesOk: false }), 'text');
  assert.equal(inviteSendPath({ share: false, filesOk: true }), 'copy');
  assert.equal(inviteSendPath({ share: false, filesOk: false }), 'copy');

  // The decision lives in `shareInvite` since 2026-09-30 — shared by the card's
  // Send invite AND the Guest list's Invite column, so the two cannot drift.
  const share = body(read(SEND), 'shareInvite');
  assert.match(share, /inviteSendPath\(/, 'Send invite no longer decides its path through inviteSendPath');
  // "files" is only claimed after the browser says it can share THAT file.
  assert.match(share, /canShare\?\.\(\{\s*files:\s*\[file\]\s*\}\)/, 'files are shared without asking canShare({ files })');
  // The message that travels WITH the image says "(attached)"; the text-only one does not.
  assert.match(share, /files:\s*\[file\],\s*text:\s*message\(true\)/);
  assert.match(share, /\{\s*text:\s*message\(false\)\s*\}/);
  // …and the card's Send invite goes through it. No share sheet, or a refused
  // one → the copy (which offers Download ticket + Mark as sent).
  const send = body(read(SEND), 'send');
  assert.match(send, /shareInvite\(/, 'Send invite has its own share path again');
  assert.match(send, /copyText\('copied-desktop'\)/);
});

test('⓶ Sent ✓ goes through the ONE writer, and the writer counts its rows', () => {
  const send = read(SEND);
  assert.match(send, /import\s*\{\s*setGuestInvitationSent\s*\}\s*from\s*'\.\.\/\.\.\/invitation\/actions'/);
  const w = read(WRITER);
  const shared = body(w, 'writeGuestInvitationSent');
  assert.match(shared, /\.update\(\{\s*invitation_sent_at:/);
  assert.match(shared, /\.eq\('event_id',\s*eventId\)/, 'the stamp is not scoped to this event');
  assert.match(shared, /\.select\('guest_id'\)/, 'a zero-row UPDATE is success-shaped — the rows must come back');
  assert.match(shared, /data\.length === 0\)\s*return \{ ok: false \}/);
  assert.match(body(w, 'setGuestInvitationSent'), /writeGuestInvitationSent\(/);
  assert.match(body(w, 'markGuestInvitationSent'), /writeGuestInvitationSent\(/,
    'the Invitation page and the guest list must run ONE statement, not two');
});

test('⓷ a copy is not a send; a closed share sheet stamps nothing', () => {
  const src = read(SEND);
  const copy = body(src, 'copyText');
  assert.doesNotMatch(copy, /\bmark\(/, 'Copy message stamps Sent by itself — a copy is not a send');
  // The share reports 'shared' only AFTER the awaited sheet, and 'closed' on an
  // AbortError — and every caller stamps on 'shared' alone.
  const share = body(src, 'shareInvite');
  const shareAt = share.indexOf('await nav.share(');
  const sharedAt = share.indexOf("return 'shared'");
  assert.ok(shareAt > 0 && sharedAt > shareAt, 'Sent ✓ is stamped before the phone handed the message over');
  assert.match(share, /'AbortError'\)\s*return 'closed';/, 'closing the share sheet must not read as a send');
  // The Guest list's cell shares from `share()` — since 2026-10-02 Invite opens
  // a sheet at every width and its "Share message + ticket" row is the share
  // (owner, live iPhone test: Copy invitation link sits beside it).
  for (const [file, caller] of [[SEND, 'send'], [CELL, 'share']] as const) {
    const b = body(read(file), caller);
    assert.match(b, /if \(out === 'shared'\) return mark\(true\);/, `${caller}() stamps on something other than a completed share`);
    assert.match(b, /if \(out === 'closed'\) return;/, `${caller}() treats a closed sheet as something to act on`);
    assert.equal((b.match(/\bmark\(true\)/g) ?? []).length, 1, `${caller}() stamps Sent ✓ on more than one path`);
  }
  // The explicit "Mark as sent" exists where a copy happened.
  assert.match(src, /data-send-invite-mark[\s\S]{0,400}Mark as sent/);
});

test('⓸ the QR image is fetched before the tap, never between the tap and navigator.share', () => {
  const src = read(SEND);
  assert.doesNotMatch(body(src, 'send'), /\bfetch\(/, 'a fetch inside send() can spend iOS’s user activation');
  assert.doesNotMatch(body(src, 'shareInvite'), /\bfetch\(/, 'a fetch inside shareInvite() can spend iOS’s user activation');
  assert.doesNotMatch(body(read(CELL), 'invite'), /\bfetch\(/, 'a fetch inside the Invite column’s tap can spend iOS’s user activation');
  assert.doesNotMatch(body(read(CELL), 'share'), /\bfetch\(/, 'a fetch inside the Invite sheet’s Share can spend iOS’s user activation');
  assert.match(body(src, 'useTicketFile'), /useEffect\([\s\S]*fetch\(ticketUrl\(guestId\)/);
});

test('⓺ what travels is the Digital ticket, never the bare QR (owner 2026-09-30)', () => {
  // "so what will show is not QR Code. it will be the Digital Ticket" ·
  // "we do not copy the QR Code, we copy the Digital Ticket".
  const src = read(SEND);
  assert.match(body(src, 'ticketUrl'), /\$\{TICKET_ROUTE\}\?guest=/, 'the shared file is not the pass-card (ticket) route');
  // Spelled in send-invite.tsx (bundle), held equal to the one source here.
  assert.equal(/export const TICKET_ROUTE = '([^']+)'/.exec(src)?.[1], PASS_CARD_ROUTE, 'TICKET_ROUTE drifted from PASS_CARD_ROUTE');
  assert.doesNotMatch(src, /\/api\/website\/qr\/guest\//, 'send-invite.tsx still fetches the bare QR PNG');
  const cell = read(CELL);
  assert.match(body(cell, 'copyTicketImage'), /ticketUrl\(guestId\)/);
  assert.doesNotMatch(cell, /\/api\/website\/qr\/guest\//, 'the Invite column still copies the bare QR PNG');
});

test('⓹ the couple’s wording survives the Details and Menu saves that share its jsonb', () => {
  const stored = parsePrintDetails({ opening_line: 'Hello', invite_message: 'Hi {name}! {link}' });
  assert.equal(stored.inviteMessage, 'Hi {name}! {link}');
  assert.equal(parsePrintDetails(serializePrintDetails(stored)).inviteMessage, 'Hi {name}! {link}');
  const route = read(PRINT_ROUTE);
  // The words save starts from EVERYTHING stored and overwrites only its own
  // keys (2026-09-30: a named key list had dropped the poster photo).
  assert.match(route, /const details = \{\s*\.\.\.stored,/,
    'the Details (words) save rebuilds print_details without the invite message — it would erase it');
  assert.match(route, /serializePrintDetails\(\{\s*\.\.\.stored,\s*menu:/, 'the Menu save no longer carries the rest');
});

test('the send surfaces never say "website" to the couple (owner 2026-09-24: it is an Event Hub)', () => {
  for (const rel of [
    SEND,
    'app/dashboard/[eventId]/guests/send/page.tsx',
    'app/dashboard/[eventId]/guests/send/_components/send-run.tsx',
  ]) {
    // A path segment (`/api/website/qr/…`, `website/editor/…`) is a URL or an
    // import, not a word the couple reads.
    assert.doesNotMatch(read(rel), /(?<!\/)\bweb ?site\b(?!\/)/i, `${rel} says "website"`);
  }
});
