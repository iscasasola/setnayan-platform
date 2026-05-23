/**
 * reupload-attire-figures.ts
 *
 * One-off · re-upload all 75 attire SVGs from /tmp/recraft-output to R2
 * after the strip-bg-v2.py post-process. Overwrites existing R2 keys
 * with the cleaned (transparent-bg) versions.
 *
 * Run:
 *   cd apps/web && set -a; source .env.local; set +a; npx tsx scripts/reupload-attire-figures.ts
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

const ROOT = '/tmp/recraft-output';
const styles = [
  'elegant-simple-classic',
  'bridgerton-regal',
  'editorial-cream',
  'tropical-heritage',
  'modern-minimalist',
];

async function main() {
  let count = 0;
  for (const style of styles) {
    const dir = path.join(ROOT, style);
    if (!fs.existsSync(dir)) continue;
    const files = fs
      .readdirSync(dir)
      .filter(
        (f) =>
          f.endsWith('.svg') &&
          !f.includes('.v2.') &&
          !f.includes('.v3.') &&
          !f.includes('.v4.') &&
          !f.includes('.OLD.') &&
          !f.includes('.withbg.') &&
          !f.includes('.preview.'),
      );
    for (const file of files) {
      const localPath = path.join(dir, file);
      const body = fs.readFileSync(localPath);
      const key = `moodboard-library/figure_attire/${style}/${file}`;
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
      if (count % 10 === 0) console.log(`Uploaded ${count} files...`);
    }
  }
  console.log(`DONE · re-uploaded ${count} cleaned SVGs to R2`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
