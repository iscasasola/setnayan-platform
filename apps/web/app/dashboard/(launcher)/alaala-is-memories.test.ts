/**
 * alaala-is-memories.test.ts — Alaala keeps PHOTOS. The board keeps events.
 *
 * ── THE REGRESSION THIS EXISTS TO CATCH ────────────────────────────────────
 * Alaala's five owner-approved lenses (2026-07-15) answered with EVENTS for
 * months and nobody noticed, because a list of events renders beautifully:
 *
 *   · the home's Alaala panel rendered `PhotosTab` — one card per event with a
 *     photo count;
 *   · the obsidian tile's "Owned" lens rendered a BULLETED LIST OF EVENT NAMES
 *     and "Attended" rendered a COUNT OF EVENTS;
 *   · `/dashboard/library` answered three of the five lenses with the same
 *     album grid.
 *
 * Events is for DOING — one card per celebration, plan it, run it. Alaala is
 * for KEEPING. "With me" is every photo of you across six years and belongs to
 * NO SINGLE EVENT, which is why an album grid can never be its answer.
 *
 * ── WHY A SOURCE SCAN ──────────────────────────────────────────────────────
 * There is nothing to assert a return value on: the failure is a rendered
 * component. The launcher and the Alaala page are server components with a
 * dozen live reads before them, so standing one up in a unit test would assert
 * the mocks. What CAN regress is visible in the source — which component the
 * lens branch renders, and whether every lens has a body at all.
 *
 * 🪤 COMMENTS ARE STRIPPED FIRST. Every file this scans contains prose about
 * `PhotosTab` and about lists of events, which is exactly the text a naive
 * scanner flags. Five guards in this repo have already matched their own
 * explanatory comments.
 *
 * 🪤 EVERY EXTRACTOR ASSERTS ITS ANCHOR BEFORE IT ASSERTS ANYTHING ELSE. A
 * search that cannot match is not a negative result — a guard whose regex
 * silently matches nothing passes forever and reads exactly like success.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');

const LAUNCHER = resolve(HERE, 'page.tsx');
const TILE = resolve(HERE, '_components', 'alaala-tile.tsx');
const WALL = resolve(HERE, '_components', 'alaala-wall.tsx');
const BODY = resolve(WEB, 'app', '_components', 'alaala', 'lens-body.tsx');
const ALAALA_PAGE = resolve(WEB, 'app', 'dashboard', '(account)', 'library', 'page.tsx');

/** The five, in the tile's order. A body missing one renders `undefined`. */
const LENSES = ['recent', 'owned', 'attended', 'people', 'with_me'] as const;

function src(path: string): string {
  const raw = readFileSync(path, 'utf8');
  // Anchor: the file exists and is the real thing, not a stub that would make
  // every assertion below pass vacuously.
  assert.ok(raw.length > 500, `${path} is too small to be the real source`);
  return stripComments(raw);
}

function count(haystack: string, needle: RegExp): number {
  return [...haystack.matchAll(needle)].length;
}

test('the home mounts the memory wall', () => {
  const s = src(LAUNCHER);
  assert.equal(
    count(s, /<AlaalaWall\b/g),
    1,
    'The home has no Alaala memory wall. Without it the five lenses have no ' +
      'surface and Alaala has no photographs.',
  );
});

test('the home does not render the per-event album grid', () => {
  const s = src(LAUNCHER);
  assert.equal(
    count(s, /\bPhotosTab\b/g),
    0,
    'The launcher renders PhotosTab — one card per event with a photo count. ' +
      'That is the board’s answer, not Alaala’s. The per-event albums ' +
      'live one tap deeper, under "Albums by event" in Alaala opened full.',
  );
});

test('the obsidian tile carries Life-Flash and does NOT carry the lenses', () => {
  const s = src(TILE);
  // It still does its own job…
  assert.ok(
    /Play Life-Flash/.test(s),
    'the Alaala tile lost its Life-Flash affordance',
  );
  // …and not the wall's.
  assert.equal(
    count(s, /<AlaalaLenses\b/g),
    0,
    'The lenses are back inside the obsidian tile. That slot is a caption: ' +
      'it can only hold sentences about events, which is what made Alaala read ' +
      'as a second list of events in the first place.',
  );
});

test('every one of the five lenses has a body on the home wall', () => {
  const s = src(WALL);
  const from = s.indexOf('const bodies');
  assert.notEqual(from, -1, 'no `const bodies` in alaala-wall.tsx — update this guard');
  // End at the map's own closing `};`, not at the next `return (`: the file's
  // FIRST `return (` belongs to the skeleton and sits ABOVE this, which yields
  // an empty slice and would pass every check below vacuously.
  const close = s.indexOf('\n  };', from);
  assert.notEqual(close, -1, 'could not find the end of the lens-bodies map');
  const block = s.slice(from, close);
  assert.ok(block.length > 100, 'the lens-bodies map extractor matched almost nothing');
  for (const lens of LENSES) {
    assert.ok(
      new RegExp(`\\b${lens}:`).test(block),
      `The "${lens}" lens has no body. A missing key renders \`undefined\` — an ` +
        `empty panel with no error, which reads as "you have nothing here".`,
    );
  }
});

test('the shared lens body renders frames, never a list of events', () => {
  const s = src(BODY);
  assert.ok(
    /selectLens\(/.test(s),
    'the lens body no longer asks the wall for frames — update this guard',
  );
  // The regression shape: mapping over events/albums to make cards.
  for (const shape of [/\bevents\.map\(/g, /\balbums\.map\(/g, /\bAlbumCard\b/g]) {
    assert.equal(
      count(s, shape),
      0,
      `The Alaala lens body renders ${shape.source} — it has turned back into a ` +
        `list of events. Alaala keeps photographs; the event is provenance.`,
    );
  }
});

test('the Alaala page answers its lenses with the same body as the home', () => {
  const s = src(ALAALA_PAGE);
  assert.equal(
    count(s, /<AlaalaLensBody\b/g),
    1,
    '/dashboard/library must render the SAME lens body as the home. Two ' +
      'surfaces answering the same five words two different ways is the drift ' +
      'that put an album grid behind three of the lenses.',
  );
  // PhotosTab is still allowed — but ONLY as the "Albums by event" door, never
  // as a lens. If it ever takes a `lens=` prop again it is answering one.
  assert.equal(
    count(s, /<PhotosTab[^>]*\blens=/g),
    0,
    'PhotosTab is answering an Alaala lens again. The album grid is a real job ' +
      '(download one whole celebration) but it is a list of events, so it lives ' +
      'under "Also kept", not behind a lens.',
  );
});

test('"With me" is reachable at the account level, where it has to be', () => {
  // The load-bearing product claim: a photo of you from six years ago belongs
  // to no single event, so the lens cannot live inside one. If it ever stops
  // being offered on the account surface, that claim quietly stopped being true.
  const s = src(ALAALA_PAGE);
  // Anchor on the DECLARED lens list, not on any occurrence of the word: the
  // page names 'with_me' twice (the key list and the chip labels), so a bare
  // /'with_me'/ still matched after the key was deleted — a guard matching a
  // STRING instead of the ACT. Proven by mutation, not assumed.
  const decl = /const LENS_KEYS = \[([^\]]*)\]/.exec(s);
  assert.ok(decl, 'no LENS_KEYS declaration on the Alaala page — update this guard');
  assert.ok(
    /'with_me'/.test(decl[1]!),
    'the account-level Alaala surface no longer offers the "With me" lens. It ' +
      'is every photo of you across six years and belongs to no single event — ' +
      'if it is not offered at the account level it cannot be offered at all.',
  );
  // …and the home wall must still carry it too, or the two surfaces disagree.
  const wall = /const LENSES: Array<\{ key: AlaalaLensKey; label: string \}> = \[([\s\S]*?)\];/
    .exec(src(resolve(HERE, '_components', 'alaala-lenses.tsx')));
  assert.ok(wall, 'no LENSES list in alaala-lenses.tsx — update this guard');
  for (const lens of LENSES) {
    assert.ok(
      new RegExp(`'${lens}'`).test(wall[1]!),
      `the home wall stopped offering the "${lens}" lens`,
    );
  }
});
