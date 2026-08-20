/**
 * The rule that decides how much page a chapter gets.
 *
 * The design's whole claim is that SIZE MEANS SOMETHING — a wedding takes the
 * width, a Tuesday takes a line. These pin the two ways that claim dies:
 * everything ending up the same size, and a size nobody can fill.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chapterWeight,
  weighYear,
  weighYearWithFloor,
  type WeighedChapter,
} from './chapter-weight';

const full: WeighedChapter = { hasPicture: true, hasWriting: true };
const pics: WeighedChapter = { hasPicture: true, hasWriting: false };
const words: WeighedChapter = { hasPicture: false, hasWriting: true };
const bare: WeighedChapter = { hasPicture: false, hasWriting: false };

test('the lead is earned by BOTH a picture and writing', () => {
  assert.equal(chapterWeight(full), 'lead');
  assert.equal(chapterWeight(pics), 'medium', 'a photo dump is not a lead');
  assert.equal(chapterWeight(words), 'medium', 'a note is not a lead');
  assert.equal(chapterWeight(bare), 'line');
});

test('🔑 a year has AT MOST ONE lead — two full-width blocks is the layout losing its nerve', () => {
  assert.deepEqual(weighYear([full, full, full]), ['lead', 'medium', 'medium']);
});

test('the newest chapter takes the lead, because that is the order it is handed', () => {
  const w = weighYear([pics, full, full]);
  assert.deepEqual(w, ['medium', 'lead', 'medium'], 'the FIRST eligible one leads');
});

test('🪤 a year of nothing but lines is promoted — a receipt is not a year', () => {
  assert.deepEqual(weighYearWithFloor([bare, bare, bare]), ['medium', 'line', 'line']);
});

test('a year that already has something is left alone', () => {
  assert.deepEqual(weighYearWithFloor([bare, words]), ['line', 'medium']);
  assert.deepEqual(weighYearWithFloor([full, bare]), ['lead', 'line']);
});

test('an empty year produces nothing rather than throwing', () => {
  assert.deepEqual(weighYearWithFloor([]), []);
});

test('THE RULE NEVER ASKS WHAT KIND OF CELEBRATION IT WAS', () => {
  // Ranking by event type would be the product deciding a wedding matters more
  // than a graduation, on a page about somebody's own life — and it fails the
  // person whose biggest day was a debut. Same inputs, same answer, always.
  const a = chapterWeight({ hasPicture: true, hasWriting: true });
  const b = chapterWeight({ hasPicture: true, hasWriting: true });
  assert.equal(a, b);
});
