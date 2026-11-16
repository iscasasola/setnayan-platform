/**
 * 🛡 A COUPLE IS ALWAYS TOLD WHEN A SUPPLIER IS NOT YET VERIFIED (owner 2026-11-16, specs DECISION_LOG 36d74d48:
 * "the event's supplier list" and "wherever a couple sees or acts on an unverified shop"). Told, never blocked.
 *
 * Every couple-facing place an unverified shop appears draws the ONE shipped line — `NotYetVerifiedThreadLine`
 * (`app/_components/chat/not-yet-verified-line.tsx`) or, on the shop's own page, its notice — from the ONE test
 * `threadShowsNotYetVerified` (a READ state that is not 'verified', never a demo). An unread state draws nothing.
 *
 * Not listed, on purpose: Discover / Find search and Compare list verified shops only, so an unverified shop never
 * appears there.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { stripComments } from './strip-comments';
import { teamRowOf, type TeamRowFacts } from './your-team-rows';
import { shopVerifiedNote, threadShowsNotYetVerified } from './findable-shop';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));
const LINE_IMPORT = /import \{ NotYetVerifiedThreadLine \} from '@\/app\/_components\/chat\/not-yet-verified-line';/;
const V = 'app/dashboard/[eventId]/vendors';

/** Every couple-facing surface, and the flag it draws the line from. */
const SURFACES: ReadonlyArray<{ file: string; draws: RegExp; why: string }> = [
  { file: 'app/dashboard/[eventId]/messages/[threadId]/page.tsx', draws: /shopNotYetVerified \? <NotYetVerifiedThreadLine renewing=\{shopPapersRenewing\} \/> : null/, why: 'the chat head' },
  { file: `${V}/_components/shortlist-categories.tsx`, draws: /v\.notYetVerified \? <NotYetVerifiedThreadLine renewing=\{v\.papersRenewing\} \/> : null/, why: 'the Suppliers card' },
  { file: `${V}/_components/vendor-quickview-inspector.tsx`, draws: /v\.notYetVerified \? <NotYetVerifiedThreadLine renewing=\{v\.papersRenewing\} \/> : null/, why: 'the quick-view' },
  { file: `${V}/_components/accordion-lock.tsx`, draws: /notYetVerified \? \(\s*<>\s*\{copy\.body\}\s*<NotYetVerifiedThreadLine renewing=\{papersRenewing\} \/>/, why: 'the Book confirm (every Book press)' },
  { file: `${V}/_components/booked-row.tsx`, draws: /row\.notYetVerified \? \(\s*<div className="ml-14">\s*<NotYetVerifiedThreadLine renewing=\{row\.papersRenewing\} \/>/, why: 'the booked and waiting rows' },
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
  assert.equal(count(rowSrc, /row\.notYetVerified \? \(\s*<div className="ml-14">\s*<NotYetVerifiedThreadLine renewing=\{row\.papersRenewing\} \/>/g), 2, 'a team row lost the line');
  // Both card renders: the card with actions AND the bare card.
  const cardSrc = read(`${V}/_components/shortlist-categories.tsx`);
  assert.equal(count(cardSrc, /v\.notYetVerified \? <NotYetVerifiedThreadLine renewing=\{v\.papersRenewing\} \/> : null/g), 2, 'a card render lost the line');
  assert.match(cardSrc, /\{card\}\s*\{told\}/, 'the bare card computes the line and never draws it');
  // The shop's own page keeps its notice.
  assert.match(read('app/v/[slug]/page.tsx'), /NotYetVerifiedNotice/);
});

test('the Suppliers page reads the flag with the chat head’s own test, and hands it to every row', () => {
  const page = read(`${V}/page.tsx`);
  assert.match(page, /'vendor_profile_id, name_revealed_at, screen_name, tier_state, verification_state, next_renewal_due_at, is_demo, papers_current'/, 'the demo flag is not read, so a demo shop would be called unverified');
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

// 📄 PAPERS RENEWAL — owner 16 Nov "9.yes 10.yes 11.yes": a shop verified before whose papers lapsed after 30 March
// reads "Renewing their papers with Setnayan", ALONE, in every place the not-verified line shows (chat, the supplier
// list, the Book confirm). The lapse keeps `verification_state = 'verified'` and only stamps `papers_lapsed_at`, so the
// old state-only test drew NOTHING for that shop.
test('the one test tells a couple about a lapsed shop too, and says which line', () => {
  assert.equal(shopVerifiedNote({ verification_state: 'pending_review', is_demo: false }), 'not_verified');
  assert.equal(shopVerifiedNote({ verification_state: 'unverified', papers_current: false }), 'not_verified');
  assert.equal(shopVerifiedNote({ verification_state: 'verified', papers_current: false }), 'renewing');
  assert.equal(shopVerifiedNote({ verification_state: 'verified', papers_current: true }), null);
  // Never drawn from an absence: a row without the column, an unread row, a demo shop.
  assert.equal(shopVerifiedNote({ verification_state: 'verified' }), null);
  assert.equal(shopVerifiedNote({ verification_state: 'verified', papers_current: null }), null);
  assert.equal(shopVerifiedNote(null), null);
  assert.equal(shopVerifiedNote({ verification_state: null, papers_current: false }), null);
  assert.equal(shopVerifiedNote({ verification_state: 'verified', papers_current: false, is_demo: true }), null);
  // The boolean every surface draws from now covers the lapsed shop.
  assert.equal(threadShowsNotYetVerified({ verification_state: 'verified', papers_current: false }), true);
  assert.equal(threadShowsNotYetVerified({ verification_state: 'verified', papers_current: true }), false);
});

test('every read that decides the line also reads papers_current, and hands "renewing" down', () => {
  const reader = read('lib/not-yet-verified.server.ts');
  assert.match(reader, /\.select\('verification_state, is_demo, papers_current'\)/, 'the chat read cannot see a lapse');
  assert.match(reader, /return shopVerifiedNote\(data\);/);
  const chat = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(chat, /const shopPapersRenewing = shopVerifiedNote === 'renewing';/);
  assert.match(chat, /quoteLockTarget\.papersRenewing = shopPapersRenewing;/, 'the quote card\'s Book confirm says not verified');
  const proposal = read('app/proposals/[publicId]/page.tsx');
  assert.match(proposal, /lockTarget\.papersRenewing = note === 'renewing';/);
  assert.match(proposal, /papersRenewing=\{lockTarget\.papersRenewing === true\}/);
  assert.match(read('app/_components/chat-message-stream.tsx'), /papersRenewing=\{lockTarget\.papersRenewing === true\}/);
  const page = read(`${V}/page.tsx`);
  assert.match(page, /papers_renewing: shopVerifiedNote\(a\) === 'renewing',/);
  assert.match(page, /papersRenewing: ext\?\.papers_renewing === true,/, 'the team rows never get the renewing flag');
  assert.match(read('lib/shortlist-taxonomy.ts'), /papersRenewing: ext\?\.papers_renewing === true,/, 'the cards never get it');
  assert.equal((read('lib/booked-rows.ts').match(/papersRenewing: team\.papersRenewing,/g) ?? []).length, 2);
  assert.match(read(`${V}/_components/shortlist-categories.tsx`), /papersRenewing=\{v\.papersRenewing\}/, 'the bench Book confirm never learns');
  assert.match(read(`${V}/_components/bench-vendor-actions.tsx`), /papersRenewing=\{papersRenewing\}/);
  // The line itself: the renewing words replace the not-verified ones (never both).
  const line = read('app/_components/chat/not-yet-verified-line.tsx');
  assert.match(line, /label=\{renewing \? RENEWING_COUPLE_MARK : NOT_YET_VERIFIED_LINE\}/);
  assert.match(line, /\{renewing \? RENEWING_COUPLE_LINE : NOT_YET_VERIFIED_INFO\}/);
});

test('a team row carries "renewing" only when it is TRUE', () => {
  const base: TeamRowFacts = {
    vendorId: 'v1', name: 'Lumina Studio', service: 'Photo', logoUrl: null, status: 'contracted',
    lockRequestState: null, lockRequestExpiresAt: null, inBuild: true, lockGroupId: null, lockBlocked: null,
    inquiryStatus: 'accepted', threadId: 't1', pricePhp: 10000, depositStep: null, reviewStatus: null,
    quoteWaitingOnCouple: false,
  };
  const ctx = { eventId: 'e1', lockHandshakeEnabled: true };
  assert.equal(teamRowOf({ ...base, notYetVerified: true, papersRenewing: true }, ctx)?.papersRenewing, true);
  assert.equal(teamRowOf({ ...base, notYetVerified: true }, ctx)?.papersRenewing, false);
});
