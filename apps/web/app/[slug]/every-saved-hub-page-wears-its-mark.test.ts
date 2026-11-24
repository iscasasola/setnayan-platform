/**
 * GUARD — R18 (owner 2026-11-24): every Event Hub page the guest's saved copy keeps WEARS the saved mark, and the mark
 * carries the seal the worker keeps it by. A kept room that stops drawing `RoomSavedMark` would still be saved from the
 * hub — but it would never say so, and opening it first (a table QR) would save nothing. A hub page that stops drawing
 * `HubSavedMark` would never be kept at all (no seal → the worker refuses it), silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { COPY_VIEWER_ATTR, GUEST_HUB_ROOMS_KEPT } from '@/lib/offline-copies';

const HERE = import.meta.dirname;
const read = (p: string) => readFileSync(path.join(HERE, p), 'utf8');
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('every kept room draws the hub’s saved mark, once, for its own viewer', () => {
  for (const room of GUEST_HUB_ROOMS_KEPT) {
    const src = code(read(`${room}/page.tsx`));
    const n = (src.match(/<RoomSavedMark slug=\{slug\} \/>/g) ?? []).length;
    assert.equal(n, 1, `/${room} draws the saved mark ${n} times`);
  }
  const mark = code(read('_components/room-saved-mark.tsx'));
  assert.match(mark, /roomCopyViewer\(event\.event_id\)/, 'the room mark no longer asks the one viewer rule');
  assert.match(mark, /if \(!viewer\) return null/, 'the room mark draws for nobody’s copy');
  assert.match(mark, /<OfflineViewerScript viewer=\{viewer\} \/>/, 'a room no longer tells the worker who is on this phone');
  assert.match(code(read('_lib/room-copy-viewer.server.ts')), /guestCopyViewer\(/, 'the rooms decide whose copy it is themselves');
});

test('the hub page draws the mark for its own viewer, at the top, with the seal — and decides the viewer by the one rule', () => {
  const page = code(read('page.tsx'));
  assert.match(page, /const ownDayViewer: string \| null = guestCopyViewer\(/, 'the hub no longer asks the one rule');
  assert.match(page, /return wearDraft\(\s*<>\s*\{hubSaved\}\s*<SiteBody/, 'the saved mark is not the first thing on the guest’s page');
  assert.match(page, /<HubSavedMark\b/);
  assert.match(page, /const hubSaved =[\s\S]{0,260}<OfflineViewerScript viewer=\{ownDayViewer\} \/>/, 'the hub page no longer tells the worker who is on this phone');
  const view = code(read('../_components/offline-ready/hub-saved-mark.tsx'));
  assert.match(view, /\[COPY_VIEWER_ATTR\]: viewer/, 'the mark no longer carries the seal');
  assert.equal(COPY_VIEWER_ATTR, 'data-sn-copy-viewer');
  // The seal is drawn even where no line is (outside the window, or on Me where "Your schedule" wears the mark).
  assert.match(view, /if \(!mark\) return <div data-hub-saved="" \{\.\.\.seal\} hidden \/>/);
});
