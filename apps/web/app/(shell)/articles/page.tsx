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
import Link from 'next/link';
import { MessageCircle, PenLine } from 'lucide-react';
import { listArticles, type ArticleSort } from '@/lib/articles.server';
import { LinkPickMenu } from '@/app/_components/link-pick-menu';
import { PUBLIC_POSTS_ARE_FINDABLE } from '@/lib/creator-chapters';
import { articleHref } from '@/lib/journal-move';
import { articleWhen, BylineName, TagChips } from './_components/article-bits';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Articles',
  description:
    'Questions, answers and guides from couples, hosts and suppliers in the Philippines — and the Setnayan Journal.',
  alternates: { canonical: '/articles' },
};

type Props = { searchParams: Promise<{ tag?: string; sort?: string }> };

function hrefFor(tag: string | null, sort: ArticleSort): string {
  const q = new URLSearchParams();
  if (tag) q.set('tag', tag);
  if (sort !== 'newest') q.set('sort', sort);
  const s = q.toString();
  return s ? `/articles?${s}` : '/articles';
}

export default async function ArticlesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tag = typeof sp.tag === 'string' && sp.tag.trim() ? sp.tag.trim().toLowerCase() : null;
  const sort: ArticleSort = sp.sort === 'replies' ? 'replies' : 'newest';
  const res = await listArticles({ tag, sort });

  const tagOptions = [
    { key: 'all', label: 'All', href: hrefFor(null, sort) },
    ...(res.ok ? res.data.tags : tag ? [tag] : []).map((t) => ({ key: t, label: t, href: hrefFor(t, sort) })),
  ];
  const sortOptions = [
    { key: 'newest', label: 'Newest', href: hrefFor(tag, 'newest') },
    { key: 'replies', label: 'Most replies', href: hrefFor(tag, 'replies') },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6">
      <h1 className="text-xl font-semibold text-ink">Articles</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LinkPickMenu label="Tag" value={tag ?? 'all'} options={tagOptions} buttonText={`Tag · ${tag ?? 'All'}`} />
        <LinkPickMenu
          label="Sort"
          value={sort}
          options={sortOptions}
          buttonText={`Sort · ${sort === 'replies' ? 'Most replies' : 'Newest'}`}
        />
        <Link href="/articles/write" className="ab ab-brand ab-main ml-auto inline-flex min-h-11 items-center gap-1.5">
          <PenLine aria-hidden className="h-4 w-4" strokeWidth={2} />
          Write a post
        </Link>
      </div>

      {!res.ok ? (
        <p role="alert" className="mt-6 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          We couldn’t load the articles just now. Please try again in a moment.
        </p>
      ) : res.data.articles.length === 0 ? (
        <p className="mt-6 text-sm text-ink/75">
          {tag ? `No posts tagged “${tag}” yet.` : 'No posts yet.'} Be the first — write a post.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ink/10">
          {res.data.articles.map((a) => (
            <li key={a.slug} className="py-4">
              <p className="flex flex-wrap items-center gap-1 text-[13px] text-ink/70">
                <BylineName byline={a.byline} />
                <span aria-hidden>·</span>
                <span>{articleWhen(a.publishedAt)}</span>
              </p>
              <Link href={articleHref(a.slug)} className="mt-1 block text-base font-semibold text-ink hover:underline">
                {a.title}
              </Link>
              {a.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-ink/75">{a.excerpt}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <TagChips tags={a.tags} />
                <span className="ml-auto inline-flex items-center gap-1 text-[13px] text-ink/70">
                  <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {a.replyCount}
                  <span className="sr-only"> replies</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-[12px] text-ink/70">ⓘ {PUBLIC_POSTS_ARE_FINDABLE}</p>
    </main>
  );
}
