/**
 * upload-decor-pilot-to-r2.ts
 *
 * ⛔ SUPERSEDED 2026-09-05 BY MB14b — THIS SCRIPT IS NOT THE WAY THESE TEN
 * ASSETS SHIPPED, AND RUNNING IT WOULD NOW UN-DO THAT.
 *
 * It waited for R2 credentials that never arrived: measured again on
 * 2026-09-05, the owner's local environment still has none, and the owner
 * ruled that `media.setnayan.com` — the host the keys below were written for —
 * is not being set up. So MB14b hosted the ten files APP-SERVED instead,
 * copied byte-for-byte into `apps/web/public/moodboard-seed/venue_scene/`,
 * following the precedent MB24 (`20271206127987`) and MB25
 * (`20271206413595`) set for exactly this problem. Migration
 * `20271207934361` repoints all ten rows at `/moodboard-seed/venue_scene/…`
 * and publishes them; an app-served path needs no bucket, no custom domain
 * and no CORS negotiation, and recolours identically.
 *
 * Kept, not deleted: it is the ready-made template for the NEXT asset class
 * that genuinely belongs in a bucket (anything large, or anything a couple
 * uploads). If you run it for these ten, also change `storage_path` back — a
 * row on R2 while the file is also in `public/` is two sources of truth for
 * one drawing.
 *
 * Uploads the 10 reception-decor pilot SVGs to the real `setnayan-media` R2
 * bucket at the keys the seed migration
 * (20271194970382_moodboard_reception_decor_layers_pilot.sql) already
 * references — mirrors reupload-attire-figures.ts exactly, just pointed at a
 * different local folder + key prefix.
 *
 * MB14 (2026-09-04) confirmed the 10 files still exist (generated in an
 * earlier session, never uploaded — no R2 credentials were readable from
 * that environment, or from MB14's either: `vercel env pull` writes an empty
 * string for every sensitive var, R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY
 * included, and there is no CI path that has them either). MB14 also
 * re-verified the 10 committed `sampled_hex` values against the real files
 * using the background-exclusion method documented in
 * reception-decor-pilot-prompts.ts (see scripts/verify-decor-pilot-colors.mjs)
 * — all 10 match exactly, so no tagging correction is needed, only the
 * upload + approval below, which still needs a human (or a session) with the
 * real secret values in hand.
 *
 * Default source layout: apps/web/scripts/decor-pilot-output/{zone}/{style-slug}.svg
 * — override with DECOR_PILOT_SRC_DIR if the 10 files live somewhere else
 * (they are not committed to git; see the migration header for why).
 *
 * Run:
 *   cd apps/web && set -a; source .env.local; set +a
 *   DECOR_PILOT_SRC_DIR=/path/to/the/10/svgs npx tsx scripts/upload-decor-pilot-to-r2.ts
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FAILED: ${key} is not set. Source the real .env.local before running this.`);
    process.exit(1);
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const ROOT = process.env.DECOR_PILOT_SRC_DIR
  ? path.resolve(process.env.DECOR_PILOT_SRC_DIR)
  : path.join(__dirname, 'decor-pilot-output');
const ZONES = ['backdrop', 'ceiling'] as const;
const EXPECTED_TOTAL = 10;

async function main() {
  let count = 0;
  for (const zone of ZONES) {
    const dir = path.join(ROOT, zone);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
      const body = fs.readFileSync(path.join(dir, file));
      const key = `moodboard-library/venue_scene/${zone}/${file}`;
      await client.send(
        new PutObjectCommand({
          Bucket: 'setnayan-media',
          Key: key,
          Body: body,
          ContentType: 'image/svg+xml',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      count += 1;
      console.log(`Uploaded ${key}`);
    }
  }
  if (count !== EXPECTED_TOTAL) {
    console.error(
      `FAILED: uploaded ${count}/${EXPECTED_TOTAL} — do NOT flip approved_at until all 10 are ` +
        `confirmed live (a partial upload would approve rows whose image 404s).`,
    );
    process.exit(1);
  }
  console.log(`DONE · uploaded ${count}/${EXPECTED_TOTAL} decor pilot SVGs to R2`);
  console.log(
    'Next: verify each URL loads, then run — ' +
      `UPDATE public.moodboard_library_assets SET approved_at = NOW() ` +
      `WHERE asset_type = 'venue_scene' AND asset_subtype IN ('backdrop','ceiling') AND approved_at IS NULL;`,
  );
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
