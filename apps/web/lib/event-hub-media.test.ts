/**
 * GUARD — the Event Hub album finds the files the Hub points at (owner 2026-10-23), each once; music and other
 * events' files are never in it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubMediaRefs } from './event-hub-media';

const EV = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-2222-3333-4444-555555555555';

test('pictures and clips under the couple-media folders, each once, refs kept whole', () => {
  const text = JSON.stringify({
    hero: `r2://setnayan-media/events/${EV}/landing-page-hero/abc-cover.jpg`,
    again: `r2://setnayan-media/events/${EV}/landing-page-hero/abc-cover.jpg`,
    film: `https://pub.r2.dev/events/${EV}/hero-video/def-film.mp4`,
    widget: [{ bg: `r2://setnayan-media/events/${EV}/scene-background/ghi-bg.webp` }],
  });
  const got = hubMediaRefs(text, EV);
  assert.deepEqual(
    got.map((r) => [r.kind, r.ref]),
    [
      ['photo', `r2://setnayan-media/events/${EV}/landing-page-hero/abc-cover.jpg`],
      ['clip', `https://pub.r2.dev/events/${EV}/hero-video/def-film.mp4`],
      ['photo', `r2://setnayan-media/events/${EV}/scene-background/ghi-bg.webp`],
    ],
  );
});

test('music, paperwork and another event are never pictures in the album', () => {
  const text = JSON.stringify([
    `r2://setnayan-media/events/${EV}/site-music/a-song.mp3`,
    `r2://setnayan-media/events/${EV}/paperwork/contract.jpg`,
    `r2://setnayan-media/events/${OTHER}/landing-page-hero/x.jpg`,
  ]);
  assert.deepEqual(hubMediaRefs(text, EV), []);
});
