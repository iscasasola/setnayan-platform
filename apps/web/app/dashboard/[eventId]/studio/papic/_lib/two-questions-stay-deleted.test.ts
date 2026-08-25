/**
 * GUARD — the Papic page asks a couple TWO fewer questions, and stays that way.
 *
 * Owner, 2026-08-26, walking his own wedding's Papic page:
 *   · *"the photo quality is already set for us by default. we do not need to
 *     ask them."*
 *   · *"i was thinking of not asking for setnayan storage? what we want is to
 *     offer them to sync this to a google drive."*
 *
 * 🔑 THE STORAGE QUESTION WAS NEVER REAL. Measured on `origin/main` the day it
 * was deleted: `events.papic_storage_target` was read by exactly three files —
 * the card that drew it, the actions that wrote it, and the Drive disconnect
 * route — and by NO capture, upload or storage path. The comment describing
 * that branch is still a `TODO(0012)`. "Use my Google Drive only" never made
 * anything Drive-only; every photo has always landed in Setnayan storage,
 * including on the four production events sitting in `google_drive_only`.
 *
 * ⚠ DELETING A QUESTION IS NOT THE SAME AS DELETING ITS MACHINERY. The Drive
 * connect / connected / overflow / disconnect flow SURVIVES — recast as the
 * offer it always should have been. Rule 4 below fails if that is thrown out
 * with the question, because a Drive story is the only way a couple keeps
 * ORIGINALS once the full-res sweep runs.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE MATCHING. Every removal in this change left a
 * note behind NAMING the string it removed — including this file's own
 * docblock. A raw-source guard would report the defect it just fixed. The
 * stripper is a real state machine, not a line-prefix filter: a prefix filter's
 * survivors are mostly block-comment continuation lines, which is how a
 * previous sweep in this repo reported a clean pass over dirty source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE = join(PAPIC_DIR, 'page.tsx');

/** Strip // and /* *\/ comments and JSX {/* *\/} blocks, preserving string literals. */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i]!;
    const nxt = src[i + 1];
    if (quote) {
      if (c === '\\') { out += c + (nxt ?? ''); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i += 1; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i += 1; continue; }
    if (c === '/' && nxt === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && nxt === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2; continue;
    }
    out += c; i += 1;
  }
  return out;
}

const PAGE_SRC = readFileSync(PAGE, 'utf8');
const PAGE_CODE = stripComments(PAGE_SRC);

test('the comment stripper actually strips — otherwise every rule below is theatre', () => {
  // This change deliberately left notes naming the deleted strings. If the
  // stripper regressed, those notes would satisfy the rules and the guard would
  // pass while the questions were back on screen.
  assert.ok(
    PAGE_SRC.includes('Where your photos go'),
    'the page should still EXPLAIN the removal in a comment — if this fails, the note was deleted and this guard lost its own test subject',
  );
  assert.ok(
    !PAGE_CODE.includes('Where your photos go'),
    'the stripper left comment text behind — every rule below is now matching prose, not code',
  );
});

test('🚨 the couple is never asked to choose a photo quality', () => {
  for (const banned of ['Photo quality', 'QualityPicker', 'papic_quality_tier']) {
    assert.ok(
      !PAGE_CODE.includes(banned),
      `"${banned}" is back on the Papic page — the owner ruled the default is already right (2026-08-26)`,
    );
  }
});

test('🚨 no megapixel or file-size talk reaches a person', () => {
  // The old cards read "~12 MP · 3-5 MB per photo" and "1:1 original". None of
  // that is a wedding decision; it is our storage bill described to a customer.
  const jargon = /\b\d+\s?MP\b|\bMB per photo\b|megapixel|1:1 original/i;
  const hit = jargon.exec(PAGE_CODE);
  assert.equal(hit, null, `storage jargon is back on the page: ${hit?.[0]}`);
});

test('🚨 the couple is never asked WHERE their photos go', () => {
  for (const banned of [
    'Where your photos go',
    'Use my Google Drive only',
    'Setnayan storage',
    'StorageChoiceCard',
    'setPapicStorageR2',
    'setPapicStorageDrive',
    'Papic storage target',
  ]) {
    assert.ok(
      !PAGE_CODE.includes(banned),
      `"${banned}" is back — storage is not a question we ask; it is how the product works`,
    );
  }
});

test('⚠ …but Google Drive SURVIVES as an offer — the machinery was not thrown out', () => {
  assert.ok(PAGE_CODE.includes('DriveCopyCard'), 'the Drive copy card is gone');
  assert.ok(
    PAGE_CODE.includes('Send a copy to your Google Drive'),
    'the offer lost its words — a couple can no longer tell what Drive does for them',
  );
  for (const kept of ['DriveConnectCTA', 'DriveConnectedPanel']) {
    assert.ok(
      PAGE_CODE.includes(kept),
      `${kept} was deleted with the question — connecting Drive is how a couple keeps ORIGINALS after the full-res sweep`,
    );
  }
});
