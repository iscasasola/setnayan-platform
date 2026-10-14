/**
 * 🎯 FOCUS MOVES THE PICTURE — A PHOTO AND A CLIP, ON A PHONE · and 🎬 THE BACKGROUND HOLDS NO DEAD HERO-VIDEO PART.
 *
 * Owner, Maker test 2026-10-14 (DECISION_LOG "MAKER TEST: SEVEN ISSUES"), verbatim:
 *   1. *"on maker-studio-look-background: there is source where you can upload photo and video but there is a part
 *      there hero video that has no use for the background."*
 *   2. *"focus not working"*
 *
 * (2) WHY IT DID NOTHING — measured, not guessed. Focus was Centre · Top · Bottom. The page's background COVERS the
 * screen, and a phone (375 × 812, 0.46 wide-to-tall) is taller than almost every photo (a square is 1, an upright
 * 4:5 is 0.8): on a phone the picture is cropped at its SIDES, so a vertical position moves nothing. Top · Bottom
 * only bite on a wide screen. And a clip took no Focus at all (`hubMainTakes` · the sanitiser dropped it). Now:
 *   (a) Left · Right join the list; ONE rule turns each word into CSS (`mainGroundPosition`), and the canvas bridge
 *       accepts exactly those words (`main-ground-preview.ts`, which imports nothing, spells them out — held equal);
 *   (b) a clip takes Focus: stored, laid on the canvas (its still AND its film), worn by the sample screen's film,
 *       and drawn on the guest page's film;
 *   (c) the guest page's film is held by the same rule — no second copy in class names.
 *
 * (1) The hero-video uploader under "Your photo or video" wrote `landing_page_hero_video_r2_key` — the hero's own
 * clip, never the main background, and never shown to a guest (`GUEST_HERO_VIDEO_PLAYBACK` is closed). The restudy's
 * list for this source (`BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.1) is cards: "Your cover photo · Save the Date
 * upload · Gallery · Your video ▶ + an Upload card". So the Studio's Background draws the hero video as the "Your
 * video" CARD (a pick makes it the background, and that clip DOES reach guests — `sceneClipRefForGuests`), and no
 * uploader of the hero's own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HUB_MAIN_FOCUSES, MAIN_GROUND_POSITIONS, hubMainTakes, mainGroundPosition, sanitizeHubMainGround, type HubMainGround } from './hub-canvas';
import { backgroundLayOf, lookGroundPictures } from './background-pick';
import { sanitizeMainGroundPreview } from '../app/[slug]/_components/main-ground-preview';
import { stripComments } from './strip-comments';

/* The components are compiled with the classic JSX runtime here — they read a global React. */
(globalThis as unknown as { React: unknown }).React = React;

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const E = 'app/dashboard/[eventId]/website/editor/_components';
const G = 'app/[slug]/_components';

const PHOTO_REF = 'r2://setnayan-media/events/E1/main-background/a.jpg';
const CLIP_REF = 'r2://setnayan-media/events/E1/main-background/b.mp4';
const POSTER_REF = 'r2://setnayan-media/events/E1/main-background/b.jpg';
const TINT = { match: false, frame: ['#f4efe6', '#1e1a12'] };
const pictures = lookGroundPictures(
  {
    loops: [],
    photoChoices: [],
    videoChoice: null,
    sceneUploads: [
      { ref: PHOTO_REF, url: 'https://media.test/a.jpg', kind: 'photo' },
      { ref: CLIP_REF, url: 'https://media.test/b.mp4', kind: 'snippet', poster: POSTER_REF, posterUrl: 'https://media.test/b.jpg' },
    ],
    cover: null,
    themeId: 'house',
  },
  () => false,
);

test('(2a) every Focus is a different crop, and Left · Right — the phone’s crop — are offered', () => {
  for (const f of ['left', 'right', 'top', 'bottom'] as const) assert.ok((HUB_MAIN_FOCUSES as readonly string[]).includes(f), `Focus ${f} is not offered`);
  const css = [null, ...HUB_MAIN_FOCUSES].map((f) => mainGroundPosition(f));
  assert.equal(new Set(css).size, css.length, 'two Focus words land on the same crop — one of them does nothing');
  assert.equal(mainGroundPosition('left'), 'left center');
  assert.equal(mainGroundPosition('right'), 'right center');
  assert.equal(mainGroundPosition(null), 'center');
  assert.deepEqual([...MAIN_GROUND_POSITIONS].sort(), [...css].sort(), 'the list of positions is not the rule’s own');
  // The canvas bridge (no imports: it ships to guests) spells the same words — no more, no fewer.
  const bridge = read(`${G}/main-ground-preview.ts`);
  const listed = /const POSITIONS = (\[[^\]]*\]);/.exec(bridge);
  assert.ok(listed, 'anti-vacuity: the bridge’s position list was not found');
  assert.deepEqual(JSON.parse(listed![1].replace(/'/g, '"')).sort(), [...MAIN_GROUND_POSITIONS].sort(), 'the canvas refuses a Focus the panel can pick');
  for (const at of MAIN_GROUND_POSITIONS) {
    const lay = { still: '/std/backgrounds/golden-hour.webp', clip: null, position: at, color: null, image: null, size: null, scrim: 0.2, blur: null, vars: {} };
    const got = sanitizeMainGroundPreview({ seq: 1, lay }, 'https://setnayan.test');
    assert.ok(got && 'lay' in got && got.lay, `the canvas drops a pick held at "${at}"`);
    assert.equal((got as { lay: { position: string } }).lay.position, at);
  }
});

test('(2b) a clip takes Focus — stored, and laid on the canvas, its still AND its film', () => {
  const clip = sanitizeHubMainGround({ kind: 'snippet', media: CLIP_REF, poster: POSTER_REF, tint: TINT, focus: 'right' });
  assert.equal((clip as { focus?: string } | null)?.focus, 'right', 'a clip’s Focus is dropped when it is stored');
  assert.equal(hubMainTakes(clip).focus, true, 'a clip offers no Focus row');
  assert.equal(hubMainTakes(sanitizeHubMainGround({ kind: 'photo', media: PHOTO_REF, tint: TINT })).focus, true);
  for (const f of HUB_MAIN_FOCUSES) {
    const photo = backgroundLayOf({ main: { kind: 'photo', media: PHOTO_REF, tint: TINT, focus: f } as HubMainGround, bg: null }, pictures);
    assert.equal(photo?.position, mainGroundPosition(f), `a photo held ${f} is laid at the centre`);
    const film = backgroundLayOf({ main: { kind: 'snippet', media: CLIP_REF, poster: POSTER_REF, tint: TINT, focus: f } as HubMainGround, bg: null }, pictures);
    assert.equal(film?.clip, 'https://media.test/b.mp4', 'anti-vacuity: the clip was not laid at all');
    assert.equal(film?.position, mainGroundPosition(f), `a clip held ${f} is laid at the centre`);
  }
});

test('(2c) the guest page holds its film where Focus holds its still — by the ONE rule', async () => {
  const { MainGround } = await import(`../${G}/main-ground`);
  const adaptive = { tint: null, scrim: 0.2, bodyContrast: 7 };
  for (const f of HUB_MAIN_FOCUSES) {
    const at = mainGroundPosition(f);
    const html = renderToStaticMarkup(React.createElement(MainGround, { still: 'https://media.test/b.jpg', clip: 'https://media.test/b.mp4', adaptive, vars: {}, focus: f }));
    assert.match(html, new RegExp(`background-position:${at}`), `the still is not held ${f}`);
    assert.match(html, new RegExp(`<video[^>]*style="[^"]*object-position:${at}`), `the film is not held ${f} — a clip ignores Focus on the guest page`);
  }
  const centred = renderToStaticMarkup(React.createElement(MainGround, { still: 'https://media.test/b.jpg', clip: 'https://media.test/b.mp4', adaptive, vars: {}, focus: null }));
  assert.doesNotMatch(centred, /object-position/, 'a centred film carries a position it does not need');
  const guest = stripComments(read(`${G}/main-ground.tsx`));
  assert.doesNotMatch(guest, /object-(?:top|bottom|left|right)\b/, 'the guest film keeps a second copy of the crop rule in class names');
});

test('(2d) the sample screen’s film and the cards are held where Focus holds the page', () => {
  const sample = stripComments(read('app/dashboard/[eventId]/launch/_components/look-sample.tsx'));
  assert.match(sample, /<LoopPicture src=\{picture\.clip\} position=\{picture\.position\}/, 'the sample’s film plays at its centre whatever Focus says');
  const cards = stripComments(read(`${E}/background-cards.tsx`));
  const loop = cards.slice(cards.indexOf('export function LoopPicture('));
  assert.match(loop, /<video[\s\S]{0,900}objectPosition: position/, 'LoopPicture does not hold its film where it is told');
  const panel = stripComments(read(`${E}/main-background-panel.tsx`));
  // The Focus row is drawn where the picture can take it, and says what it does behind ⓘ.
  assert.match(panel, /\{takes\.focus \? \(\s*<BgRow label="Focus" data="focus" info=\{FOCUS_INFO\}>/);
  // The "Your video" card is cropped where the page crops it once it is the background.
  assert.match(panel, /name="Your video"[\s\S]{0,700}\{\.\.\.held\(active && own\?\.kind === 'snippet' && own\.media === videoChoice\.ref\)\}/, 'the hero video’s card is not held where Focus holds it');
});

test('(1) the Studio’s Background draws no hero-video uploader; the hero video is a card that MAKES it the background', () => {
  const panel = stripComments(read(`${E}/main-background-panel.tsx`));
  assert.doesNotMatch(panel, /\bheroVideo\b/, 'the Background panel takes a hero-video part again');
  assert.doesNotMatch(panel, /SiteChromePanel|landing-page-hero-video|hero_video_url/, 'the Background panel draws the hero’s own video uploader');
  // The hero video, when there is one, is the "Your video" card — and a tap makes it THE BACKGROUND (a clip of theirs).
  assert.match(
    panel,
    /\{videoChoice \? \(\s*<BgCard\s+name="Your video"[\s\S]{0,300}onPick=\{\(\) => pickExisting\(\{ kind: 'snippet', ref: videoChoice\.ref,/,
    'the hero video is no longer a background card',
  );
  // A new clip comes in through the source's own Upload — saved AS the background.
  assert.match(panel, /<FileUpload[\s\S]{0,200}pathPrefix=\{`events\/\$\{eventId\}\/main-background`\}[\s\S]{0,400}acceptedTypes=\{\[\.\.\.IMAGE_TYPES, \.\.\.VIDEO_TYPES\]\}/);
  // Neither the editor page nor the lab hands the Background a hero-video node.
  for (const p of ['app/dashboard/[eventId]/website/editor/page.tsx', 'app/dev/maker-lab/maker-lab-shell.tsx']) {
    assert.doesNotMatch(stripComments(read(p)), /heroVideo=\{/, `${p} hands the Background a hero-video part`);
  }
});
