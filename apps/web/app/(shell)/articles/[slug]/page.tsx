/**
 * /articles/{slug} — one article (drawing v15 "An article"; owner 2026-11-17: a readable address).
 *
 * Text and links only: the body's paragraphs, a setnayan.com link as a card read from our own row (a shop: its
 * logo, city, Verified), any other link as plain text. ⋯ Report is the shipped Report sheet (admin/user-reports),
 * and so is each reply's. Replies are one level deep, under the name each person chose — a shop always as the
 * shop, with the Supplier mark. "Public posts can appear on Google and in AI answers."
 *
 * A failed read says so; an article that is not public (draft, taken down, no such address) is a 404.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articleBySlug, writerState } from '@/lib/articles.server';
import { articleHref } from '@/lib/journal-move';
import { articleStructuredData, jsonLdText } from '@/lib/articles-index';
import { ArticleView } from './article-view';

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const res = await articleBySlug(slug);
  if (!res.ok || !res.data) return { title: 'Articles' };
  return {
    title: res.data.title,
    description: res.data.excerpt ?? undefined,
    alternates: { canonical: articleHref(res.data.slug) },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const [res, writer] = await Promise.all([articleBySlug(slug), writerState()]);
  if (res.ok && !res.data) notFound();
  const a = res.ok ? res.data! : null;
  return (
    <>
      {a ? (
        /* 🔎 Found on Google and by AI answers (owner 17 Nov, Build 3): a member's or a shop's post is a
           DiscussionForumPosting with its replies as Comments; a Journal post is an Article (lib/articles-index.ts). */
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdText(
              articleStructuredData(
                { slug: a.slug, title: a.title, byline: a.byline, publishedAt: a.publishedAt, updatedAt: a.updatedAt, summary: a.excerpt },
                SITE_URL,
                a.replies.ok ? a.replies.data.map((r) => ({ byline: r.byline, text: r.body, postedAt: r.createdAt })) : [],
              ),
            ),
          }}
        />
      ) : null}
      <ArticleView res={res.ok ? { ok: true, data: res.data! } : { ok: false }} writer={writer} />
    </>
  );
}
