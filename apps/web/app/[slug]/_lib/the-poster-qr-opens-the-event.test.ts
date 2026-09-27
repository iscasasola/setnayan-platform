/**
 * THE EVENT POSTER QR OPENS THE EVENT (owner 2026-09-27, verbatim: *"Event
 * Poster QR. will go to the event. sign in to enter or upload your qr to
 * login."*).
 *
 *   · the door offers exactly two things: Upload your QR · Sign in;
 *   · "Upload your QR" decodes a picture of the guest's personal QR IN THE
 *     BROWSER (`jsqr`) and goes to THIS event's key — anything else is refused
 *     with one plain line; the picture is never sent anywhere;
 *   · on an "Only my Guest List" event there is no "Ask to join" anywhere — the
 *     branded poster door sends people to the event page instead.
 *
 * The decode is exercised for real: a QR is drawn with the repo's own `qrcode`
 * library, rasterised to RGBA, decoded by the repo's own `jsqr`, and routed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

import { stripComments } from '@/lib/strip-comments';
import { NOT_THIS_EVENTS_CODE, uploadedQrTarget } from '@/lib/uploaded-qr';

(globalThis as unknown as { React: unknown }).React = React;

const APP = join(process.cwd(), 'app');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const TOKEN = '3de2e5e15d0e19ba5f8161085ff37e88';

/** Draw `text` as a QR and decode it back, the way the phone does. */
function decodeAsAPhoneWould(text: string): string | null {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const scale = 8;
  const quiet = 4;
  const side = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(x, y)) continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4;
          px[i] = px[i + 1] = px[i + 2] = 0;
        }
    }
  return jsQR(px, side, side)?.data ?? null;
}

test('8 · a picture of THIS event’s invitation QR goes to that key — decoded, not sent', () => {
  const decoded = decodeAsAPhoneWould(`https://www.setnayan.com/rosa-ben?invite=${TOKEN}`);
  assert.ok(decoded, 'the QR did not decode');
  assert.equal(uploadedQrTarget(decoded!, 'rosa-ben'), `/rosa-ben?invite=${TOKEN}`);
  // The owner-nested address form, and a bare token, are the same key.
  assert.equal(uploadedQrTarget(`https://x.test/u/ice/rosa-ben?invite=${TOKEN}`, 'rosa-ben'), `/rosa-ben?invite=${TOKEN}`);
  assert.equal(uploadedQrTarget(TOKEN.toUpperCase(), 'rosa-ben'), `/rosa-ben?invite=${TOKEN}`);
});

test('8 · anything else is refused with one plain line — and a crafted QR cannot steer the guest away', () => {
  const otherEvent = decodeAsAPhoneWould(`https://www.setnayan.com/cale-ice?invite=${TOKEN}`);
  assert.equal(uploadedQrTarget(otherEvent!, 'rosa-ben'), null, 'another event’s invitation opened this one');
  assert.equal(uploadedQrTarget('https://www.setnayan.com/rosa-ben', 'rosa-ben'), null, 'the general link is not a key');
  assert.equal(uploadedQrTarget('hello', 'rosa-ben'), null);
  assert.equal(uploadedQrTarget('', 'rosa-ben'), null);
  // A different ORIGIN with our slug still lands on OUR site — the path is built here.
  assert.equal(uploadedQrTarget(`https://evil.example/rosa-ben?invite=${TOKEN}`, 'rosa-ben'), `/rosa-ben?invite=${TOKEN}`);
  assert.equal(NOT_THIS_EVENTS_CODE, 'That code isn’t an invitation to this event.');
});

test('8 · the upload decodes in the browser with the repo’s jsqr, and never posts the picture', () => {
  const src = read('[slug]/_components/upload-your-qr.tsx');
  assert.match(src, /import\('jsqr'\)/);
  assert.match(src, /uploadedQrTarget\(found\.data, slug\)/);
  assert.match(src, /window\.location\.assign\(target\)/);
  assert.doesNotMatch(src, /fetch\(|FormData|XMLHttpRequest|'use server'/, 'the picture is being sent somewhere');
  assert.match(src, /setSaid\(NOT_THIS_EVENTS_CODE\)/);
});

test('8 · the door offers exactly two things: Upload your QR · Sign in', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GetInside } = await import('../_components/get-inside');
  const html = renderToStaticMarkup(
    React.createElement(GetInside, { slug: 'rosa-ben', eventId: 'e-1', signedInNotListed: false, theOrganizer: 'the couple' }),
  );
  assert.match(html, /Upload your QR/);
  assert.match(html, /type="file"[^>]*accept="image\/\*"/);
  assert.match(html, />Sign in</);
  assert.doesNotMatch(html, /Ask to join/, 'a stranger is offered a request');
});

test('8 · "Only my Guest List" → no Ask to join anywhere; only "Anyone, I approve" opens a request', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GetInside } = await import('../_components/get-inside');
  const base = { slug: 'rosa-ben', eventId: 'e-1', signedInNotListed: true, theOrganizer: 'the couple' };
  const byDefault = renderToStaticMarkup(React.createElement(GetInside, base));
  assert.doesNotMatch(byDefault, /Ask to join/, 'the default must be the closed list');
  assert.match(byDefault, /not on the guest list for this event yet/);
  const open = renderToStaticMarkup(React.createElement(GetInside, { ...base, mayAskToJoin: true }));
  assert.match(open, /Ask to join/);
  // The branded poster door is the request form — only on "Anyone, I approve".
  const INVITE = read('[slug]/invite/page.tsx');
  const at = INVITE.indexOf('if (!anyoneMayAskToJoin(event.rsvp_ask_config)) {');
  assert.ok(at > -1, 'the poster door opens a request on a closed list');
  assert.match(INVITE.slice(at, at + 120), /redirect\(`\/\$\{event\.slug\}`\)/);
  assert.ok(at < INVITE.indexOf('<JoinFlow'), 'the request form renders before the list is checked');
});
