/**
 * 🛡 A COUPLE IS ALWAYS TOLD WHEN A SUPPLIER IS NOT YET VERIFIED (owner 2026-11-16, specs DECISION_LOG 36d74d48:
 * "the event's supplier list" and "wherever a couple sees or acts on an unverified shop"). Told, never blocked.
 *
 * Every couple-facing place an unverified shop appears draws the ONE shipped line — `NotYetVerifiedThreadLine`
 * (`app/_components/chat/not-yet-verified-line.tsx`) or, on the shop's own page, its notice — from the ONE test
 * `threadShowsNotYetVerified` (a READ state that is not 'verified', never a demo). An unread state draws nothing.
 *
 * Not listed, on purpose: Discover / Find search and Compare list verified shops only, so an unverified shop never
 * appears there. The Book confirm gets the line in its own PR (book-asks-one-confirm), which carries its own guard.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { stripComments } from './strip-comments';
import { teamRowOf, type TeamRowFacts } from './your-team-rows';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));
const LINE_IMPORT = /import \{ NotYetVerifiedThreadLine \} from '@\/app\/_components\/chat\/not-yet-verified-line';/;
const V = 'app/dashboard/[eventId]/vendors';

/** Every couple-facing surface, and the flag it draws the line from. */
const SURFACES: ReadonlyArray<{ file: string; draws: RegExp; why: string }> = [
  { file: 'app/dashboard/[eventId]/messages/[threadId]/page.tsx', draws: /shopNotYetVerified \? <NotYetVerifiedThreadLine \/> : null/, why: 'the chat head' },
  { file: `${V}/_components/shortlist-categories.tsx`, draws: /v\.notYetVerified \? <NotYetVerifiedThreadLine \/> : null/, why: 'the Suppliers card' },
  { file: `${V}/_components/vendor-quickview-inspector.tsx`, draws: /v\.notYetVerified \? <NotYetVerifiedThreadLine \/> : null/, why: 'the quick-view' },
  { file: `${V}/_components/booked-row.tsx`, draws: /row\.notYetVerified \? \(\s*<div className="ml-14">\s*<NotYetVerifiedThreadLine \/>/, why: 'the booked and waiting rows' },
];

test('every couple-facing surface draws the one shipped line', () => {
  for (const s of SURFACES) {
    const src = read(s.file);
    assert.match(src, LINE_IMPORT, `${s.why} (${s.file}) draws its own words instead of the shipped line`);
    assert.match(src, s.draws, `${s.why} (${s.file}) never tells the couple`);
  }
  // Both team rows: the booked row AND the row still waiting for a yes.
  const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;
  const rowSrc = read(`${V}/_components/booked-row.tsx`);
  assert.equal(count(rowSrc, /row\.notYetVerified \? \(\s*<div className="ml-14">\s*<NotYetVerifiedThreadLine \/>/g), 2, 'a team row lost the line');
  // Both card renders: the card with actions AND the bare card.
  const cardSrc = read(`${V}/_components/shortlist-categories.tsx`);
  assert.equal(count(cardSrc, /v\.notYetVerified \? <NotYetVerifiedThreadLine \/> : null/g), 2, 'a card render lost the line');
  assert.match(cardSrc, /\{card\}\s*\{told\}/, 'the bare card computes the line and never draws it');
  // The shop's own page keeps its notice.
  assert.match(read('app/v/[slug]/page.tsx'), /NotYetVerifiedNotice/);
});

test('the Suppliers page reads the flag with the chat head’s own test, and hands it to every row', () => {
  const page = read(`${V}/page.tsx`);
  assert.match(page, /'vendor_profile_id, name_revealed_at, screen_name, tier_state, verification_state, next_renewal_due_at, is_demo'/, 'the demo flag is not read, so a demo shop would be called unverified');
  assert.match(page, /not_yet_verified: threadShowsNotYetVerified\(a\),/, 'the card flag is not the chat head’s test');
  assert.match(page, /notYetVerified: ext\?\.not_yet_verified === true,/, 'the team rows never get the flag');
  assert.match(read('lib/shortlist-taxonomy.ts'), /notYetVerified: ext\?\.not_yet_verified === true,/, 'the cards never get the flag');
  const rows = read('lib/booked-rows.ts');
  assert.equal((rows.match(/notYetVerified: team\.notYetVerified,/g) ?? []).length, 2, 'a booked or waiting row drops the flag');
});

test('a team row carries the flag only when it is TRUE — an unread or off-platform shop is never called unverified', () => {
  const base: TeamRowFacts = {
    vendorId: 'v1', name: 'Lumina Studio', service: 'Photo', logoUrl: null, status: 'contracted',
    lockRequestState: null, lockRequestExpiresAt: null, inBuild: true, lockGroupId: null, lockBlocked: null,
    inquiryStatus: 'accepted', threadId: 't1', pricePhp: 10000, depositStep: null, reviewStatus: null,
    quoteWaitingOnCouple: false,
  };
  const ctx = { eventId: 'e1', lockHandshakeEnabled: true };
  assert.equal(teamRowOf({ ...base, notYetVerified: true }, ctx)?.notYetVerified, true);
  assert.equal(teamRowOf({ ...base }, ctx)?.notYetVerified, false);
  assert.equal(teamRowOf({ ...base, notYetVerified: false }, ctx)?.notYetVerified, false);
});
