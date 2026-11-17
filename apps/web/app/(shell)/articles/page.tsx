/**
 * /articles — Discover's articles, the feed (drawing v15 "Articles"; owner 2026-11-17: "our Reddit, cleaner").
 *
 * Text and links only. The Journal's posts are the first rows, marked Setnayan Journal. Tag ▾ and Sort ▾ are the
 * house PickMenu (LinkPickMenu — the choice is the address, so a filtered feed can be shared). New posts show at
 * once (Q6 ruled); Report takes one down. Build 3 puts this feed into Discover's Articles part and links its
 * "See all ›" here.
 *
 * 🔑 A refused read renders as a refusal ("We couldn't load the articles"), never as "No posts yet".
 */
import type { Metadata } from 'next';
import { listArticles, type ArticleSort } from '@/lib/articles.server';
import { ArticlesFeedView } from './_components/feed-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Articles',
  description:
    'Questions, answers and guides from couples, hosts and suppliers in the Philippines — and the Setnayan Journal.',
  alternates: { canonical: '/articles' },
};

type Props = { searchParams: Promise<{ tag?: string; sort?: string }> };

export default async function ArticlesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tag = typeof sp.tag === 'string' && sp.tag.trim() ? sp.tag.trim().toLowerCase() : null;
  const sort: ArticleSort = sp.sort === 'replies' ? 'replies' : 'newest';
  const res = await listArticles({ tag, sort });
  return <ArticlesFeedView res={res} tag={tag} sort={sort} />;
}
