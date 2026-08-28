#!/usr/bin/env tsx
/**
 * scripts/seed-trade-aliases.ts
 *
 * C2 (2026-08-28) — "one trade, many names". Asks Claude, ONCE per trade,
 * for the Filipino / English / Taglish words a supplier might actually type
 * for it — "sorbetero" for Sorbetes Cart, "sound hire" for Lights & Sound —
 * and writes them into `canonical_service_aliases` UNREVIEWED
 * (`written_by='ai', reviewed_at=NULL`). An admin then reviews them at
 * /admin/taxonomy/aliases before any of them can answer a supplier — see
 * lib/service-trade-aliases.ts's `reviewedAliasesByLiveTrade`, which drops
 * anything not reviewed.
 *
 * 🔒 THIS RUNS OFFLINE, TRIGGERED BY AN ADMIN — NOT IN A SUPPLIER'S REQUEST
 * PATH. It reads the taxonomy (public, not sensitive) and writes synonyms.
 * No supplier text is ever sent anywhere by this script. That is why this
 * slice needs no new data processor and no privacy-notice change — read
 * WHATS_NEXT_The_Category_Suggester_2026-08-28.md § R before adding one.
 *
 * ⚖ WHY NOT EMBEDDINGS — the same section. Zero labelled supplier cards to
 * train a classifier on, the chosen embedding model is English-only for a
 * Filipino-trade-word feature, and the PGlite replay cannot even test a
 * vector column. An alias list, reviewed by a person, does the job here.
 *
 * USAGE
 * -----
 *   ANTHROPIC_API_KEY=…  \
 *   SUPABASE_URL=…  SUPABASE_SERVICE_ROLE_KEY=…  \
 *     pnpm -F @setnayan/web exec tsx scripts/seed-trade-aliases.ts
 *
 *   # Preview what would be written, call the model, write nothing:
 *     … tsx scripts/seed-trade-aliases.ts --dry-run
 *
 *   # Only these trades (comma-separated canonical_service keys) — this is
 *   # how the 51-trade review batch in SERVICE_CARD_VOCABULARY_MEASURED_
 *   # 2026-08-28.md § 2 gets seeded first:
 *     … tsx scripts/seed-trade-aliases.ts --only=sorbetes_cart,generator_rental
 *
 *   # Re-seed a trade that already has aliases (default SKIPS any trade
 *   # that already has at least one alias row, so re-running costs nothing
 *   # for trades already covered):
 *     … tsx scripts/seed-trade-aliases.ts --force
 *
 * SAFETY
 * ------
 * Additive only — this script never deletes or reassigns an existing alias.
 * A phrase collision (two trades both wanting "sound hire") is left to
 * whichever row already holds it; the new one is skipped and logged, never
 * silently overwritten (`ON CONFLICT (phrase) DO NOTHING`).
 */
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
// Reused, never re-derived — same normalisation on the way in (here) and the
// way out (lib/service-trade-aliases.ts's matching), or a lookup never hits.
import { normalisePhrase } from '../lib/admin-map/ask-the-admin';
// The testable half lives under lib/ on purpose — test:unit globs lib/** and
// app/** ONLY, so a test file under scripts/ would never run in CI. See
// lib/seed-trade-aliases-core.ts's own docblock.
import { fetchLiveTrades, parseProposals, type LiveTrade, type Proposal } from '../lib/seed-trade-aliases-core';

export type { LiveTrade, Proposal };
export { fetchLiveTrades, parseProposals };

// ── The model call — batched, one JSON array per batch, nothing else asked
// of it. It never picks a category for anybody; it only proposes words. ──
const BATCH_SIZE = 15;

async function askForAliases(client: Anthropic, batch: readonly LiveTrade[]): Promise<Proposal[]> {
  const menu = batch
    .map((t) => `- key: "${t.key}" | trade: "${t.label}" | under: ${t.folderLabel} › ${t.branchLabel}`)
    .join('\n');
  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    system:
      'You write synonym lists for a Philippine wedding/events marketplace taxonomy. ' +
      'For each trade, list 2-6 words or short phrases a Filipino wedding SUPPLIER would ' +
      'actually type to describe that trade — Filipino, English, and Taglish spellings all ' +
      'welcome (e.g. "sorbetero", "ice cream cart", "sorbetes vendor" for a trade called ' +
      '"Sorbetes Cart"). Do not repeat the trade name itself if it is already an exact match. ' +
      'Do not invent a trade that is not in the list. Reply with ONLY a JSON array, no prose, ' +
      'shaped exactly as: [{"key":"<the key given>","aliases":["word one","word two"]}, ...] ' +
      'one entry per trade given, in the same order.',
    messages: [{ role: 'user', content: `Trades:\n${menu}` }],
  });
  const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
  return parseProposals(text, batch);
}

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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('✗ ANTHROPIC_API_KEY is not set. This script needs it to ask for synonyms.');
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const client = new Anthropic();

  const trades = await fetchLiveTrades(admin);
  console.log(`✓ ${trades.length} live trades read from the taxonomy.`);

  const { data: existingRows } = await admin.from('canonical_service_aliases').select('canonical_service');
  const alreadyHasAlias = new Set((existingRows ?? []).map((r) => (r as { canonical_service: string }).canonical_service));

  let targets = trades;
  if (only) targets = targets.filter((t) => only.has(t.key));
  if (!force) targets = targets.filter((t) => !alreadyHasAlias.has(t.key));

  if (!targets.length) {
    console.log('Nothing to seed — every targeted trade already has at least one alias row (pass --force to re-seed).');
    return;
  }
  console.log(`→ Seeding ${targets.length} trade(s)${dryRun ? ' (dry run — nothing will be written)' : ''}.`);

  let written = 0;
  let skippedCollision = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    let proposals: Proposal[];
    try {
      proposals = await askForAliases(client, batch);
    } catch (err) {
      console.error(`✗ Batch ${i / BATCH_SIZE + 1} failed: ${(err as Error).message}`);
      continue;
    }
    for (const p of proposals) {
      const trade = batch.find((t) => t.key === p.key);
      console.log(`  ${p.key} (${trade?.label ?? '?'}) → ${p.aliases.join(' · ')}`);
      if (dryRun) continue;
      const rows = p.aliases.map((phrase) => ({
        phrase: normalisePhrase(phrase),
        canonical_service: p.key,
        written_by: 'ai' as const,
      }));
      const { data, error } = await admin
        .from('canonical_service_aliases')
        .upsert(rows, { onConflict: 'phrase', ignoreDuplicates: true })
        .select('phrase');
      if (error) {
        console.error(`  ✗ write failed for ${p.key}: ${error.message}`);
        continue;
      }
      const got = (data ?? []).length;
      written += got;
      skippedCollision += rows.length - got;
    }
  }

  console.log(
    dryRun
      ? `✓ Dry run complete — nothing written.`
      : `✓ Wrote ${written} alias row(s), UNREVIEWED. ${skippedCollision} skipped as phrase collisions. ` +
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
