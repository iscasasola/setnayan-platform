/**
 * the-toolkit-claim-is-true.test.ts — "390+ tools and templates" on /for-suppliers is a count, not a slogan.
 *
 * Owner, 23 Nov 2026: "put 390+ tools and templates on /for-suppliers". This file recounts, from what the code
 * ships, every item the claim stands on (see `lib/supplier-toolkit-count.ts`) and fails when the total falls under
 * `TOOLKIT_CLAIM_FLOOR`. It also holds that the page reads the one spelling and never calls the whole set "free"
 * (a few of the items are on a plan).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { TOOLKIT_CLAIM, TOOLKIT_CLAIM_FLOOR } from '@/lib/supplier-toolkit-count';
import { CARD_ORDER } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { SHOP_BADGE_FAMILIES } from '@/lib/public-badges';
import { SUPPLIER_QR_MODES } from '@/lib/supplier-qr-codes';
import { PRINT_DESIGNS, PRINT_PIECES } from '@/lib/supplier-prints';
import { SPECIALIZED_TOOLS } from '@/lib/specialized-tools';
import { HUB_TOOL_LIBRARY } from '@/lib/hub-tools';
import { AVAILABILITY_STYLES, CARD_STYLES_COMING_SOON } from '@/lib/availability-styles';
import { NEGOTIATE_PLAN_PRESETS } from '@/lib/chat-cards';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

/** The starting card templates: one VALUES row each, in every migration that seeds `service_included_templates`. */
function cardTemplateRows(): number {
  let rows = 0;
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    const seed = sql.match(/INSERT INTO public\.service_included_templates[\s\S]*?FROM \(VALUES\n([\s\S]*?)\n\s*\) AS v\(/);
    if (seed) rows += (seed[1] ?? '').split('\n').filter((l) => /^\s*\('/.test(l)).length;
  }
  return rows;
}

/**
 * The distinct payment splits. The quote maker's `PLAN_PRESETS` is not exported, so its tuples are read as text;
 * chat's presets are a first part with the balance 7 days before (`negotiatePresetDraft`). Two presets that split
 * the same way count once.
 */
function paymentSplits(): number {
  const src = readFileSync(join(WEB, 'app', '_components', 'proposal-maker.tsx'), 'utf8');
  const block = src.match(/const PLAN_PRESETS[\s\S]*?\[\s*\n([\s\S]*?)\] as const/);
  assert.ok(block, 'PLAN_PRESETS is still in proposal-maker.tsx');
  const shapes = new Set<string>();
  for (const m of (block[1] ?? '').matchAll(/\['\w+', (\d+), (?:\{ percent: (\d+), days: (\d+) \}|null), (\d+)\]/g)) {
    shapes.add(`${m[1]}|${m[2] ? `${m[2]}@${m[3]}` : ''}|${m[4]}`);
  }
  assert.ok(shapes.size >= 4, 'the quote maker still offers its splits');
  for (const p of NEGOTIATE_PLAN_PRESETS) shapes.add(`${p.percent}||7`);
  return shapes.size;
}

function census() {
  const specialized = new Set<string>();
  for (const t of SPECIALIZED_TOOLS) {
    specialized.add(t.key);
    for (const k of t.hubKeys) specialized.add(k);
  }
  return {
    cardTemplates: cardTemplateRows(),
    paymentSplits: paymentSplits(),
    specializedTools: SPECIALIZED_TOOLS.length,
    otherShippedHubTools: HUB_TOOL_LIBRARY.filter((t) => t.shipped && !specialized.has(t.key)).length,
    performanceGraphs: CARD_ORDER.length,
    badgeFamilies: SHOP_BADGE_FAMILIES.length,
    qrModes: SUPPLIER_QR_MODES.length,
    printDesigns: PRINT_DESIGNS.length,
    printPieces: PRINT_PIECES.length,
    availabilityStyles: AVAILABILITY_STYLES.filter((s) => !CARD_STYLES_COMING_SOON.has(s.value)).length,
  };
}

test('the code ships at least as many tools and templates as the claim says', () => {
  const parts = census();
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  assert.ok(parts.cardTemplates >= 300, `the card-template seed is still read (found ${parts.cardTemplates})`);
  assert.ok(
    total >= TOOLKIT_CLAIM_FLOOR,
    `"${TOOLKIT_CLAIM}" needs ${TOOLKIT_CLAIM_FLOOR}; the code ships ${total}: ${JSON.stringify(parts)}`,
  );
});

test('the claim is spelled from the floor, once', () => {
  assert.equal(TOOLKIT_CLAIM, `${TOOLKIT_CLAIM_FLOOR}+ tools and templates`);
});

test('/for-suppliers reads the one spelling and never calls the whole set free', () => {
  const page = stripComments(readFileSync(join(HERE, '_components', 'supplier-front-page.tsx'), 'utf8'));
  assert.match(page, /\{TOOLKIT_CLAIM\}/, 'the page shows TOOLKIT_CLAIM');
  assert.doesNotMatch(page, /\d{3}\+ tools/, 'no typed count beside the claim');
  assert.doesNotMatch(page, /\{TOOLKIT_CLAIM\}[^<]*\bfree\b/i, 'the claim line does not say free');
});
