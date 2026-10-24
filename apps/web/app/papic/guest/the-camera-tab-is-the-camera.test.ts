/**
 * 📷 THE CAMERA TAB IS THE CAMERA — full screen, ✕ to leave — and it is ONE
 * camera, the approved complete design, with a Pro dress.
 *
 * Owner, 2026-10-06 (still true): *"clicking this should not open a request to
 * open a camera, it should directly be the camera"* · *"camera is a full screen
 * feature"* · *"with an exit button"*. Owner, 2026-10-24 ("Okay build it", then
 * the final ruling): *"place this as a style template for the camera. remove the
 * other style template"* · *"Free: plain camera with a small Setnayan mark on
 * saved photos. Pro: their logo on the shutter, theme colours, and their
 * monogram on saved photos. No frames."* · "ok on no flash".
 * Prototype: `prototypes/papic_camera_complete_2026-10-24_fable.html`.
 *
 * RENDERED (`PapicGuestCapture`, terms accepted, opened from an Event Hub):
 *   1. standalone the camera fills the screen exactly (`h-[100dvh]`), ✕ back;
 *   2. FREE: the plain shutter, white corners, no logo — even when handed one;
 *   3. PRO: the logo on a white shutter, the corners in the theme's colour;
 *   4. the Challenges are the one panel (the chips look is retired);
 *   5. embedded in the Event Hub it keeps the page's frame (min-h-screen);
 *   8. the complete camera's pieces: grid · Selfie⇄Main · .5/1/2× · Photo⇄Snippet ·
 *      My shots IN PLACE · Tag beside the shutter · one-line share · Ready chip;
 * and read as source:
 *   6. the bar's Camera goes straight to the camera page, no bar on it, and the
 *      page reads Pro from the Logo & QR part — there is no look to read;
 *   7. there is no flash or torch control anywhere in the camera.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const BRAND = '#7A1F2B';

async function camera(
  dress: { pro: boolean; tint: string; logo: React.ReactNode } | null,
  extra: Record<string, unknown> = {},
) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PapicGuestCapture } = await import('./_components/papic-guest-capture');
  return renderToStaticMarkup(
    React.createElement(PapicGuestCapture, {
      guestName: 'Ana',
      eventName: 'Ana & Ben',
      eventId: 'e-1',
      initialRemaining: 20,
      total: 20,
      termsAccepted: true,
      capApplies: false,
      sponsorShare: false,
      eventStyle: 'orig' as never,
      faceMode: 'mode_b' as never,
      embedded: false,
      exitTo: { slug: 'ana-ben', tab: 'live' },
      dress,
      ...extra,
    } as never),
  );
}
const LOGO = React.createElement('span', { 'data-test-logo': '' }, 'A&B');
const corners = (html: string) => html.slice(html.indexOf('data-focus-corners'), html.indexOf('data-focus-corners') + 900);

test('1 · standalone the camera fills the screen, and ✕ goes back to the tab it came from', async () => {
  const html = await camera(null);
  const main = /<main\b[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(main, /h-\[100dvh\]/, 'the camera is not full screen');
  assert.match(main, /overflow-hidden/);
  assert.match(html, /data-camera-exit=""[^>]*href="\/ana-ben\?tab=live"|href="\/ana-ben\?tab=live"[^>]*data-camera-exit/, 'no ✕ back to the Event Hub tab');
  assert.match(html, /aria-label="Close the camera"/);
});

test('2 · FREE is the plain camera: plain shutter, white corners, no logo — even when handed one', async () => {
  for (const dress of [null, { pro: false, tint: '#FFFFFF', logo: LOGO }]) {
    const html = await camera(dress);
    assert.match(html, /data-camera-dress="free"/);
    assert.doesNotMatch(html, /data-test-logo|data-shutter-logo/, 'a free camera draws a logo');
    assert.match(html, /data-shutter="free"[^>]*class="[^"]*border-cream\/80/, 'the free shutter is not the plain one');
    assert.equal((corners(html).match(/border-color:#FFFFFF/g) ?? []).length, 4, 'the corners are not white');
  }
});

test('3 · PRO: the logo on a white shutter, the corners in the theme’s colour', async () => {
  const BRAND = '#7A1F2B';
  const html = await camera({ pro: true, tint: BRAND, logo: LOGO });
  assert.match(html, /data-camera-dress="pro"/);
  assert.match(html, /data-shutter="pro"[^>]*class="[^"]*border-white/);
  assert.match(html, /data-shutter-logo=""[^]*data-test-logo/, 'no logo on the shutter');
  assert.equal((corners(html).match(new RegExp(`border-color:${BRAND}`, 'g')) ?? []).length, 4, 'the corners are not the theme colour');
  const { cameraDressTint } = await import('@/lib/camera-dress');
  assert.equal(cameraDressTint(true, BRAND), BRAND);
  assert.equal(cameraDressTint(false, BRAND), '#FFFFFF', 'a free camera wears the theme colour');
  assert.equal(cameraDressTint(true, 'not-a-colour'), '#FFFFFF');
});

test('4 · the Challenges are the one panel below the shutter — the chips look is retired', () => {
  const src = read('app/papic/guest/_components/papic-guest-capture.tsx');
  assert.ok(src.indexOf('<PapicChallengePanel') > src.indexOf('onPointerDown={onShutterDown}'), 'the challenges moved above the shutter');
  assert.equal((src.match(/<PapicChallengePanel\b/g) ?? []).length, 1);
  const panel = read('app/papic/guest/_components/papic-challenge-panel.tsx');
  assert.doesNotMatch(panel, /layout === 'chips'|data-challenge-chips|layout\?:/, 'the chips look is back');
  assert.match(panel, /m\.completed/, 'a done challenge is no longer told apart');
});

test('5 · embedded in the Event Hub the camera keeps the page’s frame', async () => {
  const html = await camera(null, { embedded: true, exitTo: null });
  assert.match(/<main\b[^>]*>/.exec(html)?.[0] ?? '', /min-h-screen/);
  assert.doesNotMatch(/<main\b[^>]*>/.exec(html)?.[0] ?? '', /h-\[100dvh\]/);
});

test('6 · the bar’s Camera opens the camera page itself — no bar on it — and Pro is the Logo & QR part', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  // One address since 2026-10-14 (`guestCameraHref`): the bar's Camera and the early Gallery share it.
  assert.match(body, /const guestCameraHref = papicGuest\s*\?\s*`\/papic\/me\/\$\{encodeURIComponent\(guest\.qr_token\)\}\/session\?next=guest&from=/);
  assert.match(body, /camera: guestCameraHref,/);
  assert.match(body, /: hostCameraOpen\s*\?\s*`\/papic\/guest\?from=\$\{event\.slug\}`/);
  const page = read('app/papic/guest/page.tsx');
  assert.doesNotMatch(page, /GuestHubBar|SiteMenuBar|HubShell|SiteFooter|<footer/, 'the camera page draws a guest bar, menu or footer');
  assert.match(page, /dress=\{cameraDress\}/);
  assert.match(page, /eventHubPartActive\(admin, session\.event_id, 'logo_qr'\)/);
  assert.doesNotMatch(page, /camera_look|cameraLook|style_preferences/, 'the camera page still reads a look');
});

const CAMERA_FILES = [
  'app/papic/guest/_components/papic-guest-capture.tsx',
  'app/papic/guest/_components/guest-camera-tools.tsx',
  'app/papic/guest/_components/tag-scanner-overlay.tsx',
  'app/papic/guest/_components/my-shots-sheet.tsx',
  'app/papic/_components/camera-controls.tsx',
  'lib/use-papic-camera.ts',
];

test('7 · no flash or torch control anywhere in the camera (owner 24 Oct: "ok on no flash")', async () => {
  for (const rel of CAMERA_FILES) {
    assert.doesNotMatch(read(rel), /aria-label="[^"]*[Ff]lash|[Tt]orch|\bZap\b|fillLightMode/, `${rel} draws or drives a flash`);
  }
  for (const dress of [null, { pro: true, tint: '#7A1F2B', logo: LOGO }]) {
    const html = await camera(dress);
    assert.doesNotMatch(html, /flash|torch/i, 'the rendered camera carries a flash control');
  }
});

test('8 · the complete camera’s pieces are there, where the prototype draws them', async () => {
  const src = read('app/papic/guest/_components/papic-guest-capture.tsx');
  // .5 / 1 / 2× come from the one rule (lib/papic-camera-steps.ts — executed by its own test).
  assert.match(src, /steps=\{zoomSteps\(lensOptions, facing\)\}/);
  assert.match(src, /selfie=\{facing === 'user'\}/);
  // Tag who's in it sits in the SHUTTER ROW, after the shutter.
  const shutter = src.indexOf('onPointerDown={onShutterDown}');
  const tag = src.indexOf('data-camera-tag=');
  const hint = src.indexOf('data-camera-hint=');
  assert.ok(shutter > 0 && tag > shutter && hint > tag, 'Tag who’s in it is not beside the shutter');
  // Photo ⇄ Snippet, and Snippet's tap-to-start / tap-to-stop.
  assert.match(src, /\(\['photo', 'snippet'\] as const\)\.map/);
  assert.match(src, /if \(mode === 'snippet'\) \{[\s\S]{0,400}stopOnUpRef\.current = true;/);
  // Tap-to-focus only where the camera reports it can.
  assert.match(src, /if \(!canFocus \|\| !ready/);
  // The status chip says Ready while nothing waits.
  assert.match(src, /<PapicUploadChip readyWhenIdle \/>/);

  // The viewfinder tools draw once the camera is live (not in a server render) — read from their source.
  assert.match(src, /<GuestCameraTools\b[\s\S]{0,200}grid=\{grid\}[\s\S]{0,40}onGrid=\{toggleGrid\}/);
  assert.match(read('app/papic/guest/_components/guest-camera-tools.tsx'), /data-camera-grid-toggle=""/);
  // The grid button and the flip pill sit OVER the picture (top-left · top-right): `absolute`, never also `relative`
  // (walk 2026-10-24: `relative` won in the stylesheet and dropped both under the picture).
  const tools = read('app/papic/guest/_components/guest-camera-tools.tsx');
  const halo = /const HALO = "([^"]*)"/.exec(tools)?.[1] ?? '';
  assert.ok(halo && !/\brelative\b/.test(halo), 'the halo makes the absolutely placed tools relative');
  assert.match(tools, /\$\{HALO\} absolute left-3 top-3/);
  assert.match(tools, /\$\{HALO\} absolute right-3 top-3/);
  assert.match(src, /localStorage\.setItem\(PAPIC_GRID_STORAGE_KEY/, 'the grid is not remembered on the device');
  const html = await camera(null);
  assert.match(html, /data-camera-share=""/);
  assert.match(html, /About Let the host feature my clips on their event page/, 'the share line lost its ⓘ');
});

test('9 · My shots opens IN PLACE — a sheet over the camera, never a new page', async () => {
  const html = await camera(null);
  const thumb = /<[a-z]+\b[^>]*data-camera-thumb=""[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(thumb, /^<button\b/, 'the thumbnail is not a button');
  assert.doesNotMatch(thumb, /href=/, 'the thumbnail navigates');
  assert.match(html, /role="dialog"[^>]*aria-label="My shots"|aria-label="My shots"[^>]*role="dialog"/, 'the sheet is not mounted with the camera');
  const sheet = read('app/papic/guest/_components/my-shots-sheet.tsx');
  assert.doesNotMatch(sheet, /next\/link|next\/navigation|router\.|location\.|href=|<a\b/, 'the sheet navigates');
  const src = read('app/papic/guest/_components/papic-guest-capture.tsx');
  assert.match(src, /data-camera-thumb=""\s*onClick=\{\(\) => setShotsOpen\(true\)\}/);
  assert.doesNotMatch(src, /cameraExitHref\([^)]*'gallery'\)/, 'the thumbnail still leaves for the gallery');
});
