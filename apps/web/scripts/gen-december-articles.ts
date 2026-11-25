/**
 * Write the December 2026 feature-articles migration from its source (lib/articles-december-2026.ts).
 *
 *     npx tsx scripts/gen-december-articles.ts          # print it
 *     npx tsx scripts/gen-december-articles.ts --write  # rewrite the committed migration
 *
 * ⚠ The migration is applied ONCE by the pipeline. After it has reached production, a change to a post is a
 * NEW migration (an UPDATE), never a rewrite of this file — `lib/articles-december-2026.test.ts` says so.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DECEMBER_2026_ARTICLES, DECEMBER_ARTICLES_MIGRATION, decemberArticlesSql } from '../lib/articles-december-2026';

const file = path.resolve(__dirname, '../../../supabase/migrations', DECEMBER_ARTICLES_MIGRATION);
const sql = decemberArticlesSql();
if (process.argv.includes('--write')) {
  fs.writeFileSync(file, sql);
  console.log(`wrote ${file} (${DECEMBER_2026_ARTICLES.length} posts)`);
} else {
  process.stdout.write(sql);
}
