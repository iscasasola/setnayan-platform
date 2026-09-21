/**
 * THE PASS IS A PASS — last slice of the arrival design (owner-approved
 * canvas, 2026-09-20). A code in a box is not a pass: somebody at the door
 * asks who this is and where they sit.
 *
 * The failure this guards is not a crash. It is a pass that states a fact
 * nobody entered — "Table TBA", an arrival time invented from nothing, a
 * companion who was allowed but never named. A guest believes a pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guestPassFacts, hasPassFacts } from './guest-pass';
import { stripComments } from './strip-comments';

const labels = (f: { label: string }[]) => f.map((x) => x.label);

test('the four facts a door needs, in the order a door reads them', () => {
  const facts = guestPassFacts({
    displayName: 'Indalecio Casasola',
    tableLabel: 'Table 7',
    arriveLabel: '1:30 PM',
    plusOneName: 'Claire',
  });
  assert.deepEqual(labels(facts), ['Guest', 'Table', 'Arrive', 'Bringing']);
  assert.equal(facts[0]?.value, 'Indalecio Casasola');
  assert.equal(facts[1]?.value, 'Table 7');
});

test('🔑 A FACT THAT DOES NOT EXIST IS OMITTED, never filled in', () => {
  const facts = guestPassFacts({ displayName: 'Maria Santos' });
  assert.deepEqual(labels(facts), ['Guest'], 'no table, no time, no companion — and no placeholders');
  for (const f of facts) {
    assert.doesNotMatch(f.value, /TBA|TBD|pending|unassigned|—/i, `${f.label} invented a value`);
  }
  // Each absent fact drops its own row, not the whole card.
  assert.deepEqual(labels(guestPassFacts({ displayName: 'A', tableLabel: 'Table 2' })), ['Guest', 'Table']);
  assert.deepEqual(labels(guestPassFacts({ displayName: 'A', arriveLabel: '2:00 PM' })), ['Guest', 'Arrive']);
});

test('a pass with no name is not a pass', () => {
  assert.deepEqual(guestPassFacts({ displayName: null, tableLabel: 'Table 7' }), []);
  assert.deepEqual(guestPassFacts({ displayName: '   ' }), []);
  assert.equal(hasPassFacts({ displayName: null }), false);
  assert.equal(hasPassFacts({ displayName: 'Maria' }), true);
});

test('blank-ish values are treated as absent, and long ones cannot overflow the card', () => {
  assert.deepEqual(labels(guestPassFacts({ displayName: 'A', tableLabel: '   ' })), ['Guest']);
  const long = guestPassFacts({ displayName: 'x'.repeat(200) })[0]!;
  assert.ok(long.value.length <= 48, `a name is bounded (${long.value.length})`);
  assert.equal(guestPassFacts({ displayName: '  Maria   Santos  ' })[0]?.value, 'Maria Santos');
});

test('PERMISSION IS NOT A PERSON — the card asks for both', () => {
  // `plus_one_allowed` means the couple said yes to a companion; it does not
  // mean one exists. The page must pass a NAME, and only when allowed.
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'site-body.tsx'), 'utf8');
  const call = src.slice(src.indexOf('guestPassFacts({'));
  const head = call.slice(0, call.indexOf('});') + 3);
  assert.match(head, /plusOneName: guest\.plus_one_allowed \? guest\.plus_one_name : null/);
  // And the resolver itself never reads a boolean. Comments are stripped with
  // the ONE shared stripper first: this file's own docblock EXPLAINS
  // `plus_one_allowed`, and prose about a construct is not the construct — the
  // trap that has produced both a false pass and a false failure in this repo.
  const lib = stripComments(readFileSync(join(__dirname, 'guest-pass.ts'), 'utf8'));
  assert.doesNotMatch(lib, /plus_one_allowed/, 'the decision takes a name, not a permission');
});

test('ARRIVE is the FIRST block of the day, not the next one', () => {
  // A pass in a pocket at 9pm must not tell a guest to arrive at the send-off.
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'site-body.tsx'), 'utf8');
  const block = src.slice(src.indexOf('const firstScheduleBlock'), src.indexOf('const passFacts'));
  assert.match(block, /scheduleBlocks\[0\]/, 'the first block');
  assert.doesNotMatch(block, /nextScheduleBlock/, 'never the next one');
  assert.match(block, /timeZone: 'Asia\/Manila'/, 'formatted in the event’s own day, not the server’s');
});

test('the facts render on the pass card, at the anchor the action links to', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'site-body.tsx'), 'utf8');
  const card = src.slice(src.indexOf('const passCard'));
  const cardEnd = card.indexOf('const ', 40);
  const body = card.slice(0, cardEnd > 0 ? cardEnd : card.length);
  assert.match(body, /id=\{PASS_ANCHOR\}/, 'the anchor "Show your pass" points at');
  assert.match(body, /passFacts\.map/, 'and the facts are drawn inside that card');
});
