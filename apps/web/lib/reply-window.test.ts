/**
 * 📬 THE REPLY WINDOW — every pick, every stage, the venue's clock and the minutes at each edge
 * (owner 2026-10-14, DECISION_LOG 📬 "RSVP GETS ITS OWN OPEN AND CLOSE"). See lib/reply-window.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readRepliesWindow,
  replyDayLabel,
  replyRefusedWords,
  replyWindow,
  replyWindowWords,
  type ReplyFace,
  type ReplyWindowEvent,
} from './reply-window';
import { REPLIES_CLOSE, REPLIES_OPEN, sanitizeRsvpAskConfig } from './rsvp-ask';

const MNL = 'Asia/Manila';
const WEDDING: ReplyFace = { phasesEnabled: true, solemn: false };
const at = (iso: string) => Date.parse(iso);

/** A wedding on Sat 12 June 2027; the Invitation opens 90 days out = Sun 14 March 2027. */
const ev = (cfg: Record<string, unknown> = {}, more: Partial<ReplyWindowEvent> = {}): ReplyWindowEvent => ({
  event_date: '2027-06-12',
  event_end_date: null,
  launch_mode: null,
  manual_phase: null,
  std_invitation_launch_date: null,
  guest_list_edit_deadline: '2027-05-15',
  rsvp_ask_config: cfg,
  ...more,
});

const STD = at('2027-02-01T12:00:00+08:00'); // the Save the Date stage
const INV = at('2027-04-01T12:00:00+08:00'); // the Invitation stage
const DAY = at('2027-06-12T15:00:00+08:00'); // The Day
const AFTER = at('2027-07-01T12:00:00+08:00'); // the story

test('the defaults are today’s behaviour: open exactly while the page is the Invitation', () => {
  assert.equal(replyWindow(ev(), STD, MNL, WEDDING).state, 'not_yet');
  assert.equal(replyWindow(ev(), STD, MNL, WEDDING).opensOn, '2027-03-14', 'the Invitation’s own day');
  assert.equal(replyWindow(ev(), INV, MNL, WEDDING).state, 'open');
  assert.deepEqual(replyWindow(ev(), DAY, MNL, WEDDING), { state: 'closed', reason: 'the_day', opensOn: null, closesOn: null });
  assert.equal(replyWindow(ev(), AFTER, MNL, WEDDING).state, 'closed');
  // An absent config, {}, null and junk all read as the defaults.
  for (const raw of [null, undefined, {}, 'x', { repliesOpen: 'soon', repliesClose: 7 }]) {
    assert.equal(replyWindow(ev(raw as Record<string, unknown>), INV, MNL, WEDDING).state, 'open');
  }
});

test('every pick × every stage — rule 5: replies never open without the Invitation', () => {
  const stages = { STD, INV, DAY, AFTER } as const;
  const seen: string[] = [];
  for (const open of REPLIES_OPEN) {
    for (const close of REPLIES_CLOSE) {
      for (const [name, now] of Object.entries(stages)) {
        const cfg = { repliesOpen: open, repliesOpenOn: '2027-04-10', repliesClose: close, repliesCloseOn: '2027-05-30' };
        const w = replyWindow(ev(cfg), now, MNL, WEDDING);
        seen.push(`${open}/${close}/${name}=${w.state}`);
        if (name !== 'INV') assert.notEqual(w.state, 'open', `${open}/${close} opened outside the Invitation (${name})`);
        if (open === 'closed') assert.equal(w.state, 'closed', 'Closed is closed, whatever the dates');
        if (name === 'DAY' || name === 'AFTER') assert.equal(w.state, 'closed', 'The Day closes replies');
        if (name === 'STD' && open !== 'closed') assert.equal(w.state, 'not_yet');
      }
    }
  }
  assert.equal(seen.length, REPLIES_OPEN.length * REPLIES_CLOSE.length * 4);
  // In the Invitation (1 April): on_date waits for 10 April; with_invitation / now are open.
  assert.equal(replyWindow(ev({ repliesOpen: 'on_date', repliesOpenOn: '2027-04-10' }), INV, MNL, WEDDING).state, 'not_yet');
  assert.equal(replyWindow(ev({ repliesOpen: 'on_date', repliesOpenOn: '2027-04-10' }), INV, MNL, WEDDING).opensOn, '2027-04-10');
  assert.equal(replyWindow(ev({ repliesOpen: 'now' }), INV, MNL, WEDDING).reason, 'open_now');
});

test('“On a date…” opens at the venue’s midnight — one minute either side', () => {
  const cfg = { repliesOpen: 'on_date', repliesOpenOn: '2027-04-10' };
  assert.equal(replyWindow(ev(cfg), at('2027-04-09T23:59:00+08:00'), MNL, WEDDING).state, 'not_yet');
  assert.equal(replyWindow(ev(cfg), at('2027-04-10T00:00:00+08:00'), MNL, WEDDING).state, 'open');
  // 15:59 UTC on 9 April is 23:59 in Manila — still shut; 16:00 UTC is Manila's midnight — open.
  assert.equal(replyWindow(ev(cfg), at('2027-04-09T15:59:00Z'), MNL, WEDDING).state, 'not_yet', 'the server’s clock must not open it');
  assert.equal(replyWindow(ev(cfg), at('2027-04-09T16:00:00Z'), MNL, WEDDING).state, 'open');
  // A venue in another zone counts its own midnight.
  assert.equal(replyWindow(ev(cfg), at('2027-04-10T00:00:00+08:00'), 'America/Los_Angeles', WEDDING).state, 'not_yet', 'still 9 April in Los Angeles');
});

test('a close date takes replies through its whole last day — one minute either side', () => {
  for (const cfg of [{ repliesClose: 'reply_by' }, { repliesClose: 'on_date', repliesCloseOn: '2027-05-15' }]) {
    assert.equal(replyWindow(ev(cfg), at('2027-05-15T23:59:00+08:00'), MNL, WEDDING).state, 'open', JSON.stringify(cfg));
    const w = replyWindow(ev(cfg), at('2027-05-16T00:00:00+08:00'), MNL, WEDDING);
    assert.deepEqual({ state: w.state, reason: w.reason, closesOn: w.closesOn }, { state: 'closed', reason: 'close_date_passed', closesOn: '2027-05-15' });
    assert.equal(replyWindow(ev(cfg), at('2027-05-15T15:59:00Z'), MNL, WEDDING).state, 'open');
    assert.equal(replyWindow(ev(cfg), at('2027-05-15T16:00:00Z'), MNL, WEDDING).state, 'closed', 'Manila’s midnight, 16:00 UTC');
  }
  // "On the reply-by date" with no reply-by date set reads as On the day.
  const noDeadline = ev({ repliesClose: 'reply_by' }, { guest_list_edit_deadline: null });
  assert.equal(replyWindow(noDeadline, at('2027-06-01T12:00:00+08:00'), MNL, WEDDING).state, 'open');
  // "On a date…" with no date yet reads as the default too.
  assert.equal(replyWindow(ev({ repliesClose: 'on_date' }), at('2027-06-01T12:00:00+08:00'), MNL, WEDDING).state, 'open');
  assert.equal(replyWindow(ev({ repliesOpen: 'on_date' }), INV, MNL, WEDDING).state, 'open');
});

test('“Now” overrides the dates (re-opens after a close) but never the Invitation; “Closed” overrides everything', () => {
  const late = at('2027-05-20T12:00:00+08:00'); // after the reply-by date
  assert.equal(replyWindow(ev({ repliesClose: 'reply_by' }), late, MNL, WEDDING).state, 'closed');
  assert.equal(replyWindow(ev({ repliesOpen: 'now', repliesClose: 'reply_by' }), late, MNL, WEDDING).state, 'open');
  assert.equal(replyWindow(ev({ repliesOpen: 'now', repliesOpenOn: '2027-05-30' }), late, MNL, WEDDING).state, 'open');
  assert.equal(replyWindow(ev({ repliesOpen: 'now' }), STD, MNL, WEDDING).state, 'not_yet');
  assert.equal(replyWindow(ev({ repliesOpen: 'now' }), DAY, MNL, WEDDING).state, 'closed');
  assert.equal(replyWindow(ev({ repliesOpen: 'closed' }), INV, MNL, WEDDING).reason, 'closed_by_couple');
});

test('the Invitation’s day comes from the couple’s launch date, else 90 days — and an open date never beats it', () => {
  const own = ev({}, { std_invitation_launch_date: '2027-05-01' });
  assert.equal(replyWindow(own, INV, MNL, WEDDING).state, 'not_yet', '1 April is before the couple’s 1 May');
  assert.equal(replyWindow(own, INV, MNL, WEDDING).opensOn, '2027-05-01');
  assert.equal(replyWindow(own, at('2027-05-01T00:00:00+08:00'), MNL, WEDDING).state, 'open');
  // An open date EARLIER than the Invitation waits for the Invitation; a LATER one is its own.
  assert.equal(replyWindow(ev({ repliesOpen: 'on_date', repliesOpenOn: '2027-01-01' }), STD, MNL, WEDDING).opensOn, '2027-03-14');
  assert.equal(replyWindow(ev({ repliesOpen: 'on_date', repliesOpenOn: '2027-04-10' }), STD, MNL, WEDDING).opensOn, '2027-04-10');
});

test('the couple’s pin wins, and a type with no Save the Date face is always the Invitation before the day', () => {
  assert.equal(replyWindow(ev({}, { launch_mode: 'manual', manual_phase: 'rsvp' }), STD, MNL, WEDDING).state, 'open');
  const pinnedStd = replyWindow(ev({}, { launch_mode: 'manual', manual_phase: 'save_the_date' }), INV, MNL, WEDDING);
  assert.deepEqual({ state: pinnedStd.state, opensOn: pinnedStd.opensOn }, { state: 'not_yet', opensOn: null }, 'pinned: no date to promise');
  assert.equal(replyWindow(ev({}, { launch_mode: 'manual', manual_phase: 'event' }), INV, MNL, WEDDING).state, 'closed');
  // A solemn event has no Save the Date: open far out.
  assert.equal(replyWindow(ev(), STD, MNL, { phasesEnabled: true, solemn: true }).state, 'open');
  // The lifecycle engine off: the page is the invitation — open far out, a pin is not read, closed on the day.
  const off: ReplyFace = { phasesEnabled: false, solemn: false };
  assert.equal(replyWindow(ev(), STD, MNL, off).state, 'open');
  assert.equal(replyWindow(ev({}, { launch_mode: 'manual', manual_phase: 'save_the_date' }), INV, MNL, off).state, 'open');
  assert.equal(replyWindow(ev(), DAY, MNL, off).state, 'closed');
  // No date at all: the Save the Date face, no day to name.
  const noDate = replyWindow(ev({}, { event_date: null, guest_list_edit_deadline: null }), INV, MNL, WEDDING);
  assert.deepEqual({ state: noDate.state, opensOn: noDate.opensOn }, { state: 'not_yet', opensOn: null });
});

test('the words — approved, and what a refusal says', () => {
  assert.equal(replyDayLabel('2026-11-14'), 'Saturday, 14 November');
  assert.equal(replyDayLabel('nope'), null);
  const notYet = replyWindow(ev({ repliesOpen: 'on_date', repliesOpenOn: '2027-04-10' }), INV, MNL, WEDDING);
  assert.deepEqual(replyWindowWords(notYet), { line: 'Replies open on Saturday, 10 April', sub: null });
  const closed = replyWindow(ev({ repliesOpen: 'closed' }), INV, MNL, WEDDING);
  assert.deepEqual(replyWindowWords(closed), { line: 'Replies are closed.', sub: 'Need to change? Message the couple.' });
  assert.equal(replyWindowWords(replyWindow(ev(), INV, MNL, WEDDING)), null);
  assert.equal(replyRefusedWords(closed), 'Your reply was not sent. Replies are closed. Need to change? Message the couple.');
  assert.equal(replyRefusedWords(notYet), 'Your reply was not sent. Replies open on Saturday, 10 April.');
  assert.equal(replyWindowWords(closed, 'the family')?.sub, 'Need to change? Message the family.');
});

test('the four keys survive the sanitizer only in their own shape', () => {
  const cfg = sanitizeRsvpAskConfig({ repliesOpen: 'on_date', repliesOpenOn: '2027-04-10', repliesClose: 'on_date', repliesCloseOn: '2027-02-30', meal: false });
  assert.deepEqual(cfg, { repliesOpen: 'on_date', repliesOpenOn: '2027-04-10', repliesClose: 'on_date', meal: false }, 'a day that does not exist is dropped');
  assert.deepEqual(readRepliesWindow(null), { open: 'with_invitation', openOn: null, close: 'on_the_day', closeOn: null });
  assert.deepEqual(sanitizeRsvpAskConfig({ repliesOpen: 'later', repliesOpenOn: '10 April' }), {});
});
