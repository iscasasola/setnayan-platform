/** 🧹 The form-media sweep keeps every file a form holds and deletes only the old orphans (lib/form-media-sweep-core.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORM_MEDIA_GRACE_MS, formMediaFolder, formMediaOrphans, keyOfFormMediaRef } from './form-media-sweep-core';

const SHOP = '00000000-0000-4000-8000-0000000000cc';
const F = formMediaFolder(SHOP);
const NOW = Date.parse('2026-11-08T00:00:00Z');
const old = new Date(NOW - FORM_MEDIA_GRACE_MS - 1);
const fresh = new Date(NOW - 60_000);

test('kept: referenced (live or retired), fresh, outside the folder, or of unknown age', () => {
  const listed = [
    { key: `${F}a.jpg`, lastModified: old },
    { key: `${F}b.jpg`, lastModified: old },
    { key: `${F}c.jpg`, lastModified: fresh },
    { key: `vendors/${SHOP}/logo/x.png`, lastModified: old },
    { key: `${F}d.jpg`, lastModified: null },
  ];
  assert.deepEqual(formMediaOrphans(listed, [`r2://setnayan-media/${F}a.jpg`], F, NOW), [`${F}b.jpg`]);
});

test('a ref names the media bucket or nothing', () => {
  assert.equal(keyOfFormMediaRef(`r2://setnayan-thread-files/${F}a.jpg`), null);
  assert.equal(keyOfFormMediaRef(`r2://setnayan-media/${F}a.jpg`), `${F}a.jpg`);
});
