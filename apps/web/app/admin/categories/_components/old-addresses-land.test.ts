/**
 * old-addresses-land.test.ts — the Taxonomy Studio's own deep links still open
 * the same thing on "Categories & event types".
 *
 * `/admin/taxonomy?…` forwards here WITH its query (lib/legacy-redirects.ts,
 * KEEPS_QUERY — pinned by lib/legacy-redirects.test.ts); this pins the other
 * half: the page reads those old params. The Studio's links live in emails,
 * the admin search box's learned rows and the Ugat map.
 *
 * SABOTAGE PERFORMED AND UNDONE: the `view === 'vocab-event'` branch in
 * readState was deleted; the event-types assertion went red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { backHref, categoriesHref, readBack, readState } from './back';

test('?view=vocab-event / vocab-faith open the Event types and Religions lists', () => {
  assert.equal(readState({ view: 'vocab-event' }).list, 'event-types');
  assert.equal(readState({ view: 'vocab-faith' }).list, 'religions');
});

test('the Studio’s view chips become the Show ▾ filter', () => {
  assert.equal(readState({ view: 'requests' }).show, 'requests');
  assert.equal(readState({ view: 'unfiled' }).show, 'unfiled');
  assert.equal(readState({ view: 'scoped' }).show, 'scoped');
  assert.equal(readState({ view: 'faith' }).show, 'religion');
});

test('a bare ?open=<category> opens that category; a typed one is kept', () => {
  assert.equal(readState({ open: 'catering' }).open, 'c:catering');
  assert.equal(readState({ open: 's:lechonero' }).open, 's:lechonero');
  assert.equal(readState({ list: 'religions', open: 'Born Again' }).open, 'Born Again');
});

test('?q= carries over, and a junk list or show falls back to the default', () => {
  const s = readState({ q: '  lechon ', list: 'nonsense', show: 'nonsense' });
  assert.deepEqual(s, { list: 'categories', open: '', q: 'lechon', show: '' });
});

test('a save lands back on the same list, panel, search and filter', () => {
  const fd = new FormData();
  fd.set('_list', 'event-types');
  fd.set('_open', 'birthday');
  fd.set('_q', 'birth');
  fd.set('_show', 'requests'); // ignored outside the categories list
  assert.deepEqual(readBack(fd), { list: 'event-types', open: 'birthday', q: 'birth', show: 'requests' });
  assert.equal(
    backHref(fd, 'ok', 'Saved.'),
    '/admin/categories?list=event-types&q=birth&open=birthday&ok=Saved.',
  );
  assert.equal(categoriesHref({}), '/admin/categories');
});
