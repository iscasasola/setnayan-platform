/**
 * schedule-time-ask.test.ts — 🔒 THE TIME-CHANGE CARD, BOTH WAYS (Unichat part F, owner 2026-11-20).
 *
 *   1 · the line written is the line read back — a supplier's move, a supplier's add, a host's ask; a label with " · "
 *       in it survives; an ask naming no time posts nothing; other lines are not a time card;
 *   2 · the card finds ITS request (direction · kind · new clock · written just before the line) and never another;
 *   3 · whose press it waits for; the settled words;
 *   4 · the wiring: the two writers post the line, the stream draws it, and the card presses the SHIPPED doors;
 *   5 · the drawing's v3 card: the facts on its second line and in ⓘ, and a No's reason said back in the chat.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { scheduleChangeFromLine, streamLineKind } from '@/lib/chat-card-lines';
import { backstageSetLine, findTimeAsk, timeAskDeclinedLine, timeAskFacts, timeAskFromLine, timeAskLine, timeAskSettledWords, timeAskTurn, type TimeAskRow } from '@/lib/schedule-time-ask';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const T = (hhmm: string, day = '2026-12-18') => `${day}T${hhmm}:00.000Z`;

test('1 · the line written is the line read back', () => {
  const move = timeAskLine({ by: 'supplier', label: 'Sound check', fromIso: T('15:30'), toIso: T('15:00') })!;
  assert.equal(move, 'Time change asked · Sound check · 3:30 PM → 3:00 PM');
  assert.deepEqual(timeAskFromLine(move), { by: 'supplier', add: false, label: 'Sound check', from: '3:30 PM', to: '3:00 PM' });

  const add = timeAskLine({ by: 'supplier', add: true, label: 'Crew call', toIso: T('12:00') })!;
  assert.equal(add, 'New moment asked · Crew call · 12:00 PM');
  assert.deepEqual(timeAskFromLine(add), { by: 'supplier', add: true, label: 'Crew call', from: null, to: '12:00 PM' });

  const host = timeAskLine({ by: 'host', label: 'Ceremony · lights cue', fromIso: T('16:00'), toIso: T('16:10') })!;
  assert.deepEqual(timeAskFromLine(host), { by: 'host', add: false, label: 'Ceremony · lights cue', from: '4:00 PM', to: '4:10 PM' });

  assert.equal(timeAskLine({ by: 'supplier', label: 'Sound check', fromIso: null, toIso: T('15:00') }), 'Time change asked · Sound check · 3:00 PM');
  assert.equal(timeAskFromLine('Time change asked · Sound check · 3:00 PM')?.from, null);
  assert.equal(timeAskLine({ by: 'supplier', label: 'x', toIso: null }), null, 'an ask in words only posted a time card');
  assert.equal(timeAskFromLine(timeAskLine({ by: 'supplier', label: 'First → last', toIso: T('09:05') }))?.label, 'First - last');

  assert.equal(streamLineKind(move), 'schedule');
  assert.equal(streamLineKind(host), 'schedule');
  assert.equal(scheduleChangeFromLine(move), null, 'an ask reads as a change that already happened');
  assert.equal(timeAskFromLine('Schedule changed · Ceremony · 2:00 PM → 2:30 PM · 30 min later'), null);
  assert.equal(timeAskFromLine('Time change asked · Sound check · soon'), null);
  assert.equal(timeAskFromLine('New moment asked · Crew call · 11:00 AM → 12:00 PM'), null);
  const quiet = backstageSetLine({ shop: 'Lumina', label: 'Crew call', toIso: T('12:00') });
  assert.equal(quiet, 'Lumina set Crew call for 12:00 PM');
  assert.equal(streamLineKind(quiet), null, 'the quiet line became a card');
});

test('2 · the card finds its own request, never another', () => {
  const row = (over: Partial<TimeAskRow>): TimeAskRow => ({
    suggestion_id: 's',
    event_id: 'e',
    block_id: 'b',
    kind: 'adjust',
    direction: 'to_host',
    status: 'open',
    proposed_label: null,
    proposed_start_at: T('15:00'),
    created_at: '2026-11-20T08:00:00.000Z',
    ...over,
  });
  const line = timeAskFromLine('Time change asked · Sound check · 3:30 PM → 3:00 PM')!;
  const at = '2026-11-20T08:00:02.000Z';
  assert.equal(findTimeAsk([row({})], line, at)?.suggestion_id, 's');
  assert.equal(findTimeAsk([row({ direction: 'to_supplier' })], line, at), null, 'a host’s ask answered for a supplier’s line');
  assert.equal(findTimeAsk([row({ direction: null })], line, at)?.suggestion_id, 's', 'a row with no direction is a supplier’s request');
  assert.equal(findTimeAsk([row({ proposed_start_at: T('15:15') })], line, at), null, 'a different time matched');
  assert.equal(findTimeAsk([row({ kind: 'new' })], line, at), null);
  assert.equal(findTimeAsk([row({ created_at: '2026-11-20T07:50:00.000Z' })], line, at), null, 'an old request matched a new line');
  assert.equal(findTimeAsk([row({ created_at: '2026-11-20T08:01:00.000Z' })], line, at), null, 'a later request matched an earlier line');
  assert.equal(
    findTimeAsk([row({ suggestion_id: 'old', created_at: '2026-11-20T07:59:00.000Z' }), row({ suggestion_id: 'new' })], line, at)?.suggestion_id,
    'new',
  );
  const hostLine = timeAskFromLine('Host asks a new time · Detail shots · 10:00 AM → 9:30 AM')!;
  assert.equal(findTimeAsk([row({ direction: 'to_supplier', proposed_start_at: T('09:30') })], hostLine, at)?.suggestion_id, 's');
  const addLine = timeAskFromLine('New moment asked · Crew call · 12:00 PM')!;
  assert.equal(findTimeAsk([row({ kind: 'new', block_id: null, proposed_start_at: T('12:00') })], addLine, at)?.suggestion_id, 's');
  assert.equal(findTimeAsk([row({})], line, 'not a date'), null);
});

test('3 · whose press it waits for, and the settled words', () => {
  assert.equal(timeAskTurn({ by: 'supplier' }, 'couple'), 'approve');
  assert.equal(timeAskTurn({ by: 'supplier' }, 'vendor'), 'take_back');
  assert.equal(timeAskTurn({ by: 'host' }, 'vendor'), 'accept');
  assert.equal(timeAskTurn({ by: 'host' }, 'couple'), 'waiting');
  const line = timeAskFromLine('Time change asked · Sound check · 3:30 PM → 3:00 PM')!;
  assert.equal(timeAskSettledWords(line, 'accepted'), '✓ Sound check → 3:00 PM');
  assert.equal(timeAskSettledWords(line, 'declined'), 'Sound check 3:30 → 3:00 PM · declined', 'a declined move drops the time it stays at');
  assert.equal(
    timeAskSettledWords(timeAskFromLine('Time change asked · Crew call · 11:30 AM → 12:30 PM')!, 'declined'),
    'Crew call 11:30 AM → 12:30 PM · declined',
  );
  assert.equal(timeAskSettledWords(timeAskFromLine('New moment asked · Crew call · 12:00 PM')!, 'declined'), 'New · Crew call 12:00 PM · declined');
  assert.equal(timeAskSettledWords(line, 'withdrawn'), 'Sound check → 3:00 PM · taken back');
  assert.equal(timeAskSettledWords(line, 'open'), null);
  assert.equal(timeAskSettledWords(timeAskFromLine('New moment asked · Crew call · 12:00 PM')!, 'accepted'), '✓ New · Crew call 12:00 PM');
});

test('4 · the wiring: both writers post the line, the stream draws it, the card presses the shipped doors', () => {
  const supplier = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  assert.match(supplier, /outcome === 'waits' && \(row\.kind === 'new' \|\| row\.kind === 'adjust'\) && row\.proposed_start_at[\s\S]*?timeAskLine\(\{ by: 'supplier'/, 'a supplier’s waiting ask posts no line');
  const host = read('lib/schedule-ask.server.ts');
  assert.match(host, /timeAskLine\(\{\s*by: 'host'[\s\S]*?postThreadSystemLine\(/, 'a host’s ask posts no line');

  const stream = read('app/_components/chat/cards/stream-line-card.tsx');
  assert.match(stream, /timeAskFromLine\(body\)[\s\S]*?<ScheduleTimeAskCard /, 'the stream does not draw the time-change ask');

  const card = read('app/_components/chat/cards/schedule-time-ask-card.tsx');
  assert.match(card, /resolveScheduleSuggestion\(fd\)/, 'the hosts’ Accept is not the Requests sheet’s door');
  assert.match(card, /suggestScheduleChange\(fd\)/, 'the supplier’s answer is not the Schedule’s door');
  assert.match(card, /fd\.set\('request', 'take_back'\)/);
  assert.match(card, /fd\.set\('request', 'answer'\)/);
  assert.match(card, /findTimeAsk\(/, 'the card guesses its request');
  assert.doesNotMatch(card, /\.from\('event_schedule_(suggestions|blocks)'\)\s*\.(insert|update|delete|upsert)\(/, 'the card writes the schedule itself');
  assert.doesNotMatch(card, /router\.(push|replace|refresh)\(|redirect\(/, 'an answer resets the screen');
});

test('5 · the v3 card: "· 18 Dec · 30 min", the note and the reason; a No says why, in the chat', () => {
  assert.deepEqual(timeAskFacts({ proposed_start_at: T('15:00'), proposed_end_at: T('15:30'), note: '  The band needs the stage. ', answer_note: null }), {
    day: '18 Dec',
    minutes: 30,
    note: 'The band needs the stage.',
    reason: null,
  });
  // A request with no end (a new moment) has no minutes — never "0 min"; a blank reason is none.
  assert.deepEqual(timeAskFacts({ proposed_start_at: T('15:00'), proposed_end_at: null, note: '', answer_note: '   ' }), { day: '18 Dec', minutes: null, note: null, reason: null });

  assert.equal(
    timeAskDeclinedLine({ label: 'Ingress & setup', fromIso: T('13:00'), reason: 'The venue opens the hall at 1:00 PM.' }),
    'Ingress & setup stays 1:00 PM · The venue opens the hall at 1:00 PM.',
  );
  assert.equal(timeAskDeclinedLine({ label: 'Haze test', add: true, fromIso: null, reason: 'No haze in the garden' }), 'Haze test isn’t added · No haze in the garden');
  // A Time-TBA moment's placeholder midnight is never said as a time (the caller passes null for it).
  assert.equal(timeAskDeclinedLine({ label: 'Sparklers', fromIso: null, reason: 'Later' }), 'Sparklers stays as it is · Later');
  assert.equal(timeAskDeclinedLine({ label: 'Sparklers', fromIso: T('20:00'), reason: '  ' }), null, 'a No with no reason posted a line');

  // Both No doors post it, after the answer is written, and only with a reason.
  const server = read('lib/schedule-ask.server.ts');
  assert.match(server, /if \(r === 'done' && why\) await postDeclinedLine\(/, 'the supplier\'s No does not say why in the chat');
  const poster = server.slice(server.indexOf('export async function postDeclinedLine'));
  assert.match(poster, /select\('label, start_at, time_tba'\)[\s\S]{0,400}time_tba === true \? null/, 'a Time-TBA moment would be said as 12:00 AM');
  assert.match(read('app/dashboard/[eventId]/schedule/actions.ts'), /if \(why\) await postDeclinedLine\(\{ eventId, suggestionId, reason: why \}\)/, 'the hosts\' No does not say why in the chat');
  // The card asks for the reason before a No is sent, on both doors.
  const card = read('app/_components/chat/cards/schedule-time-ask-card.tsx');
  assert.match(card, /if \(what === 'no' && !why\)/, 'Decline sends without a reason');
  assert.equal((card.match(/if \(why\) fd\.set\('reason', why\)/g) ?? []).length, 2, 'a door drops the reason');
});
