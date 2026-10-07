/**
 * 📷 THE CAMERA TAB IS THE CAMERA — full screen, ✕ to leave, nothing else on it;
 * and its three looks, Classic · Your brand · Challenges.
 *
 * Owner, 2026-10-06, verbatim: *"clicking this should not open a request to open
 * a camera, it should directly be the camera"* · *"camera is a full screen
 * feature"* · *"with an exit button"* · *"camera will have a design that is
 * classic meaning no design. another layout is having their shutter button have
 * their logo, have the focus grid have their theme colors. another layout is
 * having the challenge more accessible?"* DECISION_LOG "THE INVITATION HAS A
 * REPLY CARD … THE CAMERA TAB IS THE CAMERA", "THE CAMERA HAS ITS OWN THREE
 * LAYOUTS", "THE GUEST CAMERA: THE BEST A BROWSER ALLOWS NOW" (no flash button).
 *
 * RENDERED (`PapicGuestCapture`, terms accepted, opened from an Event Hub):
 *   1. with a look the camera fills the screen exactly (`h-[100dvh]`), and its
 *      ✕ goes back to the tab it came from;
 *   2. Classic: a plain white shutter, white focus corners, NO logo, neutral pills;
 *   3. Your brand: the logo on the shutter, the corners in the theme's colour;
 *   4. Challenges: the challenges sit above the shutter, not in the list below;
 *   5. no look (every real couple today) = the camera exactly as shipped;
 * and read as source:
 *   6. the bar's Camera goes straight to the camera page — no "Open the camera"
 *      card between, and the camera page mounts no guest bar, menu or footer;
 *   7. the look names are the Maker's, the pick is read from style_preferences
 *      (absent → Classic), and there is no flash button anywhere.
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

async function camera(look: { kind: 'classic' | 'brand' | 'challenges'; tint: string; logo: React.ReactNode } | null) {
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
      look,
    } as never),
  );
}
const LOGO = React.createElement('span', { 'data-test-logo': '' }, 'A&B');

test('1 · with a look the camera fills the screen, and ✕ goes back to the tab it came from', async () => {
  const html = await camera({ kind: 'classic', tint: '#FFFFFF', logo: null });
  const main = /<main\b[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(main, /h-\[100dvh\]/, 'the camera is not full screen');
  assert.match(main, /overflow-hidden/);
  assert.match(html, /data-camera-exit=""[^>]*href="\/ana-ben\?tab=live"|href="\/ana-ben\?tab=live"[^>]*data-camera-exit/, 'no ✕ back to the Event Hub tab');
  assert.match(html, /aria-label="Close the camera"/);
});

test('2 · Classic is no design: a plain white shutter, white corners, no logo, neutral pills', async () => {
  const { cameraLookDrawsLogo } = await import('@/lib/camera-look');
  assert.equal(cameraLookDrawsLogo('classic'), false);
  // Even handed a logo, Classic draws none.
  const html = await camera({ kind: 'classic', tint: '#FFFFFF', logo: LOGO });
  assert.doesNotMatch(html, /data-test-logo|data-shutter-logo/, 'Classic draws a logo');
  assert.match(html, /data-shutter="classic"[^>]*class="[^"]*border-white/, 'the shutter is not the plain white one');
  assert.match(html, /data-focus-corners=""/, 'no focus corners');
  const corners = html.slice(html.indexOf('data-focus-corners'), html.indexOf('data-focus-corners') + 900);
  assert.equal((corners.match(/border-color:#FFFFFF/g) ?? []).length, 4, 'the corners are not white');
});

test('3 · Your brand: the logo on the shutter, the corners in the theme’s colour', async () => {
  const html = await camera({ kind: 'brand', tint: BRAND, logo: LOGO });
  assert.match(html, /data-shutter-logo=""[^]*data-test-logo/, 'no logo on the shutter');
  const corners = html.slice(html.indexOf('data-focus-corners'), html.indexOf('data-focus-corners') + 900);
  assert.equal((corners.match(new RegExp(`border-color:${BRAND}`, 'g')) ?? []).length, 4, 'the corners are not the theme colour');
  const { cameraLookTint } = await import('@/lib/camera-look');
  assert.equal(cameraLookTint('brand', BRAND), BRAND);
  assert.equal(cameraLookTint('classic', BRAND), '#FFFFFF', 'Classic wears the theme colour');
  assert.equal(cameraLookTint('challenges', BRAND), '#FFFFFF');
});

test('4 · Challenges: the challenges sit above the shutter, never in the list below it', () => {
  const src = read('app/papic/guest/_components/papic-guest-capture.tsx');
  const above = src.indexOf("{look?.kind === 'challenges' && !exhausted ? challengePanel : null}");
  const shutter = src.indexOf('onPointerDown={onShutterDown}');
  assert.ok(above > 0 && above < shutter, 'the chips are not above the shutter');
  assert.match(src, /\{look\?\.kind === 'challenges' \? null : challengePanel\}/, 'Challenges draws the list below too');
  assert.match(src, /layout=\{look\?\.kind === 'challenges' \? 'chips' : 'list'\}/);
  const panel = read('app/papic/guest/_components/papic-challenge-panel.tsx');
  assert.match(panel, /if \(layout === 'chips'\)/);
  assert.match(panel, /m\.completed\s*\?\s*'bg-cream\/10 text-cream\/40'/, 'a done challenge is not greyed');
});

test('5 · no look = the camera exactly as shipped (min-h-screen, the cream ring, no corners)', async () => {
  const html = await camera(null);
  assert.match(/<main\b[^>]*>/.exec(html)?.[0] ?? '', /min-h-screen/);
  assert.doesNotMatch(html, /h-\[100dvh\]|data-focus-corners|data-shutter=|data-camera-look/, 'the shipped camera changed');
  assert.match(html, /border-4 border-cream\/80/);
});

test('6 · the bar’s Camera opens the camera page itself — nothing in between, no bar on it', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /camera: papicGuest\s*\?\s*`\/papic\/me\/\$\{encodeURIComponent\(guest\.qr_token\)\}\/session\?next=guest&from=/);
  assert.match(body, /: hostCameraOpen\s*\?\s*`\/papic\/guest\?from=\$\{event\.slug\}`/);
  const page = read('app/papic/guest/page.tsx');
  assert.doesNotMatch(page, /GuestHubBar|SiteMenuBar|HubShell|SiteFooter|<footer/, 'the camera page draws a guest bar, menu or footer');
  assert.match(page, /look=\{cameraLook\}/);
  assert.match(page, /await guestStagesOn\(admin, session\.event_id\)/, 'the look is not behind the guest-side switch');
});

test('7 · the Maker’s three names; the pick from style_preferences, absent → Classic; no flash button', async () => {
  const { CAMERA_LOOKS, CAMERA_LOOK_LABEL, cameraLookFromPreferences } = await import('@/lib/camera-look');
  const { MAKER_CAMERA_LAYOUTS } = await import('@/lib/maker-parts');
  assert.deepEqual(CAMERA_LOOKS.map((k) => CAMERA_LOOK_LABEL[k]), [...MAKER_CAMERA_LAYOUTS]);
  assert.equal(cameraLookFromPreferences(null), 'classic');
  assert.equal(cameraLookFromPreferences({ camera_look: 'statement' }), 'classic');
  assert.equal(cameraLookFromPreferences({ camera_look: 'brand', scene_styles: {} }), 'brand');
  assert.equal(cameraLookFromPreferences({ camera_look: 'challenges' }), 'challenges');
  for (const rel of ['app/papic/guest/_components/papic-guest-capture.tsx', 'app/papic/_components/camera-controls.tsx']) {
    assert.doesNotMatch(read(rel), /aria-label="[^"]*[Ff]lash|torch|\bZap\b/, `${rel} draws a flash button`);
  }
});
