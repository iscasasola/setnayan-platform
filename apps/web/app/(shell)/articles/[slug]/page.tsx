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
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { articleBySlug, writerState } from '@/lib/articles.server';
import { splitChapterParagraphs, PUBLIC_POSTS_ARE_FINDABLE } from '@/lib/creator-chapters';
import { articleHref } from '@/lib/journal-move';
import { ReportPageButton } from '@/app/_components/report-page-button';
import { articleWhen, ArticleParagraph, BylineName, LinkCardView, TagChips } from '../_components/article-bits';
import { ReplyBox } from '../_components/reply-box';

export const dynamic = 'force-dynamic';

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

  if (!res.ok) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6">
        <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          We couldn’t load this article just now. Please try again in a moment.
        </p>
      </main>
    );
  }
  const a = res.data;
  if (!a) notFound();

  const paragraphs = splitChapterParagraphs(a.body);
  const loginHref = `/login?next=${encodeURIComponent(articleHref(a.slug))}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6">
      <Link href="/articles" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink/80 hover:text-ink">
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
        Articles
      </Link>

      <article className="mt-2">
        <p className="flex flex-wrap items-center gap-1 text-[13px] text-ink/70">
          <BylineName byline={a.byline} />
          <span aria-hidden>·</span>
          <span>{articleWhen(a.publishedAt)}</span>
        </p>
        <h1 className="mt-1 text-xl font-semibold leading-snug text-ink">{a.title}</h1>
        <div className="mt-2">
          <TagChips tags={a.tags} />
        </div>

        <div className="mt-4 space-y-4">
          {paragraphs.map((p, i) => (
            <ArticleParagraph key={i} text={p} />
          ))}
        </div>

        {a.linkCards.length > 0 ? (
          <div className="mt-4 space-y-2">
            {a.linkCards.map((c) => (
              <LinkCardView key={c.path} card={c} />
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3">
          <p className="text-[12px] text-ink/70">ⓘ {PUBLIC_POSTS_ARE_FINDABLE}</p>
          <ReportPageButton targetType="chapter" targetId={a.publicId} label="Report" />
        </div>
      </article>

      <section className="mt-6" aria-labelledby="replies-heading">
        <h2 id="replies-heading" className="text-base font-semibold text-ink">
          Replies {a.replies.ok ? <span className="text-ink/70">{a.replies.data.length}</span> : null}
        </h2>
        {!a.replies.ok ? (
          <p role="alert" className="mt-2 text-sm text-danger-700">
            We couldn’t load the replies just now.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {a.replies.data.map((r) => (
              <li key={r.replyId} className="rounded-xl bg-ink/[0.03] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-1 text-[13px] text-ink/70">
                    <BylineName byline={r.byline} />
                    <span aria-hidden>·</span>
                    <span>{articleWhen(r.createdAt)}</span>
                  </p>
                  {r.mine ? null : <ReportPageButton targetType="chapter_reply" targetId={r.replyId} label="Report" />}
                </div>
                <div className="mt-1">
                  <ArticleParagraph text={r.body} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <ReplyBox
            chapterId={a.chapterId}
            signedIn={writer.signedIn}
            shopName={writer.signedIn ? writer.shopName : null}
            postingName={writer.signedIn ? writer.postingName : null}
            loginHref={loginHref}
          />
        </div>
      </section>
    </main>
  );
}
