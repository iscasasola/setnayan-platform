import 'server-only';

/**
 * 📰 ARTICLES — the reads (Build 2 of 3; drawing v15, owner rulings 2026-11-17).
 *
 * An article is a `creator_chapters` row that is published, has an address (`slug`) and was not taken down —
 * exactly what the RLS policy `public_can_read_published_article` admits, so these reads use the visitor's own
 * session and the database decides who reads what.
 *
 * 🔑 A REFUSED READ IS NOT AN EMPTY ONE (the house rule, `lib/guests.ts`): every read returns
 * `{ ok: false }` on an error, never `[]`, so a page can say "We couldn't load the articles" instead of
 * "No posts yet" to a feed that has ninety.
 *
 * WHO WROTE IT — one answer, `bylineFor`: a shop-linked post → the shop's name + the Supplier mark (owner: "user
 * account related to the supplier will always show their shop name"); a Journal post → "Setnayan Journal"; anyone
 * else → their chosen posting name. The account behind it is never shown. Names are read with the service role
 * BY ID (two columns, nothing else): a name is the one fact a reader is allowed to see about an author, and the
 * visitor's own session cannot read another person's `users` row.
 *
 * 🧭 FOR BUILD 3 (sitemap-articles.xml · llms.txt · structured data): `listPublicArticleAddresses()` returns
 * every public, not-removed article's slug + updated_at — the removed and the draft never appear in it.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { chapterExcerpt } from '@/lib/creator-chapters';
import { JOURNAL_BYLINE } from '@/lib/journal-move';
import { bylineFor, type Byline } from '@/lib/article-byline';

export { bylineFor, UNNAMED_MEMBER, type Byline } from '@/lib/article-byline';
import { cardTarget, findPostLinks } from '@/lib/article-links';
import { isShopLive, SHOP_LIVE_COLUMNS } from '@/lib/vendor-visibility';
import { displayUrlForStoredAsset } from '@/lib/uploads';

export type ArticleRead<T> = { ok: true; data: T } | { ok: false };

export type ArticleCard = {
  slug: string;
  publicId: string;
  title: string;
  excerpt: string | null;
  tags: string[];
  byline: Byline;
  replyCount: number;
  publishedAt: string | null;
  updatedAt: string;
};

export type ArticleReply = {
  replyId: string;
  body: string;
  byline: Byline;
  createdAt: string;
  mine: boolean;
};

export type LinkCard = {
  path: string;
  kind: 'shop' | 'article';
  title: string;
  /** One quiet line under the title, from our own row ("Tagaytay · Venue · Verified"). */
  line: string | null;
  /** A picture from the page's OWN data (the shop's logo), or null. Never an outside image. */
  imageUrl: string | null;
};

export type Article = ArticleCard & {
  chapterId: string;
  body: string;
  isJournal: boolean;
  replies: ArticleRead<ArticleReply[]>;
  linkCards: LinkCard[];
  viewerIsAuthor: boolean;
};

export type ArticleSort = 'newest' | 'replies';

const ARTICLE_COLS =
  'chapter_id, public_id, slug, title, body, tags, is_journal, posted_as_vendor_id, user_id, published_at, updated_at';

type ArticleRow = {
  chapter_id: string;
  public_id: string;
  slug: string;
  title: string;
  body: string | null;
  tags: string[] | null;
  is_journal: boolean;
  posted_as_vendor_id: string | null;
  user_id: string;
  published_at: string | null;
  updated_at: string;
};

/** Shop names + posting names for a set of authors — two id-scoped columns, nothing else. */
async function readNames(
  rows: { posted_as_vendor_id: string | null; user_id: string }[],
): Promise<ArticleRead<{ shops: Map<string, string>; people: Map<string, string | null> }>> {
  const shopIds = [...new Set(rows.map((r) => r.posted_as_vendor_id).filter((v): v is string => !!v))];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const admin = createAdminClient();
  const [shopsRes, peopleRes] = await Promise.all([
    shopIds.length
      ? admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds)
      : Promise.resolve({ data: [] as { vendor_profile_id: string; business_name: string | null }[], error: null }),
    userIds.length
      ? admin.from('users').select('user_id, posting_name').in('user_id', userIds)
      : Promise.resolve({ data: [] as { user_id: string; posting_name: string | null }[], error: null }),
  ]);
  if (shopsRes.error || peopleRes.error) {
    logQueryError('articles.readNames', shopsRes.error ?? peopleRes.error);
    return { ok: false };
  }
  const shops = new Map<string, string>();
  for (const s of shopsRes.data ?? []) if (s.business_name) shops.set(s.vendor_profile_id, s.business_name);
  const people = new Map<string, string | null>();
  for (const p of peopleRes.data ?? []) people.set(p.user_id, p.posting_name ?? null);
  return { ok: true, data: { shops, people } };
}

async function replyCounts(chapterIds: string[]): Promise<ArticleRead<Map<string, number>>> {
  const counts = new Map<string, number>();
  if (chapterIds.length === 0) return { ok: true, data: counts };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('creator_chapter_replies')
    .select('chapter_id')
    .in('chapter_id', chapterIds);
  if (error) {
    logQueryError('articles.replyCounts', error);
    return { ok: false };
  }
  for (const r of data ?? []) counts.set(r.chapter_id as string, (counts.get(r.chapter_id as string) ?? 0) + 1);
  return { ok: true, data: counts };
}

function toCard(row: ArticleRow, names: Parameters<typeof bylineFor>[1], replies: number): ArticleCard {
  return {
    slug: row.slug,
    publicId: row.public_id,
    title: row.title,
    excerpt: chapterExcerpt(row.body),
    tags: row.tags ?? [],
    byline: bylineFor(row, names),
    replyCount: replies,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

/** The feed: newest first (or most replies), optionally one tag. ≤ 60 rows. */
export async function listArticles(opts: { tag?: string | null; sort?: ArticleSort } = {}): Promise<
  ArticleRead<{ articles: ArticleCard[]; tags: string[] }>
> {
  const supabase = await createClient();
  let q = supabase
    .from('creator_chapters')
    .select(ARTICLE_COLS)
    .eq('status', 'published')
    .not('slug', 'is', null)
    .is('removed_at', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(60);
  if (opts.tag) q = q.contains('tags', [opts.tag]);
  const { data, error } = await q;
  if (error) {
    logQueryError('articles.listArticles', error);
    return { ok: false };
  }
  const rows = (data ?? []) as ArticleRow[];
  const [names, counts] = await Promise.all([readNames(rows), replyCounts(rows.map((r) => r.chapter_id))]);
  if (!names.ok || !counts.ok) return { ok: false };
  let articles = rows.map((r) => toCard(r, names.data, counts.data.get(r.chapter_id) ?? 0));
  if (opts.sort === 'replies') articles = [...articles].sort((a, b) => b.replyCount - a.replyCount);
  const tags = [...new Set(rows.flatMap((r) => r.tags ?? []))].sort();
  return { ok: true, data: { articles, tags } };
}

/** Articles carrying a tag — what onboarding's "Not sure yet" links to (Build 1). */
export async function articlesForTag(tag: string, limit = 3): Promise<ArticleRead<ArticleCard[]>> {
  const res = await listArticles({ tag });
  return res.ok ? { ok: true, data: res.data.articles.slice(0, limit) } : { ok: false };
}

/**
 * 🧭 Build 3's list: every public article's address and when it last changed. Drafts, removed posts and
 * future-dated ones never appear (the same filter as the feed, minus the cap).
 */
export async function listPublicArticleAddresses(): Promise<ArticleRead<{ slug: string; updatedAt: string; isJournal: boolean }[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('creator_chapters')
    .select('slug, updated_at, is_journal')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .is('removed_at', null)
    .lte('published_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(5000);
  if (error) {
    logQueryError('articles.listPublicArticleAddresses', error);
    return { ok: false };
  }
  return {
    ok: true,
    data: (data ?? []).map((r) => ({ slug: r.slug as string, updatedAt: r.updated_at as string, isJournal: Boolean(r.is_journal) })),
  };
}

/** The cards for the setnayan.com links in a body — read from our own rows only. A link we cannot place stays a link. */
async function resolveLinkCards(body: string): Promise<LinkCard[]> {
  const targets = findPostLinks(body)
    .filter((l): l is Extract<typeof l, { kind: 'setnayan' }> => l.kind === 'setnayan')
    .map((l) => ({ path: l.path, target: cardTarget(l.path) }))
    .filter((t): t is { path: string; target: NonNullable<ReturnType<typeof cardTarget>> } => t.target !== null)
    .slice(0, 6);
  if (targets.length === 0) return [];
  const supabase = await createClient();
  const words = targets.filter((t) => t.target.kind === 'page').map((t) => (t.target as { word: string }).word);
  const slugs = targets.filter((t) => t.target.kind === 'article').map((t) => (t.target as { slug: string }).slug);
  const [shopsRes, articlesRes] = await Promise.all([
    words.length
      ? supabase
          .from('vendor_profiles')
          .select(`business_slug, business_name, location_city, logo_url, ${SHOP_LIVE_COLUMNS}`)
          .in('business_slug', words)
      : Promise.resolve({ data: [], error: null }),
    slugs.length
      ? supabase.from('creator_chapters').select('slug, title, body, is_journal').in('slug', slugs).eq('status', 'published').is('removed_at', null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [what, err] of [['shops', shopsRes.error], ['articles', articlesRes.error]] as const) {
    if (err) logQueryError(`articles.resolveLinkCards (${what})`, err);
  }
  const cards: LinkCard[] = [];
  for (const t of targets) {
    if (t.target.kind === 'article') {
      const a = ((articlesRes.data ?? []) as { slug: string; title: string; body: string | null; is_journal: boolean }[])
        .find((r) => r.slug === (t.target as { slug: string }).slug);
      if (a) cards.push({ path: t.path, kind: 'article', title: a.title, line: a.is_journal ? JOURNAL_BYLINE : 'Article', imageUrl: null });
      continue;
    }
    const word = (t.target as { word: string }).word;
    const shop = ((shopsRes.data ?? []) as Record<string, unknown>[]).find((r) => r.business_slug === word);
    if (shop && isShopLive(shop)) {
      const logo = typeof shop.logo_url === 'string' ? await displayUrlForStoredAsset(shop.logo_url).catch(() => null) : null;
      cards.push({
        path: t.path,
        kind: 'shop',
        title: String(shop.business_name ?? word),
        line: [shop.location_city, 'Verified'].filter(Boolean).join(' · ') || null,
        imageUrl: logo,
      });
    }
    // ⏭ An Event Hub card is NOT built here: `events` serves a per-column grant allowlist to the visitor's
    // session, and a public-only read of its title needs its own read (named in the PR as a gap). Until then
    // an Event Hub link renders as a plain setnayan.com link — still a link, never a broken card.
  }
  return cards;
}

/** One article by its address, with its replies and its link cards. `null` data = no such public article. */
export async function articleBySlug(slug: string): Promise<ArticleRead<Article | null>> {
  const supabase = await createClient();
  const [{ data, error }, { data: auth }] = await Promise.all([
    supabase
      .from('creator_chapters')
      .select(ARTICLE_COLS)
      .eq('slug', slug)
      .eq('status', 'published')
      .is('removed_at', null)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (error) {
    logQueryError('articles.articleBySlug', error);
    return { ok: false };
  }
  if (!data) return { ok: true, data: null };
  const row = data as ArticleRow;
  const viewer = auth?.user?.id ?? null;

  const { data: replyRows, error: replyError } = await supabase
    .from('creator_chapter_replies')
    .select('reply_id, body, user_id, posted_as_vendor_id, created_at')
    .eq('chapter_id', row.chapter_id)
    .is('removed_at', null)
    .order('created_at', { ascending: true })
    .limit(500);
  if (replyError) logQueryError('articles.articleBySlug (replies)', replyError);

  const replyList = (replyRows ?? []) as { reply_id: string; body: string; user_id: string; posted_as_vendor_id: string | null; created_at: string }[];
  const [names, linkCards] = await Promise.all([
    readNames([row, ...replyList]),
    resolveLinkCards(row.body ?? ''),
  ]);
  if (!names.ok) return { ok: false };

  const replies: ArticleRead<ArticleReply[]> = replyError
    ? { ok: false }
    : {
        ok: true,
        data: replyList.map((r) => ({
          replyId: r.reply_id,
          body: r.body,
          byline: bylineFor({ is_journal: false, posted_as_vendor_id: r.posted_as_vendor_id, user_id: r.user_id }, names.data),
          createdAt: r.created_at,
          mine: viewer === r.user_id,
        })),
      };

  return {
    ok: true,
    data: {
      ...toCard(row, names.data, replies.ok ? replies.data.length : 0),
      chapterId: row.chapter_id,
      body: row.body ?? '',
      isJournal: row.is_journal,
      replies,
      linkCards,
      viewerIsAuthor: viewer === row.user_id,
    },
  };
}

/**
 * The article address of a chapter, by its public id — for the old `/u/{slug}/c/{id}` page, which forwards
 * to `/articles/{slug}` (owner 2026-11-17: "the chapter address forwards to it"). `null` = stay where you are
 * (not public as an article, taken down, or the read failed — a failed read never redirects anywhere).
 */
export async function articleSlugForChapter(publicId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('creator_chapters')
    .select('slug')
    .eq('public_id', publicId)
    .eq('status', 'published')
    .is('removed_at', null)
    .not('slug', 'is', null)
    .maybeSingle();
  if (error) {
    logQueryError('articles.articleSlugForChapter', error);
    return null;
  }
  return (data?.slug as string | undefined) ?? null;
}

/** The signed-in viewer, as the Write sheet needs them: are they signed in, do they post as a shop, their name. */
export type WriterState =
  | { signedIn: false }
  | { signedIn: true; userId: string; shopName: string | null; postingName: string | null; readFailed: boolean };

export async function writerState(): Promise<WriterState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return { signedIn: false };
  // Which shop this account posts as is the DATABASE's answer (`article_shop_of`, the same function the insert
  // trigger stamps with) — one rule, never re-derived here, so the sheet can never promise a name the post won't carry.
  const [me, shop] = await Promise.all([
    createAdminClient().from('users').select('posting_name').eq('user_id', uid).maybeSingle(),
    supabase.rpc('article_shop_of', { p_user_id: uid }),
  ]);
  const shopId = (shop.data as string | null) ?? null;
  const shopRow = shopId
    ? await createAdminClient().from('vendor_profiles').select('business_name').eq('vendor_profile_id', shopId).maybeSingle()
    : { data: null, error: null };
  const failed = Boolean(me.error || shop.error || shopRow.error);
  if (failed) logQueryError('articles.writerState', me.error ?? shop.error ?? shopRow.error);
  return {
    signedIn: true,
    userId: uid,
    shopName: (shopRow.data?.business_name as string | undefined) ?? (shopId ? 'Your shop' : null),
    postingName: (me.data?.posting_name as string | null | undefined) ?? null,
    readFailed: failed,
  };
}
