/**
 * Write the Journal import migration from the corrected source (lib/journal-import-sql.ts).
 *
 *     npx tsx scripts/gen-journal-import.ts          # print it
 *     npx tsx scripts/gen-journal-import.ts --write  # rewrite the committed migration
 *
 * ⚠ The migration is applied ONCE by the pipeline. After it has reached production, a change to a post is a
 * NEW migration (an UPDATE), never a rewrite of this file — `lib/journal-move.test.ts` says so when it fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ALL_BLOG_ARTICLES } from '../lib/blog';
import { journalImportSql } from '../lib/journal-import-sql';

export const JOURNAL_IMPORT_MIGRATION = path.resolve(
  __dirname,
  '../../../supabase/migrations/20271350850404_the_journal_moves_into_articles.sql',
);

const sql = journalImportSql(ALL_BLOG_ARTICLES);
if (process.argv.includes('--write')) {
  fs.writeFileSync(JOURNAL_IMPORT_MIGRATION, sql);
  console.log(`wrote ${JOURNAL_IMPORT_MIGRATION} (${ALL_BLOG_ARTICLES.length} posts)`);
} else {
  process.stdout.write(sql);
}
