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
import { existsSync, readFileSync } from 'node:fs';
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
const DATA = resolve(WEB, 'lib', 'alaala-wall-data.ts');

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

test('the memory wall is mounted where Alaala lives', () => {
  // ⚠ REPOINTED 2026-08-19. This asserted the wall was on the ACCOUNT HOME. The
  // owner made that page only his events, so the wall is no longer there — but
  // the rule it protects is unchanged: the five lenses must have a surface, or
  // Alaala has no photographs. That surface is now Alaala's own page, which
  // mounts the same shared body the home used to.
  const s = src(ALAALA_PAGE);
  assert.equal(
    count(s, /<AlaalaLensBody\b|<AlaalaWall\b/g) >= 1,
    true,
    'Alaala has no memory wall. Without it the five lenses have no surface and ' +
      'Alaala has no photographs.',
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

test('the home wall DERIVES its lens bodies — the pairing is not hand-typed', () => {
  const s = src(WALL);
  // 🪤 THE PREVIOUS VERSION OF THIS TEST COULD NOT FAIL THE WAY THAT MATTERED.
  // It scanned a hand-typed `{ owned: <AlaalaLensBody lens="owned" …> }` map for
  // the record KEY. A mutation rewriting one entry to `lens="recent"` preserves
  // the key, so 17/17 tests stayed green while the Owned chip rendered the
  // Recent wall — measured, not supposed. `Record<K, ReactNode>` gives no
  // key↔prop link, so no guard over hand-typed pairs can be trusted. The map is
  // now derived from the one declared list, which makes the bug unexpressible.
  assert.match(
    s,
    /ALAALA_LENSES\.map\(\s*\(\{\s*key\s*\}\)\s*=>\s*\[\s*key\s*,[\s\S]{0,160}?lens=\{key\}/,
    'The home wall no longer derives its lens bodies from ALAALA_LENSES. A ' +
      'hand-typed key/prop map lets a chip render another lens’s answer with ' +
      'every test green — that is exactly how this guard was caught being ' +
      'decoration.',
  );
  assert.equal(
    count(s, /lens="(recent|owned|attended|people|with_me)"/g),
    0,
    'a hand-typed lens prop came back on the home wall',
  );
});

test('the declared lens list is still the owner-approved five', () => {
  const s = src(resolve(WEB, 'lib', 'alaala-wall.ts'));
  const decl = /ALAALA_LENSES[\s\S]*?=\s*\[([\s\S]*?)\];/.exec(s);
  assert.ok(decl, 'no ALAALA_LENSES declaration — update this guard');
  for (const lens of LENSES) {
    assert.ok(
      new RegExp(`key: '${lens}'`).test(decl[1]!),
      `"${lens}" left ALAALA_LENSES. Every body on both surfaces is derived from ` +
        `that list, so dropping one silently removes the lens everywhere.`,
    );
  }
});

test('the People door lives in the shared body, where both surfaces get it', () => {
  // 🪤 The port-loss baseline records controls PER ROUTE DIRECTORY and does not
  // follow into app-root `_components` — so when this door moved here it was
  // recorded as REMOVED from /dashboard/library, and deleting it now would fire
  // nothing. This assertion is the replacement for the line that stopped
  // watching it.
  const s = src(BODY);
  assert.equal(
    count(s, /href="\/dashboard\/people"/g),
    1,
    'The only route from Alaala to /dashboard/people is gone. It once hung off a ' +
      'prose placeholder and vanished the moment the People lens started showing ' +
      'real faces — a control that disappears when the feature starts WORKING.',
  );
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

test('the read budgets PER LENS and counts on the uncapped set', () => {
  // 🚨 THE REGRESSION THAT SHIPPED IN #4395, and the one sabotage that escaped
  // the first version of this guard: the pure core was tested directly, so
  // nothing watched the DATA LAYER reverting to a single global cap. Replacing
  // `surfaceBudget(ordered, …)` with `ordered.slice(0, …)` there left every
  // test green while Attended and With me emptied over frames already read.
  const s = src(DATA);
  assert.equal(
    count(s, /surfaceBudget\(\s*ordered/g),
    1,
    'The wall no longer budgets per lens. A global cap over a filtered view is a ' +
      'silent filter: the newest frames all belong to one lens and the others ' +
      'render empty over photographs that were successfully read.',
  );
  assert.equal(
    count(s, /\bordered\.slice\(/g),
    0,
    'The ordered wall is being truncated before the lens split — that IS the bug.',
  );
  assert.equal(
    count(s, /lensTotals\(\s*ordered/g),
    1,
    'Totals must be measured on the UNCAPPED read. Counting the budgeted set ' +
      'prints a display cap as a total, and prints a confident 0 for a lens that ' +
      'simply had no room.',
  );
});

test('wall tiles are served at DISPLAY resolution, both halves', () => {
  // 🖼 THE OWNER SAW THIS AND SAID SO: "the photos are pixelated."
  // The wall hand-rolled a ref picker that preferred `thumb_r2_key` — long-edge
  // 320 at AVIF q50, which papic-derivatives.ts builds for dense peek strips.
  // The wall renders 105–192 CSS px squares (310–383 device px), and
  // `object-cover` on a square scales a LANDSCAPE thumb by its 240px HEIGHT, so
  // every breakpoint upscaled 1.3×–1.6×.
  const s = src(DATA);
  assert.equal(
    count(s, /resolveLargeStillRef\(/g),
    2,
    'Both owned reads (papic_photos and papic_guest_captures) must resolve at ' +
      'display resolution. Either one falling back to a thumbnail makes half ' +
      'the wall soft, which is harder to notice than all of it.',
  );
  // The column must be SELECTED, or the resolver falls back forever and the
  // whole derivative is dead weight nobody notices — a phantom column and an
  // unselected one are the same absence from the outside.
  assert.equal(
    count(s, /tile_r2_key/g),
    2,
    'Both owned reads must SELECT tile_r2_key. A column the query never names ' +
      'is a column the resolver can never prefer, so every tile silently falls ' +
      'back to the 1280px copy at ~4× the bytes — with nothing in any log.',
  );
  assert.equal(
    count(s, /\bthumb_r2_key\b\s*as string/g),
    0,
    'A hand-rolled thumb-first picker came back. Use the canonical resolver — ' +
      'that is where the drop-safety and the never-an-MP4 rule live.',
  );
  // The ATTENDED half arrives pre-presigned, so the resolution is chosen inside
  // getGuestLiveGallery. Missing this leaves half the wall soft with the owned
  // half sharp — the hardest version to spot.
  assert.match(
    s,
    /getGuestLiveGallery\([\s\S]{0,200}?prefer: 'display'/,
    'Attended frames no longer ask for display resolution, so they render from ' +
      '320px thumbnails while owned frames are sharp.',
  );
});

test('the day-of venue grid still defaults to the small copy', () => {
  // The other direction is also a defect: forcing 1280px tiles onto the
  // wedding-day page would push ~10× the bytes over venue WiFi, on the one
  // surface where that matters most.
  const gallery = src(resolve(WEB, 'lib', 'guest-live-gallery.ts'));
  assert.match(
    gallery,
    /const preferDisplay = opts\.prefer === 'display';/,
    'the size preference is gone — every caller now gets one size',
  );
  // The attended half must also SELECT and prefer the tile, or half the wall
  // stays on the heavy copy while the other half is light.
  assert.match(
    gallery,
    /r\.tile_r2_key \?\? r\.display_r2_key/,
    'the wall-size branch stopped preferring the tile derivative',
  );
  assert.equal(
    count(gallery, /tile_r2_key,/g),
    2,
    'both attended reads must SELECT tile_r2_key',
  );
  assert.match(
    gallery,
    /prefer\?: 'thumb' \| 'display';/,
    'the preference must stay OPTIONAL so the day-of page keeps its small copy ' +
      'without naming it',
  );
});

test('the tile backfill has a doorway a person can actually press', () => {
  // 🚪 IT SHIPPED WITHOUT ONE. The backfill first existed as
  // `POST /api/admin/papic/backfill-tiles` — no caller, no button, nothing in
  // the app referencing it. A mechanism never proven reachable, written in the
  // same session that quoted that rule twice. A page ships with its doorway.
  const button = src(
    resolve(WEB, 'app', 'admin', 'papic-storage', 'backfill-tiles-button.tsx'),
  );
  assert.match(
    button,
    /backfillTileDerivativesAction\(\)/,
    'the button no longer calls the backfill action',
  );
  // IMPORTED IS NOT MOUNTED — a guard that only proved the import passed while
  // the JSX was gone. Assert the ELEMENT.
  const page = src(resolve(WEB, 'app', 'admin', 'papic-storage', 'page.tsx'));
  assert.equal(
    count(page, /<BackfillTilesButton\b/g),
    1,
    'The backfill button is imported but not RENDERED on /admin/papic-storage, ' +
      'so the action is unreachable again.',
  );
  // …and the route it replaced must not come back as a second, callerless door.
  assert.equal(
    existsSync(resolve(WEB, 'app', 'api', 'admin', 'papic', 'backfill-tiles')),
    false,
    'The callerless API route is back. One doorway, and it is the admin page.',
  );
});

test('the storage readout counts the third derivative', () => {
  // A derivative nothing counts is storage we pay for and cannot see — and the
  // ~8% web-copy ratio the pricing councils asked to lock from real data would
  // read low forever.
  const telemetry = src(resolve(WEB, 'lib', 'papic-storage-telemetry.ts'));
  assert.match(
    telemetry,
    /pos\(row\.display_bytes\) \+ pos\(row\.tile_bytes\) \+ pos\(row\.thumb_bytes\)/,
    'webCopyBytes() stopped counting tile_bytes, so every storage figure ' +
      'under-reports by one derivative.',
  );
  const page = src(resolve(WEB, 'app', 'admin', 'papic-storage', 'page.tsx'));
  assert.equal(
    count(page, /\(r\.display_bytes \?\? 0\) \+ \(r\.thumb_bytes \?\? 0\)/g),
    0,
    'The page hand-sums the web copy again instead of calling webCopyBytes(). ' +
      'Two definitions of one rule is how one of them silently goes stale.',
  );
});
