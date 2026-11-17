import Link from 'next/link';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { segmentParagraph } from '@/lib/article-links';
import type { Article, ArticleRead, WriterState } from '@/lib/articles.server';
import { splitChapterParagraphs, PUBLIC_POSTS_ARE_FINDABLE } from '@/lib/creator-chapters';
import { articleHref } from '@/lib/journal-move';
import { ReportPageButton } from '@/app/_components/report-page-button';
import { articleWhen, ArticleParagraph, BylineName, initialsOf, LinkCardView, TagChips } from './article-bits';
import { ReplyBox } from './reply-box';

/** One article, drawn from a read (drawing v15 "An article"). `null` is handled by the page (a real 404). */
export function ArticleView({ res, writer }: { res: ArticleRead<Article>; writer: WriterState }) {
  if (!res.ok) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6">
        <p role="alert" className="text-sm font-medium text-danger-700">
          We couldn’t load this article just now. Please try again in a moment.
        </p>
      </main>
    );
  }
  const a = res.data;

  const paragraphs = splitChapterParagraphs(a.body);
  const byPath = new Map(a.linkCards.map((c) => [c.path, c]));
  const cardsIn = (p: string) =>
    segmentParagraph(p).flatMap((seg) => {
      const card = seg.kind === 'setnayan' ? byPath.get(seg.path) : undefined;
      return card && seg.kind === 'setnayan' ? [{ text: seg.text, card }] : [];
    });
  const loginHref = `/login?next=${encodeURIComponent(articleHref(a.slug))}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6">
      <Link href="/articles" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink/80 hover:text-ink">
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
        Articles
      </Link>

      <article className="sn-frame mt-2 p-4">
        <p className="flex flex-wrap items-center gap-1 text-[13px] text-ink/70">
          <BylineName byline={a.byline} />
          <span aria-hidden>·</span>
          <span>{articleWhen(a.publishedAt, undefined, a.byline.kind === 'journal')}</span>
        </p>
        <h1 className="mt-1 text-xl font-semibold leading-snug text-ink">{a.title}</h1>
        <div className="mt-2">
          <TagChips tags={a.tags} />
        </div>

        <div className="mt-4 space-y-4">
          {paragraphs.map((p, i) => {
            // A setnayan.com link we can place becomes its card RIGHT WHERE IT SITS (drawing: the card replaces the
            // link in the flow); the paragraph keeps its other words. A link we cannot place stays a link.
            const here = cardsIn(p);
            const words = here.reduce((t, c) => t.replace(c.text, ''), p).trim();
            return (
              <div key={i} className="space-y-2">
                {words ? <ArticleParagraph text={words} /> : null}
                {here.map((c) => (
                  <LinkCardView key={c.card.path} card={c.card} />
                ))}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[12px] text-ink/70">ⓘ {PUBLIC_POSTS_ARE_FINDABLE}</p>
      </article>
      <div className="mt-2 flex items-center gap-1 px-1 text-[13px] text-ink/75">
        <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={2} />
        <ReportPageButton targetType="chapter" targetId={a.publicId} label="Report" />
      </div>

      <section className="mt-6" aria-labelledby="replies-heading">
        <h2 id="replies-heading" className="text-base font-semibold text-ink">
          Replies {a.replies.ok ? <span className="text-ink/70">{a.replies.data.length}</span> : null}
        </h2>
        {!a.replies.ok ? (
          <p role="alert" className="mt-2 text-sm text-danger-700">
            We couldn’t load the replies just now.
          </p>
        ) : (
          <ul className="sn-frame mt-2 divide-y divide-ink/10 px-4">
            {a.replies.data.map((r) => (
              <li key={r.replyId} className="flex gap-3 py-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-cream"
                >
                  {initialsOf(r.byline.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1 text-[13px] text-ink/70">
                    <BylineName byline={r.byline} />
                    <span aria-hidden>·</span>
                    <span>{articleWhen(r.createdAt)}</span>
                  </p>
                  <div className="mt-0.5">
                    <ArticleParagraph text={r.body} />
                  </div>
                  <p className="mt-1 flex items-center gap-3 text-[12px] text-ink/70">
                    {/* One level deep: "Reply" answers the article, so it opens the one reply box. */}
                    <a href="#write-a-reply" className="font-medium hover:text-ink">
                      Reply
                    </a>
                    {r.mine ? null : <ReportPageButton targetType="chapter_reply" targetId={r.replyId} label="Report" />}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div id="write-a-reply" className="mt-4 scroll-mt-24">
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
