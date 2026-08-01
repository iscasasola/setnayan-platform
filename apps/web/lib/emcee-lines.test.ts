/**
 * MY LINES — the locked rules, held down.
 *
 * Spec: `Emcee_Script_Layer_LOCKED_BUILD_SPEC_2026-08-01.md`. Three of these
 * protect a person rather than a property, and are the reason this module is
 * pure at all:
 *
 *   · A REPEATED block type NEVER auto-fills. Rung 3 exists for singleton
 *     framing moments; without this guard every `program` block on the timeline
 *     gets the same line, which puts the WRONG words in a host's mouth while
 *     looking helpful.
 *   · A PRIVATE moment never pre-fills, and a private line is never reusable.
 *     "Watch for Grace by the sound booth" is last wedding's coordinator.
 *   · A stored line never carries a real name. `toTemplate` is the mechanical
 *     half of that promise, because save is automatic and cannot rely on the
 *     host remembering to anonymize.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  labelKey,
  singletonBlockTypes,
  matchLines,
  fillSlots,
  slotsIn,
  toTemplate,
  type SavedLine,
} from './emcee-lines';
import type { ScriptBlock } from './emcee-script-layer';

function block(over: Partial<ScriptBlock> & { block_id: string }): ScriptBlock {
  return {
    label: `Block ${over.block_id}`,
    block_type: 'program' as ScriptBlock['block_type'],
    start_at: '2026-12-12T10:00:00Z',
    end_at: null,
    notes: null,
    is_public: true,
    sort_order: 0,
    parent_block_id: null,
    ...over,
  };
}

function line(over: Partial<SavedLine> & { line_id: string }): SavedLine {
  return {
    activity_id: null,
    label_key: null,
    block_type: null,
    body: 'Ladies and gentlemen…',
    is_private_note: false,
    ...over,
  };
}

const matchOn = (b: ScriptBlock[], l: SavedLine[], m?: Map<string, string | null>) =>
  matchLines({ blocks: b, lines: l, activityByBlock: m });

// ── labelKey ────────────────────────────────────────────────────────────────

test('labelKey collapses the variation couples actually produce', () => {
  const same = ['Money Dance', 'money-dance', 'Money  Dance!', '  MONEY DANCE  '];
  const keys = new Set(same.map((s) => labelKey(s)));
  assert.equal(keys.size, 1, 'all spellings must reduce to one key');
  assert.equal(labelKey('Money Dance'), 'money dance');
});

test('labelKey returns null for nothing meaningful', () => {
  for (const v of ['', '   ', '!!!', null, undefined]) {
    assert.equal(labelKey(v as string | null), null, `${JSON.stringify(v)} is not a key`);
  }
});

// ── the singleton guard — the heart of rung 3 ──────────────────────────────

test('singletonBlockTypes counts THIS timeline, not a constant', () => {
  const s = singletonBlockTypes([
    block({ block_id: 'a', block_type: 'dinner' as ScriptBlock['block_type'] }),
    block({ block_id: 'b', block_type: 'program' as ScriptBlock['block_type'] }),
    block({ block_id: 'c', block_type: 'program' as ScriptBlock['block_type'] }),
  ]);
  assert.ok(s.has('dinner'), 'dinner occurs once — a framing moment');
  assert.ok(!s.has('program'), 'program occurs twice — NOT a framing moment');
});

test('🔴 a REPEATED block type never auto-fills — the whole point of the ladder', () => {
  const blocks = [
    block({ block_id: 'p1', label: 'Grand Entrance', block_type: 'program' as ScriptBlock['block_type'] }),
    block({ block_id: 'p2', label: 'Money Dance', block_type: 'program' as ScriptBlock['block_type'] }),
    block({ block_id: 'p3', label: 'Toasts', block_type: 'program' as ScriptBlock['block_type'] }),
  ];
  const lines = [line({ line_id: 'L', block_type: 'program', body: 'Kick off the program!' })];
  assert.deepEqual(matchOn(blocks, lines), [], 'three program blocks must get ZERO day-part fills');
});

test('a SINGLETON type does fill on rung 3', () => {
  const blocks = [
    block({ block_id: 'd', label: 'Dinner', block_type: 'dinner' as ScriptBlock['block_type'] }),
    block({ block_id: 'p', label: 'Toasts', block_type: 'program' as ScriptBlock['block_type'] }),
  ];
  const lines = [line({ line_id: 'L', block_type: 'dinner', body: 'Dinner is served!' })];
  const got = matchOn(blocks, lines);
  assert.equal(got.length, 1);
  assert.equal(got[0]?.blockId, 'd');
  assert.equal(got[0]?.rung, 'day_part');
  assert.equal(got[0]?.trusted, false, 'day-part is a guess and must not read as trusted');
});

// ── rung precedence ────────────────────────────────────────────────────────

test('exact beats by-name beats day-part, and only exact is trusted', () => {
  const b = block({ block_id: 'x', label: 'Money Dance', block_type: 'dinner' as ScriptBlock['block_type'] });
  const all = [
    line({ line_id: 'A', activity_id: 'act-1', body: 'from his segment' }),
    line({ line_id: 'B', label_key: 'money dance', body: 'by name' }),
    line({ line_id: 'C', block_type: 'dinner', body: 'day part' }),
  ];
  const bridge = new Map<string, string | null>([['x', 'act-1']]);

  const exact = matchOn([b], all, bridge)[0];
  assert.equal(exact?.line.line_id, 'A');
  assert.equal(exact?.rung, 'exact');
  assert.equal(exact?.trusted, true);

  // Without the bridge, rung 2 answers — and must NOT be trusted.
  const byName = matchOn([b], all)[0];
  assert.equal(byName?.line.line_id, 'B');
  assert.equal(byName?.rung, 'by_name');
  assert.equal(byName?.trusted, false, 'two weddings can use one word for two things');

  // With neither, rung 3.
  const dayPart = matchOn([b], [all[2] as SavedLine])[0];
  assert.equal(dayPart?.rung, 'day_part');
});

test('an unmatched moment yields NO entry — "nothing fits yet" is a real answer', () => {
  const blocks = [block({ block_id: 'w', label: 'Wine & letters ceremony', block_type: 'other' as ScriptBlock['block_type'] })];
  assert.deepEqual(matchOn(blocks, [line({ line_id: 'L', label_key: 'money dance' })]), []);
});

test('an unknown block_type falls through the ladder rather than throwing', () => {
  const blocks = [block({ block_id: 'u', label: 'Something new', block_type: 'not_a_real_type' as ScriptBlock['block_type'] })];
  assert.doesNotThrow(() => matchOn(blocks, [line({ line_id: 'L', block_type: 'not_a_real_type' })]));
});

// ── the two person-protecting rules ────────────────────────────────────────

test('🔴 a PRIVATE moment never pre-fills, on any rung', () => {
  const priv = block({ block_id: 'p', label: 'Stage reset', block_type: 'dinner' as ScriptBlock['block_type'], is_public: false });
  const lines = [
    line({ line_id: 'A', activity_id: 'act-9', body: 'exact' }),
    line({ line_id: 'B', label_key: 'stage reset', body: 'by name' }),
    line({ line_id: 'C', block_type: 'dinner', body: 'day part' }),
  ];
  const bridge = new Map<string, string | null>([['p', 'act-9']]);
  assert.deepEqual(matchOn([priv], lines, bridge), [], 'no rung may route around privacy');
});

test('publicFacing fails toward silence — anything not strictly true is private', () => {
  for (const loose of [undefined, null, 0, 1, 'true', {}]) {
    const b = block({ block_id: 'x', label: 'Dinner', block_type: 'dinner' as ScriptBlock['block_type'], is_public: loose as unknown as boolean });
    assert.deepEqual(
      matchOn([b], [line({ line_id: 'L', block_type: 'dinner' })]),
      [],
      `is_public=${JSON.stringify(loose)} must be treated as private`,
    );
  }
});

test('🔴 a line authored on a private moment is never reusable', () => {
  const b = block({ block_id: 'd', label: 'Dinner', block_type: 'dinner' as ScriptBlock['block_type'] });
  const priv = line({ line_id: 'P', block_type: 'dinner', body: 'Watch for Grace by the sound booth', is_private_note: true });
  assert.deepEqual(matchOn([b], [priv]), [], 'last wedding’s coordinator must not reach this one');
});

test('an empty or whitespace-only stored line is not a candidate', () => {
  const b = block({ block_id: 'd', label: 'Dinner', block_type: 'dinner' as ScriptBlock['block_type'] });
  assert.deepEqual(matchOn([b], [line({ line_id: 'L', block_type: 'dinner', body: '   ' })]), []);
});

// ── slots ──────────────────────────────────────────────────────────────────

test('fillSlots substitutes what it can and LEAVES the rest visible', () => {
  const got = fillSlots(
    'Please welcome ⟨the couple⟩ — ⟨how they’re announced⟩!',
    { 'the couple': 'Bea & Marco' },
  );
  assert.ok(got.text.includes('Bea & Marco'));
  assert.ok(
    got.text.includes('⟨how they’re announced⟩'),
    'an unresolved slot stays visible — a warned host beats an ambushed one',
  );
  assert.deepEqual(got.unfilled, ['how they’re announced']);
});

test('a blank or whitespace slot value counts as unfilled', () => {
  const got = fillSlots('Hi ⟨the couple⟩', { 'the couple': '   ' });
  assert.deepEqual(got.unfilled, ['the couple']);
  assert.ok(got.text.includes('⟨the couple⟩'));
});

test('a fully filled line reports nothing outstanding', () => {
  const got = fillSlots('Hi ⟨the couple⟩ on ⟨the date⟩', { 'the couple': 'Bea & Marco', 'the date': 'December 12' });
  assert.deepEqual(got.unfilled, []);
  assert.equal(got.text, 'Hi Bea & Marco on December 12');
});

test('slotsIn lists each slot once, in first-appearance order', () => {
  assert.deepEqual(slotsIn('⟨the date⟩ — ⟨the couple⟩ and again ⟨the couple⟩'), ['the date', 'the couple']);
  assert.deepEqual(slotsIn('no slots here'), []);
});

// ── toTemplate — the privacy promise, made mechanical ──────────────────────

test('🔴 toTemplate swaps this couple back out, longest value first', () => {
  const typed = 'Please welcome Bea & Marco! Bea, Marco — the floor is yours.';
  const tpl = toTemplate(typed, { 'the couple': 'Bea & Marco', 'partner one': 'Bea', 'partner two': 'Marco' });
  assert.ok(!/Bea|Marco/.test(tpl), `no real name may survive: ${tpl}`);
  assert.ok(tpl.includes('⟨the couple⟩'), 'the full pair must win over its parts');
});

test('toTemplate is case-insensitive and survives regex metacharacters in a name', () => {
  const tpl = toTemplate('salamat kay bea & marco (talaga)', { 'the couple': 'Bea & Marco' });
  assert.ok(tpl.includes('⟨the couple⟩'));
  assert.doesNotThrow(() => toTemplate('hi', { 'the couple': 'A+B (C)' }));
});

test('toTemplate ignores one-character values — too dangerous to blanket-replace', () => {
  const out = toTemplate('a wedding at a venue', { 'the venue': 'a' });
  assert.equal(out, 'a wedding at a venue');
});

test('round trip: type → store → refill for a NEW couple', () => {
  const tpl = toTemplate('Ladies and gentlemen, please welcome Bea & Marco!', { 'the couple': 'Bea & Marco' });
  const refilled = fillSlots(tpl, { 'the couple': 'Carla & Miggo' });
  assert.equal(refilled.text, 'Ladies and gentlemen, please welcome Carla & Miggo!');
  assert.deepEqual(refilled.unfilled, []);
});
