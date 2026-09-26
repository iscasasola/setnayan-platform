/**
 * print-preview-view.test.ts
 *
 * The controller's phone check of Prints & Tickets (2026-09-26) found each
 * sample sitting as a blank `bg-ink/[0.04]` box for several seconds — the
 * server render behind `/api/hub-print` is real work, not a cached asset, and
 * a bare `<img>` gave no sign anything was coming. `printPreviewView` is the
 * pure mapping the fix (`print-preview.tsx`) reads to paint a loading state
 * and an honest error state instead. See that file's own docblock for why the
 * mapping lives here rather than being asserted through a DOM: this suite has
 * none.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { printPreviewView } from './print-preview-view';

test('loading — shimmer on, image present but invisible, "Drawing your…", no error', () => {
  const v = printPreviewView('loading', 'poster');
  assert.equal(v.showShimmer, true);
  assert.equal(v.showImage, true, 'the <img> stays mounted so onLoad/onError can still fire');
  assert.equal(v.imageVisible, false);
  assert.equal(v.loadingLabel, 'Drawing your poster…');
  assert.equal(v.errorLabel, null);
});

test('loaded — the image is visible, shimmer and both labels are gone', () => {
  const v = printPreviewView('loaded', 'poster');
  assert.equal(v.showImage, true);
  assert.equal(v.imageVisible, true);
  assert.equal(v.showShimmer, false);
  assert.equal(v.loadingLabel, null);
  assert.equal(v.errorLabel, null);
});

test('⛔ error — NEVER a silent grey box: the image and shimmer are gone, an honest line is not', () => {
  const v = printPreviewView('error', 'invitation card');
  assert.equal(v.showImage, false, 'a failed <img> left in the tree can still paint the browser’s own broken-image icon');
  assert.equal(v.showShimmer, false, 'a shimmer over nothing loading is a lie');
  assert.equal(v.loadingLabel, null);
  assert.ok(v.errorLabel, 'error must always carry a line — this is the whole point of the fix');
  assert.match(v.errorLabel!, /couldn.t draw your invitation card/i);
  assert.match(v.errorLabel!, /try again/i, 'the couple needs to be told the retry is available');
});

test('the piece’s own name reaches both sentences, never a generic "this"', () => {
  assert.match(printPreviewView('loading', 'entourage card').loadingLabel!, /entourage card/);
  assert.match(printPreviewView('error', 'boarding pass').errorLabel!, /boarding pass/);
});
