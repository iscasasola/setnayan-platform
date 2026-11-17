import 'server-only';

/**
 * articles-index.server.ts — the ONE read behind every place a public article is listed: Discover's Articles part,
 * `sitemap-articles.xml` and `llms.txt` (Build 3 of the Find · Build · Book drawing, owner-approved 17 Nov). The pure
 * rules — the address, the hidden test, the XML, the llms lines, the structured data — are `articles-index.ts`.
 *
 * PUBLIC means exactly what the article page itself requires (`app/u/[userSlug]/c/[chapterId]/page.tsx` → resolve):
 * the chapter is `published`, carries something to read (`chapterHasReadableContent`), and its author's profile is
 * public, not deleted and slugged (the same three conditions `fetchPublishedChapterForShare` applies). A `draft` or
 * a chapter shared with the day only (`event`) is never listed. On top of that, an article an admin has HIDDEN leaves
 * every list (ruled 17 Nov: "only a removed or reported-and-hidden post drops out").
 *
 * 🔑 A REFUSED READ IS NOT "NO ARTICLES". `readPublicArticles` says `ok: false`; Discover then says the part could
 * not load, and the sitemap / llms.txt list nothing rather than a half-list. The hidden read FAILS CLOSED: when the
 * report read is refused, nothing is listed at all — an unreadable takedown must never republish a hidden post.
 *
 * Service-role reads filtered in app code — the same public-read pattern as `lib/creator-public.ts`.
 *
 * 🔒 lib/articles-are-findable.test.ts
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { chapterHasReadableContent } from '@/lib/creator-chapters';
import {
  articleSummary,
  hiddenChapterIds,
  type ChapterReportRow,
  type IndexedArticle,
} from '@/lib/articles-index';

type ChapterRow = {
  public_id: string;
  user_id: string;
  title: string;
  body: string | null;
  embed_url: string | null;
  published_at: string | null;
  updated_at: string | null;
};

type OwnerRow = {
  user_id: string;
  slug: string | null;
  display_name: string | null;
  public_profile_enabled: boolean | null;
  deleted_at: string | null;
};

/** The public ids an admin has hidden — or null when the report read was refused (callers then list nothing). */
async function readHiddenChapterIds(admin: ReturnType<typeof createAdminClient>): Promise<Set<string> | null> {
  const { data, error } = await admin
    .from('user_reports')
    .select('target_id, status, action_taken')
    .eq('target_type', 'chapter')
    .eq('status', 'actioned');
  if (error) {
    console.error('[articles-index] hidden-report read failed', error);
    return null;
  }
  return hiddenChapterIds((data ?? []) as ChapterReportRow[]);
}

/**
 * Every public article, newest first, up to `limit`. One read of the chapters, one of their authors, one of the
 * hidden reports — parallel where they can be.
 */
export async function readPublicArticles(limit = 5000): Promise<{ ok: boolean; items: IndexedArticle[] }> {
  try {
    const admin = createAdminClient();
    const [chaptersRes, hidden] = await Promise.all([
      admin
        .from('creator_chapters')
        .select('public_id, user_id, title, body, embed_url, published_at, updated_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(limit),
      readHiddenChapterIds(admin),
    ]);
    if (chaptersRes.error || hidden === null) {
      if (chaptersRes.error) console.error('[articles-index] chapters read failed', chaptersRes.error);
      return { ok: false, items: [] };
    }
    const chapters = ((chaptersRes.data ?? []) as ChapterRow[]).filter(
      (c) => chapterHasReadableContent(c) && !hidden.has(c.public_id),
    );
    if (chapters.length === 0) return { ok: true, items: [] };

    const { data: owners, error: ownersError } = await admin
      .from('users')
      .select('user_id, slug, display_name, public_profile_enabled, deleted_at')
      .in('user_id', [...new Set(chapters.map((c) => c.user_id))]);
    if (ownersError) {
      console.error('[articles-index] authors read failed', ownersError);
      return { ok: false, items: [] };
    }
    const ownerById = new Map(((owners ?? []) as OwnerRow[]).map((o) => [o.user_id, o]));

    const items: IndexedArticle[] = [];
    for (const c of chapters) {
      const o = ownerById.get(c.user_id);
      if (!o || o.public_profile_enabled !== true || o.deleted_at || !o.slug) continue;
      items.push({
        publicId: c.public_id,
        title: c.title,
        authorSlug: o.slug,
        authorName: o.display_name?.trim() || o.slug,
        // Build 2 (#7919) adds `is_journal`; until then every row is a member's post.
        isJournal: false,
        publishedAt: c.published_at,
        updatedAt: c.updated_at,
        summary: articleSummary(c.body),
      });
    }
    return { ok: true, items };
  } catch (error) {
    console.error('[articles-index] read threw', error);
    return { ok: false, items: [] };
  }
}

/**
 * Has an admin hidden this article? For the article page's robots line. A refused read answers `true` — the page then
 * stays out of the index for one revalidate window, which is the safe direction for a takedown.
 */
export async function articleIsHidden(publicId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('user_reports')
      .select('target_id, status, action_taken')
      .eq('target_type', 'chapter')
      .eq('target_id', publicId)
      .eq('status', 'actioned');
    if (error) {
      console.error('[articles-index] hidden check failed', publicId, error);
      return true;
    }
    return hiddenChapterIds((data ?? []) as ChapterReportRow[]).has(publicId);
  } catch (error) {
    console.error('[articles-index] hidden check threw', publicId, error);
    return true;
  }
}
