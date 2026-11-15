import { redirect } from 'next/navigation';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { listArticleTopics, type ArticleSort } from '@/lib/articles.server';
import { ArticlesFilters } from '../_components/articles-filters';
import { TopicList } from '../_components/topic-list';
import { NewTopic } from '../_components/article-composer';
import { articleEventChoices, newTopicViewer } from '../_components/articles-viewer';

/**
 * /articles — ARTICLES: topics people start and talk in.
 *
 * Contract: DECISION_LOG 2026-11-16 (specs repo) — "a place where people can
 * discuss and create topics inside like reddit", "purely public use", links only
 * to setnayan.com, anonymous to readers and known to Setnayan — and the approved
 * prototype `prototypes/articles_2026-11-16/` ("1a 2a 3a").
 *
 * 🔒 THE LIST IS INSIDE THE ACCOUNT. "Discover happens inside the account"
 * (41057aae), and the Articles ruling (3): "a topic's exact link opens read-only
 * when signed out; the topic list stays inside the account". So a signed-out
 * visitor is sent to sign in and brought back here; only `/articles/<topic>`
 * opens signed out. Held by `articles-the-list-is-inside-the-account.test.ts`.
 *
 * Desktop (≥1024): the list on the left, the open topic on the right — the
 * topic page draws both; this page draws the list and a quiet right pane.
 */

export const metadata = {
  title: 'Articles',
  description: 'Topics people start and talk in, on Setnayan.',
  robots: { index: false, follow: false },
};

function parseSort(raw: string | undefined): ArticleSort {
  return raw === 'replies' ? 'replies' : 'newest';
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; event?: string; sort?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/articles'));

  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 80);
  const sort = parseSort(sp.sort);
  const [{ events, label }, viewer] = await Promise.all([articleEventChoices(), newTopicViewer(user.id)]);
  const eventType = events.some((e) => e.key === sp.event) ? (sp.event as string) : '';
  const read = await listArticleTopics({ q, eventType: eventType || null, sort });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8">
      <section aria-labelledby="articles-h1" className="space-y-3">
        <h1 id="articles-h1" className="text-2xl font-semibold text-ink">
          Articles
        </h1>
        <ArticlesFilters q={q} eventType={eventType} sort={sort} events={events} />
        <TopicList read={read} eventLabel={label} filtered={Boolean(q || eventType)} />
      </section>
      <aside aria-hidden className="hidden lg:flex lg:items-center lg:justify-center lg:rounded-2xl lg:bg-ink/[0.03] lg:text-sm lg:text-ink/60">
        Pick a topic to read it here.
      </aside>
      <NewTopic postAs={viewer.postAs} events={events} paused={viewer.paused} />
    </main>
  );
}
