/**
 * admin-records-in-search.test.ts — the records are IN the box, and reachable.
 *
 * 🔴 WHAT THIS EXISTS FOR. The owner ruled an admin must be able to find any
 * guest by name across every celebration. That search shipped — into the Entity
 * map console, a page you have to already know about. The box on the admin bar
 * searched no record at all. This pins the bridge, and it pins the two ways a
 * bridge like it goes wrong quietly:
 *
 *  1. THE ROWS RENDER AND THE KEYBOARD CANNOT REACH THEM. Exactly what happened
 *     to the assistant offer, which was visible on screen while sitting in
 *     neither the arrow-key ring nor the Enter path.
 *  2. THE OFFSET SILENTLY DRIFTS. `hitOffsetOf` used to count EVERY
 *     non-destination row; records are appended after the hits, so that version
 *     counts them too and every page row highlights N places away from the row
 *     Enter opens.
 *
 * "Existing is not reachable": these assert what the COMPONENT passes and what
 * the shared list actually returns, not that a symbol appears somewhere.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { buildNavRows, hitOffsetOf } from '@/lib/admin-map/palette-nav';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const PALETTE = 'app/admin/_components/admin-command-palette.tsx';

/* ── THE OFFSET, EXECUTED ───────────────────────────────────────────────── */

test('record rows appended after the hits do NOT push the hit offset', () => {
  const hits = ['a', 'b', 'c'];
  const records = [{ href: '/x' }, { href: '/y' }];

  const withoutAsk = buildNavRows(false, hits, records);
  assert.equal(hitOffsetOf(withoutAsk), 0, 'records inflated the offset with no ask row');

  const withAsk = buildNavRows(true, hits, records);
  assert.equal(hitOffsetOf(withAsk), 1, 'records inflated the offset past the ask row');
});

test('the highlighted row IS the row Enter opens, for every hit', () => {
  const hits = ['a', 'b', 'c'];
  const records = [{ href: '/x' }];
  for (const offerAsk of [false, true]) {
    const rows = buildNavRows(offerAsk, hits, records);
    const offset = hitOffsetOf(rows);
    hits.forEach((h, i) => {
      const row = rows[i + offset];
      assert.equal(row?.kind, 'dest', `hit ${i} does not land on a destination row`);
      assert.equal(row.kind === 'dest' ? row.dest : null, h, `hit ${i} points at the wrong row`);
    });
  }
});

test('records come last in the one list the keyboard walks', () => {
  const rows = buildNavRows(true, ['a'], [{ href: '/x' }]);
  assert.deepEqual(rows.map((r) => r.kind), ['ask', 'dest', 'record']);
});

test('with no records the list is byte-for-byte what it was', () => {
  // The guarantee that this change is invisible to every ordinary lookup.
  assert.deepEqual(buildNavRows(false, ['a', 'b']), buildNavRows(false, ['a', 'b'], []));
  assert.deepEqual(
    buildNavRows(false, ['a', 'b'], []).map((r) => r.kind),
    ['dest', 'dest'],
  );
});

/* ── THE WIRING ─────────────────────────────────────────────────────────── */

test('the palette actually runs the shipped search', () => {
  const src = read(PALETTE);
  assert.match(src, /import \{ fetchUgatSearch \}/, 'the box no longer calls the shipped search');
  assert.match(src, /fetchUgatSearch\(term\)/, 'the search is imported but never called');
  assert.match(src, /toAdminRecordRows\(groups\)/, 'the results never become rows');
});

test('the palette writes NO second search of its own', () => {
  // A search written here would be a second copy of the admin gate, the ILIKE
  // sanitiser, the deleted-guest filter and the privacy fence, free to drift
  // from the one that was reviewed.
  const src = read(PALETTE);
  assert.doesNotMatch(src, /createAdminClient|createClient\(/, 'the box opened its own database client');
  assert.doesNotMatch(src, /\.from\(['"]/, 'the box queries a table directly');
});

test('the records the box fetched are the records the keyboard walks', () => {
  // The reachability claim, asserted where it is DECIDED: the same `records`
  // state is handed to buildNavRows. Passing `[]` here, or a different array,
  // is how rows render and stay unreachable.
  const src = read(PALETTE);
  assert.match(
    src,
    /buildNavRows\(\s*askRowSelectable,\s*hits,\s*records\s*\)/,
    'the fetched records are not in the list the keyboard walks',
  );
  assert.match(
    src,
    /target\.kind === 'record' \? target\.record\.href : target\.dest\.href/,
    'Enter cannot open a record',
  );
  assert.match(src, /records\.map\(/, 'the records are never rendered');
});

test('a record row renders its name and its category, and no contact field', () => {
  const src = read(PALETTE);
  assert.match(src, /\{r\.title\}/, 'a record row stopped showing the name');
  assert.match(src, /\{r\.category\}/);
  assert.match(src, /\{r\.detail\}/);
  // The row may only render fields the redacting layer produced. Reaching for
  // a raw contact field here would walk straight around that fence.
  for (const field of ['r.email', 'r.mobile', 'r.phone', 'r.address']) {
    assert.doesNotMatch(src, new RegExp(field.replace('.', '\\.')), `a record row renders ${field}`);
  }
});

test('the record search is gated behind the admin check, not the component', () => {
  // The read uses the SERVICE ROLE, so the app-side gate is the entire fence.
  const actions = read('app/admin/ugat/actions.ts');
  const fn = actions.slice(actions.indexOf('export async function fetchUgatSearch'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /await requireAdminAction\(\)/, 'fetchUgatSearch lost its admin gate');
  assert.ok(
    body.indexOf('requireAdminAction') < body.indexOf('ugatSearch('),
    'the admin gate must come before the read',
  );
});
