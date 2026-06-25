#!/usr/bin/env node
/**
 * apply-papic-r2-lifecycle.mjs — apply (or inspect) the Cloudflare R2 lifecycle
 * rules that reap ABANDONED free-Papic-sampler bytes, the cron-free guaranteed
 * cleanup for the only per-couple marginal cost (R2 storage).
 *
 * WHY TWO PREFIXES: sampler originals + clip posters live under `papic-sampler/`,
 * but their display/thumb derivatives live under a PARALLEL `derivatives/` tree
 * (`derivatives/papic-sampler/…`, see lib/papic-derivatives.ts). A single-prefix
 * rule would miss the derivatives. (Discovered in PR #2145.)
 *
 * WHY THIS IS DATA-LOSS-SAFE NOW (it was NOT before PR #2160): on convert
 * (Drive connect / paid upgrade) `makeSamplerPermanent` RELOCATES a kept couple's
 * bytes OFF both ephemeral prefixes onto the permanent `papic/` prefix, and the
 * record-layer cap + per-row fail-safe + the 5-key retention sweep mean only
 * genuinely-ephemeral bytes ever remain under `papic-sampler/`. So an age-based
 * expiry on these two prefixes can only delete abandoned/expired sampler bytes —
 * never a converted couple's photos. Do NOT enable this rule on a build that
 * predates #2138/#2145/#2150/#2160.
 *
 * SAFETY: this MERGES the two rules into the bucket's existing lifecycle config
 * (matched by rule ID, replacing only those two) — it never clobbers other rules.
 *
 * USAGE (run from apps/web with the R2 creds in the env — the SAME ones the app
 * uses in Vercel: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY):
 *
 *   node scripts/apply-papic-r2-lifecycle.mjs            # VERIFY — print current config (read-only, default)
 *   node scripts/apply-papic-r2-lifecycle.mjs --dry-run  # print the merged config that WOULD be applied
 *   node scripts/apply-papic-r2-lifecycle.mjs --apply     # MERGE + PUT the two rules, then re-print to confirm
 *
 * Idempotent: re-running --apply is a no-op-equivalent (replaces the two rules
 * by ID with identical content). Alternative (no CLI): Cloudflare dashboard →
 * R2 → setnayan-media → Settings → Object lifecycle rules → add two
 * "Delete objects" rules, prefixes `papic-sampler/` and `derivatives/papic-sampler/`,
 * age 37 days.
 */

import {
  S3Client,
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3';

const BUCKET = 'setnayan-media';
const EXPIRE_DAYS = 37; // 30-day sampler retention + 7-day grace

/** The two rules this script owns (keyed by ID for idempotent merge). */
const MANAGED_RULES = [
  {
    ID: 'expire-papic-sampler',
    Status: 'Enabled',
    Filter: { Prefix: 'papic-sampler/' },
    Expiration: { Days: EXPIRE_DAYS },
  },
  {
    ID: 'expire-papic-sampler-derivatives',
    Status: 'Enabled',
    Filter: { Prefix: 'derivatives/papic-sampler/' },
    Expiration: { Days: EXPIRE_DAYS },
  },
];
const MANAGED_IDS = new Set(MANAGED_RULES.map((r) => r.ID));

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
if (!accountId || !accessKeyId || !secretAccessKey) {
  die(
    'Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY\n' +
      '  (the same values configured in Vercel) and re-run from apps/web.',
  );
}

const mode = process.argv.includes('--apply')
  ? 'apply'
  : process.argv.includes('--dry-run')
    ? 'dry-run'
    : 'verify';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
  // R2 compatibility — mirror lib/r2.ts (R2 rejects the SDK's default checksum headers).
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

async function getExistingRules() {
  try {
    const out = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: BUCKET }));
    return out.Rules ?? [];
  } catch (err) {
    // No lifecycle config yet → empty (R2/S3 throws NoSuchLifecycleConfiguration).
    if (err?.name === 'NoSuchLifecycleConfiguration' || err?.Code === 'NoSuchLifecycleConfiguration') {
      return [];
    }
    throw err;
  }
}

function printRules(label, rules) {
  console.log(`\n${label} (${rules.length} rule${rules.length === 1 ? '' : 's'}):`);
  for (const r of rules) {
    const prefix = r.Filter?.Prefix ?? r.Prefix ?? '(all)';
    const exp = r.Expiration?.Days != null ? `expire after ${r.Expiration.Days}d` : JSON.stringify(r.Expiration ?? {});
    const mine = MANAGED_IDS.has(r.ID) ? '  ← managed by this script' : '';
    console.log(`  • [${r.Status}] ${r.ID}: prefix "${prefix}" — ${exp}${mine}`);
  }
}

async function main() {
  console.log(`Bucket: ${BUCKET}  ·  mode: ${mode}`);
  const existing = await getExistingRules();
  printRules('Current lifecycle config', existing);

  if (mode === 'verify') {
    const present = MANAGED_RULES.every((m) => existing.some((e) => e.ID === m.ID));
    console.log(
      present
        ? '\n✓ Both managed Papic-sampler rules are already present.'
        : '\n△ The Papic-sampler rules are NOT yet applied. Run with --apply to add them.',
    );
    return;
  }

  // Merge: keep every existing rule EXCEPT the two we own, then append ours.
  const merged = [...existing.filter((r) => !MANAGED_IDS.has(r.ID)), ...MANAGED_RULES];
  printRules('Merged config to apply', merged);

  if (mode === 'dry-run') {
    console.log('\n(dry-run) Nothing written. Re-run with --apply to write this config.');
    return;
  }

  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: BUCKET,
      LifecycleConfiguration: { Rules: merged },
    }),
  );
  console.log('\n✓ Applied. Re-reading to confirm…');
  printRules('Confirmed lifecycle config', await getExistingRules());
}

main().catch((err) => die(err?.message ?? String(err)));
