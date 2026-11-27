/**
 * 🕖 FACEBOOK POSTS AT THE OWNER'S TIMES (owner, 27 Nov 2026: "give me the correct timing for posts").
 *
 * Two a day for a new Page: lunch 12–1 PM and the evening peak 7–9 PM, every day; Saturday and Sunday
 * also open 10 AM–12 NN. ≥3h apart as before. All times are Asia/Manila (UTC+08:00, no DST).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAvailableSlot, isPhWeekend, PLATFORM_DAILY_CAPS } from './governor';

const ph = (s: string) => new Date(`${s}+08:00`);
const phTime = (d: Date) => new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

test('Facebook posts at most twice a day', () => {
  assert.equal(PLATFORM_DAILY_CAPS.facebook, 2);
});

test('a weekday morning waits for the lunch window', () => {
  // Fri 27 Nov 2026, 08:00 PHT
  assert.equal(phTime(nextAvailableSlot('facebook', [], ph('2026-11-27T08:00:00'))), '2026-11-27 12:00');
});

test('11 AM on a weekday is no longer a posting time', () => {
  assert.equal(phTime(nextAvailableSlot('facebook', [], ph('2026-11-27T11:15:00'))), '2026-11-27 12:00');
});

test('after lunch, the next slot is the 7 PM evening window, not 6 PM', () => {
  const lunch = ph('2026-11-27T12:00:00');
  assert.equal(phTime(nextAvailableSlot('facebook', [lunch], ph('2026-11-27T13:30:00'))), '2026-11-27 19:00');
});

test('two posts fill the day; the third rolls to the next day', () => {
  const taken = [ph('2026-11-27T12:00:00'), ph('2026-11-27T19:00:00')];
  // Next day is Saturday → the weekend 10 AM window opens.
  assert.equal(phTime(nextAvailableSlot('facebook', taken, ph('2026-11-27T19:30:00'))), '2026-11-28 10:00');
});

test('weekends open at 10 AM; weekdays do not', () => {
  assert.equal(isPhWeekend('2026-11-28'), true); // Saturday
  assert.equal(isPhWeekend('2026-11-29'), true); // Sunday
  assert.equal(isPhWeekend('2026-11-30'), false); // Monday
  assert.equal(phTime(nextAvailableSlot('facebook', [], ph('2026-11-29T09:00:00'))), '2026-11-29 10:00');
  assert.equal(phTime(nextAvailableSlot('facebook', [], ph('2026-11-30T09:00:00'))), '2026-11-30 12:00');
});

test('a 10 AM weekend post keeps 3h spacing, so the second lands in the evening', () => {
  const morning = ph('2026-11-28T10:00:00');
  assert.equal(phTime(nextAvailableSlot('facebook', [morning], ph('2026-11-28T10:05:00'))), '2026-11-28 19:00');
});

test('nothing lands after 9 PM', () => {
  assert.equal(phTime(nextAvailableSlot('facebook', [], ph('2026-11-30T21:00:00'))), '2026-12-01 12:00');
});
