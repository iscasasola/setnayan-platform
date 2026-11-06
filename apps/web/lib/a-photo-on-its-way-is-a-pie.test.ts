/**
 * a-photo-on-its-way-is-a-pie.test.ts — IN A GALLERY, AN UPLOAD IS THE 0–100 PIE, AND EVERY ✕ IS ROUND.
 *
 * Controller, 2026-10-08, from two pictures of Studio › Love Story's photo slots:
 *   · the uploading tile drew a small spinner and a thin GOLD bar with "27%" under it — the owner's ruling for a
 *     measured wait is the 0–100 PIE in the accent (*"when pressed. show a loading screen 0-100 pie to know how long
 *     til it uploads"*; gallery § 21: *"the upload shows a real 0 to 100 pie, then the picture with a ✕"*);
 *   · the ✕ on a kept photo was a tall oval — a bare 24 px button, stretched by the app's 44 px button floor.
 *
 * Both live in the shared uploader's `gallery` layout (`app/_components/file-upload.tsx`). The runner has no DOM and
 * a tile in flight exists only after a pick, so the markup is read from the source; the measuring (width = height on
 * each ✕, the pie's figure) is done in a browser on the review copy.
 *
 *   (1) THE PIE — the uploading tile is a pie filled by the upload's own measured figure, in the accent token, with
 *       that figure on it; no spinner, no bar beside it.
 *   (2) EVERY ✕ — kept, uploading and failed tiles wear ONE round 44 px target carrying a 24 px disc.
 *   (3) NOBODY ELSE IS RESTYLED — the one-line row layout keeps its spinner and bar; `gallery` is worn by exactly the
 *       surfaces listed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const up = () => read('app/_components/file-upload.tsx');
/** The gallery's tiles, and the row layout's — the two halves of the uploader's list. */
function halves() {
  const s = up();
  const g = s.indexOf('{(isGallery && (inFlight.length > 0 || items.length > 0)) || failed.length > 0 ? (');
  const r = s.indexOf('{!isGallery &&', g);
  assert.ok(g > -1 && r > g, 'anti-vacuity: the gallery branch was not found');
  return { gallery: s.slice(g, r), rows: s.slice(r) };
}

test('(1) the uploading tile is the 0–100 pie: filled by the measured figure, in the accent, the figure on it — no spinner, no bar', () => {
  const { gallery } = halves();
  const tile = gallery.slice(gallery.indexOf('{inFlight.map((item) => ('), gallery.indexOf('{failed.map((item) => ('));
  assert.ok(tile.length > 300, 'anti-vacuity: the uploading tile was not found');
  // The pie is filled by `item.progress` — the figure `sendToStorage` measures from the PUT — and by nothing else.
  assert.match(tile, /data-upload-pie=\{item\.progress\}/);
  assert.match(tile, /style=\{\{ background: `conic-gradient\(rgb\(var\(--sn-accent\)\) \$\{item\.progress\}%, [^`]+ 0\)` \}\}/, 'the pie is not filled by the measured figure, or not in the accent token');
  // The figure is ON the pie, in the accent.
  assert.match(tile, /<span className="[^"]*\brounded-full\b[^"]*\btext-sn-accent\b[^"]*">\s*\{item\.progress\}%\s*<\/span>/);
  assert.equal((tile.match(/(?<!\$)\{item\.progress\}%/g) ?? []).length, 1, 'the figure is printed twice on the tile');
  // No spinner beside a measured figure, no bar, and no colour of its own.
  assert.doesNotMatch(tile, /Loader2|animate-spin|animate-pulse/, 'a spinner sits beside the measured figure');
  assert.doesNotMatch(tile, /width: `\$\{item\.progress\}%`|h-1\.5/, 'the thin bar is still drawn');
  assert.doesNotMatch(tile, /terracotta|mulberry|gild|gold|#[0-9a-fA-F]{3,8}\b/, 'the pie wears a colour written by hand');
  // The figure handed to a parent (Done's "Uploading… N%") is the same one.
  assert.match(up(), /const flyingPct = inFlight\.length > 0 \? inFlight\[0\]!\.progress : null;/);
});

test('(2) every ✕ on a gallery tile is ONE round 44 px target carrying a 24 px disc — kept, uploading, failed', () => {
  const s = up();
  const x = /const TILE_X = '([^']+)';/.exec(s)?.[1]?.split(/\s+/) ?? [];
  const disc = /const TILE_X_DISC = '([^']+)';/.exec(s)?.[1]?.split(/\s+/) ?? [];
  // Round, and as wide as it is tall — at the app's own 44 px floor, so the floor cannot stretch it.
  for (const c of ['h-11', 'w-11', 'rounded-full', 'absolute']) assert.ok(x.includes(c), `the ✕ target lost ${c}`);
  assert.ok(!x.some((c) => /^(h|w|min-h|min-w)-(?!11$)/.test(c)), `the ✕ target has a second size: ${x.join(' ')}`);
  for (const c of ['h-6', 'w-6', 'rounded-full']) assert.ok(disc.includes(c), `the ✕ disc lost ${c}`);
  const { gallery } = halves();
  // Each ✕: from its own `<button` to its name (an arrow's `>` ends a tag for a simple pattern, so cut by hand).
  const closers = [...gallery.matchAll(/aria-label=\{`(?:Remove|Cancel) [^`]*`\}/g)].map((m) => gallery.slice(gallery.lastIndexOf('<button', m.index), m.index! + m[0].length));
  assert.equal((gallery.match(/<button\b/g) ?? []).length, 4, 'anti-vacuity: the gallery holds other buttons than its three ✕ and Try again');
  assert.deepEqual(
    closers.map((b) => /aria-label=\{`(\w+) \$\{item\.(file\.name|filename)\}`\}/.exec(b)?.slice(1).join(' ')),
    ['Remove filename', 'Cancel filename', 'Remove file.name'],
    'a tile lost its ✕, or gained one that is not named',
  );
  for (const b of closers) assert.match(b, /className=\{TILE_X\}/, `a ✕ is drawn its own way: ${b}`);
  assert.equal((gallery.match(/<span className=\{TILE_X_DISC\}>/g) ?? []).length, 3);
  // Nothing in the gallery still draws the bare 24 px button the floor stretched.
  assert.doesNotMatch(gallery, /<button\b[^>]*className="[^"]*\bh-6 w-6\b/, 'a bare 24 px button is back — the app’s button floor makes it an oval');
  // Reachable without hover (a phone has none).
  for (const b of closers) assert.doesNotMatch(b, /opacity-0|group-hover:/);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

test('(3) nobody else is restyled: the row layout keeps its spinner and bar, and `gallery` is worn by exactly the surfaces listed', () => {
  const { rows } = halves();
  const flying = rows.slice(rows.indexOf('{inFlight.map((item) => ('));
  assert.match(flying, /<Loader2 className="h-5 w-5 animate-spin"/, 'the row layout lost its spinner');
  assert.match(flying, /style=\{\{ width: `\$\{item\.progress\}%` \}\}/, 'the row layout lost its bar');
  assert.match(flying, /\{item\.progress\}% · \{bytesToHuman\(item\.size\)\}/);
  assert.doesNotMatch(rows, /data-upload-pie|TILE_X/, 'the row layout was given the gallery’s pie or its ✕');
  // WHO WEARS `gallery` — and so shows the pie and the round ✕. A new wearer is added here on purpose.
  const wearers = walk('app').filter((f) => f !== 'app/_components/file-upload.tsx' && /<FileUpload\b[^>]*?\svariant="gallery"/s.test(read(f)));
  assert.deepEqual(wearers.sort(), [
    'app/dashboard/[eventId]/website/our-story/_components/moment-order-cards.tsx',
    'app/vendor-dashboard/services/_components/showcase-media-fields.tsx',
  ]);
});
