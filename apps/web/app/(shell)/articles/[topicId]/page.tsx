import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { relativeTime } from '@/lib/activity';
import { formatCount } from '@/lib/format-number';
import {
  isPausedFromArticles,
  listArticleTopics,
  readArticleThread,
  viewerLabelInTopic,
  type ArticlePost,
} from '@/lib/articles.server';
import { ReportPageButton } from '@/app/_components/report-page-button';
import { ArticleText } from '../_components/article-text';
import { ReplyComposer } from '../_components/article-composer';
import { TopicList } from '../_components/topic-list';
import { articleEventChoices } from '../_components/articles-viewer';

/**
 * /articles/<S89A-…> — ONE TOPIC AND ITS REPLIES (prototype screen 3).
 *
 * 🔓 THE EXACT LINK OPENS SIGNED OUT, READ-ONLY (owner ruling 3, 16 Nov:
 * "a topic's exact link opens read-only when signed out"; the exact-link rule
 * 448fd3c1). A signed-out visitor reads the topic and every reply and is asked
 * to sign in to reply — no composer, no Report-as-anyone. The topic LIST stays
 * inside the account (`../page.tsx`).
 *
 * Names are "Guest · code" / "Supplier · code" only: the read
 * (`readArticleThread`) never returns an account. A removed post keeps its place
 * with "Removed by Setnayan — it broke the house rules." so the thread still reads.
 *
 * ⚠ NO loading.tsx IN THIS FOLDER, ON PURPOSE: this page can notFound(), and a
 * loading boundary would commit a 200 before it runs (the /v/[slug] soft-404).
 */

export const metadata = {
  robots: { index: false, follow: false },
};

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

export default async function ArticleTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const user = await getCurrentUser();
  const read = await readArticleThread(topicId, user?.id ?? null);
  if (read.ok && read.value === null) notFound();

  const signedIn = Boolean(user);
  const [{ label }, list, postAs, paused] = await Promise.all([
    articleEventChoices(),
    // The desktop list pane — signed in only (the list is inside the account).
    signedIn ? listArticleTopics({ sort: 'newest' }) : Promise.resolve(null),
    user && read.ok && read.value ? viewerLabelInTopic(read.value.publicId, user.id) : Promise.resolve(null),
    user ? isPausedFromArticles(user.id) : Promise.resolve(false),
  ]);

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
                  <ol className="space-y-4 border-t border-ink/10 pt-4" data-article-replies="">
                    {t.replies.map((r) => (
                      <li key={r.id}>
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
                  ) : paused !== false ? (
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
