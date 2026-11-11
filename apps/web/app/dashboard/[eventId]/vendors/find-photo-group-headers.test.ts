/**
 * find-photo-group-headers.test.ts — 🖼 FIND'S GROUPS OPEN ON A PHOTO HEADER THAT PINS (owner 2026-11-09: *"event
 * dashboard> suppliers> find still doesn't have the photo effect done for the pinned group rows"*).
 *
 * Held, on what RENDERS:
 *   1 · a group whose categories have a taxonomy photo opens on the photo band (a lazy, sized <img>, the count on it);
 *   2 · a group with none is the plain title row — no band, no <img>, no empty box — its count as the small line;
 *   3 · EVERY group header (Popular included) is the shared `PhotoGroupHeader`, and every one is `sticky`, inside its
 *       own <section> (so the next group's header pushes it up);
 *   4 · the photo is the ONE taxonomy source's (`TaxonomySnapshot.categoryPhotos`, Admin › Categories), picked by
 *       `pickFindHeaderPhotos` — no photo map in the Find code, and the read folds it into the read it already makes.
 *
 * Sabotage (2026-11-09, each run and reverted): `sticky` dropped from the header row → 1, 2, 3 red; the band drawn
 * without a photo → 2 red; `loading="lazy"` removed → 1 red; the Popular section back on a plain <h3> → 3 red;
 * `pickFindHeaderPhotos` reading a literal `/taxonomy/tiles/` path → 4 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhotoGroupHeader } from '@/app/_components/photo-group-header';
import { buildFindList, pickFindHeaderPhotos, type FindList } from '@/lib/supplier-find';
import { stripComments } from '@/lib/strip-comments';
import { FindCategoryList } from './_components/find-category-list';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(APP, '..', rel), 'utf8'));

/** Every header row's opening tag. */
const headerTags = (html: string) => html.match(/<div[^>]*data-photo-group-header=""[^>]*>/g) ?? [];
const isSticky = (tag: string) => /class="[^"]*\bsticky\b/.test(tag);

const head = (photoUrl: string | null) =>
  renderToStaticMarkup(React.createElement(PhotoGroupHeader, { title: 'Venue & food', count: '6 categories · 2 booked', photoUrl }));

test('1 · with a taxonomy photo: the photo band (lazy, sized), the count on it, the title row sticky', () => {
  const html = head('/taxonomy/tiles/led_wall.webp');
  assert.match(html, /data-photo-group-band=""/, 'no photo band');
  const img = html.match(/<img[^>]*>/)?.[0] ?? '';
  assert.match(img, /src="\/taxonomy\/tiles\/led_wall\.webp"/, 'the band does not draw the photo');
  assert.match(img, /loading="lazy"/, 'the photo is not lazy');
  assert.match(img, /width="\d+"/, 'the photo has no width');
  assert.match(img, /height="\d+"/, 'the photo has no height');
  assert.match(img, /alt=""/, 'a decorative photo must be alt=""');
  assert.match(html, /data-photo-group-count="">6 categories · 2 booked</, 'the count is not on the band');
  const tags = headerTags(html);
  assert.equal(tags.length, 1);
  assert.ok(isSticky(tags[0]!), 'the title row does not pin');
  assert.match(tags[0]!, /data-photo="photo"/);
  assert.match(html, /<h3[^>]*>Venue &amp; food<\/h3>/, 'the title is not the heading');
});

test('2 · without a photo: the plain title row — no band, no <img>, no empty box — the count as its small line', () => {
  const html = head(null);
  assert.doesNotMatch(html, /data-photo-group-band/, 'a band was drawn with no photo');
  assert.doesNotMatch(html, /<img/, 'an <img> was drawn with no photo');
  assert.doesNotMatch(html, /data-photo-group-thumb/, 'a thumb box was drawn with no photo');
  assert.doesNotMatch(html, /data-photo-group-count/, 'a count overlay was drawn with no photo');
  const tags = headerTags(html);
  assert.equal(tags.length, 1);
  assert.ok(isSticky(tags[0]!), 'the text row does not pin');
  assert.match(tags[0]!, /data-photo="none"/);
  assert.match(html, />6 categories · 2 booked</, 'the count is gone from the text row');
});

/** A wedding's list on the bench's code scope, with a photo on Venue & food's categories only. */
function weddingList(): FindList {
  const list = buildFindList({
    folders: [
      { tiles: [{ tile: 'reception', label: 'Reception' }, { tile: 'catering', label: 'Catering' }, { tile: 'cake', label: 'Cake' }] },
      { tiles: [{ tile: 'photo_video', label: 'Photo & video' }, { tile: 'florist', label: 'Florist' }, { tile: 'hmua', label: 'Hair & makeup' }] },
      { tiles: [{ tile: 'dj', label: 'DJ' }] },
    ] as never,
    eventType: 'wedding',
    solemn: false,
    booked: new Set(['catering']),
  });
  const refs = pickFindHeaderPhotos(list, { reception: '/a.webp', catering: '/b.webp' });
  return {
    ...list,
    popularPhotoUrl: refs.popular,
    groups: list.groups.map((g) => ({ ...g, photoUrl: refs.groups[g.id] ?? null })),
  };
}

test('3 · Find: EVERY group header is the shared one and pins, each in its own section — photo where the taxonomy has one', () => {
  const list = weddingList();
  const html = renderToStaticMarkup(
    React.createElement(FindCategoryList, { eventId: 'e1', list, bookedMeasured: true, eventType: 'wedding', solemn: false }),
  );
  const tags = headerTags(html);
  const expected = list.groups.length + (list.popular.length > 0 ? 1 : 0);
  assert.ok(list.groups.length >= 3 && list.popular.length > 0, 'the fixture lost its groups');
  assert.equal(tags.length, expected, 'a group (or Popular) is not drawn with the shared header');
  for (const t of tags) assert.ok(isSticky(t), `a group header does not pin: ${t}`);
  // Each header opens its own section — sticky containment is what lets the next one push it up.
  const sections = html.split(/<section\b/).slice(1);
  assert.equal(sections.length, expected);
  for (const s of sections) assert.equal(headerTags(s).length, 1, 'a section holds no header, or two');
  // Popular wears a photo of its own categories, Venue & food the other one (never the same picture twice while another is left);
  // Photos & video and Music have none in the taxonomy → their plain rows.
  const venueUrl = list.groups.find((g) => g.id === 'venue_food')?.photoUrl;
  assert.ok(list.popularPhotoUrl && venueUrl && venueUrl !== list.popularPhotoUrl, 'Popular and Venue & food open on the same photo');
  const venue = sections.find((s) => s.includes('data-find-group="venue_food"'))!;
  assert.ok(venue.includes(`src="${venueUrl}"`), 'Venue & food does not wear its own photo');
  const popular = sections.find((s) => s.includes('data-find-popular'))!;
  assert.ok(popular.includes(`src="${list.popularPhotoUrl}"`), 'Popular does not wear its photo');
  for (const id of ['look_style', 'photos_video', 'music_program']) {
    const s = sections.find((x) => x.includes(`data-find-group="${id}"`));
    if (!s) continue;
    assert.doesNotMatch(s, /<img/, `${id} has no photo in the taxonomy but drew one`);
    assert.match(s, /data-photo="none"/);
  }
});

test('4 · the photo is the ONE taxonomy source: picked from categoryPhotos, folded into the read, never a map in Find', () => {
  const list = weddingList();
  // a photo is the group's OWN category's; none → null
  const refs = pickFindHeaderPhotos(list, { florist: 'r2://samples/x.webp' });
  assert.equal(refs.groups.look_style, 'r2://samples/x.webp');
  assert.equal(refs.groups.venue_food, undefined);
  assert.equal(refs.popular, null, 'Popular (reception · catering · photo & video · …) has no photo here');
  // when every photo is taken, a group still shows one rather than a text row
  const shared = pickFindHeaderPhotos(list, { reception: '/only.webp' });
  assert.equal(shared.popular, '/only.webp');
  assert.equal(shared.groups.venue_food, '/only.webp');
  // empty strings are "no photo"
  assert.equal(pickFindHeaderPhotos(list, { reception: '  ', catering: '' }).groups.venue_food, undefined);

  const read = src('lib/supplier-find-read.ts');
  assert.match(read, /pickFindHeaderPhotos\(list, taxonomy\.categoryPhotos\)/, 'the read does not take the photos from the taxonomy it was handed');
  assert.match(read, /displayUrlForCatalogueArt/, 'the read does not resolve the photo the way Explore does');
  for (const f of ['lib/supplier-find.ts', 'lib/supplier-find-read.ts', 'app/dashboard/[eventId]/vendors/_components/find-category-list.tsx', 'app/_components/photo-group-header.tsx']) {
    assert.doesNotMatch(src(f), /taxonomy\/tiles\/|\.webp['"`]/, `${f} carries a photo path of its own`);
  }
});
