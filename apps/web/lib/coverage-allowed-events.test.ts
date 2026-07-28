import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { allowedEventOptions, droppedEventTypes } from './coverage-allowed-events';
import { audienceGroups } from './canvas-audience-groups';

// The real 16-key prod vocab shape (event_type_vocab WHERE status='active',
// 2026-07-28) — the same roster the audience-groups tests pin against.
const VOCAB = [
  'wedding',
  'debut',
  'christening',
  'birthday',
  'anniversary',
  'gender_reveal',
  'corporate',
  'graduation',
  'reunion',
  'tournament',
  'travel',
  'celebration',
  'gala_night',
  'simple_event',
  'date',
  'hangout',
].map((key) => ({ key, label: key }));

test('null allowed = no restriction — every vocab option renders', () => {
  assert.deepEqual(
    allowedEventOptions(VOCAB, null).map((o) => o.key),
    VOCAB.map((o) => o.key),
  );
});

test('EMPTY allowed = no restriction (the server and create flow read [] the same way)', () => {
  assert.deepEqual(
    allowedEventOptions(VOCAB, []).map((o) => o.key),
    VOCAB.map((o) => o.key),
  );
});

test('a restricted leaf renders NO chip outside allowedEventTypes', () => {
  const allowed = ['wedding', 'debut', 'christening'];
  const rendered = allowedEventOptions(VOCAB, allowed);
  for (const o of rendered) {
    assert.ok(
      allowed.includes(o.key),
      `chip "${o.key}" rendered outside the allowed set — checkable, then silently dropped by parseEventTypes on save`,
    );
  }
  // …and every allowed key that exists in the vocab does render, vocab order kept.
  assert.deepEqual(rendered.map((o) => o.key), ['wedding', 'debut', 'christening']);
});

test('an allowed key absent from the vocab renders nothing (no phantom chip)', () => {
  const rendered = allowedEventOptions(VOCAB, ['wedding', 'retired_type']);
  assert.deepEqual(rendered.map((o) => o.key), ['wedding']);
});

test('droppedEventTypes names exactly the saved keys the server would strip', () => {
  // The admin narrowed the leaf after the row was saved: the coverage still
  // carries 'corporate', which no chip can render and the server will drop.
  assert.deepEqual(droppedEventTypes(['wedding', 'corporate'], ['wedding', 'debut']), [
    'corporate',
  ]);
  assert.deepEqual(droppedEventTypes(['wedding'], ['wedding', 'debut']), []);
});

test('droppedEventTypes is empty when the leaf is unrestricted', () => {
  assert.deepEqual(droppedEventTypes(['wedding', 'celebration'], null), []);
  assert.deepEqual(droppedEventTypes(['wedding', 'celebration'], []), []);
});

test('composes with audienceGroups: the union of rendered groups is EXACTLY allowed ∩ vocab', () => {
  const allowed = ['wedding', 'corporate', 'celebration', 'hangout'];
  const rendered = audienceGroups(allowedEventOptions(VOCAB, allowed)).flatMap((g) =>
    g.options.map((o) => o.key),
  );
  assert.deepEqual([...rendered].sort(), [...allowed].sort());
  // exactly once each — a duplicate would post the key twice
  assert.equal(new Set(rendered).size, rendered.length);
});

// ── The call-site pins (the parity-test idiom): both surfaces must render
// through the helper, not an ad-hoc filter or the raw vocab. Lexical, so a
// conditional bypass is out of reach — but removing the call outright fails.
const COMPONENTS = join(process.cwd(), 'app', 'vendor-dashboard', 'services', '_components');

test('the serves EDIT sheet renders its chips through allowedEventOptions', () => {
  const src = readFileSync(join(COMPONENTS, 'coverage-panel.tsx'), 'utf8');
  // Pin the CHIP RENDER itself (`.map(`), not just any helper call — the note
  // line also calls the helper, and a probe showed reverting the render alone
  // stayed green against a looser regex.
  assert.match(
    src,
    /allowedEventOptions\(eventTypeOptions,\s*open\.allowedEventTypes\)\.map\(/,
    'coverage-panel.tsx edit sheet no longer RENDERS through allowedEventOptions — chips outside the leaf’s allowed set would be checkable, then silently dropped on save',
  );
  // …and the raw-vocab chip render must not come back beside it.
  assert.doesNotMatch(
    src,
    /eventTypeOptions\.map\(\(e\) => \(\s*<CheckChip/,
    'the edit sheet renders event-type chips from the RAW vocab again (the pre-fix defect)',
  );
  assert.match(src, /droppedEventTypes\(/, 'the edit sheet lost its dropped-keys disclosure');
});

test('the canvas audience sheet groups the ALLOWED options, not the raw vocab', () => {
  const src = readFileSync(join(COMPONENTS, 'canvas-maker.tsx'), 'utf8');
  assert.match(src, /audienceGroups\(audienceOptions\)/);
  assert.doesNotMatch(
    src,
    /audienceGroups\(eventTypeOptions\)/,
    'canvas-maker.tsx grouped the unfiltered vocab — chips outside the leaf’s allowed set would be checkable, then silently dropped on save',
  );
});
