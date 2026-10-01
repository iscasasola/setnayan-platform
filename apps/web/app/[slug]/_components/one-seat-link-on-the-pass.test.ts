/**
 * ONE SEAT LINK ON THE PASS (owner 2026-09-21: "custom QR is free").
 *
 * The pass card carried "Find my table" AND "Your seat pass" — two free doors
 * to one question. The seat pass is the one. And because the custom QR is
 * free, ownership alone says yes for every event, including kinds whose /seat
 * page is notFound(): the link must also ask whether the kind seats people and
 * whether seating is published.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const body = stripComments(readFileSync(join(__dirname, 'site-body.tsx'), 'utf8'));
const loaders = stripComments(readFileSync(join(__dirname, '..', '_lib', 'loaders.ts'), 'utf8'));

// 🎫 2026-09-30: the pass LEFT HOME and became the Digital ticket on Me
// (owner: "i thought this will be the digital ticket" · "the ticket belongs on
// the guest's Me page only"). Its "Find my seat" button went with the old
// block; Me already carries the ONE seat door, `SeatDoorLine` (→ /find-seat),
// mounted right under the ticket. So the property is unchanged — one free seat
// door beside the pass, never two, never the paid hop — it is just measured
// where the pass now lives.
const page = stripComments(readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8'));
const ticket = stripComments(readFileSync(join(__dirname, 'guest-ticket.tsx'), 'utf8'));
const seatLine = stripComments(readFileSync(join(__dirname, 'seat-door-line.tsx'), 'utf8'));

test('the pass (the ticket on Me) sits beside exactly one seat door, to the free seat page', () => {
  const me = page.slice(page.indexOf('const meSlot'), page.indexOf('<GuestMe', page.indexOf('const meSlot')));
  assert.ok(me.includes('<GuestTicket'), 'precondition: the ticket is on Me');
  assert.equal(me.split('<SeatDoorLine').length - 1, 1, 'Me has one seat door');
  assert.match(me, /seatPassActive \? \(\s*<SeatDoorLine/, 'the seat door asks whether there is a seat to show');
  // The ticket itself carries no second seat door, and no paid hop.
  assert.doesNotMatch(ticket, /find-seat|find-my-table|\/seat\/claim/, 'a second seat door on the ticket');
  assert.equal((seatLine.match(/\/find-seat`/g) ?? []).length, 1, 'the seat door goes to the free seat page');
  assert.doesNotMatch(seatLine, /\/seat\/claim\?t=/, 'the seat door sends guests through the paid pass hop');
  // Home's old pass block (and its "Find my seat" button) is not back.
  assert.doesNotMatch(body, /Find my seat/, 'the old pass block’s seat button is back on Home');
});

test('the link asks the destination’s own questions, not just ownership', () => {
  const at = loaders.indexOf('const seatPassActive');
  assert.ok(at > 0, 'precondition: seatPassActive is computed');
  const expr = loaders.slice(at, loaders.indexOf(';', at));
  assert.match(expr, /seatingSurfaceEnabled/, 'a trip or a dinner has no seat page');
  assert.match(expr, /seatingPublished/, 'an unpublished plan has no seat to show');
});
