/**
 * 📰 The Journal import, as SQL — one pure function, so the committed data migration and the corrected
 * source can never disagree (owner 2026-11-17: "Move them to articles. And check their content and match
 * them with our updated app"; controller relay on PR #7919: "Import the 91 Journal posts").
 *
 *   npx tsx scripts/gen-journal-import.ts --write   # rewrites the migration from the source
 *
 * `lib/journal-move.test.ts` regenerates this and compares it with the committed file byte for byte, so an
 * edit to a post that is not carried into the migration fails CI instead of shipping a stale copy.
 *
 * WHAT EACH ROW IS — creator_chapters, through the privileged import (so the article-fields guard keeps
 * `slug` and `is_journal` as written):
 *   • owner      — the platform's own internal account (`users.is_internal`, the earliest one). If none exists
 *                  (a fresh replay) the migration inserts NOTHING and says so: no row is ever owned by a guess.
 *   • slug       — the post's slug AFTER the 2026-11-17 renames, so /blog/{slug} → /articles/{slug} lands.
 *   • status     — published, or draft for a post the source still holds STAGED (publishedAt 2099-01-01:
 *                  the owner's "not yet" — moving it must not publish it).
 *   • body       — text and links only (`journalBodyFromBlocks`); no cover photo (Q7 ruled).
 *   • tags       — `journalTags` (≤ 3), so onboarding's "Not sure yet" links by tag.
 * Re-runnable: ON CONFLICT on the slug does nothing, so a second apply changes nothing.
 */
import { journalBodyFromBlocks, journalTags, JOURNAL_SLUG_RENAMES, type JournalBlock } from '@/lib/journal-move';

export type JournalSource = {
  slug: string;
  title: string;
  category: 'planning' | 'vendors' | 'culture' | 'news';
  publishedAt: string;
  updatedAt?: string;
  blocks: readonly JournalBlock[];
};

/** The source's own "staged, not published" sentinel (lib/blog-batches/launch-seed.ts). */
export const JOURNAL_STAGED_DATE = '2099-01-01';

/** The day the Journal moved in (owner ruling 2026-11-17) — the stamp on a staged post that has no date. */
export const JOURNAL_MOVE_DATE = '2026-11-17';

/** Dollar-quote a value with a tag the value cannot contain. */
function dollar(value: string, n: number): string {
  let tag = `j${n}`;
  while (value.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${value}$${tag}$`;
}

function sqlArray(items: readonly string[]): string {
  if (items.length === 0) return `'{}'::text[]`;
  return `ARRAY[${items.map((t) => `'${t.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
}

export function journalImportSql(articles: readonly JournalSource[]): string {
  const rows = [...articles]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((a, i) => {
      const staged = a.publishedAt >= JOURNAL_STAGED_DATE;
      const day = staged ? null : a.publishedAt;
      // A staged post has no real date yet; it is stamped with the day it moved in.
      const touched = a.updatedAt ?? (staged ? JOURNAL_MOVE_DATE : a.publishedAt);
      return (
        `    (${dollar(a.slug, i * 3)}, ${dollar(a.title, i * 3 + 1)},\n` +
        `     ${dollar(journalBodyFromBlocks(a.blocks), i * 3 + 2)},\n` +
        `     '${staged ? 'draft' : 'published'}', ${day ? `'${day} 08:00:00+08'::timestamptz` : 'NULL'}, ` +
        `${sqlArray(journalTags(a))}, '${touched} 08:00:00+08'::timestamptz)`
      );
    });

  const renames = Object.entries(JOURNAL_SLUG_RENAMES)
    .map(([from, to]) => `  UPDATE public.journal_vendor_spotlights SET blog_slug = '${to}' WHERE blog_slug = '${from}';`)
    .join('\n');

  return `-- ============================================================================
-- 📰 THE JOURNAL MOVES INTO ARTICLES — ${articles.length} posts, as "Setnayan Journal" (Build 2 of 3)
-- ============================================================================
-- ⛔ GENERATED — do not hand-edit. Source: apps/web/lib/blog.ts + lib/blog-batches/* (corrected 2026-11-17 per
-- the specs' JOURNAL_CONTENT_AUDIT_2026-11-17.md). Regenerate: (cd apps/web && npx tsx
-- scripts/gen-journal-import.ts --write). lib/journal-move.test.ts fails when this file and the source differ.
--
-- Owner 2026-11-17 (DECISION_LOG "THE JOURNAL MOVES INTO DISCOVER'S ARTICLES — ONE SOURCE"); controller relay
-- on PR #7919: "Import the 91 Journal posts" + "remove the unsourced figures and say 'ask 3 suppliers'".
-- Text and links only; no cover photos (Q7). Staged posts (publishedAt ${JOURNAL_STAGED_DATE}) arrive as DRAFTS.
-- Owned by the platform's internal account; if there is none, NOTHING is inserted.
-- Re-runnable: ON CONFLICT (slug) DO NOTHING.
-- ============================================================================

DO $journal$
DECLARE
  v_owner UUID;
BEGIN
  SELECT u.user_id INTO v_owner
    FROM public.users u
   WHERE u.is_internal = TRUE
   ORDER BY u.created_at
   LIMIT 1;

  IF v_owner IS NULL THEN
    RAISE NOTICE 'journal import: no internal account — nothing inserted';
    RETURN;
  END IF;

  INSERT INTO public.creator_chapters
    (user_id, kind, is_journal, slug, title, body, status, published_at, tags, created_at, updated_at)
  SELECT v_owner, 'wedding', TRUE, r.slug, r.title, r.body, r.status, r.published_at, r.tags,
         coalesce(r.published_at, r.touched), r.touched
    FROM (VALUES
${rows.join(',\n')}
    ) AS r(slug, title, body, status, published_at, tags, touched)
  ON CONFLICT (slug) WHERE slug IS NOT NULL DO NOTHING;

  -- The Journal's supplier credits follow the posts they credit (journal_vendor_spotlights joins on blog_slug).
${renames}
END
$journal$;
`;
}
