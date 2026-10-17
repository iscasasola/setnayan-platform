/**
 * 🖼 EVERY ONE OF THE COUPLE'S UPLOADED COVER MEDIA IS IN THE COVER'S UPLOAD ROW — photos AND videos, one list.
 *
 * Owner 2026-10-17, on cale-ice, Cover Scene › Background › Upload ◆: *"why is the video not showing on the list of
 * uploaded media files?"* The cover was PLAYING his sunset clip (`canvas.ground` = `{ kind: 'snippet', media:
 * …/scene-background/…-sunset….mp4, poster }`) while the row showed "+ Upload" and one "Your photo". MEASURED: the
 * editor page signs the clip into `sceneUploads` (`sceneUploadRefs` reads the cover's own ground) — but BOTH Cover
 * Scene mounts (the toolbar's `coverSceneBackground` in `editor-shell.tsx`, and Details › Hero's `coverScene` in the
 * editor `page.tsx`) left `sceneUploads` and `videoChoice` out, and the row defaulted them to `[]` / null. The clip
 * was signed, carried to the Maker, and dropped one prop short of its card.
 *
 *   (1) cale-ice's shape: every upload the cover folder holds — the clip AND the photo — is a card, the worn one ringed,
 *       the clip "▶ Your video", and a tap on the other card switches
 *   (2) the worn ground is ALWAYS a card, even when no list handed to the row holds it
 *   (3) EVERY mount of the background rows hands them the event's uploads and its video (no mount can leave them out —
 *       and the rows' own props say so: required, never defaulted)
 *   (4) a clip card says how long it is: "▶ Your video · 12 s" (the approved prototype's card)
 *
 * Each claim was broken once and seen red (the sabotage run is in the PR body).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { coverClipCardName, coverUploadCards } from './cover-scene';
import { sanitizeHubCanvas } from './hub-canvas';
import { sceneUploadRefs } from './scene-media-choices';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() };
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const EV = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';
const FOLDER = `r2://setnayan-media/events/${EV}/scene-background`;
/* cale-ice's own refs, read SELECT-only from production 2026-10-17 (the draft's hero `canvas.ground`). */
const CLIP = `${FOLDER}/b1643582-c132-4fcd-972b-311b5a2e5e50-sunset-entrance-landscape-1920x1078.mp4`;
const STILL = `${FOLDER}/b375e610-5d50-4477-98af-7ed1ab14a5dc-still.jpg`;
const HERO = `r2://setnayan-media/events/${EV}/std-background/2cdbbdd0-1d43-4ba3-9c84-be4e558d8142-Cale-Ice-Prenup7.jpg`;
const SCENE_PHOTO = `${FOLDER}/9a1d2c3e-0000-4000-8000-000000000001-garden.jpg`;
const signed = (ref: string) => `https://media.test/${ref.split('/').pop()}`;

/** The editor page's own path: the canvases (the hero's cover ground, a scene's photo) → `sceneUploadRefs` → signed. */
function caleIceUploads() {
  const configs = [
    { canvas: { design: 'marquee', ground: { kind: 'snippet', media: CLIP, poster: STILL } } },
    { canvas: { kind: 'photo', media: SCENE_PHOTO } },
  ];
  return sceneUploadRefs(EV, configs).map((u) => ({ ref: u.ref, url: signed(u.ref), kind: u.kind, poster: u.poster, posterUrl: u.poster ? signed(u.poster) : null }));
}

async function drawRow(ground: unknown, sceneUploads: readonly unknown[], videoChoice: unknown = null) {
  const { CoverSceneGroundRows } = await import('@/app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background');
  const html = renderToStaticMarkup(
    React.createElement(CoverSceneGroundRows, {
      eventId: EV,
      canvas: sanitizeHubCanvas({ canvas: { ground } }),
      draftAction: (async () => ({ ok: true })) as never,
      themeColours: ['#2C2A29'],
      photoChoices: [{ ref: HERO, url: signed(HERO) }],
      videoChoice: videoChoice as never,
      sceneUploads: sceneUploads as never,
      mediaCapBytes: 500 * 1024 * 1024,
      proHref: null,
    }),
  );
  return [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*aria-label="([^"]*)"[^>]*data-stage-bg-tile="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({
    on: m[1] === 'true',
    name: m[2]!,
    key: m[3]!,
    face: m[4]!,
  }));
}

test('(1) cale-ice: the clip the cover wears AND every photo are cards — the clip ▶-marked and ringed', async () => {
  const uploads = caleIceUploads();
  assert.ok(uploads.some((u) => u.kind === 'snippet' && u.ref === CLIP), 'the editor page does not list the cover’s own clip at all');
  const tiles = await drawRow({ kind: 'snippet', media: CLIP, poster: STILL }, uploads);
  for (const ref of [...uploads.map((u) => u.ref), HERO]) {
    assert.ok(tiles.some((t) => t.key === ref), `an uploaded cover medium has no card in the Upload row: ${ref.split('/').pop()}`);
  }
  assert.deepEqual(tiles.filter((t) => t.on).map((t) => t.key), [CLIP], 'the clip the cover is wearing is not the ringed card');
  const clip = tiles.find((t) => t.key === CLIP)!;
  assert.match(clip.face, /▶ (<!-- -->)?Your video/, 'the clip card does not read "▶ Your video"');
  assert.ok(clip.face.includes(signed(STILL)), 'the clip card does not show its poster frame');
  /* …and the photo is a card of its own beside it, to switch to (and back). */
  assert.deepEqual(tiles.filter((t) => t.name === 'Your photo').length, 2, 'the photos are not cards beside the clip');
  const photoTiles = await drawRow({ kind: 'photo', media: HERO }, uploads);
  assert.deepEqual(photoTiles.filter((t) => t.on).map((t) => t.key), [HERO], 'picking the photo does not ring it');
  assert.ok(photoTiles.some((t) => t.key === CLIP && !t.on), 'with the photo worn, the clip is gone from the row — it cannot be switched back to');
});

test('(2) the ground the cover is wearing is always a card — even when no list handed to the row holds it', async () => {
  const tiles = await drawRow({ kind: 'snippet', media: CLIP, poster: STILL }, []);
  assert.deepEqual(tiles.filter((t) => t.on).map((t) => t.key), [CLIP], 'a worn clip that no list holds has no card');
  const cards = coverUploadCards({ uploads: [], photoChoices: [], videoChoice: null, ground: { kind: 'photo', media: SCENE_PHOTO }, takesClips: true });
  assert.deepEqual(cards.photos.map((p) => p.ref), [SCENE_PHOTO], 'a worn photo that no list holds has no card');
});

/** Every JSX mount of `<Name …>` in app/ (comments stripped), as its tag text. */
function mounts(name: string): Array<{ file: string; tag: string }> {
  const out: Array<{ file: string; tag: string }> = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(n) && !/\.test\.tsx$/.test(n)) {
        const src = stripComments(readFileSync(p, 'utf8'));
        for (const m of src.matchAll(new RegExp(`<${name}\\b([\\s\\S]*?)\\/>`, 'g'))) out.push({ file: relative(WEB, p), tag: m[1]! });
      }
    }
  };
  walk(join(WEB, 'app'));
  return out;
}

test('(3) every mount of the background rows hands them the event’s uploads and its video — none can leave them out', () => {
  const all = [...mounts('SceneBackgroundRow'), ...mounts('CoverSceneGroundRows')];
  assert.ok(all.length >= 3, `the background-row mounts were not found (${all.length}) — this guard would pass on nothing`);
  const offenders = all.filter((m) => !/\bsceneUploads=\{/.test(m.tag) || !/\bvideoChoice=\{/.test(m.tag)).map((m) => `${m.file}: ${/\bwidgetType="hero"/.test(m.tag) ? 'a Cover Scene mount' : 'a mount'} without sceneUploads/videoChoice`);
  assert.deepEqual(offenders, [], 'a background row is mounted without the couple’s uploads — its Upload row would miss them');
  /* …and the rows' own props make it a type error to forget: required, never defaulted to an empty list. */
  for (const f of ['app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background.tsx', 'app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx']) {
    const src = stripComments(readFileSync(join(WEB, f), 'utf8'));
    assert.match(src, /\n\s*sceneUploads: readonly SceneUpload\[\];/, `${f}: sceneUploads is optional again`);
    assert.match(src, /\n\s*videoChoice: \{ ref: string; url: string; poster\?: string \| null \} \| null;/, `${f}: videoChoice is optional again`);
    assert.doesNotMatch(src, /\bsceneUploads = \[\]/, `${f}: sceneUploads defaults to an empty list again`);
  }
});

test('(4) a clip card says how long it is — "▶ Your video · 12 s"', async () => {
  assert.equal(coverClipCardName(CLIP, 1, 12), 'Your video · 12 s');
  assert.equal(coverClipCardName(CLIP, 1, 11.6), 'Your video · 12 s');
  assert.equal(coverClipCardName(CLIP, 1, null), 'Your video', 'an unread length must not print "· NaN s"');
  assert.equal(coverClipCardName(CLIP, 1, Number.NaN), 'Your video');
  assert.equal(coverClipCardName(CLIP, 2, 9), 'sunset-entrance-landscape-1920x1078.mp4 · 9 s');
  /* The length is read for every clip card from its own file (only while the Upload row is up). */
  const src = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background.tsx'), 'utf8'));
  assert.match(src, /coverClipCardName\(c\.ref, clips\.length, c\.url \? seconds\[c\.url\] : null\)/, 'a clip card no longer carries its length');
});
