import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { relativeTime } from '@/lib/activity';
import { formatCount } from '@/lib/format-number';
import type { ArticlePost, ArticleRead, ArticleThread, ArticleTopicCard } from '@/lib/articles.server';
import { ReportPageButton } from '@/app/_components/report-page-button';
import { ArticleText } from './article-text';
import { ReplyComposer } from './article-composer';
import { TopicList } from './topic-list';

/**
 * One topic and its replies (prototype screen 3) — drawn from what the page
 * read, so the page (`../[topicId]/page.tsx`) and the dev lab draw the SAME
 * thing. No reads here.
 *
 * 🔓 Signed out: read-only — no composer, no Report, "Sign in to reply".
 */

function Post({ post, kind, signedIn }: { post: ArticlePost; kind: 'article_topic' | 'article_reply'; signedIn: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink/70">
        <span className="font-semibold text-ink/85">{post.label}</span> · {relativeTime(post.createdAt)}
      </p>
      <ArticleText text={post.body} muted={post.removed} />
      {signedIn && !post.removed && !post.mine && (
        <ReportPageButton
          targetType={kind}
          targetId={post.id}
          label="Report"
          sheetTitle={kind === 'article_topic' ? 'Report this topic' : 'Report this reply'}
          thing={kind === 'article_topic' ? 'topic' : 'reply'}
          className="pt-0.5"
        />
      )}
    </div>
  );
}

export function ThreadView({
  topicId,
  read,
  eventLabel: label,
  list,
  signedIn,
  paused,
  postAs,
}: {
  topicId: string;
  read: ArticleRead<ArticleThread | null>;
  eventLabel: (key: string | null) => string | null;
  /** The desktop list pane — signed in only. */
  list: ArticleRead<ArticleTopicCard[]> | null;
  signedIn: boolean;
  paused: boolean;
  postAs: string | null;
}) {
  return (
    <main className={`mx-auto w-full max-w-6xl px-4 pb-24 pt-4 ${signedIn ? 'lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8' : 'max-w-2xl'}`}>
      {signedIn && list && (
        <nav aria-label="Topics" className="hidden lg:block">
          <TopicList read={list} eventLabel={label} activeId={topicId} filtered={false} />
        </nav>
      )}
      <article className="space-y-4" data-article-thread="">
        {signedIn && (
          <Link href="/articles" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink/80 hover:text-ink lg:hidden">
            <ArrowLeft aria-hidden className="h-4 w-4" /> Articles
          </Link>
        )}
        {!read.ok ? (
          <>
            <h1 className="text-xl font-semibold text-ink">Articles</h1>
            <p role="alert" className="rounded-xl bg-terracotta/5 px-4 py-3 text-sm text-terracotta-800">
              We couldn’t load this topic just now. Please try again in a moment.
            </p>
          </>
        ) : (
          (() => {
            const t = read.value!;
            const ev = label(t.eventType);
            return (
              <>
                <header className="space-y-2">
                  <p className="text-xs text-ink/70">
                    {[ev, t.opening.label, relativeTime(t.opening.createdAt)].filter(Boolean).join(' · ')}
                  </p>
                  <h1 className="text-2xl font-semibold text-ink">{t.title}</h1>
                  <ArticleText text={t.opening.body} muted={t.removed} />
                  <div className="flex items-center gap-4 text-xs text-ink/70">
                    <span>
                      {formatCount(t.replyCount)} {t.replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                    {signedIn && !t.removed && !t.opening.mine && (
                      <ReportPageButton targetType="article_topic" targetId={t.publicId} label="Report" sheetTitle="Report this topic" thing="topic" />
                    )}
                  </div>
                </header>
                {t.replies.length > 0 && (
                  <ol className="space-y-3" data-article-replies="">
                    {t.replies.map((r) => (
                      <li key={r.id} className={`rounded-2xl px-3 py-3 ${r.removed ? 'bg-ink/[0.02]' : 'bg-ink/[0.045]'}`}>
                        <Post post={r} kind="article_reply" signedIn={signedIn} />
                      </li>
                    ))}
                  </ol>
                )}
                <div className="border-t border-ink/10 pt-4">
                  {t.removed ? (
                    <p className="text-sm text-ink/70">This topic was removed, so it takes no more replies.</p>
                  ) : !signedIn ? (
                    <p className="text-sm text-ink/80" data-article-signed-out="">
                      <Link
                        href={`/login?next=${encodeURIComponent(`/articles/${t.publicId}`)}`}
                        className="inline-flex min-h-11 items-center rounded-xl bg-terracotta-700 px-4 font-semibold text-cream hover:bg-terracotta-800"
                      >
                        Sign in to reply
                      </Link>
                    </p>
                  ) : paused ? (
                    <p className="text-sm text-ink/80">Setnayan has paused your posting in Articles. You can still read.</p>
                  ) : (
                    <ReplyComposer topic={t.publicId} postAs={postAs} />
                  )}
                </div>
              </>
            );
          })()
        )}
      </article>
    </main>
  );
}
