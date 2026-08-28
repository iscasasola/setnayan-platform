#!/usr/bin/env tsx
/**
 * scripts/seed-trade-aliases.ts
 *
 * C2 (2026-08-28) — "one trade, many names". MINES the Filipino / English /
 * Taglish words a supplier might actually type for a trade — "360 booth",
 * "gif booth", "polaroid instax" for Photo Booth — straight out of our OWN
 * `canonical_service_schemas.category_specific_attributes` (the enum /
 * multi_select option values every category's attribute form already
 * carries), and writes them into `canonical_service_aliases` UNREVIEWED
 * (`source='mined', reviewed_at=NULL`). An admin then reviews them at
 * /admin/taxonomy/aliases before any of them can answer a supplier — see
 * lib/service-trade-aliases.ts's `reviewedAliasesByLiveTrade`, which drops
 * anything not reviewed.
 *
 * 🛑 CORRECTED 2026-08-28 — NO MODEL CALL, NOT ONE. This script used to ask
 * Claude for synonyms. Owner: "when we do not have data yet, do not
 * recommend. collect first." then "initially, we already have a target
 * service for each category. that is our initial data." The mining logic
 * itself is pure and lives in lib/trade-alias-miner.ts — read its docblock
 * for exactly which words survive and why (two filters: a generic-
 * descriptor stoplist, and a measured cross-category-sharing ceiling).
 * This file is now nothing but I/O around that pure function.
 *
 * 🔒 THIS RUNS OFFLINE, TRIGGERED BY AN ADMIN — NOT IN A SUPPLIER'S REQUEST
 * PATH, AND NOW WITH NO EXTERNAL CALL AT ALL. It reads our own database and
 * writes back into it. Nothing leaves the process. No new data processor,
 * no privacy-notice question, no key to configure.
 *
 * ⚖ WHY NOT EMBEDDINGS — WHATS_NEXT_The_Category_Suggester_2026-08-28.md
 * § R. Zero labelled supplier cards to train a classifier on, the chosen
 * embedding model is English-only for a Filipino-trade-word feature, and
 * the PGlite replay cannot even test a vector column.
 *
 * USAGE
 * -----
 *   SUPABASE_URL=…  SUPABASE_SERVICE_ROLE_KEY=…  \
 *     pnpm -F @setnayan/web exec tsx scripts/seed-trade-aliases.ts
 *
 *   # Preview what would be mined and written, write nothing:
 *     … tsx scripts/seed-trade-aliases.ts --dry-run
 *
 *   # Only these trades (comma-separated canonical_service keys):
 *     … tsx scripts/seed-trade-aliases.ts --only=photo_booth,lights_sound
 *
 *   # Re-mine a trade that already has aliases (default SKIPS any trade
 *   # that already has at least one alias row, so re-running costs nothing
 *   # for trades already covered):
 *     … tsx scripts/seed-trade-aliases.ts --force
 *
 * SAFETY
 * ------
 * Additive only — this script never deletes or reassigns an existing alias.
 * A phrase collision (two trades both wanting the same word) is left to
 * whichever row already holds it; the new one is skipped and logged, never
 * silently overwritten (`ON CONFLICT (phrase) DO NOTHING`).
 */
import { createClient } from '@supabase/supabase-js';
// Reused, never re-derived — same normalisation on the way in (here) and the
// way out (lib/service-trade-aliases.ts's matching), or a lookup never hits.
import { normalisePhrase } from '../lib/admin-map/ask-the-admin';
// The testable half lives under lib/ on purpose — test:unit globs lib/** and
// app/** ONLY, so a test file under scripts/ would never run in CI. See
// lib/seed-trade-aliases-core.ts's own docblock.
import {
  fetchLiveTrades,
  fetchSchemaAttributeRows,
  type LiveTrade,
} from '../lib/seed-trade-aliases-core';
import { mineTradeAliases } from '../lib/trade-alias-miner';

export { fetchLiveTrades, fetchSchemaAttributeRows };

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean)) : null;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '✗ Missing env. Provide:\n' +
        '  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)\n' +
        '  SUPABASE_SERVICE_ROLE_KEY\n',
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [trades, schemaRows] = await Promise.all([
    fetchLiveTrades(admin),
    fetchSchemaAttributeRows(admin),
  ]);
  console.log(`✓ ${trades.length} live trades read from the taxonomy.`);
  const liveKeys = new Set(trades.map((t: LiveTrade) => t.key));

  const mined = mineTradeAliases(schemaRows);
  console.log(
    `✓ Mined from ${mined.kept.size} categories. Dropped ${mined.droppedGeneric} generic descriptor(s) ` +
      `and ${mined.droppedOverShared} over-shared word(s) — see lib/trade-alias-miner.ts for both rules.`,
  );

  const { data: existingRows } = await admin.from('canonical_service_aliases').select('canonical_service');
  const alreadyHasAlias = new Set((existingRows ?? []).map((r) => (r as { canonical_service: string }).canonical_service));

  let targetKeys = [...mined.kept.keys()].filter((k) => liveKeys.has(k));
  if (only) targetKeys = targetKeys.filter((k) => only.has(k));
  if (!force) targetKeys = targetKeys.filter((k) => !alreadyHasAlias.has(k));

  if (!targetKeys.length) {
    console.log('Nothing to write — every mined, targeted trade already has at least one alias row (pass --force to re-mine).');
    return;
  }
  console.log(`→ Writing ${targetKeys.length} trade(s)${dryRun ? ' (dry run — nothing will be written)' : ''}.`);

  let written = 0;
  let skippedCollision = 0;
  for (const key of targetKeys) {
    const words = mined.kept.get(key) ?? [];
    const trade = trades.find((t: LiveTrade) => t.key === key);
    console.log(`  ${key} (${trade?.label ?? '?'}) → ${words.join(' · ')}`);
    if (dryRun) continue;
    const rows = words.map((phrase) => ({
      phrase: normalisePhrase(phrase),
      canonical_service: key,
      source: 'mined' as const,
    }));
    const { data, error } = await admin
      .from('canonical_service_aliases')
      .upsert(rows, { onConflict: 'phrase', ignoreDuplicates: true })
      .select('phrase');
    if (error) {
      console.error(`  ✗ write failed for ${key}: ${error.message}`);
      continue;
    }
    const got = (data ?? []).length;
    written += got;
    skippedCollision += rows.length - got;
  }

  console.log(
    dryRun
      ? `✓ Dry run complete — nothing written.`
      : `✓ Wrote ${written} alias row(s), UNREVIEWED (source='mined'). ${skippedCollision} skipped as phrase collisions. ` +
          `Review at /admin/taxonomy/aliases before any of them can answer a supplier.`,
  );
}

// Only run when invoked directly (`tsx scripts/seed-trade-aliases.ts`), NOT
// when imported for its pure helpers by a test.
if (process.argv[1] && process.argv[1].endsWith('seed-trade-aliases.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
