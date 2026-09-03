/**
 * the-gallery-picker-is-paged.test.ts — THE SUPPLIER GALLERY IS NEVER READ
 * UNBOUNDED, AND A PICK NEVER LOSES ITS PROVENANCE.
 *
 * ── WHY A SOURCE GUARD AND NOT A RENDER ─────────────────────────────────────
 * The fetch happens in a `useEffect` and "Show more" happens on a click, and
 * `renderToStaticMarkup` (the only renderer this repo's guards have) runs
 * neither. A render test of this component could only paint its empty state,
 * which is exactly the half that cannot go wrong. So this file reads SOURCE —
 * but it reads it the way the repo has learned to:
 *
 *   · every window is anchored on the SPECIFIC declaration it is about, sliced
 *     forward to the next declaration, so an assertion cannot be satisfied by
 *     a match somewhere else in the file (`a-guard-window-anchored-on-the-
 *     first-match-faces-the-wrong-cell`);
 *   · it pins the CALL SITES, not only the pieces. page.tsx → InspirationBoard
 *     → GalleryPicker → fetchGalleryAssets → normalizeGalleryQuery → .range()
 *     is one line with five joints, and a correct query plus a correct
 *     component can both pass their own tests while a joint in the middle is
 *     quietly cut;
 *   · counts are asserted, not mere presence, so a second unguarded query
 *     appearing beside the guarded one is red rather than invisible.
 *
 * The CAP ITSELF is proven for real in `lib/moodboard-gallery.test.ts` (clamps
 * a million-row request, a missing limit, NaN, negatives) and the PROVENANCE
 * rule is proven for real against Postgres in
 * `tests/db/the-gallery-chain-keeps-its-credit.db.test.ts`. This file only
 * proves the wires between them are attached.
 *
 * 🛑 WHAT IT EXISTS TO CATCH. `template-gallery.tsx` used to receive the ENTIRE
 * moodboard_theme_templates table as an RSC prop — survivable at 100 rows, a
 * real cost at 2,600 — and PR #5113 had to undo it. The supplier gallery grows
 * with every shop that uploads, with no ceiling anybody here controls.
 *
 * SABOTAGE PERFORMED AND UNDONE DURING VERIFICATION — see the session report.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const HERE = __dirname;
const ACTIONS = path.join(HERE, '..', 'actions.ts');
const PAGE = path.join(HERE, '..', 'page.tsx');
const PICKER = path.join(HERE, 'gallery-picker.tsx');
const BOARD = path.join(HERE, 'inspiration-board.tsx');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/**
 * The source between `from` and the next `until` after it. Anchored on the
 * declaration itself — never on the first occurrence of an incidental token —
 * so an assertion below can only be satisfied from inside the thing named.
 */
function windowOf(src: string, from: string, until: RegExp): string {
  const start = src.indexOf(from);
  assert.notEqual(start, -1, `anchor missing from source: ${from}`);
  const rest = src.slice(start + from.length);
  const m = rest.match(until);
  return from + (m && m.index !== undefined ? rest.slice(0, m.index) : rest);
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/* ── 1 · THE SERVER ACTION IS THE CAP ─────────────────────────────────── */

test('⭐ THE GUARD · fetchGalleryAssets normalizes, then RANGES — there is no unbounded read', () => {
  const body = windowOf(
    read(ACTIONS),
    'export async function fetchGalleryAssets(',
    /\nexport (async )?function /,
  );

  assert.equal(
    count(body, 'normalizeGalleryQuery('),
    1,
    'exactly one normalize call: two would mean one of them is the unguarded path',
  );
  assert.match(
    body,
    /if \(!query\) throw/,
    'an un-normalizable request must throw, never fall through to a query',
  );
  assert.equal(
    count(body, '.range('),
    1,
    'exactly one .range() — a second query in here would be the fetch-all',
  );
  assert.match(
    body,
    /\.range\(query\.offset, query\.offset \+ query\.limit - 1\)/,
    'the range must come from the CLAMPED query, not from raw input',
  );
  assert.equal(
    count(body, 'from(\'moodboard_library_assets\')'),
    1,
    'one read of the library here; a second one would need its own range',
  );
  // The other half of the "two zeroes" contract: a dead read throws so the
  // picker can say so, instead of returning [] and reading as "nobody uploaded".
  assert.match(body, /if \(error\) throw new Error\(error\.message\)/);
  assert.match(body, /withheld/, 'the page must report what it withheld');
});

/* ── 2 · A PICK CARRIES ITS PROVENANCE ────────────────────────────────── */

test('⭐ THE GUARD · applyGalleryPick writes gallery_pick AND the library_asset_id together', () => {
  const body = windowOf(
    read(ACTIONS),
    'export async function applyGalleryPick(',
    /\nexport (async )?function /,
  );

  assert.match(body, /source_kind: 'gallery_pick'/);
  assert.match(
    body,
    /isMoodboardSlotPosition\(input\.slotPosition\)/,
    'the position vocabulary is ONE list in lib/moodboard-slots.ts, never restated here',
  );
  assert.match(
    body,
    /library_asset_id: asset\.assetId/,
    'the id must come from the re-read asset — not from the client, and never null',
  );
  assert.doesNotMatch(
    body,
    /library_asset_id: null/,
    'a gallery pick with a null provenance is the defect MB10 exists to close',
  );
  // The colours are re-read server-side; the browser only ever had swatches.
  assert.match(body, /shapeGalleryPage\(/);
  assert.equal(count(body, 'sampled_hex_1: asset.swatches[0]'), 1);
});

test('the template-seeding path records provenance too — it used to claim url_paste', () => {
  // applyMoodboardTemplate has copied library photos into inspiration slots
  // since the theme gallery shipped, writing source_kind='url_paste': a
  // Setnayan library asset permanently recorded as something the couple pasted
  // off the internet. Nothing rendered differently, which is why it lasted.
  const src = read(ACTIONS);
  assert.equal(
    count(src, "source_kind: 'url_paste'"),
    0,
    'no writer in this module may still claim a library photo was pasted',
  );
  assert.equal(
    count(src, "source_kind: 'gallery_pick'"),
    2,
    'both library-sourced writers (the picker and template seeding) declare it',
  );
});

/* ── 3 · THE CLIENT DOES NOT SET THE CAP, AND PAGES BY OFFSET ─────────── */

test('⭐ THE GUARD · the picker never sends a limit — the cap cannot be client-side', () => {
  const src = read(PICKER);
  const loader = windowOf(src, 'const loadPage = useCallback(', /\n  useEffect\(/);

  assert.match(loader, /fetchAction\(\{ slotKey, offset \}\)/);
  // Reading `page.limit` back off the server's answer is required (it drives
  // the offset cursor). SENDING one is what must never happen — a cap the
  // client sets is a cap the client can remove.
  assert.doesNotMatch(
    loader,
    /limit:/,
    'a client-passed limit is a cap the client can remove; the server clamps instead',
  );
  assert.match(loader, /page\.limit/, 'the cursor must use the limit the SERVER applied');
  assert.match(
    loader,
    /setLoadedThrough\(page\.offset \+ page\.limit\)/,
    'paging walks the SERVER-reported offset+limit',
  );
  assert.match(loader, /setLoadError\(true\)/, 'a dead fetch must be shown, not blanked');
});

test('⭐ THE GUARD · "Show more" pages by offset, NOT by how many rows arrived', () => {
  const src = read(PICKER);
  // A page may legitimately return fewer showable photos than rows (an
  // unverified shop, an asset with no colours). Counting arrivals would
  // re-request rows already seen and stall short of the end.
  assert.match(src, /onClick=\{\(\) => void loadPage\(loadedThrough\)\}/);
  assert.doesNotMatch(src, /loadPage\(assets\.length\)/);
  assert.equal(count(src, 'void loadPage('), 3, 'mount, retry, show-more — no fourth caller');
});

test('the picker asks for NOTHING until it is mounted by a tap', () => {
  const board = read(BOARD);
  // The component only exists while a slot is open, so drawing the inspiration
  // board costs zero gallery queries — the same "loads nothing until narrowed"
  // rule template-gallery.tsx follows.
  assert.match(board, /openGallerySlot !== null &&/);
  assert.match(board, /setOpenGallerySlot\(\(prior\) => \(prior === slot\.k \? null : slot\.k\)\)/);
});

/* ── 4 · THE WIRES. page.tsx → board → picker → the real actions ──────── */

test('⭐ THE GUARD · page.tsx hands the board the REAL actions, not a stub', () => {
  const mount = windowOf(read(PAGE), '<InspirationBoard', /\/>/);
  assert.match(mount, /fetchGalleryAction=\{fetchGalleryAssets\}/);
  assert.match(mount, /applyGalleryAction=\{applyGalleryPick\}/);
  assert.match(
    mount,
    /gallerySlots=\{GALLERY_SLOT_KEYS\}/,
    'the slots must be the DERIVED list, never a literal array typed here',
  );
});

test('⭐ THE GUARD · the board hands the picker the actions it was given', () => {
  const mount = windowOf(read(BOARD), '<GalleryPicker', /\n            \/>/);
  assert.match(mount, /fetchAction=\{fetchGalleryAction!\}/);
  assert.match(mount, /applyAction=\{applyGalleryAction!\}/);
  assert.match(
    mount,
    /emptyPositions=\{emptyPositionsFor\(openGallerySlot\)\}/,
    'free cells must be read off the same state the grid paints from',
  );
  assert.match(
    mount,
    /onSaved=\{\(pos, url, credit\) =>/,
    'the credit crosses back with the save — one derivation, not two',
  );
});

test('the button only appears for slots a trade actually supplies', () => {
  const board = read(BOARD);
  assert.match(board, /galleryWired && gallerySlotSet\.has\(slot\.k\)/);
  assert.match(
    board,
    /const galleryWired = Boolean\(fetchGalleryAction && applyGalleryAction\)/,
    'a button that cannot fetch is worse than no button',
  );
});

/* ── 5 · THE CREDIT REACHES THE BOARD, NOT JUST THE PICKER ───────────── */

test('⭐ THE GUARD · a saved supplier photo shows its credit on the BOARD tile', () => {
  const src = read(BOARD);
  // Otherwise the credit lasts exactly as long as the picker was open, and the
  // couple can never answer "whose bouquet was that?" a week later.
  const tile = windowOf(src, '  if (tile) {', /\n  return \(\n    <label/);
  assert.match(tile, /\{tile\.credit \?/, 'the tile must render its own credit');
  assert.match(tile, /\{tile\.credit\}/);
});

test('⭐ THE GUARD · page.tsx resolves the credit SERVER-side, through the library asset', () => {
  const src = read(PAGE);
  assert.match(src, /library_asset_id,/, 'the inspiration read must fetch the provenance');
  assert.match(src, /shop:vendor_profiles \( business_name, services \)/);
  assert.match(
    src,
    /r\.library_asset_id && shopName/,
    'no provenance or no shop name → no credit, never a guessed one',
  );
  assert.equal(
    count(src, 'creditLine('),
    1,
    'one place builds the credit string in this file',
  );
});
