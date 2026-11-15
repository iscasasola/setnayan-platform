import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { articleLabel, type ArticleAuthorKind } from '@/lib/articles.server';

/**
 * articles-moderation.server — what Admin › User reports does with a report
 * about an Articles topic or reply (prototype screen 6, owner ruling 1 of 16 Nov:
 * "posts go live at once; the team acts on reports").
 *
 *   Keep                     → the existing 'dismiss' lane
 *   Remove                   → the existing 'hide' lane: the post's removed_at is
 *                              stamped; readers see "Removed by Setnayan — it broke
 *                              the house rules." where it was
 *   Remove and pause posting → the existing 'block' lane: removed AND the poster
 *                              gets an article_posting_pauses row. ARTICLES ONLY —
 *                              the account can still read, plan and book; nothing
 *                              else in the product reads that table.
 *
 * Held by `lib/articles-moderation-reaches-the-post.test.ts`.
 */

export const ARTICLE_TARGETS = ['article_topic', 'article_reply'] as const;
export type ArticleTarget = (typeof ARTICLE_TARGETS)[number];

export function isArticleTarget(t: string): t is ArticleTarget {
  return (ARTICLE_TARGETS as readonly string[]).includes(t);
}

async function authorOf(
  admin: SupabaseClient,
  target: ArticleTarget,
  targetId: string,
): Promise<{ authorUserId: string; removed: boolean } | null> {
  const isTopic = target === 'article_topic';
  const { data } = await admin
    .from(isTopic ? 'article_topics' : 'article_replies')
    .select('author_user_id, removed_at')
    .eq(isTopic ? 'public_id' : 'reply_id', targetId)
    .maybeSingle();
  if (!data) return null;
  return { authorUserId: data.author_user_id as string, removed: Boolean(data.removed_at) };
}

/**
 * Remove the reported post (and, with `pause`, stop its author posting in
 * Articles). Returns what actually happened, so the resolution note never says
 * "removed" about a post that was not found.
 */
export async function removeReportedArticlePost(
  admin: SupabaseClient,
  target: ArticleTarget,
  targetId: string,
  moderatorUserId: string,
  opts: { pause: boolean; reportId: string },
): Promise<{ removed: boolean; paused: boolean }> {
  const author = await authorOf(admin, target, targetId);
  if (!author) return { removed: false, paused: false };
  const isTopic = target === 'article_topic';
  const { error } = await admin
    .from(isTopic ? 'article_topics' : 'article_replies')
    .update({ removed_at: new Date().toISOString(), removed_by: moderatorUserId })
    .eq(isTopic ? 'public_id' : 'reply_id', targetId)
    .is('removed_at', null);
  const removed = !error;
  let paused = false;
  if (opts.pause) {
    const { error: pauseErr } = await admin.from('article_posting_pauses').upsert(
      { user_id: author.authorUserId, paused_by: moderatorUserId, report_id: opts.reportId },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
    paused = !pauseErr;
  }
  // Every other open report about the same post is answered by this one.
  if (removed) {
    await admin
      .from('user_reports')
      .update({
        status: 'actioned',
        action_taken: 'Removed from Articles by Setnayan moderator (another report about the same post).',
        reviewed_by: moderatorUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('target_type', target)
      .eq('target_id', targetId)
      .eq('status', 'open')
      .neq('report_id', opts.reportId);
  }
  return { removed, paused };
}

export type ArticleReportContext = {
  topicTitle: string | null;
  topicHref: string | null;
  excerpt: string;
  /** "Guest · K2" — what readers see. */
  label: string | null;
  /** The REAL account — only ever shown here, to the team. */
  posterName: string | null;
  posterEmail: string | null;
  joinedAt: string | null;
  removedBefore: number;
  paused: boolean;
  removed: boolean;
};

/** Context for every Articles row on the visible page of the queue. */
export async function articleReportContext(
  admin: SupabaseClient,
  rows: ReadonlyArray<{ target_type: string; target_id: string }>,
): Promise<Map<string, ArticleReportContext>> {
  const out = new Map<string, ArticleReportContext>();
  const topicIds = rows.filter((r) => r.target_type === 'article_topic').map((r) => r.target_id);
  const replyIds = rows.filter((r) => r.target_type === 'article_reply').map((r) => r.target_id);
  if (!topicIds.length && !replyIds.length) return out;

  const [topicsRes, repliesRes] = await Promise.all([
    topicIds.length
      ? admin.from('article_topics').select('topic_id, public_id, title, body, author_user_id, removed_at').in('public_id', topicIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    replyIds.length
      ? admin.from('article_replies').select('reply_id, topic_id, body, author_user_id, removed_at').in('reply_id', replyIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const topics = (topicsRes.data ?? []) as Record<string, unknown>[];
  const replies = (repliesRes.data ?? []) as Record<string, unknown>[];
  const parentIds = Array.from(new Set(replies.map((r) => r.topic_id as string)));
  const parentsRes = parentIds.length
    ? await admin.from('article_topics').select('topic_id, public_id, title').in('topic_id', parentIds)
    : { data: [] as Record<string, unknown>[] };
  const parentOf = new Map(((parentsRes.data ?? []) as Record<string, unknown>[]).map((t) => [t.topic_id as string, t]));
  for (const t of topics) parentOf.set(t.topic_id as string, t);

  const authors = Array.from(
    new Set([...topics, ...replies].map((r) => r.author_user_id as string)),
  );
  const pairs = [...topics, ...replies].map((r) => ({ topic: r.topic_id as string, user: r.author_user_id as string }));
  const [usersRes, codesRes, pausesRes, removedTopicsRes, removedRepliesRes] = await Promise.all([
    admin.from('users').select('user_id, display_name, email, created_at').in('user_id', authors),
    admin
      .from('article_topic_codes')
      .select('topic_id, user_id, code, author_kind')
      .in('topic_id', Array.from(new Set(pairs.map((p) => p.topic)))),
    admin.from('article_posting_pauses').select('user_id').in('user_id', authors),
    admin.from('article_topics').select('author_user_id').in('author_user_id', authors).not('removed_at', 'is', null),
    admin.from('article_replies').select('author_user_id').in('author_user_id', authors).not('removed_at', 'is', null),
  ]);
  const userOf = new Map(((usersRes.data ?? []) as Record<string, unknown>[]).map((u) => [u.user_id as string, u]));
  const codeOf = new Map(
    ((codesRes.data ?? []) as Record<string, unknown>[]).map((c) => [
      `${c.topic_id as string}:${c.user_id as string}`,
      articleLabel(c.author_kind as ArticleAuthorKind, c.code as string),
    ]),
  );
  const paused = new Set(((pausesRes.data ?? []) as Record<string, unknown>[]).map((p) => p.user_id as string));
  const removedCount = new Map<string, number>();
  for (const r of [...((removedTopicsRes.data ?? []) as Record<string, unknown>[]), ...((removedRepliesRes.data ?? []) as Record<string, unknown>[])]) {
    const k = r.author_user_id as string;
    removedCount.set(k, (removedCount.get(k) ?? 0) + 1);
  }

  const build = (type: ArticleTarget, id: string, r: Record<string, unknown>) => {
    const parent = parentOf.get(r.topic_id as string);
    const author = r.author_user_id as string;
    const u = userOf.get(author);
    const isRemoved = Boolean(r.removed_at);
    out.set(`${type}:${id}`, {
      topicTitle: (parent?.title as string | undefined) ?? null,
      topicHref: parent ? `/articles/${parent.public_id as string}` : null,
      excerpt: String(type === 'article_topic' ? `${r.title as string}\n${r.body as string}` : (r.body as string)).slice(0, 280),
      label: codeOf.get(`${r.topic_id as string}:${author}`) ?? null,
      posterName: (u?.display_name as string | null) ?? null,
      posterEmail: (u?.email as string | null) ?? null,
      joinedAt: (u?.created_at as string | null) ?? null,
      // "Before": removals other than this one.
      removedBefore: Math.max(0, (removedCount.get(author) ?? 0) - (isRemoved ? 1 : 0)),
      paused: paused.has(author),
      removed: isRemoved,
    });
  };
  for (const t of topics) build('article_topic', t.public_id as string, t);
  for (const r of replies) build('article_reply', r.reply_id as string, r);
  return out;
}
