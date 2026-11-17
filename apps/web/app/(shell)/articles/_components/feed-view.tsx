import Link from 'next/link';
import { MessageCircle, Plus } from 'lucide-react';
import type { ArticleCard, ArticleRead, ArticleSort } from '@/lib/articles.server';
import { LinkPickMenu } from '@/app/_components/link-pick-menu';
import { PUBLIC_POSTS_ARE_FINDABLE } from '@/lib/creator-chapters';
import { articleHref } from '@/lib/journal-move';
import { formatCount } from '@/lib/format-number';
import { articleWhen, BylineName, TagChips } from './article-bits';

/** The feed, drawn from a read (drawing v15 "Articles"). A refused read renders as a refusal, never as empty. */
export function hrefFor(tag: string | null, sort: ArticleSort): string {
  const q = new URLSearchParams();
  if (tag) q.set('tag', tag);
  if (sort !== 'newest') q.set('sort', sort);
  const s = q.toString();
  return s ? `/articles?${s}` : '/articles';
}

export function ArticlesFeedView({
  res,
  tag,
  sort,
}: {
  res: ArticleRead<{ articles: ArticleCard[]; tags: string[] }>;
  tag: string | null;
  sort: ArticleSort;
}) {
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
      </div>
      <Link href="/articles/write" className="ab ab-brand ab-main mt-3 inline-flex min-h-11 items-center gap-1.5">
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
        Write a post
      </Link>

      {!res.ok ? (
        <p role="alert" className="mt-6 text-sm font-medium text-danger-700">
          We couldn’t load the articles just now. Please try again in a moment.
        </p>
      ) : res.data.articles.length === 0 ? (
        <p className="mt-6 text-sm text-ink/75">
          {tag ? `No posts tagged “${tag}” yet.` : 'No posts yet.'} Be the first — write a post.
        </p>
      ) : (
        <ul className="sn-frame mt-4 divide-y divide-ink/10 px-4">
          {res.data.articles.map((a) => (
            <li key={a.slug} className="flex gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1 text-[13px] text-ink/70">
                  <BylineName byline={a.byline} />
                  <span aria-hidden>·</span>
                  <span>{articleWhen(a.publishedAt, undefined, a.byline.kind === 'journal')}</span>
                </p>
                <Link href={articleHref(a.slug)} className="mt-1 block text-base font-semibold text-ink hover:underline">
                  {a.title}
                </Link>
                {a.excerpt && a.byline.kind !== 'journal' ? (
                  <p className="mt-1 line-clamp-2 text-sm text-ink/75">{a.excerpt}</p>
                ) : null}
                <div className="mt-2">
                  <TagChips tags={a.tags} />
                </div>
              </div>
              <span className="inline-flex shrink-0 items-start gap-1 pt-6 text-[13px] text-ink/70">
                <MessageCircle aria-hidden className="mt-0.5 h-3.5 w-3.5" strokeWidth={1.75} />
                {formatCount(a.replyCount)}
                <span className="sr-only"> replies</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-[12px] text-ink/70">{PUBLIC_POSTS_ARE_FINDABLE}</p>
    </main>
  );
}
