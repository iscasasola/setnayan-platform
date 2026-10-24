/**
 * plans-price-reach-not-income.test.ts — no plan rations what earns a booking fee.
 *
 * ⚖ OWNER 2026-10-23 (DECISION_LOG), verbatim: *"their price differences is based on their type of business reach and
 * not their capability to maximize the app features that return us income. We want everybody to be able to give us
 * booking fee. let them create at least 3 per category."* Plus: no bookings-per-day limit, no inquiry-answering limit,
 * "free 50" portfolio photos for every shop (more is Papic credits, Phase 2), couples per date the same on every plan.
 *
 * Each block pins a PROPERTY of the plan table or of the code that enforces it — never a sentence of copy:
 *   1 · no tier has fewer than MIN_SERVICES_PER_LEAF service cards per category;
 *   2 · no tier carries a per-day booking limit or a weekly answering limit — and NO shipped code reads either cap to
 *       refuse anything (the readers are named below, each one display-only);
 *   3 · the portfolio base is PORTFOLIO_FREE_BASE on every tier, it is grandfathered (stored photos always survive),
 *       and the one writer that saves the gallery goes through `capPortfolioRefs`;
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
  MIN_SERVICES_PER_LEAF,
  PORTFOLIO_FREE_BASE,
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

// ── 1 · at least three service cards per category ─────────────────────────────

test('1 · no tier has fewer than three service cards per category', () => {
  assert.equal(MIN_SERVICES_PER_LEAF, 3, 'owner: "let them create at least 3 per category"');
  for (const t of VENDOR_TIERS) {
    assert.ok(
      TIER_CAPS[t].servicesPerLeaf >= MIN_SERVICES_PER_LEAF,
      `${t} allows ${TIER_CAPS[t].servicesPerLeaf} per category — below the every-plan minimum of ${MIN_SERVICES_PER_LEAF}`,
    );
  }
  // The rungs the ruling named (Free 3 · Verified 3 · Solo 3 · Pro 5 · Ultra unlimited).
  assert.equal(TIER_CAPS.free.servicesPerLeaf, 3);
  assert.equal(TIER_CAPS.verified.servicesPerLeaf, 3);
  assert.equal(TIER_CAPS.solo.servicesPerLeaf, 3);
  assert.equal(TIER_CAPS.pro.servicesPerLeaf, 5);
  assert.equal(TIER_CAPS.enterprise.servicesPerLeaf, Infinity);
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
  'lib/vendor-effective-caps.ts': 'carries the axis through the Custom overlay (max with the base, which is Infinity)',
  'app/for-suppliers/_components/vendor-tier-deltas.tsx': 'display — the base rung says "You set it" / "No limit" once',
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

test('3c · the gallery save goes through capPortfolioRefs and refuses out loud', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/actions.ts'), 'utf8'));
  const portfolioCase = src.slice(src.indexOf("case 'portfolio':"), src.indexOf("case 'gallery_videos':"));
  assert.ok(portfolioCase.length > 100, "the portfolio case of updateVendorProfileField moved — re-point this guard");
  assert.match(portfolioCase, /capPortfolioRefs\(/, 'the gallery save no longer goes through the grandfathered cap');
  // The owner's words, with the shop's own number (`portfolioOverCapMessage` — a personal invite's 100, 2026-10-23).
  assert.match(portfolioCase, /portfolioOverCapMessage\(portfolioMax\)|PORTFOLIO_OVER_BASE_MESSAGE/, 'a refused photo is no longer refused with the owner’s words');
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
  assert.ok(numbers.length >= 7, `${latest}: expected every tier + ELSE in the whitelist arm, found ${numbers.length}`);
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
