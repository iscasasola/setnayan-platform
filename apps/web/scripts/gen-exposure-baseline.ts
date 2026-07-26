/**
 * Regenerate supabase/security/exposure-surface.baseline.txt.
 *
 *   pnpm --filter @setnayan/web exposure:baseline
 *
 * Replays every migration into an in-process PGlite — the same harness the DB
 * test suite uses — and writes the resulting exposure surface to disk. No
 * network, no docker, no credentials, and it never touches prod.
 *
 * Run this ONLY when you have deliberately changed what anon/authenticated can
 * reach, and commit the result in the SAME pull request as the migration that
 * caused it. That is the whole point: the diff is the review.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReplayedDb } from '../tests/db/replay-migrations';
import { collectSurface, renderBaseline, BASELINE_PATH_FROM_REPO_ROOT } from '../tests/db/exposure-surface';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(REPO_ROOT, BASELINE_PATH_FROM_REPO_ROOT);

async function main(): Promise<void> {
  process.stdout.write('replaying migrations into PGlite… ');
  const { db, applied, total, skipped } = await createReplayedDb();
  process.stdout.write(`${applied}/${total} applied, ${skipped.length} skipped\n`);

  const facts = await collectSurface(db);
  const text = renderBaseline(facts);

  const previous = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text, 'utf8');

  const rel = path.relative(REPO_ROOT, OUT);
  if (previous === text) {
    console.log(`\n${rel} unchanged (${facts.length} facts).`);
  } else {
    console.log(`\nwrote ${rel} — ${facts.length} facts.`);
    console.log('Review the diff before committing: every ADDED line is something');
    console.log('anon or authenticated can now reach that it could not before.');
  }
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
