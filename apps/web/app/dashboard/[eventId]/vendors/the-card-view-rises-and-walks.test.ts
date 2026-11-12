/**
 * the-card-view-rises-and-walks.test.ts — 👉 THE CARD VIEW IS THE SCREEN, AND A SIDEWAYS SWIPE WALKS THE CATEGORY.
 *
 * Owner 2026-11-12 ("Yes, build it" on the organized-Find prototype; "ok let's do that" on the swipe): the service card
 * view, the scoped search and the ideas board rise full-screen; a sideways swipe on the card's BODY goes to the next /
 * previous supplier in the open category (Booked → Asked → Suggested), with a "2 of 5 in Catering" peek row whose ends
 * are tappable; a swipe on the PHOTO is the photo's own; the first 8 px lock the axis; the body keeps pan-y; the tap
 * that ends a swipe is swallowed; a swipe down from the top closes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { sheetWalkLine, SHEET_WALK_HINT } from '@/lib/supplier-sheet';

const read = (p: string) => stripComments(readFileSync(join(__dirname, p), 'utf8'));
const SHEET = read('_components/supplier-sheet.tsx');
const BENCH = read('_components/shortlist-categories.tsx');
const INSP = read('_components/find-inspiration.tsx');
const SEARCH = read('_components/category-search-overlay.tsx');

test('1 · the three views rise full-screen', () => {
  assert.match(SHEET, /<Sheet open onClose=\{onClose\} labelledById="supplier-sheet-name" wide rise full>/, 'the card view is not a full-screen rise');
  assert.match(INSP, /<Sheet open onClose=\{close\} labelledById=\{titleId\} full rise>/, 'the ideas board is not a full-screen rise');
  assert.match(SEARCH, /\.csov\{position:fixed;inset:0;/, 'the scoped search is no longer the full-screen overlay');
});

test('2 · the gestures: owner by where the finger starts, 8 px axis lock, 60 px step, 80 px close, pan-y, tap swallowed', () => {
  assert.match(SHEET, /touch-pan-y/, 'the body must keep its own up/down scroll');
  assert.match(SHEET, /data-swipe-body=""/);
  assert.match(SHEET, /closest\('\[data-swipe-photo\]'\)/, 'a swipe that starts on the photo must stay the photo’s');
  assert.match(SHEET, /Math\.abs\(dx\) < 8 && Math\.abs\(dy\) < 8/, 'the first 8 px lock the axis');
  assert.match(SHEET, /Math\.abs\(dx\) >= 60/, 'a sideways step is 60 px');
  assert.match(SHEET, /dy >= 80 && \(g\.photo \|\| g\.top\)/, 'down closes only from the photo or from the top');
  assert.match(SHEET, /onClickCapture=\{\(e\) => \{\s*if \(!swallow\.current\) return;/, 'the tap that ends a swipe must be swallowed');
});

test('3 · the walk is the page’s own order, and every card that opens the sheet is on it', () => {
  assert.match(BENCH, /document\.querySelectorAll<HTMLElement>\('\[data-sheet-ring\]'\)/, 'the order must be read from the page');
  assert.match(BENCH, /useSheetRing\(sheetDoor, walkable \? \(tile \?\? null\) : null, walkKey, openSheetNow\)/, 'the couple’s cards are not on the walk');
  assert.match(BENCH, /useSheetRing\(ringDoor, ringAt, v\.vendorProfileId, onOpen\)/, 'the suggested cards are not on the walk');
  assert.match(BENCH, /ringTile=\{tile\}/);
  assert.match(BENCH, /walk=\{sheetWalk\}/);
});

test('4 · the peek row names both ends and both ends are buttons', () => {
  assert.match(SHEET, /data-sheet-walk-prev=""/);
  assert.match(SHEET, /data-sheet-walk-next=""/);
  assert.match(SHEET, /onClick=\{\(\) => stepTo\(-1\)\}/);
  assert.match(SHEET, /onClick=\{\(\) => stepTo\(1\)\}/);
  assert.equal(sheetWalkLine(1, 5, 'Catering'), '2 of 5 in Catering');
  assert.equal(sheetWalkLine(999, 1200, 'Catering'), '1,000 of 1,200 in Catering');
  assert.match(SHEET_WALK_HINT, /swipe sideways for the next supplier/);
});

test('5 · a step is a new supplier: nothing of the last one is drawn', () => {
  assert.match(SHEET, /if \(shown !== shownKey\) \{\s*setShown\(shownKey\);/);
  assert.match(SHEET, /setSaid\(null\);\s*\}/);
});
