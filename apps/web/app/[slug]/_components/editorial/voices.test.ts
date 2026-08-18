/**
 * THE THREE VOICES — §5 of the Editorial Experience Spec, and the consent that
 * governs them.
 *
 * Measured 2026-08-18: the spec had asked for three distinct weights since
 * June and **none of it was built**. Every column rendered identically; the
 * only role words anywhere in the editorial tree were inside sample prose. The
 * data was there the whole time — `guest_columns.guest_id` joins straight to
 * `guests.role`, whose enum already carries `bride_parents`, `best_man`,
 * `maid_of_honor` and the rest. The reader never selected it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { voiceOf, roleLabel, byVoiceWeight } from './voices';

const HERE = dirname(fileURLToPath(import.meta.url));

test('parents carry the highest weight', () => {
  assert.equal(voiceOf('bride_parents'), 'parents');
  assert.equal(voiceOf('groom_parents'), 'parents');
});

test('the named party the spec calls out gets its own weight', () => {
  for (const r of ['maid_of_honor', 'matron_of_honor', 'best_man', 'principal_sponsor', 'officiant']) {
    assert.equal(voiceOf(r), 'named', `${r} lost its voice`);
  }
});

test('everyone else is a guest — including roles with no editorial meaning', () => {
  // A ring bearer with a badge is clutter. The spec asks for distinction where
  // it means something, not everywhere it is possible.
  for (const r of ['guest', 'ring_bearer', 'flower_girl', 'helper', '', null, undefined]) {
    assert.equal(voiceOf(r as string | null), 'guest');
  }
});

test('parents first, then the named party, then everyone else', () => {
  const order = byVoiceWeight([
    { role: 'guest', id: 1 },
    { role: 'best_man', id: 2 },
    { role: 'bride_parents', id: 3 },
    { role: 'guest', id: 4 },
  ] as Array<{ role: string; id: number }>);
  assert.deepEqual(order.map((c) => c.id), [3, 2, 1, 4]);
});

test('the sort is STABLE — nobody\'s column jumps between visits', () => {
  // Equal weights keep submission order. A list that reorders itself is a list
  // nobody trusts.
  const same = [{ role: 'guest', id: 1 }, { role: 'guest', id: 2 }, { role: 'guest', id: 3 }];
  assert.deepEqual(byVoiceWeight(same).map((c) => c.id), [1, 2, 3]);
});

test('a badge reads as English, never the raw database value', () => {
  assert.equal(roleLabel('maid_of_honor'), 'Maid of honour');
  assert.equal(roleLabel('bride_parents'), 'Parents of the bride');
  assert.equal(roleLabel('ring_bearer'), null, 'a role with no badge got one');
  assert.equal(roleLabel(null), null);
});

// ── 🔒 the consent, which is the part that could hurt somebody ──────────────

test('the ROLE is withheld in lockstep with the byline, at the reader', () => {
  // There is exactly ONE maid of honour. A badge over an unnamed column would
  // identify her to everybody at the wedding — so the role rides the SAME
  // consent as the name (DPO ruling 2026-08-06), stripped at the READER so an
  // unconsented role never reaches a component that could render it.
  const data = readFileSync(join(HERE, 'data.ts'), 'utf8');
  assert.match(
    data,
    /role: bylineFor\(/,
    'the role no longer rides the byline consent — an unnamed column can now be ' +
      'badged with a role that identifies its author anyway',
  );
});

test('the wall only ever prints a badge beside a name', () => {
  const wall = readFileSync(join(HERE, 'editorial-content.tsx'), 'utf8');
  const block = /function GuestColumnsWall[\s\S]*?\n}\n/.exec(wall)?.[0] ?? '';
  assert.ok(block, 'the columns wall moved — this scan is now blind');
  // every roleLabel render sits inside a `c.author ? …` branch
  const badges = [...block.matchAll(/roleLabel\(c\.role\)/g)];
  assert.ok(badges.length >= 2, `expected the badge in both voices, found ${badges.length}`);
  assert.ok(
    !/\{roleLabel\(c\.role\)[\s\S]{0,80}\}\s*\n\s*\) : null\}\s*\n\s*<\/article>/.test(
      block.replace(/c\.author \? \([\s\S]*?\) : null/g, ''),
    ),
    'a role badge renders outside the author branch',
  );
});

test('parents are lifted OUT of the masonry, not just restyled inside it', () => {
  // The spec asks for centre placement and large type — a masonry cell flattens
  // everything to the same size, so a parent's block has to leave the grid.
  const wall = readFileSync(join(HERE, 'editorial-content.tsx'), 'utf8');
  assert.match(wall, /voiceOf\(c\.role\) === 'parents'/);
  assert.match(wall, /voiceOf\(c\.role\) !== 'parents'/);
});
