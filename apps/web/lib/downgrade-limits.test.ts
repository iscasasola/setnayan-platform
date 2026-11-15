/**
 * THE LIMITS SHEET — the pure rules (ruling 5683, supplier downgrade). Every number is read from `TIER_CAPS` / the
 * Plan sheet's `limitOf`, never typed here, so a re-sized plan cannot leave this test asserting the old one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIX_HREF, downgradeFit, storageFloor, storageWords, type DowngradeFacts, type FitCard } from './downgrade-limits';
import { limitOf } from './plan-sheet';
import { TIER_CAPS } from './vendor-tier-caps';
import { EARLY_SHOPS_PAPERS_DUE_ISO } from './verified-badge';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = new Date('2026-11-12T02:00:00Z');
const opts = { paywallOn: true, storageAllowanceBytes: null, now: NOW };

const card = (id: string, kind: string, families: string[], daily: number | null = null): FitCard => ({
  id,
  name: id,
  kind,
  families,
  live: true,
  hold: null,
  holdStartsOn: null,
  daily,
});

const base: DowngradeFacts = {
  founder: false,
  cards: [],
  includedBranches: 0,
  seats: { people: 0, freeHelpers: 0, counted: 0 },
  extraSeats: 0,
  reachKm: null,
  storedBytes: 0,
  badge: null,
};

test('a plan at or above the shop’s own draws nothing', () => {
  const f = downgradeFit({ ...base, cards: [card('a', 'photo', ['A']), card('b', 'video', ['B'])] }, 'solo', 'pro', opts);
  assert.deepEqual(f.rows, []);
  assert.equal(f.fits, true);
});

test('services: what the lower plan does not hold goes on hold, counted by the create gate’s rule', () => {
  // Pro → Free: Free holds TIER_CAPS.free.parentCategories families × servicesPerLeaf per kind.
  const cards = [card('a', 'photo', ['A']), card('b', 'video', ['B']), card('c', 'florist', ['C'])];
  const f = downgradeFit({ ...base, cards }, 'pro', 'free', opts);
  const row = f.rows.find((r) => r.key === 'services');
  assert.ok(row, 'services row missing');
  assert.equal(row.state, 'over');
  assert.equal(row.fix?.href, FIX_HREF.services);
  const stays = Math.min(TIER_CAPS.free.parentCategories, 3);
  assert.match(row.line, new RegExp(`^3 services on .* ${3 - stays} go(es)? on hold when Free starts`));
  assert.equal(f.fits, false);
  assert.equal(f.blocked, false, 'services never block — the lower plan puts them on hold');
});

test('a card already held is not counted again', () => {
  const held = { ...card('b', 'video', ['B']), hold: 'held' as const };
  const f = downgradeFit({ ...base, cards: [card('a', 'photo', ['A']), held] }, 'pro', 'free', opts);
  assert.equal(f.rows.find((r) => r.key === 'services'), undefined);
});

test('bookings a day: a card over the lower plan’s number is named', () => {
  const perDay = limitOf('solo', 'bookingsPerDate', true);
  const f = downgradeFit({ ...base, cards: [card('a', 'photo', ['A'], perDay + 2)] }, 'pro', 'solo', opts);
  const row = f.rows.find((r) => r.key === 'dailyBookings');
  assert.ok(row);
  assert.equal(row.fix?.href, FIX_HREF.dailyBookings);
});

test('team seats and branches are KEPT over a lower plan — the line says so', () => {
  const branches = TIER_CAPS.pro.branchesIncluded;
  assert.ok(branches > TIER_CAPS.solo.branchesIncluded, 'the plan table no longer steps branches down from Pro');
  const f = downgradeFit(
    { ...base, includedBranches: branches, seats: { people: 5, freeHelpers: 1, counted: 4 } },
    'pro',
    'solo',
    opts,
  );
  const b = f.rows.find((r) => r.key === 'branches');
  const s = f.rows.find((r) => r.key === 'teamSeats');
  assert.ok(b && s);
  assert.match(b.line, /You keep them; you can’t add more\./);
  assert.match(s.line, /Everyone stays; you can’t add more\./);
  assert.equal(b.fix?.href, FIX_HREF.branches);
});

test('Free and Verified have no branches — read from the plan table', () => {
  assert.equal(limitOf('free', 'branches', true), 0);
  assert.equal(limitOf('verified', 'branches', true), 0);
});

test('reach over the lower plan is named with both numbers in words', () => {
  const soloKm = TIER_CAPS.solo.serviceRadiusKm;
  const f = downgradeFit({ ...base, reachKm: soloKm + 10 }, 'pro', 'solo', opts);
  const row = f.rows.find((r) => r.key === 'reach');
  assert.ok(row);
  assert.match(row.line, new RegExp(`${soloKm + 10} km`));
});

test('THE STORAGE FLOOR: below what the shop stores blocks the switch until some is removed', () => {
  assert.deepEqual(storageFloor(5e9, null), { fits: true });
  assert.deepEqual(storageFloor(5e9, 6e9), { fits: true });
  assert.deepEqual(storageFloor(7e9, 5e9), { fits: false, overBytes: 2e9 });
  const f = downgradeFit({ ...base, storedBytes: 7e9 }, 'pro', 'solo', { ...opts, storageAllowanceBytes: 5e9 });
  const row = f.rows.find((r) => r.key === 'storage');
  assert.ok(row);
  assert.equal(row.state, 'blocks');
  assert.match(row.line, /Remove 2 GB first\./);
  assert.equal(f.blocked, true);
  assert.equal(storageWords(12_400_000_000), '12.4 GB');
});

test('no storage allowance known → no storage row (a guessed number would tell a supplier to delete their work)', () => {
  const f = downgradeFit({ ...base, storedBytes: 9e12 }, 'pro', 'solo', opts);
  assert.equal(f.rows.find((r) => r.key === 'storage'), undefined);
});

test('THE BADGE GRACE: a verified shop moving down keeps its badge to its own day (30 March for the early shops)', () => {
  const f = downgradeFit(
    { ...base, badge: { verification_state: 'verified', next_renewal_due_at: EARLY_SHOPS_PAPERS_DUE_ISO } },
    'solo',
    'verified',
    opts,
  );
  const row = f.rows.find((r) => r.key === 'badge');
  assert.ok(row);
  assert.equal(row.state, 'keeps');
  assert.match(row.line, /until March 30, 2027/);
  assert.equal(f.fits, true, 'the badge row is good news, not a misfit');
  // Past the day the badge is off — the sheet never promises it.
  const after = downgradeFit(
    { ...base, badge: { verification_state: 'verified', next_renewal_due_at: EARLY_SHOPS_PAPERS_DUE_ISO } },
    'solo',
    'verified',
    { ...opts, now: new Date('2027-04-01T00:00:00Z') },
  );
  assert.equal(after.rows.find((r) => r.key === 'badge'), undefined);
});

test('an unread fact says so — never "fits"', () => {
  const f = downgradeFit({ ...base, cards: null, seats: null, includedBranches: null }, 'pro', 'solo', opts);
  assert.deepEqual(
    f.rows.map((r) => [r.key, r.state]),
    [
      ['services', 'unread'],
      ['teamSeats', 'unread'],
      ['branches', 'unread'],
    ],
  );
  assert.equal(f.fits, false);
});

test('no limit number is typed in the rule', () => {
  const src = stripComments(readFileSync(join(HERE, 'downgrade-limits.ts'), 'utf8'));
  assert.doesNotMatch(src, /TIER_CAPS\.\w+\.\w+/, 'read a limit through limitOf/capsOf, never a raw TIER_CAPS cell');
  assert.doesNotMatch(src, /\b\d+\s*(GB|km)\b/, 'a typed GB or km figure');
});
