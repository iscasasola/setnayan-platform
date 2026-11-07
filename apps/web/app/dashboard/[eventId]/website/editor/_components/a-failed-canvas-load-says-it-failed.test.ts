/**
 * 🔌 A FAILED CANVAS LOAD SAYS IT FAILED — IT NEVER CLAIMS A LINK LEFT THE PAGE (walk 2026-11-01, `/dev/maker-lab`).
 *
 * The Maker's canvas guard (`maker-canvas-guard.tsx`) covers the frame when it lands anywhere but the couple's page.
 * A load that FAILS lands on the browser's error page, which reads exactly like a link to elsewhere (cross-origin,
 * `location` throws) — and the canvas told the couple "That link leads out of your Invitation page" over a page nobody
 * had pressed anything on. THE PROPERTY: before the frame has shown the page once, an unreadable or off-page landing is
 * a FAILED LOAD (it says so, with Try again); only after it is an escape. And because WebKit fires NOTHING for a
 * failed frame load (measured: no load, no error, the frame stays on about:blank), a frame still blank after
 * `CANVAS_STALL_MS` says it is taking too long, with the same Try again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { CANVAS_STALL_MS, canvasLanding, canvasStalled } from './maker-canvas-guard';

const PAGE = '/maria-and-jose';

test('🔑 a frame that never reached the page and cannot be read is a failed load, not an escape', () => {
  assert.equal(canvasLanding(null, PAGE, false), 'failed', 'the browser error page (cross-origin) on a first load');
  assert.equal(canvasLanding('/login', PAGE, false), 'failed', 'a first load that never reached the page');
});

test('after the page was shown, leaving it is an escape (the guard still covers it)', () => {
  assert.equal(canvasLanding(null, PAGE, true), 'escaped');
  assert.equal(canvasLanding('/dashboard/abc/launch', PAGE, true), 'escaped');
});

test('the page itself and the blank frame before its first load cover nothing', () => {
  assert.equal(canvasLanding(PAGE, PAGE, false), 'page');
  assert.equal(canvasLanding(`${PAGE}/everyone`, PAGE, true), 'page');
  assert.equal(canvasLanding('blank', PAGE, false), 'blank');
});

test('🔑 a load that fires nothing (WebKit: no load, no error, still about:blank) is called out after a bounded wait', () => {
  assert.equal(canvasStalled('blank', false), true, 'a frame still blank and never on the page has stalled');
  assert.equal(canvasStalled('blank', true), false, 'a frame that reached the page has not stalled');
  assert.equal(canvasStalled(PAGE, false), false, 'a frame on the page has not stalled');
  assert.ok(CANVAS_STALL_MS > 0 && CANVAS_STALL_MS <= 30_000, `the wait is ${CANVAS_STALL_MS}ms — a blank canvas must not pass for "loading" forever`);
  const src = stripComments(readFileSync(join(import.meta.dirname, 'maker-canvas-guard.tsx'), 'utf8'));
  assert.match(src, /setTimeout\([\s\S]{0,200}canvasStalled\([\s\S]{0,120}setLanding\('stalled'\)[\s\S]{0,40}CANVAS_STALL_MS/, 'the guard never arms the stall wait');
});

test('🔑 the failed face says it failed and offers a retry; the "leads out" words belong to the escape face only', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, 'maker-canvas-guard.tsx'), 'utf8'));
  const failedAt = src.indexOf('data-maker-canvas-failed');
  const escapedAt = src.indexOf('data-maker-canvas-escaped');
  assert.ok(failedAt > 0, 'the guard has no failed-load face');
  assert.ok(escapedAt > failedAt, 'the escape face is gone or moved above the failed face — re-aim the scan');
  const failedFace = src.slice(failedAt, escapedAt);
  assert.match(failedFace, /didn&rsquo;t load|did not load|couldn&rsquo;t load/i, 'the failed face does not say the page failed to load');
  assert.match(failedFace, /Try again/, 'the failed face offers no retry');
  assert.doesNotMatch(failedFace, /leads out/, 'the failed face still claims a link left the page');
});
