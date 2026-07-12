/**
 * Unit suite for surprise-mode's pure state resolver. Guards the load-bearing
 * bit: a surprise is protecting the honoree exactly while the public site reads
 * as private, and stops the moment the scheduled reveal is due.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSurpriseState, surpriseRevealAtFor } from './event-surprise';

const T = (iso: string) => new Date(iso).getTime();

test('not a surprise → never sealed, regardless of visibility', () => {
  const s = resolveSurpriseState(
    { is_surprise: false, landing_page_visibility: 'private', scheduled_launch_at: null },
    T('2026-01-01'),
  );
  assert.equal(s.isSurprise, false);
  assert.equal(s.sealed, false);
  assert.equal(s.needsRevealDate, false);
});

test('surprise + private + future reveal → sealed until the date', () => {
  const s = resolveSurpriseState(
    {
      is_surprise: true,
      landing_page_visibility: 'private',
      scheduled_launch_at: '2026-11-14T00:00:00.000Z',
    },
    T('2026-10-01'),
  );
  assert.equal(s.isSurprise, true);
  assert.equal(s.sealed, true);
  assert.equal(s.revealAt, '2026-11-14T00:00:00.000Z');
  assert.equal(s.needsRevealDate, false);
});

test('surprise reveal is DUE → no longer sealed (the surprise is over)', () => {
  const s = resolveSurpriseState(
    {
      is_surprise: true,
      landing_page_visibility: 'private',
      scheduled_launch_at: '2026-11-14T00:00:00.000Z',
    },
    T('2026-11-14T09:00:00.000Z'), // the morning of — auto-launch is due
  );
  assert.equal(s.sealed, false); // resolveEffectiveVisibility → 'public'
});

test('surprise + private + NO schedule → needs a reveal date', () => {
  const s = resolveSurpriseState(
    { is_surprise: true, landing_page_visibility: 'private', scheduled_launch_at: null },
    T('2026-10-01'),
  );
  assert.equal(s.sealed, true);
  assert.equal(s.needsRevealDate, true);
  assert.equal(s.revealAt, null);
});

test('surprise but already public → not sealed (host revealed early)', () => {
  const s = resolveSurpriseState(
    { is_surprise: true, landing_page_visibility: 'public', scheduled_launch_at: null },
    T('2026-10-01'),
  );
  assert.equal(s.isSurprise, true);
  assert.equal(s.sealed, false);
  assert.equal(s.needsRevealDate, false);
});

test('surpriseRevealAtFor anchors to local midnight of the event date', () => {
  const iso = surpriseRevealAtFor('2026-11-14');
  assert.ok(iso && !Number.isNaN(new Date(iso).getTime()));
  const d = new Date(iso!);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

test('surpriseRevealAtFor returns null for a missing/invalid date', () => {
  assert.equal(surpriseRevealAtFor(null), null);
  assert.equal(surpriseRevealAtFor(undefined), null);
  assert.equal(surpriseRevealAtFor('not-a-date'), null);
});
