import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * four-small-truths-on-the-event-page.test.ts
 *
 * Six measured observations from the event-dashboard study, all in one card:
 *   D-2 the greeting stranded "today." on a line of its own
 *   D-3 "Hair & makeup" arrived as "Hair & mak…"
 *   D-4 four filled actions shouting at once, in the decorative colour
 *   D-5 a chip that said what its heading, its label and its sub-line said
 *   D-6 the same number printed twice on one card
 *   D-8 prose set in a monospace face
 *
 * 🛡 Mutation-checked by occurrence count; comments stripped before matching,
 * because every fix here carries a note quoting what it removed.
 */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (p: string) => readFileSync(join(WEB, p), 'utf8');
const code = (p: string) =>
  raw(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const FOCAL = 'app/dashboard/[eventId]/_components/event-dashboard.tsx';
const CSS = 'app/globals.css';

test('D-2 · the hero balances its lines and its tail never splits', () => {
  const css = raw(CSS);
  const rule = css.slice(css.indexOf('.sn-h1 {'), css.indexOf('/* Section head'));
  assert.match(rule, /text-wrap:\s*balance/, 'a greedy fill is what stranded one word');
  assert.match(rule, /\.sn-h1-tail\s*\{[^}]*white-space:\s*nowrap/, 'the tail moves whole or not at all');
});

test('D-2 · and the tail is ink — no terracotta was ever set here', () => {
  const css = raw(CSS);
  const rule = css.slice(css.indexOf('.sn-h1-tail {'), css.indexOf('.sn-h1-tail {') + 200);
  assert.match(rule, /color:\s*var\(--sn-ink-400\)/);
  assert.ok(!/terra|mulberry/i.test(rule), 'a review reported terracotta; the source never had it');
});

test('D-3 · a schedule name wraps rather than being cut to eleven characters', () => {
  const focal = code(FOCAL);
  const tile = focal.slice(focal.indexOf('Schedule · next'), focal.indexOf("miniFoot('Full program')"));
  assert.match(tile, /line-clamp-2/, 'two lines, then the ellipsis');
  assert.ok(!/truncate/.test(tile), 'one line is not enough for an appointment name');
  assert.match(tile, /items-start/, 'the date pill sits with the first line, not centred on two');
});

test('D-4 · exactly ONE filled action on the page, and it is the action colour', () => {
  const focal = code(FOCAL);
  const filled = (focal.match(/background: 'var\(--sn-gold-700\)', color: '#FFFFFF'/g) || []).length;
  assert.equal(filled, 1, 'the only solid gold left is the PRIORITY badge, which is not an action');
  assert.match(
    focal,
    /background: 'rgb\(var\(--color-mulberry\)\)', color: '#FFFFFF'/,
    'the do-this-now action wears the action colour, not the decorative one',
  );
  assert.ok(
    !/ii === 0\s*\?\s*\{ background: 'var\(--sn-gold-700\)'/.test(focal),
    'every group first-row used to be filled — three groups, three "most important" buttons',
  );
});

test('D-5 · a "pick" row carries no chip, and the other kinds keep theirs', () => {
  const focal = code(FOCAL);
  assert.match(focal, /kind === 'pick'\s*\?\s*null/);
  assert.match(focal, /'not booked yet'/, 'this one says something the row does not');
  assert.match(focal, /'awaiting confirmations'/, 'so does this one');
  assert.ok(!/'pick one'/.test(focal), 'the heading, the label and the sub-line already said it');
});

test('D-5 · and both places that render a chip survive it being absent', () => {
  const focal = code(FOCAL);
  assert.match(focal, /\{item\.chip \? \(/, 'the digest');
  assert.equal(
    (focal.match(/\{item\.chip \? \(/g) || []).length,
    2,
    'the digest AND the decisions board — a null chip must not render an empty pill',
  );
  assert.match(
    code('app/dashboard/[eventId]/_components/overview-inspector-body.tsx'),
    /\{chip \? \(/,
    'and the inspector the row opens',
  );
});

test('D-6 · the locked figure appears once on the card, not twice', () => {
  const focal = code(FOCAL);
  assert.ok(
    !/categories locked/.test(focal),
    'the gold bar above already reports the locked share, and the briefing says it in words',
  );
  assert.match(focal, /days to go/, 'the chips that remain each say something nothing else does');
  assert.match(focal, /Most urgent:/);
});

test('D-8 · the focal sub-line is prose, so it is not set in mono', () => {
  const focal = code(FOCAL);
  const at = focal.indexOf('style={{ color: focalSubColor }}');
  const line = focal.slice(at - 120, focal.indexOf('The date is locked') + 40);
  assert.ok(!/font-mono/.test(line), 'Space Mono makes a venue name read like a serial number');
  assert.match(line, /text-xs/, 'and nothing else about the line changed');
});
