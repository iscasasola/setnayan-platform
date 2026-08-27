/**
 * GUARD — the manual-uploads gate answers the right question, in the right
 * direction, about the right seat.
 *
 * The switch shipped governing the studio SCREEN: the page hides the file
 * picker. That was honest while the couple was the only person it could stop and
 * dishonest the moment anything else could reach the write — a server action is
 * a public endpoint, and a hidden button is one `fetch` from not being hidden.
 * The live photo wall mirrored to every guest's phone for a whole celebration
 * while the only "off" the product offered closed the venue screens.
 *
 * Three things about the gate are decisions rather than details, and each one is
 * a way it could be silently wrong:
 *
 *   1. It only has an opinion about the UPLOADS camera. If it gated an ordinary
 *      seat, switching it off would stop a paparazzo photographing a wedding —
 *      the opposite of what the OFF copy promises.
 *   2. It fails OPEN on anything it cannot read. The column lands in a
 *      migration; failing closed there takes uploading away from every couple
 *      with no explanation and no error.
 *   3. It reads the switch on its OWN round trip. Naming an unknown column makes
 *      PostgREST refuse the whole query — this Papic surface has already turned
 *      a missing migration into a live celebration rendering as missing once.
 *
 * ⚠ RULES 1–4 TEST THE PURE RULE; RULE 5 READS THE IO AS SOURCE. The round trip
 * lives in a `server-only` module, which cannot be imported by a test in this
 * repo — so the decision was split out (the same shape
 * `event-accepts-captures-rule.ts` has). What source can still defend is the one
 * thing that is not a decision but a shape: which columns the select names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { manualUploadsClosedFrom } from './papic-uploads-open-rule';
import { PAPIC_UPLOADS_CAMERA_INDEX } from './papic-cameras';

const OFF = { papic_uploads_open: false };
const ON = { papic_uploads_open: true };

test('1 · an ordinary camera is never gated, whatever the switch says', () => {
  for (const seatIndex of [100, 101, 102, 110, 200, 700, null, undefined]) {
    assert.equal(
      manualUploadsClosedFrom(seatIndex, OFF, false),
      false,
      `seat_index ${String(seatIndex)} was gated by the manual-uploads switch. ` +
        `Turning that switch off would stop a paparazzo photographing a wedding, ` +
        `while the OFF copy promises "Only what your cameras capture".`,
    );
  }
});

test('2 · 🚨 the Uploads camera IS gated when the couple has switched it off', () => {
  assert.equal(
    manualUploadsClosedFrom(PAPIC_UPLOADS_CAMERA_INDEX, OFF, false),
    true,
    'the switch is off and the gate says the door is open — hiding the picker ' +
      'is then the only thing stopping anybody, and a server action is a public ' +
      'endpoint',
  );
});

test('3 · switched ON lets it through', () => {
  assert.equal(
    manualUploadsClosedFrom(PAPIC_UPLOADS_CAMERA_INDEX, ON, false),
    false,
    'a couple with uploads switched on cannot add photos to their own library',
  );
});

test('4 · ⚠ absent, unreadable or missing all mean OPEN — never closed', () => {
  /*
    The column lands in a migration. A pre-migration database refuses the query;
    a transient error refuses it too. Failing closed on either takes the
    library's most obvious door away from every couple on the platform, with no
    explanation and no error anywhere. An upload costs a credit exactly like a
    shot, so an open door is not a free one — the cost of failing open is bounded
    and the cost of failing closed is not.
  */
  const cases: Array<[string, Parameters<typeof manualUploadsClosedFrom>[1], boolean]> = [
    ['a pre-migration column', {}, false],
    ['an explicit null', { papic_uploads_open: null }, false],
    ['a refused read', null, true],
    ['no row at all', null, false],
    ['a refused read that still carried a row', OFF, true],
  ];
  for (const [what, row, readFailed] of cases) {
    assert.equal(
      manualUploadsClosedFrom(PAPIC_UPLOADS_CAMERA_INDEX, row, readFailed),
      false,
      `${what} closed the door. That is the wrong direction: it removes ` +
        `uploading from every couple, silently.`,
    );
  }
});

test('5 · 🪤 the switch is read on its OWN select, naming nothing else', () => {
  /*
    Folding this column into a bigger event read is the tempting one-liner and
    the wrong one: PostgREST refuses the WHOLE query when a named column does not
    exist yet, so on a pre-migration database it would take whatever else that
    read was for down with it. The Papic studio page has already paid for this
    exact mistake in the other direction — its first cut read the column off a
    select that never named it, so the switch governed nothing and reported OPEN
    forever.

    🪤 COMMENTS ARE STRIPPED FIRST. That file explains this rule at length in
    prose, and a raw match reports the mistake it is warning about.
  */
  const src = readFileSync(join(import.meta.dirname, 'papic-uploads-open.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  const selects = src.match(/\.select\(\s*'[^']*'\s*,?\s*\)/g) ?? [];
  assert.deepEqual(
    selects,
    ["select('papic_uploads_open')"].map((s) => `.${s}`),
    `the gate selected ${JSON.stringify(selects)}. It must name that column and ` +
      `nothing else, on one round trip: a second name makes a pre-migration ` +
      `database refuse the read, and this helper answers a refused read with OPEN.`,
  );

  // …and the decision must come from the pure rule, not be re-derived here. Two
  // copies of a rule drift; this repo has a memory note about that alone.
  assert.match(
    src,
    /return manualUploadsClosedFrom\(/,
    'the round trip decides for itself again instead of calling the pure rule — ' +
      'that is a second copy of the fail-open direction, and the tested one is ' +
      'then no longer the one that runs',
  );
});
