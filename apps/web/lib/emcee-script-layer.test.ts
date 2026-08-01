/**
 * The emcee script layer — the decisions, held down.
 *
 * `emcee-script-layer.ts` exists as a pure module for one stated reason: the
 * interesting part is a set of DECISIONS (what counts as written, what is still
 * blank, what he must never read aloud) and a decision is only trustworthy if a
 * test can hold it down. It shipped as WIP with no tests. This is that suite.
 *
 * Two of these protect a person rather than a property:
 *
 *   · `publicFacing` must fail toward SILENCE. A booked vendor reads the full
 *     timeline, private blocks included — a private block's note is CONTEXT, not
 *     copy. If `is_public` ever arrives as `undefined`/`null`/`1`/`'true'`
 *     (a loosened type, a `select` that drops the column, a JSON round-trip),
 *     the entry must read PRIVATE. The failure mode being defended against is a
 *     host reading a surprise into a live microphone.
 *
 *   · An ORPHAN must be promoted, never dropped. A sub-block whose parent was
 *     filtered away by RLS still has to appear, because silently losing a moment
 *     from a host's running order is the worst outcome this module can produce.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScriptWorkbook,
  compileScriptText,
  type ScriptBlock,
  type ScriptEntry,
  type ScriptWorkbook,
} from './emcee-script-layer';

/**
 * Indexed access under `noUncheckedIndexedAccess` — assert the entry exists and
 * narrow, so a suite that silently stopped producing entries fails LOUDLY here
 * rather than passing on `undefined === undefined`.
 */
function at(wb: ScriptWorkbook, i: number): ScriptEntry {
  const e = wb.entries[i];
  assert.ok(e, `expected an entry at index ${i}, got ${wb.entries.length} entries`);
  return e;
}

/** Deterministic formatter — these tests must not depend on a locale or a clock. */
const fmt = (startIso: string): string => startIso.slice(11, 16);

function block(over: Partial<ScriptBlock> & { block_id: string; start_at: string }): ScriptBlock {
  return {
    label: `Block ${over.block_id}`,
    block_type: 'other' as ScriptBlock['block_type'],
    end_at: null,
    notes: null,
    is_public: true,
    sort_order: 0,
    parent_block_id: null,
    ...over,
  };
}

const build = (blocks: ScriptBlock[], scripts: { block_id: string; body: string }[] = []) =>
  buildScriptWorkbook({ blocks, scripts, options: { formatTime: fmt } });

// ── ordering ────────────────────────────────────────────────────────────────

test('orders chronologically, then by sort_order, then by id — the order he reads in', () => {
  const wb = build([
    block({ block_id: 'c', start_at: '2026-08-01T19:00:00Z' }),
    block({ block_id: 'b', start_at: '2026-08-01T18:00:00Z', sort_order: 2 }),
    block({ block_id: 'a', start_at: '2026-08-01T18:00:00Z', sort_order: 1 }),
  ]);
  assert.deepEqual(wb.entries.map((e) => e.blockId), ['a', 'b', 'c']);
});

test('identical time AND sort_order still resolves deterministically', () => {
  const mk = () => [
    block({ block_id: 'zz', start_at: '2026-08-01T18:00:00Z' }),
    block({ block_id: 'aa', start_at: '2026-08-01T18:00:00Z' }),
  ];
  assert.deepEqual(build(mk()).entries.map((e) => e.blockId), ['aa', 'zz']);
  assert.deepEqual(build(mk().reverse()).entries.map((e) => e.blockId), ['aa', 'zz']);
});

test('a part nests under its moment at depth 1, directly after it', () => {
  const wb = build([
    block({ block_id: 'later', start_at: '2026-08-01T20:00:00Z' }),
    block({ block_id: 'kid', start_at: '2026-08-01T18:30:00Z', parent_block_id: 'parent' }),
    block({ block_id: 'parent', start_at: '2026-08-01T18:00:00Z' }),
  ]);
  assert.deepEqual(
    wb.entries.map((e) => [e.blockId, e.depth]),
    [['parent', 0], ['kid', 1], ['later', 0]],
  );
});

// ── the two safety decisions ────────────────────────────────────────────────

test('an ORPHAN is promoted to depth 0, never dropped', () => {
  // The parent was filtered by RLS before it reached us (unreleased coordinator
  // prep). Losing the moment entirely would be the worst failure here.
  const wb = build([
    block({ block_id: 'orphan', start_at: '2026-08-01T18:30:00Z', parent_block_id: 'not-visible' }),
  ]);
  assert.equal(wb.entries.length, 1);
  assert.equal(at(wb, 0).blockId, 'orphan');
  assert.equal(at(wb, 0).depth, 0);
});

test('publicFacing fails toward SILENCE for every non-true value', () => {
  for (const loose of [undefined, null, 0, 1, 'true', 'false', {}]) {
    const wb = build([
      block({
        block_id: 'x',
        start_at: '2026-08-01T18:00:00Z',
        is_public: loose as unknown as boolean,
      }),
    ]);
    assert.equal(
      at(wb, 0).publicFacing,
      false,
      `is_public=${JSON.stringify(loose)} must read PRIVATE, not public`,
    );
  }
  const ok = build([block({ block_id: 'y', start_at: '2026-08-01T18:00:00Z', is_public: true })]);
  assert.equal(at(ok, 0).publicFacing, true, 'a real true is the only thing that is public');
});

// ── what counts as written ──────────────────────────────────────────────────

test('a blank or whitespace body does NOT count as written', () => {
  const wb = build(
    [
      block({ block_id: 'a', start_at: '2026-08-01T18:00:00Z' }),
      block({ block_id: 'b', start_at: '2026-08-01T19:00:00Z' }),
    ],
    [
      { block_id: 'a', body: '   \n\t ' },
      { block_id: 'b', body: 'Please welcome the couple.' },
    ],
  );
  assert.equal(at(wb, 0).script, null);
  assert.equal(at(wb, 1).script, 'Please welcome the couple.');
  assert.equal(wb.written, 1);
  assert.equal(wb.blank, 1);
});

test('a script whose block no longer exists is ignored, not crashed on', () => {
  const wb = build(
    [block({ block_id: 'live', start_at: '2026-08-01T18:00:00Z' })],
    [{ block_id: 'deleted', body: 'orphaned line' }],
  );
  assert.equal(wb.entries.length, 1);
  assert.equal(at(wb, 0).script, null);
  assert.equal(wb.written, 0);
});

test('duplicate rows for one block resolve last-wins without depending on the DB constraint', () => {
  const wb = build(
    [block({ block_id: 'a', start_at: '2026-08-01T18:00:00Z' })],
    [
      { block_id: 'a', body: 'first' },
      { block_id: 'a', body: 'second' },
    ],
  );
  assert.equal(at(wb, 0).script, 'second');
});

test('unanswered = they asked for something and he has not written his line', () => {
  const wb = build(
    [
      block({ block_id: 'asked-answered', start_at: '2026-08-01T18:00:00Z', notes: 'say this' }),
      block({ block_id: 'asked-blank', start_at: '2026-08-01T19:00:00Z', notes: 'and this' }),
      block({ block_id: 'no-ask', start_at: '2026-08-01T20:00:00Z' }),
    ],
    [{ block_id: 'asked-answered', body: 'done' }],
  );
  assert.deepEqual(wb.unanswered, ['asked-blank']);
});

test('a whitespace-only couple note is not an ask', () => {
  const wb = build([block({ block_id: 'a', start_at: '2026-08-01T18:00:00Z', notes: '  ' })]);
  assert.equal(at(wb, 0).note, null);
  assert.deepEqual(wb.unanswered, []);
});

// ── totality ────────────────────────────────────────────────────────────────

test('an empty timeline is empty, not a throw', () => {
  const wb = build([]);
  assert.equal(wb.empty, true);
  assert.equal(wb.entries.length, 0);
  assert.equal(wb.written, 0);
  assert.equal(wb.blank, 0);
});

test('an unparseable start time renders a dash rather than throwing', () => {
  const wb = buildScriptWorkbook({
    blocks: [block({ block_id: 'a', start_at: 'not-a-date' })],
    scripts: [],
  });
  assert.equal(at(wb, 0).time, '—');
});

// ── the printed copy ────────────────────────────────────────────────────────

test('compiled text marks a private block DO NOT READ ALOUD', () => {
  const wb = build([
    block({ block_id: 'p', start_at: '2026-08-01T18:00:00Z', label: 'Dowry talk', is_public: false, notes: 'family only' }),
  ]);
  const text = compileScriptText(wb, { coupleName: 'Ice & Claire', eventDate: '1 Aug 2026' });
  assert.ok(text.includes('[PRIVATE — DO NOT READ ALOUD]'));
  assert.ok(text.includes('They asked: family only'));
  assert.ok(text.includes('YOU SAY: ______________________'), 'an unwritten line shows a blank to fill');
});

test('compiled text counts progress and survives an empty timeline', () => {
  const wb = build(
    [
      block({ block_id: 'a', start_at: '2026-08-01T18:00:00Z' }),
      block({ block_id: 'b', start_at: '2026-08-01T19:00:00Z' }),
    ],
    [{ block_id: 'a', body: 'Good evening.' }],
  );
  assert.ok(compileScriptText(wb, { coupleName: null, eventDate: null }).includes('— 1 of 2 written —'));

  const none = compileScriptText(build([]), { coupleName: null, eventDate: null });
  assert.ok(none.includes('(No timeline yet — nothing to script.)'));
});
