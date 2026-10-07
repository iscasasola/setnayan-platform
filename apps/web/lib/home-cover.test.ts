/**
 * 🖼 THE EVENT HOME'S HEADER WEARS THE EVENT HUB'S MAIN BACKGROUND (owner
 * 2026-10-07: *"i thought this will use the main background image of the event
 * hub maker?"*) — and its words stay legible by the hub's own AA rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homeCoverOf, type HomeCoverInput } from './home-cover';
import { AA_BODY, compositeOver, contrastRatio } from './hub-legibility';
import { stripComments } from './strip-comments';

const main = (frame: string[] | null): HomeCoverInput => ({
  scene: { kind: 'photo', src: 'https://r2.example/main.jpg', ground: 'main', legibility: null },
  paper: null,
  mainFrame: frame,
  theme: 'house',
});

/** The ink against the veil laid over a sample, as the browser paints it. */
function contrastOver(cover: { ink: string; scrim: string }, sample: string): number {
  const m = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(cover.scrim)!;
  const hex = `#${[m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`;
  return contrastRatio(cover.ink, compositeOver(hex, Number(m[4]), sample));
}

test('🔴 the Main background is the header — its picture, not today’s colour', () => {
  const got = homeCoverOf(main(['#d9c4cf', '#f7f2ec', '#2b1d14']));
  assert.ok(got && got.kind === 'image', 'the header ignored the Event Hub’s main background');
  assert.equal(got.src, 'https://r2.example/main.jpg');
});

test('🔴 the words clear AA over every measured colour of the frame', () => {
  const frame = ['#ffffff', '#f7f2ec', '#c9a24b', '#2b1d14', '#000000'];
  const got = homeCoverOf(main(frame));
  assert.ok(got && got.kind === 'image');
  for (const s of frame) assert.ok(contrastOver(got, s) >= AA_BODY, `${s}: ${contrastOver(got, s).toFixed(2)}`);
});

test('an UNMEASURED frame is veiled for the worst case — never read as calm', () => {
  const got = homeCoverOf(main([]));
  assert.ok(got && got.kind === 'image');
  for (const s of ['#ffffff', '#000000', '#808080']) assert.ok(contrastOver(got, s) >= AA_BODY, s);
});

test('no Main background → the hub cover, with the cover’s own measured veil', () => {
  const got = homeCoverOf({
    scene: { kind: 'theme', src: '/themes/house.webp', ground: 'theme', legibility: { '--hub-ink': '#1e1a14', '--hub-scrim': 'rgba(247, 242, 236, 0.60)' } },
    paper: null,
    mainFrame: null,
    theme: 'house',
  });
  assert.deepEqual(got, { kind: 'image', src: '/themes/house.webp', ink: '#1e1a14', scrim: 'rgba(247, 242, 236, 0.60)' });
});

test('their colour or ombré → the paper; nothing chosen, or a wake → today’s colour', () => {
  assert.deepEqual(
    homeCoverOf({ scene: null, paper: { ground: { cream: '91 74 107', ink: '247 242 236', ombre: null } }, mainFrame: null, theme: 'house' }),
    { kind: 'paper', background: 'rgb(91 74 107)', ink: 'rgb(247 242 236)' },
  );
  assert.equal(homeCoverOf({ scene: null, paper: { ground: null }, mainFrame: null, theme: 'house' }), null);
  assert.equal(homeCoverOf({ scene: { kind: 'quiet' }, paper: null, mainFrame: null, theme: 'house' }), null);
  assert.equal(homeCoverOf(null), null);
});

test('the Home header is drawn from it, and the page reads it from the PUBLISHED event', () => {
  const card = stripComments(readFileSync(join(__dirname, '../app/dashboard/[eventId]/_components/home-first-screen.tsx'), 'utf8'));
  assert.match(card, /data-home-cover=\{ground\?\.kind \?\? 'colour'\}/);
  assert.match(card, /style=\{\{ background: ground\.scrim \}\}/, 'the picture has no veil under the words');
  const page = stripComments(readFileSync(join(__dirname, '../app/dashboard/[eventId]/page.tsx'), 'utf8'));
  assert.match(page, /ground=\{homeCover\}/);
  const server = stripComments(readFileSync(join(__dirname, './home-cover.server.ts'), 'utf8'));
  assert.doesNotMatch(server, /event_site_drafts|hubDraft/i, 'the Home header must never read an unapplied draft');
  assert.match(server, /dressEventCover\(/, 'a second resolver — ask Discover’s own');
});
