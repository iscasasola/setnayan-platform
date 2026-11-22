/**
 * 📱 THE CAMERA PAGE IS EXACTLY THE SCREEN — and the picture is exactly the photo.
 *
 * Owner, 2026-10-30, verbatim: *"also the camera page should be scroll free full screen camera page that works on
 * browser and app."* · on his iPhone's screenshot: the floating "Add credits" sat ON the consent line, the page stacked
 * bands and scrolled, and Safari's "Open in the Setnayan app" banner took the top strip · *"we took a 1:1 photo but it
 * save a portrait photo"* → *"so viewfinder needs to be portrait"* → *"9:16"*.
 *
 * Held here, for BOTH Papic cameras (`/papic/guest` · `/papic/seat/[token]`):
 *   1. the camera is a fixed stage the browser sizes (`fixed inset-0`, with `h-[100dvh]`) — no viewport-unit guess,
 *      so Safari's toolbar shown or hidden, or the app's WKWebView, leaves no gap and no scrollbar;
 *   2. the document behind it is held still while it is open — the one page lock (`lib/overlay-lock.ts`: the body
 *      pinned `position: fixed`, `overscroll-behavior: none` on html and body) — and released on leave;
 *   3. the picture is the 9:16 box, the top row and the controls lie OVER it, inside the safe areas;
 *   4. the guest camera: the long hint lives in an ⓘ; the consent is a compact toggle, still off by default, that stops
 *      short of the "Add credits" button's corner; that button is 44 px tall.
 * The no-scroll result itself is measured in WebKit + Chromium by the walk in the PR (scrollHeight === innerHeight).
 *
 * SABOTAGE, each seen red before this shipped:
 *   a  drop `<CameraPageLock />` from either camera          → "the document behind the … camera can scroll"
 *   b  the guest camera back to `flex h-[100dvh] flex-col`    → "the guest camera is not a fixed stage"
 *   c  the static hint back under the shutter                 → "the hint is a line under the shutter again"
 *   d  the consent toggle without its right-hand clearance    → "the consent toggle runs under Add credits"
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

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const GUEST = read('app/papic/guest/_components/papic-guest-capture.tsx');
// 📷 ONE CAMERA (owner 2026-11-22: "we only have one camera interface and that should be it"): the seat page mounts
// the guest camera in seat mode — there is no second camera source to read.
const SEAT_PAGE = read('app/papic/seat/[token]/page.tsx');
const SEAT_MODE = { seat: { token: 'seat-token', geoEnabled: false } };

async function guestCamera(extra: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PapicGuestCapture } = await import('./guest/_components/papic-guest-capture');
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
      dress: null,
      ...extra,
    } as never),
  );
}

test('1 · both cameras are a fixed stage the browser sizes, with nothing to scroll', async () => {
  const html = await guestCamera();
  const main = /<main\b[^>]*>/.exec(html)?.[0] ?? '';
  for (const cls of ['fixed', 'inset-0', 'h-[100dvh]', 'overflow-hidden', 'overscroll-none']) {
    assert.ok(main.includes(cls), `the guest camera is not a fixed stage (no ${cls})`);
  }
  const seatMain = /<main\b[^>]*>/.exec(await guestCamera(SEAT_MODE))?.[0] ?? '';
  for (const cls of ['fixed', 'inset-0', 'h-[100dvh]', 'overflow-hidden', 'overscroll-none']) {
    assert.ok(seatMain.includes(cls), `the seat camera is not a fixed stage (no ${cls})`);
  }
  assert.match(SEAT_PAGE, /<PapicGuestCapture\b[\s\S]{0,200}embedded=\{false\}/, 'the seat page does not open the one camera full screen');
  assert.doesNotMatch(SEAT_PAGE, /papic-seat-capture/, 'the seat page opens a second camera again');
  // Embedded in the Event Hub, the camera keeps the hub's page — no stage, no lock.
  const hub = await guestCamera({ embedded: true, exitTo: null });
  assert.doesNotMatch(/<main\b[^>]*>/.exec(hub)?.[0] ?? '', /\bfixed\b/);
});

test('2 · the document behind each camera is held still while it is open, and let go on leave', () => {
  assert.match(GUEST, /\{fullScreen \? <CameraPageLock \/> : null\}/, 'the document behind the guest camera can scroll');
  // The seat page mounts the same camera full screen (above), so the same lock holds the page behind it.
  const lock = read('app/papic/_components/camera-page-lock.tsx');
  assert.match(lock, /useEffect\(\(\) => \{\s*lockPageScroll\(\);\s*return \(\) => unlockPageScroll\(\);\s*\}, \[\]\);/, 'the lock is not taken on open and released on leave');
  const overlay = read('lib/overlay-lock.ts');
  // The lock that holds on iOS: the body pinned, no rubber band on html or body.
  assert.match(overlay, /b\.position = 'fixed';/);
  assert.match(overlay, /b\.overscrollBehavior = 'none';/);
  assert.match(overlay, /document\.documentElement\.style\.overscrollBehavior = 'none';/);
});

test('3 · the picture is the 9:16 box; the top row and the controls lie over it, inside the safe areas', () => {
  for (const [name, src] of [['camera', GUEST]] as const) {
    assert.match(src, /\[container-type:size\]/, `${name}: the 9:16 box is not sized to the stage`);
    assert.match(src, /width: frameSideways \? 'min\(100cqw, 100cqh \* 16 \/ 9\)' : 'min\(100cqw, 100cqh \* 9 \/ 16\)'/, `${name}: the box is not as large as the screen allows`);
    assert.match(src, /ref=\{topBarRef\}\s*data-camera-top=""/, `${name}: no top row over the picture`);
    assert.match(src, /ref=\{controlsRef\}\s*data-camera-controls=""/, `${name}: no controls over the picture`);
    assert.match(src, /style=\{(?:fullScreen \? )?\{ top: overlayInsets\.top, bottom: overlayInsets\.bottom \}/, `${name}: the tools on the picture run under the top row or the controls`);
    assert.match(src, /env\(safe-area-inset-bottom,0px\)/, `${name}: a control can sit under the home indicator`);
    assert.match(src, /env\(safe-area-inset-top,0px\)/, `${name}: the top row runs under the clock / Dynamic Island`);
  }
  assert.match(GUEST, /'absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 bg-gradient-to-t/, 'the guest controls are a band under the picture again');
});

test('4 · the guest camera: the hint is in an ⓘ, the consent is a compact toggle — still off — clear of Add credits', async () => {
  const html = await guestCamera();
  assert.doesNotMatch(html, /data-camera-hint=""/, 'the hint is a line under the shutter again');
  assert.match(html, /aria-label="How the shutter works"/, 'the hint has no ⓘ');
  const share = /<label\b[^>]*data-camera-share=""[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(share.includes('max-w-[calc(100%-10rem)]'), 'the consent toggle runs under Add credits');
  assert.ok(share.includes('min-h-11'), 'the consent toggle is under 44 px');
  const box = /<input\b[^>]*type="checkbox"[^>]*>/.exec(html.slice(html.indexOf('data-camera-share')))?.[0] ?? '';
  assert.ok(box && !/\bchecked\b/.test(box), 'the consent is ticked for the guest');
  assert.match(GUEST, /const \[sharePublicly, setSharePublicly\] = useState\(false\);/, 'the consent default changed');
  const shell = read('app/papic/_components/papic-buy-shell.tsx');
  assert.match(shell, /data-papic-add-credits=""[\s\S]{0,120}fixed bottom-\[max\(1rem,env\(safe-area-inset-bottom\)\)\] right-\[max\(1rem,var\(--sn-safe-r\)\)\][^"]*min-h-11/, 'Add credits is not the 44 px button at the bottom-right corner the camera keeps clear');
});

test('5 · 📷 a seat on the one camera: no guest-only rows — no consent line, no challenge pill, no face step', async () => {
  const html = await guestCamera(SEAT_MODE);
  assert.doesNotMatch(html, /data-camera-share=""/, 'the guest consent line draws on a seat camera');
  assert.doesNotMatch(html, /data-tour="camera-challenge"/, 'the guest challenge pill draws on a seat camera');
  assert.doesNotMatch(html, /Add your face so your photos find you/, 'the guest face step draws on a seat camera');
  assert.match(html, /aria-label="How the shutter works"/, 'the seat camera lost the shutter ⓘ');
  assert.match(html, /data-camera-exit=""/, 'the seat camera has no ✕');
  // A seat claimed without an account keeps its one slim "save your account" line; a signed-in claimer has none.
  assert.doesNotMatch(html, /data-camera-save-account=""/, 'a signed-in seat is asked to save an account');
  const anon = await guestCamera({ seat: { token: 'seat-token', geoEnabled: false, isAnon: true } });
  assert.match(anon, /data-camera-save-account=""[^>]*href="\/signup\?next=%2Fpapic%2Fseat%2Fseat-token"/, 'an anonymous seat lost its save-your-account line');
});
