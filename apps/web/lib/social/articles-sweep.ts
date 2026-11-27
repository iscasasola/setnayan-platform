import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { chapterExcerpt } from '@/lib/creator-chapters';
import { articleHref, journalArticleSlug, JOURNAL_SLUG_RENAMES } from '@/lib/journal-move';
import { onlyPublicArticles } from '@/lib/public-articles';
import { siteUrl } from '@/lib/social/urls';

/**
 * apps/web/lib/social/articles-sweep.ts — sweep b2 of `lib/social/flush.ts`: Articles → Facebook teasers.
 *
 * 📰 BACK ON 2026-11-24. The sweep was switched off on 2026-11-16 with the blog (DECISION_LOG "THE BLOG AND REAL
 * STORIES ARE RETIRED"), because every teaser linked a /blog page that no longer served. On 2026-11-17 the Journal
 * moved into Discover's Articles (DECISION_LOG "THE JOURNAL MOVES INTO DISCOVER'S ARTICLES — ONE SOURCE"), so each
 * post has a live home again at /articles/{slug} — the reason for switching it off no longer holds.
 *
 * What it reads: the article store (`creator_chapters`), through `onlyPublicArticles` — published, has an address,
 * not taken down, and its date has arrived — and only Setnayan's own Journal posts (`is_journal`, no shop byline).
 * A draft, a removed post, a future-dated post or a member's post is never teased on Setnayan's page.
 *
 * What it writes: one `social_posts` row per article, ever. Same shape as before the pause, so the partial-unique
 * index `social_posts_source_unique (source_type, source_ref)` still protects it: `source_type = 'announcement'`,
 * `source_ref = 'journal:{slug}'`. An article whose CURRENT slug or any OLD slug (`JOURNAL_SLUG_RENAMES`) already has
 * a row — whatever its status, pulled included — is never composed again, so the 19 teasers posted before the pause
 * are not reposted.
 *
 * Pace: ONE teaser waits in the queue at a time. A new one is composed only when no Journal teaser is scheduled or
 * publishing, and the governor (`lib/social/governor.ts`) gives it the next free slot. So the backlog drips out one
 * slot at a time and leaves room for everything else, never a flood. Newest article first, so the day's article is
 * not stuck behind the backlog.
 *
 * Switches: the existing `social_publish_settings.autopublish_enabled` AND `facebook_enabled` (the teaser is a
 * Facebook link card). Either off → nothing is composed, and no backlog builds up while the page is paused.
 *
 * 🔑 Any read that fails composes NOTHING: we cannot tell what was already posted, and a duplicate on a public page
 * is worse than a missed slot. The next flush tries again.
 */

type Admin = SupabaseClient | ReturnType<typeof createAdminClient>;

export type ArticleSweepSettings = { autopublish_enabled: boolean; facebook_enabled: boolean };

/** The deterministic ref a Journal teaser carries — unchanged since before the pause. */
export const JOURNAL_TEASER_PREFIX = 'journal:';
export function journalTeaserRef(slug: string): string {
  return `${JOURNAL_TEASER_PREFIX}${slug}`;
}

/** Every slug an article has gone by: its own, plus each old slug renamed to it. */
export function slugsOfArticle(slug: string): string[] {
  const old = Object.entries(JOURNAL_SLUG_RENAMES)
    .filter(([, renamed]) => renamed === slug)
    .map(([was]) => was);
  const current = journalArticleSlug(slug) ?? slug;
  return [...new Set([slug, current, ...old])];
}

export type ArticleTeaser = {
  source_type: 'announcement';
  source_ref: string;
  title: string;
  body: string;
  link_url: string;
};

/**
 * The teaser for one article: "Articles · {title}", the opening lines of the LIVE article row (`chapterExcerpt` of
 * its `creator_chapters.body`) as the body, and the article's /articles address as the link. `null` when there is
 * nothing to say.
 *
 * 🔑 ONE SOURCE (content finalization S16, 2026-11-27): the teaser reads only the article row the reader will open.
 * It used to prefer a hand-written hook from the code batch files (`HOOKS_*` in `lib/blog-batches`), but the live
 * articles are database rows, so a fix made to a live article never reached its teaser, and the reverse. Fix the
 * article and its teaser follows.
 */
export function composeArticleTeaser(article: { slug: string; title: string; body: string | null }): ArticleTeaser | null {
  const teaser = chapterExcerpt(article.body);
  if (!teaser || !article.title.trim()) return null;
  const slug = journalArticleSlug(article.slug) ?? article.slug;
  return {
    source_type: 'announcement',
    source_ref: journalTeaserRef(slug),
    title: `Articles · ${article.title.trim()}`,
    body: `${teaser}\n\n#Setnayan #SetNaYan`,
    link_url: `${siteUrl().replace(/\/$/, '')}${articleHref(slug)}`,
  };
}

/** How many public Journal articles one sweep looks through, newest first. */
const ARTICLE_SCAN_LIMIT = 500;

export async function sweepJournalArticles(
  admin: Admin,
  now: Date,
  settings: ArticleSweepSettings,
): Promise<void> {
  if (!settings.autopublish_enabled || !settings.facebook_enabled) return;

  // Every Journal teaser ever composed — the dedupe set AND the "one waiting at a time" check, in one read.
  const { data: existingData, error: existingErr } = await admin
    .from('social_posts')
    .select('source_ref, status')
    .eq('source_type', 'announcement')
    .like('source_ref', `${JOURNAL_TEASER_PREFIX}%`);
  if (existingErr) {
    logQueryError('runSocialFlush (journal teasers lookup)', existingErr);
    return;
  }
  const existing = (existingData ?? []) as Array<{ source_ref: string; status: string }>;
  if (existing.some((r) => r.status === 'scheduled' || r.status === 'publishing')) return; // one at a time
  const taken = new Set(existing.map((r) => r.source_ref));

  const { data: articleData, error: articleErr } = await onlyPublicArticles(
    admin.from('creator_chapters').select('slug, title, body'),
    now,
  )
    .eq('is_journal', true)
    .is('posted_as_vendor_id', null)
    .order('published_at', { ascending: false })
    .limit(ARTICLE_SCAN_LIMIT);
  if (articleErr) {
    logQueryError('runSocialFlush (journal articles read)', articleErr);
    return;
  }
  const articles = (articleData ?? []) as Array<{ slug: string; title: string; body: string | null }>;

  for (const article of articles) {
    if (slugsOfArticle(article.slug).some((s) => taken.has(journalTeaserRef(s)))) continue;
    const teaser = composeArticleTeaser(article);
    if (!teaser) continue;
    const { error } = await admin.from('social_posts').insert(teaser);
    // A concurrent flush composing the same teaser hits the unique index — expected, ignore quietly.
    if (error && error.code !== '23505') {
      logQueryError('runSocialFlush (compose journal teaser)', error, { slug: article.slug });
    }
    return; // ONE teaser per sweep — the governor gives it the next slot
  }
}
