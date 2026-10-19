/**
 * 🔏 THE COVER'S VIDEO IS SERVED FROM THE HOST THE MAIN BACKGROUND IS — AND ITS STILL IS ITS OWN FIRST FRAME.
 *
 * Owner report 2026-10-19 (cale-ice, live): *"claire tried to check the invitation link. and it did not show the video.
 * just the photo under the reveal."* — and, on what should be there: *"shouldn't before the reveal, it should be the
 * first frame of the video?"*
 *
 * 🔴 MEASURED (read-only, live page): the cover's clip and still were drawn at the bucket's PUBLIC development host
 * (`pub-….r2.dev`, `publicUrlForStoredAsset`) while the Main background is SIGNED on `….r2.cloudflarestorage.com`
 * (`displayUrlForStoredAsset`). On a laptop that cannot reach `*.r2.dev` (Safari and Chrome alike) both cover files
 * failed (video error 4), the cover drew nothing and the Main background photo showed through. Blocking `*.r2.dev`
 * alone in Playwright reproduced it exactly. And the stored poster is an all-black grab, so even a working cover showed
 * black behind the veil, not the film.
 *
 * Properties held here (behaviour where it can run, the one call site by source):
 *   1 · every ref the cover draws is signed on the bucket's own host, through the Main background's signer and fence;
 *   2 · the layer draws the signed address whenever there is one — no cover ref reaches a guest at `r2.dev` when it
 *       could be signed;
 *   3 · the guest page's one cover call hands the layer its signed refs;
 *   4 · the clip is drawn from frame 0 with NO separate poster (`#t=0.001`, `preload="auto"`), muted · loop · inline;
 *   5 · a play the browser REFUSES shows a ▶ and the next tap plays it — never a dead still; the veil's hold (an
 *       AbortError) does not count as a refusal, and the unveil asks again inside the tap.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EV = '11111111-2222-4333-8444-555555555555';
const CLIP = `r2://setnayan-media/events/${EV}/scene-background/0b2c9a1e-1d43-4ba3-9c84-be4e558d8142-bbb.mp4`;
const STILL = `r2://setnayan-media/events/${EV}/scene-background/7f3e2d10-aaaa-4bbb-8ccc-123456789abc-still.jpg`;

/** A fake account: signing is a local HMAC, nothing leaves the machine. */
function withR2<T>(fn: () => Promise<T>): Promise<T> {
  const keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.R2_ACCOUNT_ID = 'acct0test';
  process.env.R2_ACCESS_KEY_ID = 'AKIATEST';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-test';
  process.env.R2_PUBLIC_URL = 'https://pub-0000.r2.dev';
  return fn().finally(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

test('1 · 2 · the cover clip and its still are signed on the bucket host, and the layer draws those', async () => {
  await withR2(async () => {
    const { signCoverSceneMedia, coverSceneLayer } = await import('@/app/[slug]/_lib/cover-scene-layer');
    const ground = { kind: 'snippet' as const, media: CLIP, poster: STILL };
    const signed = await signCoverSceneMedia(ground);
    for (const ref of [CLIP, STILL]) {
      assert.match(signed[ref] ?? '', /^https:\/\/[^/]+\.r2\.cloudflarestorage\.com\/.+X-Amz-Signature=/, `${ref.slice(-12)} was not signed on the bucket's own host`);
    }
    const layer = coverSceneLayer(ground, { heroPhotoUrl: null, signed });
    assert.ok(layer);
    assert.equal(layer!.clip, signed[CLIP], 'the cover clip is not the signed address');
    assert.equal(layer!.still, signed[STILL], 'the cover still is not the signed address');
    for (const u of [layer!.clip, layer!.still]) assert.doesNotMatch(u ?? '', /r2\.dev/, 'a cover file still reaches a guest at r2.dev');
    /* Unsigned (the lab, no signer): the public address — never an empty cover where a link could still work. */
    const unsigned = coverSceneLayer(ground, { heroPhotoUrl: null });
    assert.match(unsigned!.clip ?? '', /^https:\/\/pub-0000\.r2\.dev\//);
  });
});

test('1 · a ref outside the one public bucket is never signed', async () => {
  await withR2(async () => {
    const { signCoverSceneMedia } = await import('@/app/[slug]/_lib/cover-scene-layer');
    const signed = await signCoverSceneMedia({ kind: 'snippet', media: 'r2://setnayan-private/events/x/a.mp4', poster: 'r2://setnayan-private/events/x/a.jpg' });
    assert.deepEqual(signed, {}, 'a private-bucket ref was signed for the cover');
  });
});

test('2 · inside the layer, every drawn ref goes through the signed-first resolver', () => {
  const src = read('app/[slug]/_lib/cover-scene-layer.ts');
  const body = src.slice(src.indexOf('export function coverSceneLayer('));
  assert.ok(body.length > 0);
  const direct = body.match(/\bpublicUrl\(/g) ?? [];
  assert.equal(direct.length, 0, `coverSceneLayer resolves ${direct.length} ref(s) straight to the public host`);
  assert.ok((body.match(/\bservedUrl\(/g) ?? []).length >= 4, 'the loop and the clip do not both go through servedUrl');
  assert.match(src, /displayUrlForStoredAsset\(siteMediaServeRef\(ref\)\)/, 'the cover is not signed by the Main background’s signer and fence');
});

test('3 · the guest page hands its one cover call the signed refs', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  const calls = body.match(/coverSceneLayer\([^)]*\)[^)]*\)/g) ?? [];
  assert.equal(calls.length, 1, `expected one cover call on the guest page, found ${calls.length}`);
  assert.match(calls[0]!, /signed: await signCoverSceneMedia\(heroCanvas\.ground\)/, 'the guest page draws the cover unsigned');
});

test('4 · the clip is drawn from its own first frame — no separate poster', async () => {
  const { CoverSceneGround } = await import('@/app/[slug]/_components/cover-scene-ground');
  const html = renderToStaticMarkup(
    React.createElement(CoverSceneGround, {
      layer: { shape: 'full', css: null, still: 'https://x.test/black-grab.jpg', clip: 'https://x.test/c.mp4?X-Amz-Signature=s', parallax: false, veil: null, scrim: { color: '#000', opacity: 0 }, tone: 'cream' },
    }),
  );
  const video = html.match(/<video[^>]*>/)?.[0] ?? '';
  assert.ok(video, 'the cover drew no video');
  assert.doesNotMatch(video, /\bposter=/, 'the cover video shows a separate poster instead of its own first frame');
  assert.match(video, /src="https:\/\/x\.test\/c\.mp4\?X-Amz-Signature=s#t=0\.001"/, 'the cover video does not ask for its first frame');
  assert.match(video, /preload="auto"/, 'the first frame is not loaded before the unveil');
  assert.doesNotMatch(video, /opacity:\s*0/, 'the cover video is hidden until it moves — frame 0 never shows behind the veil');
  assert.match(video, /\bmuted=""/);
  assert.match(video, /\bloop=""/);
  assert.match(video, /\bplaysInline=""|\bplaysinline=""/i);
  assert.doesNotMatch(video, /\bautoplay\b|\bcontrols\b/i);
  assert.doesNotMatch(html, /data-clip-refused/, 'a ▶ before anything was refused');
});

test('5 · a refused play shows ▶ and the next tap plays; the veil’s hold is not a refusal; the unveil asks inside the tap', () => {
  const clip = read('app/[slug]/_components/scene-clip.tsx');
  assert.match(clip, /name === 'NotAllowedError'\) setRefused\(true\)/, 'a refused play is not noticed (or every rejection counts — the veil’s hold is an AbortError)');
  assert.match(clip, /\{refused \? \(\s*<span\s+data-clip-refused=""/, 'a refused play draws no ▶');
  assert.match(clip, /document\.addEventListener\('pointerup', tapToPlay, \{ capture: true \}\)/, 'a tap does not play a refused clip (or only the first tap is asked — a refused unveil tap would leave a dead ▶)');
  assert.match(clip, /tapToPlay = \(\) => \{\s*void v\.play\(\)\.then\(\(\) => setRefused\(false\)/, 'a tap that plays does not clear the ▶');
  assert.match(clip, /if \(firstFrame\) window\.addEventListener\(HUB_VEIL_RELEASED_EVENT, sync\)/, 'the unveil does not ask the cover clip to play inside the tap');
  /* Reduced motion and Save-Data stay still — and show no ▶ (they never call play()). */
  assert.match(clip, /if \(reduce\?\.matches \|\| saveData \|\| typeof IntersectionObserver === 'undefined'\) \{\s*v\.pause\(\);\s*return;/);
  assert.match(read('app/[slug]/_components/cover-scene-ground.tsx'), /<SceneClip src=\{layer\.clip\} play="loop"[^>]*\bfirstFrame\b/, 'the cover does not draw its clip from frame 0');
});
