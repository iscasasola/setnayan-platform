/**
 * Unit suite for deriveGenericPlan (0053 Phase 3 PR3). Invariant: the starter plan
 * is the type's taxonomy chips (in order), capped by the effort axis; picks carry
 * the category ids and labels the display strings, 1:1 and aligned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveGenericPlan } from './generic-plan';

const CHIPS = [
  { cat: 'catering', label: 'Catering', folder: 'food' },
  { cat: 'photo_video', label: 'Photo & Video', folder: 'media' },
  { cat: 'host_mc', label: 'Host / MC', folder: 'talent' },
  { cat: 'cake', label: 'Cake', folder: 'food' },
  { cat: 'dj', label: 'DJ', folder: 'talent' },
  { cat: 'photo_booth', label: 'Photo Booth', folder: 'media' },
  { cat: 'mobile_bar', label: 'Mobile Bar', folder: 'food' },
  { cat: 'lights_sound', label: 'Lights & Sound', folder: 'av' },
  { cat: 'florist', label: 'Florist', folder: 'decor' },
  { cat: 'stylist', label: 'Stylist / Decorator', folder: 'decor' },
];

test('effort scales the plan size: simple=4, balanced=6, allout=9', () => {
  assert.equal(deriveGenericPlan(CHIPS, 'simple').picks.length, 4);
  assert.equal(deriveGenericPlan(CHIPS, 'balanced').picks.length, 6);
  assert.equal(deriveGenericPlan(CHIPS, 'allout').picks.length, 9);
});

test('unknown / missing effort falls back to 6', () => {
  assert.equal(deriveGenericPlan(CHIPS, undefined).picks.length, 6);
  assert.equal(deriveGenericPlan(CHIPS, null).picks.length, 6);
  assert.equal(deriveGenericPlan(CHIPS, 'bogus').picks.length, 6);
});

test('picks are category ids; labels align 1:1 in taxonomy order', () => {
  const plan = deriveGenericPlan(CHIPS, 'simple');
  assert.deepEqual(plan.picks, ['catering', 'photo_video', 'host_mc', 'cake']);
  assert.deepEqual(plan.labels, ['Catering', 'Photo & Video', 'Host / MC', 'Cake']);
});

test('fewer chips than the limit → returns all of them', () => {
  const plan = deriveGenericPlan(CHIPS.slice(0, 2), 'allout');
  assert.deepEqual(plan.picks, ['catering', 'photo_video']);
});

test('empty taxonomy → empty plan (no crash)', () => {
  assert.deepEqual(deriveGenericPlan([], 'balanced'), { picks: [], labels: [] });
});
