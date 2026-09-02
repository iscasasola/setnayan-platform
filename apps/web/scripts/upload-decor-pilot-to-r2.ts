/**
 * upload-decor-pilot-to-r2.ts
 *
 * Uploads the 10 reception-decor pilot SVGs (generated this session, saved at
 * apps/web/scripts/decor-pilot-output/{zone}/{style-slug}.svg) to the real
 * `setnayan-media` R2 bucket at the keys the seed migration
 * (20271194970382_moodboard_reception_decor_layers_pilot.sql) already
 * references — mirrors reupload-attire-figures.ts exactly, just pointed at a
 * different local folder + key prefix.
 *
 * This script could NOT be run from the generation session itself: that
 * environment had no R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.
 * A human with those credentials in .env.local runs this once, then flips
 * `approved_at = NOW()` on the 10 moodboard_library_assets rows this
 * migration inserted (they were seeded with approved_at = NULL on purpose —
 * see the migration header for why).
 *
 * Run:
 *   cd apps/web && set -a; source .env.local; set +a; npx tsx scripts/upload-decor-pilot-to-r2.ts
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'node:fs';
import * as path from 'node:path';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const ROOT = path.join(__dirname, 'decor-pilot-output');
const ZONES = ['backdrop', 'ceiling'] as const;

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
  console.log(`DONE · uploaded ${count}/10 decor pilot SVGs to R2`);
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
