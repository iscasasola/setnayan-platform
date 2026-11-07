/**
 * 🚪 THE GUEST DOOR IS ONE BUTTON (owner 2026-11-03, DECISION_LOG "THE GUEST DOOR IS ONE BUTTON: 'OPEN YOUR
 * INVITATION'"): *"both buttons does the same thing"* · *"just 1 button please"* · *"yes Open your invitation"* ·
 * *"i also saw sign in"* · *"either that or your recommendation, lost QR? Login"*.
 *
 *   (1) signed out, the first screen shows ONE button — "Open your invitation" — and nothing else: no subtitle, no
 *       second primary, no separate Sign in;
 *   (2) pressed, exactly three choices, in order: Scan QR · Upload QR · Lost QR? Login;
 *   (3) a signed-in guest on this list meets no door: "Not [first name]? Switch account" opens the same three, and
 *       only for the account's OWN seat;
 *   (4) the live scan is the shared camera half (`lib/use-live-qr-scan.ts`) — never a second copy — and a scanned
 *       code goes where an uploaded one goes (`uploadedQrTarget`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { DOOR_CHOICE, STRANGER_DOOR_WORDS } from './door-choice-words';

// The components are compiled with the classic JSX runtime under tsx.
(globalThis as unknown as { React: unknown }).React = React;
// Loaded after the React global above, as the door's other guards do.
const { GetInside } = require('./get-inside') as typeof import('./get-inside');
const { NotYouSwitch } = require('./not-you-switch') as typeof import('./not-you-switch');

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', '..', '..', p), 'utf8'));
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;
/** The pressable things in a piece of markup, in order: buttons, links, and the file picker's label. */
const pressables = (html: string) =>
  Array.from(html.matchAll(/<(button|a|label)\b[^>]*>([\s\S]*?)<\/\1>/g)).map((m) => (m[2] ?? '').replace(/<[^>]+>/g, '').trim());

const strangerDoor = (over: Partial<{ inFoot: boolean; dock: boolean; mayAskToJoin: boolean }> = {}) =>
  renderToStaticMarkup(
    React.createElement(GetInside, { slug: 'maria-and-jose', eventId: 'e-1', signedInNotListed: false, theOrganizer: 'the couple', mayAskToJoin: true, ...over }),
  );

test('(1) signed out: ONE button, "Open your invitation", with no subtitle — the only primary on the door', () => {
  assert.equal(STRANGER_DOOR_WORDS, 'Open your invitation');
  for (const [label, html] of [
    ['in the foot', strangerDoor({ inFoot: true })],
    ['in flow', strangerDoor()],
    ['on the canvas', strangerDoor({ dock: false })],
  ] as const) {
    const summary = /<summary\b[^>]*>([\s\S]*?)<\/summary>/.exec(html)?.[1] ?? '';
    assert.ok(summary, `${label}: no door at all`);
    assert.equal(summary.replace(/<[^>]+>/g, ''), STRANGER_DOOR_WORDS, `${label}: the button says more than its one name — "${summary.replace(/<[^>]+>/g, '')}"`);
    assert.equal(count(html, /\bbutton-primary\b/g), 1, `${label}: more than one primary button on the signed-out door`);
    assert.match(html, /<summary class="button-primary /, `${label}: the one primary is not the door's own button`);
    assert.doesNotMatch(html, /Confirm your Booking|Upload your QR|>Sign in</, `${label}: the old door's words are still drawn`);
    // Before it is pressed the screen holds only the button: everything else is INSIDE the closed <details>.
    const outside = html.replace(/<details\b[\s\S]*<\/details>/, '');
    assert.equal(pressables(outside).length, 0, `${label}: something pressable stands beside the door: ${pressables(outside).join(' · ')}`);
  }
});

test('(2) pressed: exactly three choices, in order — Scan QR · Upload QR · Lost QR? Login', () => {
  const html = strangerDoor({ inFoot: true });
  const inside = html.slice(html.indexOf('</summary>'));
  assert.deepEqual(pressables(inside), [DOOR_CHOICE.scan, DOOR_CHOICE.upload, DOOR_CHOICE.login]);
  assert.deepEqual(DOOR_CHOICE, { scan: 'Scan QR', upload: 'Upload QR', login: 'Lost QR? Login' });
  assert.match(inside, /<input type="file" accept="image\/\*"/, 'Upload QR does not open the phone’s picker');
  assert.match(inside, /href="\/login\?next=%2Fmaria-and-jose"[^>]*>Lost QR\? Login</, 'Lost QR? Login does not come back to this event');
  // A list-only event keeps its one line UNDER the door — words, not a fourth choice.
  const listOnly = strangerDoor({ mayAskToJoin: false });
  assert.equal(pressables(listOnly.slice(listOnly.indexOf('</summary>'))).length, 3);
});

test('(3) signed in and listed: "Not Maria? Switch account" opens the same three — and signs nobody out by opening', () => {
  const html = renderToStaticMarkup(React.createElement(NotYouSwitch, { slug: 'maria-and-jose', account: { firstName: 'Maria' } }));
  const summary = /<summary\b[^>]*>([\s\S]*?)<\/summary>/.exec(html)?.[1]?.replace(/<[^>]+>/g, '') ?? '';
  assert.equal(summary, 'Not Maria? Switch account');
  assert.deepEqual(pressables(html.slice(html.indexOf('</summary>'))), [DOOR_CHOICE.scan, DOOR_CHOICE.upload, DOOR_CHOICE.login]);
  assert.doesNotMatch(html, /sign-out|<form/, 'opening the line posts a sign-out');
  assert.doesNotMatch(html, /\bbutton-primary\b/, 'the small line draws a second primary under the guest’s RSVP');
  const noName = renderToStaticMarkup(React.createElement(NotYouSwitch, { slug: 'maria-and-jose', account: { firstName: '' } }));
  assert.match(noName, /Not you\?/);
  // The shipped "Not you? Switch" (reply page) is unchanged.
  const shipped = renderToStaticMarkup(React.createElement(NotYouSwitch, { slug: 'maria-and-jose' }));
  assert.match(shipped, /<form[^>]*action="\/maria-and-jose\/sign-out" method="post">Not you\? <button/);

  // The server already lets a listed account straight in (its seat → the guest's own tree)…
  const page = read('app/[slug]/page.tsx');
  assert.match(page, /const guestViewer = resolveGuestViewer\(\{\s*eventId: event\.event_id,\s*cookie: session,\s*seat: viewerSeat,\s*\}\);/);
  // …and the line is drawn for the account's OWN seat only, never a pass held for somebody else, never on the canvas.
  assert.match(page, /switchAccountName=\{\s*viewerAccount\?\.id && viewerSeat\?\.guestId === guest\.guest_id && !isEditorCanvas\s*\?/);
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.equal(count(body, /switchLine=\{switchAccountName !== null && event\.slug && !isEditorCanvas \? <NotYouSwitch slug=\{event\.slug\} account=\{\{ firstName: switchAccountName \}\} \/> : null\}/g), 2, 'a guest cover without the line');
  const masthead = read('app/[slug]/_components/pahina-masthead.tsx');
  assert.match(masthead, /\{!door && switchLine \? <div \{\.\.\.line\(\)\} data-cover-switch="" className="w-full">\{switchLine\}<\/div> : null\}/);
});

test('(4) the live scan is the shared camera half, and a scanned code goes where an uploaded one goes', () => {
  // The camera loads when the door is drawn, never on the Maker's first load (its JS budget).
  const door = read('app/[slug]/_components/door-choices.tsx');
  assert.match(door, /const ScanYourQr = dynamic\(\(\) => import\('\.\/scan-your-qr'\)/);
  assert.doesNotMatch(door, /useLiveQrScan|from '@\/lib\/use-live-qr-scan'/, 'the camera half is back on the door’s first load');
  const choices = read('app/[slug]/_components/scan-your-qr.tsx');
  assert.match(choices, /useLiveQrScan\(onCode\)/);
  assert.match(choices, /const target = uploadedQrTarget\(raw, slug\);/);
  assert.match(choices, /setSaid\(NOT_THIS_EVENTS_CODE\)/);
  assert.doesNotMatch(choices, /getUserMedia|makeQrDetector|import\('jsqr'\)/, 'the door grew a camera of its own');
  const seat = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/seat-scanner.tsx');
  assert.match(seat, /useLiveQrScan\(handle\)/, 'the Find-a-seat scanner no longer shares the camera half');
  assert.doesNotMatch(seat, /getUserMedia/, 'a second copy of the camera half');
  const hook = read('lib/use-live-qr-scan.ts');
  assert.match(hook, /makeQrDetector\(\)/);
  assert.match(hook, /useCameraThatComesBack\(/);
});
