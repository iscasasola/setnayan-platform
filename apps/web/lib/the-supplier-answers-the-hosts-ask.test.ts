/**
 * 🗓 THE SUPPLIER ANSWERS THE HOST'S ASK — and a Yes moves the moment (owner 2026-11-02, DECISION_LOG "A SUPPLIER'S
 * SCHEDULE BASICS FOR THIS WEEK" item 2; supplier gate audit D2; migration 20271303655108).
 *
 * The database half (who may ask, who may answer, a stranger refused) is
 * `tests/db/the-host-asks-a-supplier-to-change-their-times.db.test.ts`. This holds the app half:
 *
 *   1. ONLY THE OTHER SIDE ANSWERS — `sideMayDecide`: the host never approves their own ask, a supplier never its own
 *      request — and the ONE accept path asks it before it writes anything.
 *   2. ACCEPT APPLIES IT — a host's ask carries a new time; the accept path's patch (`proposedPatch`) moves the moment's
 *      start and end, and the accept path writes exactly that patch.
 *   3. THE ANSWER DOOR IS GATED BY THE DATABASE — the supplier's answer asks `may_answer_schedule_ask` before the
 *      accept path runs with the service role, as the supplier.
 *   4. THE ASK REACHES THE SUPPLIER'S DAY — one read, split by direction: what was asked of them lands in "Asked of
 *      you" and NEVER in their own "waiting for the host" list (and the host's queue never shows their own asks).
 *   5. IN-APP ONLY — neither notice is emailed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  askedOfYou,
  askStateWords,
  asksOnMoment,
  askNote,
  answerNote,
  askerWords,
  directionOf,
  proposedPatch,
  sideMayDecide,
} from '@/lib/schedule-ask';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The body of `function <name>(…) {…}`, brace-matched from the first `{` after the name. */
function body(src: string, name: string): string {
  const at = src.search(new RegExp(`function\\s+${name}\\s*[(<]`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  let i = src.indexOf(') {', at);
  const alt = src.indexOf('): Promise', at);
  if (alt >= 0 && alt < i) i = src.indexOf('{\n', alt);
  else i += 2;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`${name} never closes`);
}

// ─── 1 · only the other side answers ────────────────────────────────────────────

test('only the other side answers: a host never decides their own ask, a supplier never its own request', () => {
  assert.equal(sideMayDecide({ direction: 'to_supplier' }, 'supplier'), true);
  assert.equal(sideMayDecide({ direction: 'to_supplier' }, 'host'), false);
  assert.equal(sideMayDecide({ direction: 'to_host' }, 'host'), true);
  assert.equal(sideMayDecide({ direction: 'to_host' }, 'supplier'), false);
  // A row read before the column existed is a supplier's request.
  assert.equal(sideMayDecide({}, 'host'), true);
  assert.equal(directionOf({ direction: null }), 'to_host');
});

test('the ONE accept path asks which side may decide BEFORE it writes anything', () => {
  const fn = body(read('lib/schedule-suggestion-decide.server.ts'), 'decideSuggestion');
  const gate = fn.indexOf('sideMayDecide(');
  assert.ok(gate > 0, 'decideSuggestion no longer checks which side is answering');
  for (const write of ['.update(', '.insert(', '.delete(']) {
    const at = fn.indexOf(write);
    if (at >= 0) assert.ok(gate < at, `decideSuggestion writes (${write}) before it checks the side`);
  }
});

// ─── 2 · accept applies it ──────────────────────────────────────────────────────

test('a host’s ask, accepted, moves the moment to the new time', () => {
  const ask = {
    direction: 'to_supplier',
    kind: 'adjust',
    proposed_start_at: '2099-12-12T09:30:00.000Z',
    proposed_end_at: '2099-12-12T10:00:00.000Z',
    proposed_location: null,
    proposed_label: null,
  };
  assert.deepEqual(proposedPatch(ask), { start_at: '2099-12-12T09:30:00.000Z', end_at: '2099-12-12T10:00:00.000Z' });
});

test('the accept path writes exactly the proposed patch onto the moment', () => {
  const fn = body(read('lib/schedule-suggestion-decide.server.ts'), 'decideSuggestion');
  assert.match(fn, /const patch = proposedPatch\(suggestion\)/, 'the adjust branch no longer builds its patch from the proposal');
  assert.match(fn, /\.from\('event_schedule_blocks'\)\s*\.update\(patch\)/, 'the adjust branch no longer writes that patch');
});

// ─── 3 · the answer door ────────────────────────────────────────────────────────

test('the supplier’s answer asks the database first, then runs the accept path AS the supplier', () => {
  const fn = body(read('lib/schedule-ask.server.ts'), 'answerScheduleAsk');
  const gate = fn.indexOf("rpc('may_answer_schedule_ask'");
  const decide = fn.indexOf('decideSuggestion(');
  assert.ok(gate >= 0, 'answerScheduleAsk no longer asks may_answer_schedule_ask');
  assert.ok(decide > gate, 'the accept path runs before the database said this supplier may answer');
  assert.match(fn.slice(gate, decide), /may !== true\) return/, 'a No from the database must stop the answer');
  assert.match(fn.slice(decide), /as: 'supplier'/, 'the accept path must run as the supplier, or it refuses the ask as gone');
  const action = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  assert.match(action, /request === 'answer'[\s\S]{0,400}answerScheduleAsk\(/, 'the supplier’s Schedule has no door to answer');
});

test('the host asks from the moment sheet’s own door, on the caller’s client (the database decides who may)', () => {
  const action = read('app/dashboard/[eventId]/schedule/actions.ts');
  assert.match(action, /momentOp === 'ask_supplier'[\s\S]{0,120}askSupplierToChange\(supabase,/);
  const fn = body(read('lib/schedule-ask.server.ts'), 'askSupplierToChange');
  assert.match(fn, /await supabase\s*\.from\('event_schedule_suggestions'\)\s*\.insert\(/, 'the ask must be written by the caller, not the service role');
  assert.match(fn, /direction: 'to_supplier'/);
  // The sheet keys "each supplier's latest ask" on the SHOP — the door must hand it back, or a new ask shows beside the old one.
  assert.match(fn, /value: `\$\{[^`]*suggestion_id[^`]*\}:\$\{booking\.marketplace_vendor_id\}`/);
});

// ─── 4 · it reaches the supplier's day, and only there ──────────────────────────

test('what was asked of a supplier is theirs to answer, oldest first, open only', () => {
  const rows = [
    { suggestion_id: 'b', status: 'open', created_at: '2026-11-02T10:00:00Z' },
    { suggestion_id: 'a', status: 'open', created_at: '2026-11-02T09:00:00Z' },
    { suggestion_id: 'c', status: 'accepted', created_at: '2026-11-02T08:00:00Z' },
  ];
  assert.deepEqual(askedOfYou(rows).map((r) => r.suggestion_id), ['a', 'b']);
});

test('the supplier page splits its one read by direction — an ask never lands in their own requests', () => {
  const page = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /\.select\(\s*'[^']*\bdirection\b[^']*'/, 'the supplier’s read no longer selects direction');
  assert.match(page, /const suggestions = \w+\.filter\(\(r\) => directionOf\(r\) === 'to_host'\)/, 'their own requests include asks of them');
  assert.match(page, /askedOfYou\(\w+\.filter\(\(r\) => directionOf\(r\) === 'to_supplier'\)\)/, 'asks of them never reach their day');
  assert.match(page, /asked: askedOfThem/, 'the asks are not handed to the Schedule view');
});

test('the host’s queue and Home’s count are a supplier’s requests only', () => {
  for (const f of ['app/dashboard/[eventId]/schedule/page.tsx', 'lib/home-schedule.server.ts']) {
    const src = read(f);
    assert.match(src, /\.eq\('status', 'open'\)\s*\.eq\('direction', 'to_host'\)/, `${f}: the hosts’ own asks would read as requests to approve`);
  }
});

test('the moment sheet shows each supplier’s latest ask once, and what they answered', () => {
  const asks = [
    { block_id: 'm', vendor_profile_id: 'v1', created_at: '2026-11-01T00:00:00Z', status: 'declined', answer_note: 'Busy' },
    { block_id: 'm', vendor_profile_id: 'v1', created_at: '2026-11-02T00:00:00Z', status: 'open', answer_note: null },
    { block_id: 'm', vendor_profile_id: 'v2', created_at: '2026-11-01T00:00:00Z', status: 'declined', answer_note: 'Another event until 3 PM' },
    { block_id: 'x', vendor_profile_id: 'v1', created_at: '2026-11-03T00:00:00Z', status: 'open', answer_note: null },
  ];
  const on = asksOnMoment(asks, 'm');
  assert.deepEqual(on.map((a) => `${a.vendor_profile_id}:${a.status}`), ['v1:open', 'v2:declined']);
  assert.equal(askStateWords(on[0]!, 'Glow'), 'Waiting for Glow.');
  assert.equal(askStateWords(on[1]!, 'Lightbox'), 'Lightbox said no: “Another event until 3 PM”');
  assert.equal(askStateWords({ status: 'accepted', answer_note: null }, 'Glow'), 'Glow said yes — the moment moved.');
});

test('a coordinator asks AS the coordinator; words never empty', () => {
  assert.equal(askerWords({ suggested_by_name: 'Ana', asked_as: 'coordinator' }), 'Ana (coordinator)');
  assert.equal(askerWords({ suggested_by_name: null, asked_as: 'host' }), 'The host');
  assert.equal(askNote('   ', '9:30 AM'), 'Could you change your time to 9:30 AM?');
  assert.equal(answerNote('  '), null);
  assert.equal(answerNote('x'.repeat(900))?.length, 500);
});

// ─── 5 · in-app only ────────────────────────────────────────────────────────────

test('neither notice is emailed', () => {
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('EMAIL_ENABLED_TYPES'), emit.indexOf('MARKETING_GATED_EMAIL_TYPES'));
  for (const t of ['schedule_ask', 'schedule_ask_answered']) {
    assert.doesNotMatch(allow, new RegExp(`'${t}'`), `${t} is on the email allowlist`);
  }
  assert.match(read('lib/schedule-ask.server.ts'), /type: 'schedule_ask'/);
  assert.match(read('lib/schedule-suggestion-decide.server.ts'), /type: 'schedule_ask_answered'/);
});
