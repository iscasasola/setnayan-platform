/**
 * guests-seats-and-supplier-chat-hold-final-check.test.ts — final check, area 2, fix batch 3 (25 Nov 2026).
 *
 * Ten findings from the staging walk on the couple's guest, seat and supplier-chat screens. Each test below holds
 * one claim on the comment-stripped source (a comment that names the fix cannot satisfy it), plus behaviour for the
 * one pure helper.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { paymentNoteWords } from '@/lib/payment-note-words';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..', '..', '..');
const src = (rel: string): string => stripComments(readFileSync(join(web, rel), 'utf8'));

test('A2-D16: the check-in desk says the reply in the list’s own words, never the database value', () => {
  const s = src('app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx');
  assert.doesNotMatch(s, /RSVP&rsquo;d \{selected\.rsvpStatus\}/);
  assert.match(s, /RSVP_LIST_WORDS\[selected\.rsvpStatus\]/);
});

test('A2-H4: the chat box marks the phone key "Send" (Enter sends on every device)', () => {
  assert.match(src('app/_components/chat-send-form.tsx'), /enterKeyHint="send"/);
});

test('A2-H1: the inbox offers no "Suppliers" chip that draws exactly the All list', () => {
  const s = src('app/dashboard/[eventId]/messages/_components/chat-inbox.tsx');
  assert.match(s, /peerFilter = null,/);
  assert.doesNotMatch(s, /peerFilter = 'Suppliers'/);
});

test('A2-G11: Find never links a shop to "#"', () => {
  const s = src('app/dashboard/[eventId]/vendors/categories/page.tsx');
  assert.doesNotMatch(s, /: '#'/);
  assert.match(s, /shopsRead\.results\.flatMap\(\(r\) => \(r\.slug \?/);
});

test('A2-G1: Build "Ask to book" and Compare "book" are drawn only for a viewer who books', () => {
  const body = src('app/dashboard/[eventId]/vendors/_components/build-body.tsx');
  assert.match(body, /const books = useViewerBooks\(\);/);
  assert.match(body, /\{books && askable\(line\) \?/);
  const compare = src('app/dashboard/[eventId]/vendors/_components/build-compare.tsx');
  assert.match(compare, /const books = useViewerBooks\(\);/);
  const gate = compare.indexOf('{books ? (');
  const book = compare.indexOf("onApply(c.snapshot, 'lock', c.title)");
  assert.ok(gate >= 0 && book > gate, 'the book button sits inside the books gate');
});

test('A2-G4: the stored payment notes read as "reservation fee" and "supplier"; other notes pass through', () => {
  const lock = 'Downpayment (lock · awaiting ' + 'vendor confirmation)';
  const held = 'Deposit (date held · awaiting ' + 'vendor confirmation)';
  assert.equal(paymentNoteWords(lock), 'Reservation fee · waiting for the supplier to confirm');
  assert.equal(paymentNoteWords(held), 'Reservation fee · date held · waiting for the supplier to confirm');
  assert.equal(paymentNoteWords('Paid the band in cash'), 'Paid the band in cash');
  assert.match(
    src('app/dashboard/[eventId]/_components/vendor-itemization-card.tsx'),
    /paymentNoteWords\(p\.notes\)/,
  );
});

test('A2-H3: in a supplier thread only a host is handed Book and Pay', () => {
  const s = src('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(s, /fetchEventViewer\(supabase, eventId, user\.id\)\.catch\(\(\) => null\)/);
  assert.match(s, /const viewerBooks = \(await viewerRead\)\?\.isCouple \?\? false;/);
  assert.match(s, /lockTarget=\{viewerBooks \? quoteLockTarget : null\}/);
  assert.match(s, /couplePay=\{viewerBooks \? couplePay : null\}/);
});

test('A2-H2: a money-hidden viewer is handed no payment facts in the thread', () => {
  assert.match(
    src('app/dashboard/[eventId]/messages/[threadId]/page.tsx'),
    /decisionPayments=\{chatPins\.streamMasked \? \[\] : decisionPayments\}/,
  );
});

test('A2-E3: the tea order serves only who is coming, never calls everyone an elder, and says when it could not read', () => {
  const s = src('app/dashboard/[eventId]/guests/tea-ceremony/page.tsx');
  assert.match(s, /g\.rsvp_status !== 'declined'/);
  assert.doesNotMatch(s, /\belders`/);
  const refused = s.indexOf('if (eventRowError) {\n    return');
  const nf = s.indexOf('notFound()');
  assert.ok(refused >= 0 && nf > refused, 'a refused event read is said before the not-found gate');
});

test('A2-D1: a refused table or seat read is said in the Seats view, never thrown at the whole Guests page', () => {
  const s = src('app/dashboard/[eventId]/seating/page.tsx');
  assert.match(s, /fetchTables\(supabase, eventId\)\.catch\(/);
  assert.match(s, /fetchAssignments\(supabase, eventId\)\.catch\(/);
  assert.match(s, /if \(tables === null \|\| assignments === null\) \{/);
});
