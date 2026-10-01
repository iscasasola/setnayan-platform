/**
 * THE HUB'S CAMERA TERMS IS ONLY THE CARD — owner, 2026-09-30, on the Papic
 * "Before you start shooting" card inside the guest Event Hub: "space is too big
 * also should only be the small frame".
 *
 * The camera has two mounts. Standalone (/papic/guest) its small-card states
 * are the whole page, so they sit centred on a full-height ground. Inside the
 * hub that same `<main min-h-screen …>` left a screen of empty cream above and
 * below the card, and nested a <main> inside the hub's <main>.
 *
 * Executed against the source (comments stripped):
 *   1. the hub mounts the camera `embedded`; /papic/guest mounts it not;
 *   2. the embedded frame carries no <main>, no min-h-screen, no bg/centring;
 *   3. every small-card state (terms · blocked · no camera) goes through that
 *      frame — none opens its own full-page <main> again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CAMERA = read('app/papic/guest/_components/papic-guest-capture.tsx');

/** The JSX of the single `<PapicGuestCapture … />` element in a file. */
function mount(rel: string): string {
  const src = read(rel);
  const at = src.indexOf('<PapicGuestCapture');
  assert.ok(at >= 0, `precondition: ${rel} mounts the camera`);
  assert.equal(src.indexOf('<PapicGuestCapture', at + 1), -1, `${rel} mounts it once`);
  return src.slice(at, src.indexOf('/>', at));
}

const PAGE_FRAME = /<main\b|min-h-(?:screen|dvh)|\bbg-cream\b|justify-center/;

test('the hub mounts the camera embedded; the standalone page does not', () => {
  const hub = mount('app/[slug]/_components/site-body.tsx');
  assert.match(hub, /\bembedded(?:\s|=\{true\}|$)/, 'the Event Hub passes `embedded`');
  assert.doesNotMatch(hub, /embedded=\{false\}/);
  assert.match(mount('app/papic/guest/page.tsx'), /embedded=\{false\}/, '/papic/guest keeps its full page');
});

test('the embedded frame is only the card — no page around it', () => {
  const at = CAMERA.indexOf('function CardFrame(');
  assert.ok(at >= 0, 'precondition: the frame exists');
  const body = CAMERA.slice(at, CAMERA.indexOf('\n}\n', at));
  const embeddedBranch = body.match(/if \(embedded\)([^;]*);/);
  assert.ok(embeddedBranch, 'precondition: the frame decides on `embedded`');
  assert.doesNotMatch(embeddedBranch[1] ?? '', PAGE_FRAME, 'embedded renders no page frame');
  // …and the standalone branch still does, so /papic/guest is unchanged.
  assert.match(body.slice(embeddedBranch.index! + embeddedBranch[0].length), /min-h-screen/);
});

test('every small-card state goes through the frame, not its own <main>', () => {
  for (const heading of ['Before you start shooting', 'Camera unavailable', 'We need your camera']) {
    const h = CAMERA.indexOf(heading);
    assert.ok(h >= 0, `precondition: found "${heading}"`);
    const ret = CAMERA.lastIndexOf('return (', h);
    const opening = CAMERA.slice(ret, h);
    assert.match(opening, /<CardFrame embedded=\{embedded\}/, `"${heading}" is framed by CardFrame`);
    assert.doesNotMatch(opening, PAGE_FRAME, `"${heading}" opens no full-page frame of its own`);
  }
});
