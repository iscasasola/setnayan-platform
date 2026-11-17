/**
 * 🏅 THE PUBLIC BADGE SURFACES SAY ONLY WHAT IS TRUE (badge build J6, owner rulings 2026-11-15 — specs 4b8cc3a3 "the
 * badges we created will be the only badges we have"; 7fbff0cd items 5 and 9). One test per claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import {
  CARD_MEDALS,
  RETIRED_EXPLORE_PILLS,
  keptExplorePills,
  publicBadgeView,
  publicShopName,
} from './public-badges';

// The components are compiled with the classic JSX runtime under tsx — React must be in scope before they load.
(globalThis as unknown as { React: unknown }).React = React;

const WEB = process.cwd();
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROW = 'app/(shell)/explore/_components/vendor-badge-row.tsx';
const CARD = 'app/(shell)/explore/_components/vendor-card.tsx';
const SHEET = 'app/v/[slug]/_components/service-details-sheet.tsx';

test('1 · the retired explore pills draw nothing; Setnayan Verified stays', async () => {
  assert.deepEqual(keptExplorePills(['new', 'verified', 'couple_trusted', 'most_booking', 'top_pick']), ['verified']);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VendorBadgeRow } = await import('@/app/(shell)/explore/_components/vendor-badge-row');
  const html = renderToStaticMarkup(
    React.createElement(VendorBadgeRow, { badges: ['new', 'verified', 'couple_trusted', 'most_booking', 'top_pick'] }),
  );
  assert.match(html, /Setnayan Verified/);
  for (const word of ['New', 'Couple Trusted', 'Most Booked', 'Top Pick']) {
    assert.ok(!html.includes(`>${word}<`), `the retired pill "${word}" still draws`);
  }
  assert.equal(renderToStaticMarkup(React.createElement(VendorBadgeRow, { badges: [...RETIRED_EXPLORE_PILLS] })), '');
});

test('2 · the card medals keep the row order, Setnayan Verified LAST (ruling 7fbff0cd (5))', () => {
  assert.deepEqual(
    CARD_MEDALS.map((m) => m.name),
    ['Hot Booking', 'Quick Responder', 'Trending Now', 'Rave Reviews', 'Generous Giver', 'Setnayan Verified'],
  );
  const v = publicBadgeView({ verified: true, cardMedals: ['verified', 'rave_reviews', 'hot_booking'] });
  assert.deepEqual(v.cardMedals.map((m) => m.key), ['hot_booking', 'rave_reviews', 'verified']);
});

test('3 · never a fake badge: only a fact with a source draws', () => {
  const today = publicBadgeView({ verified: true });
  assert.deepEqual(today.shopBadges, [], 'a tiered shop badge drew with no source');
  assert.deepEqual(today.seals.map((s) => s.key), ['verified']);
  assert.deepEqual(today.cardMedals.map((m) => m.key), ['verified']);
  const unverified = publicBadgeView({ verified: false, seals: ['verified'], cardMedals: ['verified'] });
  assert.deepEqual([unverified.seals, unverified.cardMedals], [[], []], 'Verified drew for an unverified shop');
  const bad = publicBadgeView({
    verified: false,
    tiers: [
      { family: 'bookings', name: 'Completed bookings', tier: 'Gold', count: 0 },
      { family: 'nope' as never, name: 'Made up', tier: 'Gold', count: 9 },
    ],
    seals: ['made_up' as never],
  });
  assert.deepEqual([bad.shopBadges, bad.seals], [[], []], 'a zero count or an unknown key drew a badge');
});

test('4 · an unverified shop shows its REAL name on the explore card (ruling 7fbff0cd (9))', () => {
  assert.equal(publicShopName('Lumen Studio', 'Photographer · Quezon City'), 'Lumen Studio');
  assert.equal(publicShopName('  ', 'Photographer · Quezon City'), 'Photographer · Quezon City');
  assert.match(src(CARD), /const displayLabel = publicShopName\(vendor\.business_name, resolveVendorDisplayName\(\{/);
});

test('5 · the service card draws Verified and the medals only from the adapter view', () => {
  const sheet = src(SHEET);
  assert.match(sheet, /\{badges\?\.verified \? \(\s*<BadgeCheck aria-label="Setnayan Verified"/);
  // The J3 row comes in as a slot (the gallery hands the same CardBadgeRow the face draws); without one, only the
  // adapter's names-only row may draw.
  assert.match(sheet, /\{cardBadgeRow \? \([\s\S]*?\{cardBadgeRow\}[\s\S]*?\) : badges && badges\.cardMedals\.length > 0 \? \(\s*<CardMedalRow medals=\{badges\.cardMedals\} \/>\s*\) : null\}/);
  assert.match(sheet, /badges = null,/, 'with no caller passing badges, nothing may draw');
});

test('6 · ONE adapter: the surfaces read badge names through lib/public-badges and no other badge engine', () => {
  for (const f of [ROW, CARD, SHEET]) {
    const code = src(f);
    assert.ok(code.includes("from '@/lib/public-badges'"), `${f} does not read the adapter`);
    assert.doesNotMatch(code, /from '@\/lib\/(spotlight-awards|badge-rewards|shop-badges|card-badges[^']*|shop-seals[^']*)'/, `${f} reads a badge engine directly`);
  }
  assert.doesNotMatch(src(ROW), /couple_trusted|most_booking|top_pick|Most Booked|Top Pick|Couple Trusted/);
});
