import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { refusedLinks } from '@/lib/articles-links';

/**
 * articles.server — every read and write behind ARTICLES.
 *
 * Contract: DECISION_LOG 2026-11-16 (specs repo) rows about Articles, Discover
 * and exact links; prototype `prototypes/articles_2026-11-16/` (approved, "1a 2a 3a").
 *
 * ── ANONYMOUS TO READERS, KNOWN TO SETNAYAN ─────────────────────────────────
 * Every table here is RLS Pattern F (admin-only) — see the migration
 * `…_articles_topics_and_replies.sql` for why. So nothing in this file can be
 * reached from a browser; it reads with the service client and returns ONLY:
 * a label ("Guest · 3F" / "Supplier · 7K"), the words, and times. 🔒 No type
 * returned by a READER below carries a user id, an email or a name — held by
 * `lib/articles-readers-never-see-the-account.test.ts`. The real account is
 * read in exactly one place: Admin › User reports.
 *
 * ── HONEST READS ────────────────────────────────────────────────────────────
 * A refused read returns `{ ok: false }`, never an empty list — so the page
 * says "We couldn't load the topics", not "No topics yet" (the pattern of
 * `lib/guests.ts` · `guests-read-is-honest.test.ts`).
 */

export type ArticleSort = 'newest' | 'replies';
export type ArticleAuthorKind = 'guest' | 'supplier';

export type ArticleTopicCard = {
  publicId: string;
  title: string;
  eventType: string | null;
  replyCount: number;
  createdAt: string;
  lastActivityAt: string;
};

export type ArticlePost = {
  /** reply_id for a reply, the topic's public_id for the opening post. */
  id: string;
  label: string;
  body: string;
  createdAt: string;
  removed: boolean;
  /** True when the signed-in viewer wrote it (to hide Report on your own post). */
  mine: boolean;
};

export type ArticleThread = {
  publicId: string;
  title: string;
  eventType: string | null;
  removed: boolean;
  opening: ArticlePost;
  replies: ArticlePost[];
  replyCount: number;
};

export type ArticleRead<T> = { ok: true; value: T } | { ok: false };

export const ARTICLE_TITLE_MIN = 3;
export const ARTICLE_TITLE_MAX = 120;
export const ARTICLE_BODY_MAX = 4000;
/** One page of topics. A list, not an archive: search narrows the rest. */
const LIST_LIMIT = 50;

/** "Guest · 3F" / "Supplier · 7K" — the only name a reader is ever shown. */
export function articleLabel(kind: ArticleAuthorKind, code: string): string {
  return `${kind === 'supplier' ? 'Supplier' : 'Guest'} · ${code}`;
}

/** The marker readers see where a removed post was (prototype screen 6). */
export const ARTICLE_REMOVED_LINE = 'Removed by Setnayan — it broke the house rules.';

function cleanSearch(q: string): string {
  // PostgREST `.or()` treats , ( ) as syntax and * % _ as wildcards.
  return q.replace(/[,()*%_\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** The topic list (inside the account). */
export async function listArticleTopics(opts: {
  q?: string;
  eventType?: string | null;
  sort?: ArticleSort;
  limit?: number;
}): Promise<ArticleRead<ArticleTopicCard[]>> {
  const admin = createAdminClient();
  let query = admin
    .from('article_topics')
    .select('public_id, title, event_type, reply_count, created_at, last_activity_at')
    .is('removed_at', null);
  const q = cleanSearch(opts.q ?? '');
  if (q) query = query.or(`title.ilike.*${q}*,body.ilike.*${q}*`);
  if (opts.eventType) query = query.eq('event_type', opts.eventType);
  query =
    opts.sort === 'replies'
      ? query.order('reply_count', { ascending: false }).order('last_activity_at', { ascending: false })
      : query.order('created_at', { ascending: false });
  const { data, error } = await query.limit(Math.min(opts.limit ?? LIST_LIMIT, LIST_LIMIT));
  if (error) {
    logQueryError('listArticleTopics', error, {}, 'graceful_degrade');
    return { ok: false };
  }
  return {
    ok: true,
    value: (data ?? []).map((r) => ({
      publicId: r.public_id as string,
      title: r.title as string,
      eventType: (r.event_type as string | null) ?? null,
      replyCount: (r.reply_count as number) ?? 0,
      createdAt: r.created_at as string,
      lastActivityAt: r.last_activity_at as string,
    })),
  };
}

/**
 * 🧭 THE READ FOR DISCOVER'S "ARTICLES" SHELF — the newest live topics.
 * Same honest shape as the list: `{ ok: false }` when the read was refused, so
 * a shelf can hide or say so rather than claim there is nothing to read.
 */
export async function latestArticleTopics(limit = 6): Promise<ArticleRead<ArticleTopicCard[]>> {
  return listArticleTopics({ sort: 'newest', limit });
}

/** One topic by its exact link, with its replies. `null` value = no such topic. */
export async function readArticleThread(
  publicId: string,
  viewerUserId: string | null,
): Promise<ArticleRead<ArticleThread | null>> {
  if (!/^S89A-[0-9A-Z]{10}$/.test(publicId)) return { ok: true, value: null };
  const admin = createAdminClient();
  const { data: topic, error } = await admin
    .from('article_topics')
    .select('topic_id, public_id, author_user_id, title, body, event_type, reply_count, removed_at, created_at')
    .eq('public_id', publicId)
    .maybeSingle();
  if (error) {
    logQueryError('readArticleThread (topic)', error, {}, 'graceful_degrade');
    return { ok: false };
  }
  if (!topic) return { ok: true, value: null };

  const [codesRes, repliesRes] = await Promise.all([
    admin.from('article_topic_codes').select('user_id, code, author_kind').eq('topic_id', topic.topic_id),
    admin
      .from('article_replies')
      .select('reply_id, author_user_id, body, removed_at, created_at')
      .eq('topic_id', topic.topic_id)
      .order('created_at', { ascending: true })
      .limit(500),
  ]);
  if (codesRes.error || repliesRes.error) {
    logQueryError('readArticleThread (codes/replies)', codesRes.error ?? repliesRes.error, {}, 'graceful_degrade');
    return { ok: false };
  }
  const labelOf = new Map<string, string>();
  for (const c of codesRes.data ?? []) {
    labelOf.set(c.user_id as string, articleLabel(c.author_kind as ArticleAuthorKind, c.code as string));
  }
  const removed = Boolean(topic.removed_at);
  const opening: ArticlePost = {
    id: topic.public_id as string,
    label: labelOf.get(topic.author_user_id as string) ?? 'Guest',
    body: removed ? ARTICLE_REMOVED_LINE : (topic.body as string),
    createdAt: topic.created_at as string,
    removed,
    mine: viewerUserId !== null && viewerUserId === topic.author_user_id,
  };
  const replies: ArticlePost[] = (repliesRes.data ?? []).map((r) => {
    const gone = Boolean(r.removed_at);
    return {
      id: r.reply_id as string,
      label: labelOf.get(r.author_user_id as string) ?? 'Guest',
      body: gone ? ARTICLE_REMOVED_LINE : (r.body as string),
      createdAt: r.created_at as string,
      removed: gone,
      mine: viewerUserId !== null && viewerUserId === r.author_user_id,
    };
  });
  return {
    ok: true,
    value: {
      publicId: topic.public_id as string,
      title: removed ? 'Removed topic' : (topic.title as string),
      eventType: (topic.event_type as string | null) ?? null,
      removed,
      opening,
      replies: removed ? [] : replies,
      replyCount: (topic.reply_count as number) ?? 0,
    },
  };
}

/**
 * Is this account paused from posting in Articles? `null` = the read was
 * refused — a write treats that as paused (fail closed): a missed post can be
 * sent again; a post from a paused account cannot be un-sent.
 */
export async function isPausedFromArticles(userId: string): Promise<boolean | null> {
  const { data, error } = await createAdminClient()
    .from('article_posting_pauses')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logQueryError('isPausedFromArticles', error, {}, 'graceful_degrade');
    return null;
  }
  return Boolean(data);
}

/**
 * Supplier or guest? A person who owns a shop or sits on a shop's team posts
 * as "Supplier · code" (ruling 2). `null` = could not tell — the write refuses
 * rather than risk a supplier posting as a Guest (advertising in disguise).
 */
export async function articleAuthorKind(userId: string): Promise<ArticleAuthorKind | null> {
  const admin = createAdminClient();
  const [owned, team] = await Promise.all([
    admin.from('vendor_profiles').select('vendor_profile_id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('vendor_team_members').select('vendor_profile_id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  if (owned.error || team.error) {
    logQueryError('articleAuthorKind', owned.error ?? team.error, {}, 'graceful_degrade');
    return null;
  }
  return (owned.count ?? 0) + (team.count ?? 0) > 0 ? 'supplier' : 'guest';
}

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomArticleCode(length: number): string {
  let s = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return s;
}

/**
 * The viewer's code inside one topic — the existing one, or a new one. The
 * kind is fixed the first time they post in the topic.
 */
async function codeInTopic(
  topicId: string,
  userId: string,
  kind: ArticleAuthorKind,
  preferred?: string | null,
): Promise<{ code: string; kind: ArticleAuthorKind } | null> {
  const admin = createAdminClient();
  const { data: existing, error } = await admin
    .from('article_topic_codes')
    .select('code, author_kind')
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logQueryError('codeInTopic (read)', error, {}, 'graceful_degrade');
    return null;
  }
  if (existing) return { code: existing.code as string, kind: existing.author_kind as ArticleAuthorKind };
  for (let attempt = 0; attempt < 10; attempt++) {
    // The New-topic form showed "You post as Guest · 3F" before posting. In a
    // brand-new topic nobody else holds a code, so that code is free — use it,
    // so what the person was told is what readers see.
    const code =
      attempt === 0 && preferred && /^[0-9A-Z]{2,4}$/.test(preferred) ? preferred : randomArticleCode(attempt < 6 ? 2 : 3);
    const { error: insErr } = await admin
      .from('article_topic_codes')
      .insert({ topic_id: topicId, user_id: userId, code, author_kind: kind });
    if (!insErr) return { code, kind };
    if (insErr.code !== '23505') {
      logQueryError('codeInTopic (insert)', insErr, {}, 'graceful_degrade');
      return null;
    }
    // 23505: either the code is taken in this topic (try another) or this
    // person won a race and already has one (read it back).
    const { data: again } = await admin
      .from('article_topic_codes')
      .select('code, author_kind')
      .eq('topic_id', topicId)
      .eq('user_id', userId)
      .maybeSingle();
    if (again) return { code: again.code as string, kind: again.author_kind as ArticleAuthorKind };
  }
  return null;
}

export type ArticleWriteError =
  | 'paused'
  | 'link_refused'
  | 'bad_title'
  | 'bad_body'
  | 'bad_event'
  | 'no_topic'
  | 'topic_removed'
  | 'unavailable';

export type ArticleWriteResult =
  | { ok: true; publicId: string; post?: ArticlePost }
  | { ok: false; error: ArticleWriteError; refused?: string[] };

async function gateWriter(userId: string, texts: string[]): Promise<ArticleWriteResult | ArticleAuthorKind> {
  // 🔗 THE SERVER HALF OF THE LINK RULE — the same function the composer runs
  // while typing. Checked before anything else is read or written.
  const refused = texts.flatMap((t) => refusedLinks(t));
  if (refused.length) return { ok: false, error: 'link_refused', refused };
  const [paused, kind] = await Promise.all([isPausedFromArticles(userId), articleAuthorKind(userId)]);
  if (paused === null || kind === null) return { ok: false, error: 'unavailable' };
  if (paused) return { ok: false, error: 'paused' };
  return kind;
}

async function eventTypeIsActive(eventType: string): Promise<boolean | null> {
  const { data, error } = await createAdminClient()
    .from('event_type_vocab')
    .select('event_type')
    .eq('event_type', eventType)
    .eq('status', 'active')
    .maybeSingle();
  if (error) return null;
  return Boolean(data);
}

/** New topic. Goes live at once (ruling 1). */
export async function postArticleTopic(
  userId: string,
  input: { title: string; body: string; eventType: string | null; code?: string | null },
): Promise<ArticleWriteResult> {
  const title = input.title.replace(/\s+/g, ' ').trim();
  const body = input.body.trim();
  if (title.length < ARTICLE_TITLE_MIN || title.length > ARTICLE_TITLE_MAX) return { ok: false, error: 'bad_title' };
  if (body.length > ARTICLE_BODY_MAX) return { ok: false, error: 'bad_body' };
  const gate = await gateWriter(userId, [title, body]);
  if (typeof gate !== 'string') return gate;
  if (input.eventType) {
    const active = await eventTypeIsActive(input.eventType);
    if (active === null) return { ok: false, error: 'unavailable' };
    if (!active) return { ok: false, error: 'bad_event' };
  }
  const admin = createAdminClient();
  const { data: topic, error } = await admin
    .from('article_topics')
    .insert({ author_user_id: userId, title, body, event_type: input.eventType || null })
    .select('topic_id, public_id')
    .single();
  if (error || !topic) {
    logQueryError('postArticleTopic (insert)', error, {}, 'graceful_degrade');
    return { ok: false, error: 'unavailable' };
  }
  const code = await codeInTopic(topic.topic_id as string, userId, gate, input.code ?? null);
  if (!code) {
    // No code, no name to show: take the topic back rather than leave a post
    // nobody can be named on.
    await admin.from('article_topics').delete().eq('topic_id', topic.topic_id);
    return { ok: false, error: 'unavailable' };
  }
  return { ok: true, publicId: topic.public_id as string };
}

/** Reply inside a topic. Goes live at once (ruling 1). */
export async function postArticleReply(
  userId: string,
  input: { topicPublicId: string; body: string },
): Promise<ArticleWriteResult> {
  const body = input.body.trim();
  if (body.length < 1 || body.length > ARTICLE_BODY_MAX) return { ok: false, error: 'bad_body' };
  const gate = await gateWriter(userId, [body]);
  if (typeof gate !== 'string') return gate;
  const admin = createAdminClient();
  const { data: topic, error } = await admin
    .from('article_topics')
    .select('topic_id, public_id, removed_at')
    .eq('public_id', input.topicPublicId)
    .maybeSingle();
  if (error) return { ok: false, error: 'unavailable' };
  if (!topic) return { ok: false, error: 'no_topic' };
  if (topic.removed_at) return { ok: false, error: 'topic_removed' };
  const code = await codeInTopic(topic.topic_id as string, userId, gate);
  if (!code) return { ok: false, error: 'unavailable' };
  const { data: reply, error: insErr } = await admin
    .from('article_replies')
    .insert({ topic_id: topic.topic_id, author_user_id: userId, body })
    .select('reply_id, created_at')
    .single();
  if (insErr || !reply) {
    logQueryError('postArticleReply (insert)', insErr, {}, 'graceful_degrade');
    return { ok: false, error: 'unavailable' };
  }
  return {
    ok: true,
    publicId: topic.public_id as string,
    post: {
      id: reply.reply_id as string,
      label: articleLabel(code.kind, code.code),
      body,
      createdAt: reply.created_at as string,
      removed: false,
      mine: true,
    },
  };
}

/** The viewer's label in a topic, if they have posted there (for "You post as …"). */
export async function viewerLabelInTopic(publicId: string, userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: topic } = await admin.from('article_topics').select('topic_id').eq('public_id', publicId).maybeSingle();
  if (!topic) return null;
  const { data } = await admin
    .from('article_topic_codes')
    .select('code, author_kind')
    .eq('topic_id', topic.topic_id)
    .eq('user_id', userId)
    .maybeSingle();
  return data ? articleLabel(data.author_kind as ArticleAuthorKind, data.code as string) : null;
}
