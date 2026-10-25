/**
 * GUARD — THE ALBUMS OF AN EVENT'S MEMORIES (owner 2026-10-23; controller's call for Challenges the same day):
 * All · Papic · Challenges · Event Hub · Suppliers · Your uploads; Challenges grouped by challenge in the board's
 * order, only the ones answered; "Needs a look" = screened or reported; moderation on Papic files only; the Event Hub
 * album draws only image files in THIS event's own Hub folders.
 *
 * Sabotage (2026-10-23): `inAlbum` counts every file in Challenges → red; `challengeGroups` reverses the board → red;
 * `hubImageRefs` admits another event's folder → red. Restored → green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEMORIES_ALBUMS, albumCountWords, canModerate, challengeGroups, hubImageRefs, inAlbum, isMemoriesAlbum, needsALook } from './event-memories';

test('the albums, in the owner’s order', () => {
  assert.deepEqual(MEMORIES_ALBUMS.map((a) => a.label), ['All', 'Papic', 'Challenges', 'Event Hub', 'Suppliers', 'Your uploads']);
  assert.ok(isMemoriesAlbum('challenges') && !isMemoriesAlbum('gallery'));
});

test('each file sits in All, its own source, and Challenges only when it answered one', () => {
  const guest = { source: 'papic' as const, challengeId: null };
  const answer = { source: 'papic' as const, challengeId: 'm1' };
  const hub = { source: 'hub' as const, challengeId: null };
  assert.ok(inAlbum(guest, 'all') && inAlbum(guest, 'papic') && !inAlbum(guest, 'challenges'));
  assert.ok(inAlbum(answer, 'challenges') && inAlbum(answer, 'papic'));
  assert.ok(inAlbum(hub, 'hub') && !inAlbum(hub, 'papic') && !inAlbum(hub, 'suppliers'));
  assert.ok(inAlbum({ source: 'uploads', challengeId: null }, 'uploads'));
});

test('Challenges: by challenge, in the board’s order, only the answered ones', () => {
  const board = [
    { id: 'a', title: 'The first dance', supplier: null },
    { id: 'b', title: 'Your table', supplier: null },
    { id: 'c', title: 'A polaroid with the props', supplier: 'Lumen Studio' },
  ];
  const items = [
    { id: '1', challengeId: 'c' },
    { id: '2', challengeId: 'a' },
    { id: '3', challengeId: null },
    { id: '4', challengeId: 'c' },
  ];
  const groups = challengeGroups(items, board);
  assert.deepEqual(groups.map((g) => g.challenge.id), ['a', 'c'], 'out of the board’s order, or an empty challenge drawn');
  assert.deepEqual(groups[1]!.items.map((i) => i.id), ['1', '4']);
  assert.equal(groups[1]!.challenge.supplier, 'Lumen Studio');
});

test('needs a look · who may moderate · the count words', () => {
  assert.ok(needsALook({ look: 'screened' }) && needsALook({ look: 'reported' }));
  assert.ok(!needsALook({ look: 'hidden' }) && !needsALook({ look: 'ok' }));
  assert.ok(canModerate({ source: 'papic' }) && canModerate({ source: 'uploads' }));
  assert.ok(!canModerate({ source: 'hub' }) && !canModerate({ source: 'suppliers' }));
  const f = (n: number) => n.toLocaleString('en-PH');
  assert.equal(albumCountWords(1284, 'all', f), '1,284 photos');
  assert.equal(albumCountWords(1, 'papic', f), '1 photo');
  assert.equal(albumCountWords(4, 'hub', f), '4 files');
});

test('the Event Hub album: image files in this event’s own Hub folders, nothing else', () => {
  const E = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';
  const refs = hubImageRefs(
    [
      { landing_page_hero_image_url: `r2://setnayan-media/events/${E}/landing-page-hero/a.jpg` },
      [{ widget_type: 'hero', config_json: { main: { media: `r2://setnayan-media/events/${E}/std-background/b-Prenup7.jpg` } } }],
      { music: `r2://setnayan-media/events/${E}/site-music/song.mp3` },
      { other: `r2://setnayan-media/events/00000000-0000-0000-0000-000000000000/our-photos/x.jpg` },
      { selfie: `r2://setnayan-media/events/${E}/guest-selfies/s.jpg` },
      { dup: `r2://setnayan-media/events/${E}/landing-page-hero/a.jpg` },
      { web: `https://example.com/events/${E}/our-photos/y.jpg` },
    ],
    E,
  );
  assert.deepEqual(refs, [
    { ref: `r2://setnayan-media/events/${E}/landing-page-hero/a.jpg`, use: 'Cover photo' },
    { ref: `r2://setnayan-media/events/${E}/std-background/b-Prenup7.jpg`, use: 'Background' },
  ]);
});
