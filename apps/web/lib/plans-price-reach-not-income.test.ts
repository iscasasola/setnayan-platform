/**
 * plans-price-reach-not-income.test.ts — no plan rations what earns a booking fee.
 *
 * ⚖ OWNER 2026-10-23 (DECISION_LOG), verbatim: *"their price differences is based on their type of business reach and
 * not their capability to maximize the app features that return us income. We want everybody to be able to give us
 * booking fee. let them create at least 3 per category."* Plus: no bookings-per-day limit, no inquiry-answering limit,
 * "free 50" portfolio photos for every shop (more is Papic credits, Phase 2), couples per date the same on every plan.
 *
 * Each block pins a PROPERTY of the plan table or of the code that enforces it — never a sentence of copy:
 *   1 · SUPERSEDED 2026-11-04 — service cards per category are a plan allowance again (owner, "SUPPLIER PLAN
 *       ALLOWANCES": "service cards free 1, solo 3, pro 10, ultra unlimited"); the block now pins those rungs and that
 *       every plan may still put up at least one card in a category it covers (a booking needs a card);
 *   2 · no tier carries a per-day booking limit or a weekly answering limit — and NO shipped code reads either cap to
 *       refuse anything (the readers are named below, each one display-only);
 *   3 · the portfolio base is PORTFOLIO_FREE_BASE on every tier, it is grandfathered (stored photos always survive),
 *       and past it the gallery save PAYS from the shop wallet (`shop_portfolio_commit`, shop wallet PR 2/2 —
 *       `shop-portfolio-credits.test.ts` + the db test hold the price) instead of refusing;
 *   4 · couples per date is WHITELIST_PER_DATE_ALL_PLANS on every tier, in TypeScript AND in the latest SQL definition
 *       of `vendor_tier_limit` (the database is the gate);
 *   5 · Free answers couples, is searchable once verified, and shows its real name once verified.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  DAILY_CAPACITY_MAX,
  PORTFOLIO_FREE_BASE,
  WAITLIST_SETTING_MAX,
  PORTFOLIO_OVER_BASE_MESSAGE,
  portfolioOverCapMessage,
  TIER_CAPS,
  VENDOR_TIERS,
  WHITELIST_PER_DATE_ALL_PLANS,
  capPortfolioRefs,
  canAcceptInAppInquiries,
  isTrueNameTier,
} from './vendor-tier-caps';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..', '..');

function shippedSources(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n === '.next') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  return out;
}

/** Files (relative to apps/web) whose comment-stripped source reads `.<key>`. */
function readersOf(key: string): string[] {
  const re = new RegExp(`\\.${key}\\b`);
  return shippedSources()
    .filter((f) => {
      const src = readFileSync(f, 'utf8');
      return src.includes(key) && re.test(stripComments(src));
    })
    .map((f) => relative(WEB, f))
    .sort();
}

// ── 1 · service cards IN TOTAL, by plan (owner 2026-11-18) ─────────────────────

test('1 · every plan can put up a card; the totals are the owner\'s', () => {
  // Owner 2026-11-18, DECISION_LOG "SUPPLIER PLANS REBUILT" + "SUPPLIER CARDS: MAX 80, ULTRA 200", verbatim: "max 80
  // cards / ultra 200 cards". Cards are counted IN TOTAL across categories (supersedes the per-category allowance).
  for (const t of VENDOR_TIERS) {
    assert.ok(TIER_CAPS[t].serviceCardsTotal >= 1, `${t} allows ${TIER_CAPS[t].serviceCardsTotal} cards — a shop could not be booked at all`);
  }
  assert.equal(TIER_CAPS.free.serviceCardsTotal, 1);
  assert.equal(TIER_CAPS.verified.serviceCardsTotal, 3);
  assert.equal(TIER_CAPS.solo.serviceCardsTotal, 10);
  assert.equal(TIER_CAPS.pro.serviceCardsTotal, 20);
  assert.equal(TIER_CAPS.enterprise.serviceCardsTotal, 80); // Max (today's top plan, renamed by the owner 2026-11-18)
});

// ── 2 · no per-day booking cap, no weekly answering cap ────────────────────────

test('2a · no tier carries a bookings-a-day limit or a weekly answering limit', () => {
  for (const t of VENDOR_TIERS) {
    assert.equal(TIER_CAPS[t].slotsPerDay, Infinity, `${t} still limits bookings a day by plan`);
    assert.equal(TIER_CAPS[t].inAppCustomersPerWeek, Infinity, `${t} still limits answering couples per week`);
    assert.equal(canAcceptInAppInquiries(t), true, `${t} cannot answer couples`);
  }
});

/**
 * Every shipped file that still reads either cap, and why it is allowed to. A reader is allowed only when it DISPLAYS
 * the cap or carries it through the plan table — never when it clamps, refuses or hides an input with it. A new reader
 * turns this red so its author has to say which it is.
 */
const CAP_READERS: Record<string, string> = {
  'lib/vendor-tier-caps.ts': 'the table itself',
  // (vendor-tier-deltas.tsx, which displayed both caps on /for-suppliers, was deleted 2026-11-06 with the old page.)
};

test('2b · no shipped code reads the per-day or weekly cap to refuse anything', () => {
  const readers = [...new Set([...readersOf('slotsPerDay'), ...readersOf('inAppCustomersPerWeek')])].sort();
  const unexplained = readers.filter((f) => !(f in CAP_READERS));
  assert.deepEqual(
    unexplained,
    [],
    `These files read a plan's bookings-a-day / weekly-answering cap — the owner removed both limits on 2026-10-23. ` +
      `If it only DISPLAYS the cap, add it to CAP_READERS with the reason; if it clamps or refuses, remove the read:\n  ` +
      unexplained.join('\n  '),
  );
  // Teeth: the scan must actually find the table, or a broken scan passes everything.
  assert.ok(readers.includes('lib/vendor-tier-caps.ts'), 'the reader scan found nothing — it is not scanning');
});

test('2c · bookings per date are NOT a plan limit on any plan (owner 2026-11-18, ruling 17)', () => {
  // Owner, verbatim: "a cake business can handle 30 cakes in a day. So they need to purchase unlimited from us. I think
  // that is wrong pricing." Reverses 2026-11-06. The shop's own number governs, up to the setting's ceiling (500).
  for (const t of VENDOR_TIERS) {
    assert.equal('bookingsPerDatePerService' in TIER_CAPS[t], false, `${t} carries a plan cap on bookings per date again`);
  }
  assert.equal(DAILY_CAPACITY_MAX, 500, 'owner ruling 18: "Yes, 500"');
  // The waiting list is a lead too (ruling 32): every plan's allowance is the setting's own ceiling.
  for (const t of VENDOR_TIERS) assert.equal(TIER_CAPS[t].waitlistAcceptances, WAITLIST_SETTING_MAX, `${t} limits the waitlist by plan`);
});

// ── 3 · the portfolio free base, grandfathered ─────────────────────────────────

test('3a · the portfolio base is 50 free on every tier', () => {
  assert.equal(PORTFOLIO_FREE_BASE, 50, 'owner: "free 50"');
  for (const t of VENDOR_TIERS) {
    assert.equal(TIER_CAPS[t].portfolioPhotos, PORTFOLIO_FREE_BASE, `${t} portfolio photos`);
  }
  assert.equal(
    PORTFOLIO_OVER_BASE_MESSAGE,
    'Your first 50 portfolio photos are free. More photos with Papic credits is coming soon.',
  );
});

test('3b · capPortfolioRefs keeps every stored photo and refuses only NEW ones past the base', () => {
  const stored = Array.from({ length: 80 }, (_, i) => `r2://media/vendors/v/p${i}.jpg`);
  // A grandfathered shop re-saving, reordering or removing keeps everything it has.
  const resave = capPortfolioRefs([...stored].reverse(), stored, 50);
  assert.equal(resave.refs.length, 80);
  assert.equal(resave.refused, 0);
  const removed = capPortfolioRefs(stored.slice(0, 60), stored, 50);
  assert.equal(removed.refs.length, 60);
  assert.equal(removed.refused, 0);
  // …but cannot ADD while over the base.
  const added = capPortfolioRefs([...stored, 'r2://media/vendors/v/new.jpg'], stored, 50);
  assert.equal(added.refused, 1);
  assert.equal(added.refs.length, 80);
  // A shop under the base adds up to it, in order, and no further.
  const fresh = Array.from({ length: 52 }, (_, i) => `r2://media/vendors/v/n${i}.jpg`);
  const under = capPortfolioRefs(fresh, fresh.slice(0, 10), 50);
  assert.equal(under.refs.length, 50);
  assert.equal(under.refused, 2);
  assert.deepEqual(under.refs, fresh.slice(0, 50), 'order is the supplier’s');
});

test('3c · the gallery save keeps the free base, grandfathered, and pays past it — never truncates', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/actions.ts'), 'utf8'));
  const portfolioCase = src.slice(src.indexOf("case 'portfolio':"), src.indexOf("case 'gallery_videos':"));
  assert.ok(portfolioCase.length > 100, "the portfolio case of updateVendorProfileField moved — re-point this guard");
  // Owner 2026-10-23 (option A): past the free base the photo is paid from the shop wallet in ONE step with the
  // list (`shop_portfolio_commit` — grandfathered, the free base read inside the function), not refused.
  assert.match(portfolioCase, /\.rpc\('shop_portfolio_commit'/, 'the gallery save no longer goes through the priced commit');
  assert.match(portfolioCase, /status === 'insufficient'/, 'a save the wallet cannot cover is no longer refused out loud');
  assert.equal(portfolioOverCapMessage(PORTFOLIO_FREE_BASE), PORTFOLIO_OVER_BASE_MESSAGE, 'at the base the refusal is the owner’s sentence, byte for byte');
  // The old silent truncation must not come back inside the parser.
  const parser = src.slice(src.indexOf('function parsePortfolioRefs('), src.indexOf('function parseVideoLinks('));
  assert.doesNotMatch(parser, /out\.length\s*>=/, 'parsePortfolioRefs truncates by count again — that cut grandfathered shops');
});

// ── 4 · five couples a date, on every plan, in both places ─────────────────────

test('4a · couples per date is the same on every tier', () => {
  assert.equal(WHITELIST_PER_DATE_ALL_PLANS, 5);
  for (const t of VENDOR_TIERS) {
    assert.equal(TIER_CAPS[t].whitelistPerDate, WHITELIST_PER_DATE_ALL_PLANS, `${t} couples per date`);
  }
});

test('4b · the database gate says the same number — the LATEST vendor_tier_limit, every tier', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const defining = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /CREATE OR REPLACE FUNCTION public\.vendor_tier_limit\(/.test(readFileSync(join(dir, f), 'utf8')));
  const latest = defining.at(-1);
  assert.ok(latest, 'no migration defines vendor_tier_limit');
  const sql = readFileSync(join(dir, latest), 'utf8');
  const arm = sql.slice(sql.indexOf("WHEN 'whitelist_per_date' THEN"), sql.indexOf("WHEN 'waitlist_acceptances' THEN"));
  assert.ok(arm.length > 50, `${latest}: could not find the whitelist arm`);
  const numbers = [...arm.matchAll(/(?:WHEN '(\w+)'|ELSE)\s+THEN\s+(\d+)|ELSE\s+(\d+)/g)].map((m) => Number(m[2] ?? m[3]));
  // Derived, not typed: every tier in VENDOR_TIERS + the ELSE (was a literal 7 until the Custom plan was retired 2026-11-06).
  assert.ok(
    numbers.length >= VENDOR_TIERS.length + 1,
    `${latest}: expected every tier + ELSE in the whitelist arm, found ${numbers.length}`,
  );
  assert.deepEqual(
    [...new Set(numbers)],
    [WHITELIST_PER_DATE_ALL_PLANS],
    `${latest}: the SQL gate holds a different couples-per-date number on some plan`,
  );
});

// ── 5 · Free sells like every plan ─────────────────────────────────────────────

test('5 · Free answers couples, is searchable once verified, and shows its name once verified', () => {
  for (const t of ['free', 'verified'] as const) {
    assert.equal(TIER_CAPS[t].chat, 'chat', `${t} cannot chat`);
    assert.equal(TIER_CAPS[t].marketplaceSearchable, true, `${t} is not searchable`);
  }
  assert.equal(TIER_CAPS.free.nameMode, 'verified', 'Free shows its real name once verified');
  // …and never by tier alone — an UNVERIFIED free shop stays a placeholder (the reveal is is_verified).
  assert.equal(isTrueNameTier('free'), false);
});
