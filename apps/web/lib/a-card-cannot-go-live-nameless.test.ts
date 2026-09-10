/**
 * A SERVICE CARD CANNOT GO LIVE WITHOUT A NAME.
 *
 * 🔴 THE DEFECT, MEASURED IN PRODUCTION 2026-09-10 (not grepped, queried):
 * `count(*) FILTER (WHERE title IS NULL) FROM vendor_services` = **2 of 2**, and
 * both are `is_active = true`. Every reader falls back to the kind, so a couple
 * reads "Wedding Bands (full ensemble)" where the shop's own name for that
 * service should be.
 *
 * ⚖ AND THE REPAIR IS A FILL, NOT A REQUIREMENT. The owner locked the opposite
 * on 2026-07-27 — *"saving builds blank will make us autocreate a name"* — so
 * `PUBLISH_REQUIREMENTS` is deliberately UNTOUCHED and this file asserts that it
 * stays that way. Demanding the one thing the product promises to write would
 * have been the wrong fix, and the two cards prove why: nobody withheld a title,
 * nothing ever wrote one.
 *
 * 🔑 EVERY ASSERTION IS DERIVED FROM THE FILE THAT DECIDES IT — the maker's own
 * expression, the server's own call, and the SQL read out of the migration —
 * because the rule now lives in three places that must agree. *Two copies of one
 * rule always drift, and the copy on the screen is the optimistic one.*
 *
 * ⛔ WHAT IS DELIBERATELY NOT ASSERTED HERE: that `canvas-maker.tsx` imports the
 * shared helper. It still inlines its own copy, and folding it in was skipped ON
 * PURPOSE — PRs #5373 and #5375 are both open drafts rewriting that file, and a
 * cosmetic dedup in it would have conflicted with two changes that must land
 * together. Rule 3 below pins the two shapes against each other instead, so they
 * cannot drift while this stays green.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  SERVICE_CARD_TITLE_MAX,
  autoServiceCardTitle,
  serviceCardTitleOrAuto,
} from './service-card-auto-title';
import { PUBLISH_REQUIREMENTS } from './service-publish-gate';
import { humanizeKind } from './service-card-kind';

const WEB = join(import.meta.dirname, '..');
const REPO = join(WEB, '..', '..');
const MIGRATIONS = join(REPO, 'supabase', 'migrations');
const read = (p: string) => readFileSync(p, 'utf8');

/** Found by NAME, never by date — a prefix is allocated, not chosen. */
function nameMigration(): string {
  const hits = readdirSync(MIGRATIONS).filter((f) =>
    f.endsWith('_a_card_cannot_go_live_nameless.sql'),
  );
  assert.equal(hits.length, 1, `expected exactly one naming migration, found: ${hits.join(', ')}`);
  return read(join(MIGRATIONS, hits[0] as string));
}

/**
 * Strip SQL line comments before matching.
 *
 * 🪤 THIS MIGRATION EXPLAINS ITS OWN RULE IN PROSE, quoting the very shapes it
 * writes ("`<kind> by <shop>`", `title = NULLIF(...)`). A raw-source match would
 * happily find the rule in the paragraph describing it and report a pass with
 * the function gutted. This repo has been bitten by exactly that.
 */
function sqlBody(src: string): string {
  return src
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · THE RULE ITSELF
// ════════════════════════════════════════════════════════════════════════════

test('1 · a nameless card is named "<kind> by <shop>"', () => {
  assert.equal(
    autoServiceCardTitle({
      kindLabel: 'Wedding Bands (full ensemble)',
      shopName: 'Saysay Live Band & Hosting',
    }),
    'Wedding Bands (full ensemble) by Saysay Live Band & Hosting',
  );
});

test('1b · no shop name → the kind alone, never a dangling "by"', () => {
  for (const shopName of [null, undefined, '', '   ']) {
    const out = autoServiceCardTitle({ kindLabel: 'Live Band', shopName });
    assert.equal(out, 'Live Band', `shopName=${JSON.stringify(shopName)}`);
    assert.ok(!/\bby\s*$/.test(out), 'the title ends in a dangling "by"');
  }
});

test('1c · nothing to name it after → "", which the caller stores as NULL', () => {
  // An empty string in `title` is an absence wearing the costume of a value:
  // every reader in the app asks `title?.trim() || <fallback>`, so it would
  // behave exactly like the NULL it replaced while looking like a fix.
  assert.equal(autoServiceCardTitle({ kindLabel: '   ', shopName: 'Saysay' }), '');
  assert.equal(serviceCardTitleOrAuto(null, { kindLabel: '', shopName: 'Saysay' }), null);
  assert.equal(serviceCardTitleOrAuto('  ', { kindLabel: '', shopName: null }), null);
});

test('1d · the supplier’s own words always win', () => {
  assert.equal(
    serviceCardTitleOrAuto('Our Six-Piece Reception Set', {
      kindLabel: 'Live Band',
      shopName: 'Saysay',
    }),
    'Our Six-Piece Reception Set',
  );
});

test('1e · the clamp is the column’s, and it is applied to the joined name', () => {
  assert.equal(SERVICE_CARD_TITLE_MAX, 80);
  const out = autoServiceCardTitle({ kindLabel: 'K'.repeat(60), shopName: 'S'.repeat(60) });
  assert.equal(out.length, 80);
  // A typed title is clamped too, or the server would post 200 characters at a
  // column every other writer holds to 80.
  assert.equal(serviceCardTitleOrAuto('T'.repeat(200), { kindLabel: 'x', shopName: null })?.length, 80);
});

test('1f · the kind is never a raw database key', () => {
  // `humanizeKind` is the app-wide floor ("NEVER PRINT A DATABASE KEY AT A
  // COUPLE", lib/vendors.ts 2026-08-09). Both live cards sit on keys outside the
  // legacy 52, which is exactly the population this floor exists for.
  assert.equal(humanizeKind('host_mc'), 'Host Mc');
  assert.equal(
    autoServiceCardTitle({ kindLabel: humanizeKind('host_mc'), shopName: 'Saysay' }),
    'Host Mc by Saysay',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 2 · IT IS NOT A PUBLISH REQUIREMENT — the owner's 2026-07-27 lock
// ════════════════════════════════════════════════════════════════════════════

test('2 · a title is NEVER added to the publish gate', () => {
  assert.ok(
    !(PUBLISH_REQUIREMENTS as readonly string[]).includes('title'),
    'a missing title now REFUSES a publish — that reverses the owner’s 2026-07-27 ' +
      'lock ("saving builds blank will make us autocreate a name") and is his call, not a tidy-up',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 3 · THE MAKER AND THE SHARED RULE STILL WRITE THE SAME NAME
// ════════════════════════════════════════════════════════════════════════════

test('3 · the maker’s inline auto-name is the same shape as the shared rule', () => {
  const maker = read(
    join(WEB, 'app', 'vendor-dashboard', 'services', '_components', 'canvas-maker.tsx'),
  );
  const at = maker.indexOf('setTitle(shopName');
  assert.ok(at > 0, 'the maker stopped writing a name into a new card’s title box');
  const expr = maker.slice(at, maker.indexOf('\n', at));
  // The JOIN, matched as the template it is — not as the word "by" somewhere in
  // the file, which a comment would satisfy with the expression deleted.
  assert.match(
    expr,
    /`\$\{activeCategoryLabel\} by \$\{shopName\}`/,
    'the maker names a new card differently from the server — two names for one card',
  );
  assert.match(
    expr,
    new RegExp(`slice\\(0,\\s*${SERVICE_CARD_TITLE_MAX}\\)`),
    'the maker stopped clamping to the same length the column and the server use',
  );
  assert.match(expr, /:\s*activeCategoryLabel\)/, 'the maker lost its no-shop-name fallback');
});

// ════════════════════════════════════════════════════════════════════════════
// 4 · THE SERVER NAMES A BLANK CARD ON EVERY SAVE THAT REACHES IT
// ════════════════════════════════════════════════════════════════════════════

test('4 · commitVendorService names the card instead of storing the blank', () => {
  const actions = read(join(WEB, 'app', 'vendor-dashboard', 'services', 'actions.ts'));
  assert.match(
    actions,
    /const title = await titleForCard\(supabase, profile, category, typedTitle\);/,
    'the save stopped naming a blank card — a nameless row reaches the write again',
  );
  // The helper must actually consult the shared rule, or it is a second copy.
  assert.match(
    actions,
    /return serviceCardTitleOrAuto\(typed, \{ kindLabel, shopName \}\);/,
    'the server writes its own name instead of the shared one',
  );
  // And the kind must go through the app-wide labeller, never `category` raw.
  assert.match(
    actions,
    /cardKindLabeller\(\)\s*\n?\s*\.then\(\(label\) => label\(category\)\)/,
    'the server names the card after a raw database key',
  );
});

test('4b · the shop name passes the marketplace’s own anonymity test', () => {
  const actions = read(join(WEB, 'app', 'vendor-dashboard', 'services', 'actions.ts'));
  const start = actions.indexOf('async function titleForCard');
  assert.ok(start > 0, 'the naming helper is gone');
  const body = actions.slice(start, actions.indexOf('\n}\n', start));
  // The PREDICATE, not the assignment. `shopName = ...` on the left-hand side is
  // satisfied by `shopName = profile.business_name` with the gate deleted, which
  // is the exact leak this asserts against.
  assert.match(
    body,
    /if \(\s*\n?\s*row &&\s*\n?\s*isVendorNameRevealed\(\{/,
    'the shop name is written into a public card title without the hybrid-anonymity test — ' +
      'an unverified shop’s real name would be published AND frozen there',
  );
  assert.match(body, /is_verified: row\.verification_state === 'verified'/);
  assert.match(body, /name_revealed_at: row\.name_revealed_at \?\? null/);
  // Failing soft matters in ONE direction only: an unreadable profile must drop
  // the shop name, never publish it.
  assert.match(body, /catch \{\s*\n?\s*shopName = null;/, 'a failed profile read no longer fails toward hidden');
});

// ════════════════════════════════════════════════════════════════════════════
// 5 · THE DATABASE FLOOR — the only one of the four that is a fence
// ════════════════════════════════════════════════════════════════════════════

test('5 · the trigger fills a blank title, and does not refuse', () => {
  const body = sqlBody(nameMigration());
  assert.match(
    body,
    /CREATE OR REPLACE FUNCTION public\.fill_blank_service_card_title\(\)/,
    'the migration does not create the naming function at all',
  );
  assert.match(
    body,
    /CREATE TRIGGER trg_before_enforce_fill_service_card_title\s*\n?\s*BEFORE INSERT OR UPDATE ON public\.vendor_services/,
    'the trigger is gone, or stopped covering one of INSERT / UPDATE',
  );
  // ⛔ A REFUSAL HERE WOULD BOUNCE THE OWNER'S OWN LIVE CARDS. The legacy card
  // editor writes no title at all, so a gate on `title` would refuse his next
  // price change with a raw Postgres sentence.
  assert.ok(
    !/RAISE EXCEPTION/.test(body),
    'the naming trigger now REFUSES a publish — it must fill, never refuse (owner 2026-07-27)',
  );
});

test('5b · it writes the same name the TypeScript would', () => {
  const body = sqlBody(nameMigration());
  // The JOIN itself, as an expression — an occurrence count on ` by ` would be
  // satisfied by any prose the stripper missed.
  assert.match(
    body,
    /v_kind \|\| ' by ' \|\| v_shop/,
    'the database names a card differently from the app',
  );
  assert.match(body, /left\(\s*\n?\s*CASE WHEN v_shop IS NULL THEN v_kind ELSE/);
  assert.match(body, new RegExp(`\\n\\s*${SERVICE_CARD_TITLE_MAX}\\n`), 'the database clamp left 80');
  // The kind chain: the same source the coverage tree labels leaves from, then
  // the SQL spelling of `humanizeKind`.
  assert.match(body, /FROM public\.canonical_service_schemas s/);
  assert.match(
    body,
    /initcap\(replace\(COALESCE\(NEW\.category, ''\), '_', ' '\)\)/,
    'the humanised floor is gone — a raw database key could reach a card title',
  );
});

test('5c · the supplier’s own words survive the trigger, twice over', () => {
  const body = sqlBody(nameMigration());
  // The WHEN clause is the cheap half: a named card never calls the function.
  assert.match(
    body,
    /WHEN \(NULLIF\(btrim\(COALESCE\(NEW\.title, ''\)\), ''\) IS NULL\)/,
    'the trigger fires for named cards too — one lost early-return renames real work',
  );
  // …and the belt inside the function, for a future definition that loses it.
  assert.match(
    body,
    /IF NULLIF\(btrim\(COALESCE\(NEW\.title, ''\)\), ''\) IS NOT NULL THEN\s*\n\s*RETURN NEW;/,
    'the in-function guard is gone — the trigger would overwrite a typed title',
  );
});

test('5d · the database applies the same anonymity test as the app', () => {
  const body = sqlBody(nameMigration());
  assert.match(
    body,
    /AND \(p\.verification_state = 'verified' OR p\.name_revealed_at IS NOT NULL\)/,
    'the trigger writes any shop’s business_name into a public card title',
  );
});

test('5e · nothing is backfilled — the two live rows are the owner’s data', () => {
  const body = sqlBody(nameMigration());
  assert.ok(
    !/UPDATE\s+public\.vendor_services/i.test(body),
    'the migration rewrites live cards — putting words on a public card the shop never saw',
  );
});
