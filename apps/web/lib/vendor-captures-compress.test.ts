/**
 * A SUPPLIER'S PHOTOGRAPHS SHRINK LIKE EVERYONE ELSE'S — owner 2026-08-24,
 * *"compress it as well."*
 *
 * Three joints, and every one of them was missing before this. Each would have
 * failed SILENTLY and in a different direction, which is why each is pinned:
 *
 *   1. THE WEB COPY IS MADE. Without it there is nothing for the sweep to
 *      replace an original with, so the table is not one it drops from — it is
 *      one it cannot see. Nothing errors; the bill just grows.
 *   2. THE COUPLE'S COPY GOES OUT FIRST. The sweep refuses to drop anything not
 *      confirmed in the couple's Drive hand-off, and nothing enqueued a
 *      supplier's captures — so wiring the sweep alone would have been inert on
 *      exactly the Drive-connected celebrations where it matters.
 *   3. THE SWEEP CAN SEE THE TABLE. And photos only: a vendor clip has no
 *      transcoded video copy, so it must keep its original.
 *
 * Source-scanned, comments stripped first — every file below carries prose
 * naming the strings hunted here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { vendorPhotoItem } from './papic-fullres-drop-core';

const ROOT = join(import.meta.dirname, '..');
const code = (p: string) =>
  readFileSync(join(ROOT, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const ROUTE = 'app/api/vendor/papic-capture/route.ts';

test('the mapper carries exactly what the drop predicate reads', () => {
  const item = vendorPhotoItem({
    capture_id: 'c1',
    event_id: 'e1',
    r2_object_key: 'r2://setnayan-media/orig.jpg',
    display_r2_key: 'r2://setnayan-media/orig.display.avif',
    orig_bytes: 4_000_000,
    captured_at: '2026-01-01T00:00:00Z',
    full_res_dropped_at: null,
    preserved_at: null,
  });
  assert.equal(item.table, 'vendor_papic_captures');
  assert.equal(item.idCol, 'capture_id');
  assert.equal(item.kind, 'photo');
  assert.equal(item.display_r2_key, 'r2://setnayan-media/orig.display.avif');
  assert.equal(item.orig_bytes, 4_000_000);
  // A photo must NEVER present as a clip candidate: the clip path deletes a raw
  // video after a custody HEAD, and a photo has no video to check.
  assert.equal(item.clip_web_r2_key, null);
  assert.equal(item.photo_type, null);
  assert.equal(item.media_type, null);
});

test('a capture with no web copy yet is not a droppable shape', () => {
  const item = vendorPhotoItem({
    capture_id: 'c2',
    event_id: 'e1',
    r2_object_key: 'r2://setnayan-media/orig.jpg',
    display_r2_key: null,
    orig_bytes: null,
    captured_at: '2026-01-01T00:00:00Z',
    full_res_dropped_at: null,
    preserved_at: null,
  });
  // The query already filters these out; the mapper must not invent a copy.
  assert.equal(item.display_r2_key, null);
});

test('the capture route MAKES the web copy, through the shared generator', () => {
  const src = code(ROUTE);
  assert.match(
    src,
    /generatePhotoDerivatives\(\s*r2Ref,\s*'vendor_papic_captures',\s*'capture_id',\s*captureId,\s*\)/,
    'a photo must get the same three AVIF sizes every other photograph gets',
  );
  assert.match(
    src,
    /generateClipThumb\(\s*posterRef,\s*'vendor_papic_captures',\s*'capture_id',\s*captureId,\s*\)/,
    'a clip’s STILL must compress even though its video keeps the original',
  );
  // A SECOND hook, not folded into the NSFW one — that one returns early on a
  // posterless clip because there is nothing to SCREEN, which is not a reason
  // to skip compressing a photo.
  assert.ok(
    [...src.matchAll(/after\(async \(\) => \{/g)].length >= 2,
    'compression must not inherit the screening hook’s early return',
  );
});

test('the COUPLE’S copy is enqueued — the inverse before the destructive half', () => {
  const src = code(ROUTE);
  assert.match(
    src,
    /enqueueDriveCopy\(\{/,
    'nothing enqueued a supplier’s captures, so the sweep would defer them forever ' +
      'on a Drive-connected celebration and drop them with no copy on an unconnected one',
  );
  assert.match(
    src,
    /sourceTable: 'vendor_papic_captures',/,
    'the hand-off row must say which table it came from',
  );
});

test('the sweep sees the table — photos ONLY', () => {
  const src = code('lib/papic-fullres-drop.ts');
  assert.equal(
    [...src.matchAll(/\.from\('vendor_papic_captures'\)/g)].length,
    1,
    'exactly one candidate query, and it is the photo one',
  );

  /*
   * 🪤 SCOPED TO **THIS** QUERY, NOT THE FILE.
   *
   * The first cut of this test matched `.not('display_r2_key', 'is', null)`
   * anywhere in the module — and THREE queries carry that line (seat photos,
   * guest photos, and this one). Deleting it from the supplier query left two
   * behind and the test stayed GREEN at 3 → 2, while the single most dangerous
   * regression in this change sailed through: a capture whose compression had
   * not landed becoming eligible, and its original deleted with no copy to
   * replace it.
   *
   * Measured before → after, which is the only reason it was caught.
   */
  const vendorQuery = src.slice(
    src.indexOf(".from('vendor_papic_captures')"),
    src.indexOf('.limit(limit)', src.indexOf(".from('vendor_papic_captures')")),
  );
  assert.ok(vendorQuery.length > 0 && vendorQuery.length < 1200, 'query block located');
  assert.match(vendorQuery, /\.eq\('media_type', 'photo'\)/, 'photos only');
  // THE SAFETY PROPERTY: no web copy ⇒ not a candidate.
  assert.match(
    vendorQuery,
    /\.not\('display_r2_key', 'is', null\)/,
    'a capture whose compression has not landed must never be a drop candidate — ' +
      'without this line an original is deleted with nothing to replace it',
  );
  assert.match(
    vendorQuery,
    /\.is\('full_res_dropped_at', null\)/,
    'and never dropped twice',
  );
  assert.match(
    vendorQuery,
    /\.in\('event_id', expiredEventIds\)/,
    'and only once the retention window has passed',
  );
  // No vendor CLIP mapper exists, deliberately — it would be refused every pass.
  assert.doesNotMatch(
    code('lib/papic-fullres-drop-core.ts'),
    /export function vendorClipItem/,
    'a vendor clip has no transcoded video copy to be replaced by',
  );
});

test('EVERY candidate query keeps its no-web-copy safety filter — derived, not listed', () => {
  /*
   * 🔑 THE ONE LINE BETWEEN THIS SWEEP AND A DELETED PHOTOGRAPH.
   *
   * The sweep deletes a full-res original and lets the compressed copy become
   * the photograph. `.not('<web copy>', 'is', null)` is what guarantees the copy
   * EXISTS first. Remove it from any candidate query and the sweep deletes
   * originals with nothing to replace them — the one outcome the owner's
   * "not delete, just compress" rule exists to forbid.
   *
   * 🪤 FOUND BY ACCIDENT, AND IT WAS ALREADY OPEN. While mutation-testing the
   * supplier query, a mis-aimed substitution removed this filter from the
   * COUPLE'S guest-capture query instead — and the entire 9785-test suite passed.
   * Nothing guarded it for any table. It is guarded for all of them now.
   *
   * DERIVED FROM THE CODE, not from a list of tables I happened to think of: a
   * fourth capture table added later is checked the day it appears. FLOORED at
   * three so an empty sweep — a renamed helper, a moved query — cannot pass by
   * finding nothing to check, which is how a guard becomes decoration.
   */
  const src = code('lib/papic-fullres-drop.ts');

  // Every `.from('<table>')` … `.limit(limit)` block that selects a drop
  // candidate. A candidate query is recognised by the column the drop stamps.
  const blocks: { table: string; body: string }[] = [];
  const fromRe = /\.from\('([a-z_]+)'\)/g;
  for (let m = fromRe.exec(src); m !== null; m = fromRe.exec(src)) {
    const end = src.indexOf('.limit(limit)', m.index);
    if (end === -1) continue;
    const body = src.slice(m.index, end);
    if (body.length > 2000) continue; // not a single query block
    if (!body.includes(".is('full_res_dropped_at', null)")) continue;
    blocks.push({ table: m[1]!, body });
  }

  assert.ok(
    blocks.length >= 3,
    `expected at least 3 drop-candidate queries, found ${blocks.length}. ` +
      'A floor, not a formality: if the shape of these queries changes and this ' +
      'finds nothing, the check must fail rather than silently pass.',
  );

  for (const { table, body } of blocks) {
    const isClipQuery = body.includes("'clip'");
    const required = isClipQuery
      ? ".not('clip_web_r2_key', 'is', null)"
      : ".not('display_r2_key', 'is', null)";
    assert.ok(
      body.includes(required),
      `${table} (${isClipQuery ? 'clip' : 'photo'}) candidates no longer require a ` +
        `web copy. Without ${required} this sweep deletes a full-res original ` +
        'with nothing to replace it — the photograph is gone, not compressed.',
    );
  }
});
