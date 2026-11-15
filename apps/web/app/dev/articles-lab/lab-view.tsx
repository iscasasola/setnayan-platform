import { TopicList } from '@/app/(shell)/articles/_components/topic-list';
import { ArticlesFilters } from '@/app/(shell)/articles/_components/articles-filters';
import { NewTopic } from '@/app/(shell)/articles/_components/article-composer';
import { ThreadView } from '@/app/(shell)/articles/_components/thread-view';
import type { ArticleRead, ArticleThread, ArticleTopicCard } from '@/lib/articles.server';

/** Fixture data — the prototype's samples (prototypes/articles_2026-11-16/). Times are relative to the render. */
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const EVENTS = [
  { key: 'wedding', label: 'Wedding' },
  { key: 'debut', label: 'Debut' },
  { key: 'christening', label: 'Christening' },
];
const label = (k: string | null) => EVENTS.find((e) => e.key === k)?.label ?? null;
const ID = 'S89A-0FIRST00LK';
const TOPICS: ArticleTopicCard[] = [
  { publicId: ID, title: 'Is a first look worth it?', eventType: 'wedding', replyCount: 24, createdAt: ago(120), lastActivityAt: ago(40) },
  { publicId: 'S89A-0CATERER01', title: 'How early did you book your caterer?', eventType: 'wedding', replyCount: 41, createdAt: ago(300), lastActivityAt: ago(60) },
  { publicId: 'S89A-0DEBUT0001', title: 'Debut ideas that are not 18 roses', eventType: 'debut', replyCount: 12, createdAt: ago(1440), lastActivityAt: ago(200) },
  { publicId: 'S89A-0COORD0001', title: 'What do you wish your coordinator did?', eventType: 'wedding', replyCount: 57, createdAt: ago(2880), lastActivityAt: ago(300) },
  { publicId: 'S89A-0CHRIST001', title: 'Christening at home or at a venue?', eventType: 'christening', replyCount: 8, createdAt: ago(4320), lastActivityAt: ago(900) },
];
const LIST: ArticleRead<ArticleTopicCard[]> = { ok: true, value: TOPICS };
const THREAD: ArticleRead<ArticleThread | null> = {
  ok: true,
  value: {
    publicId: ID,
    title: 'Is a first look worth it?',
    eventType: 'wedding',
    removed: false,
    replyCount: 3,
    opening: {
      id: ID,
      label: 'Guest · 3F',
      body: 'We’re split. Did a first look change your day, or take something away?',
      createdAt: ago(120),
      removed: false,
      mine: false,
    },
    replies: [
      { id: 'r1', label: 'Guest · A7', body: 'We did it and the photos were the best of the day. Ask your photographer how long it adds.', createdAt: ago(110), removed: false, mine: false },
      { id: 'r2', label: 'Supplier · K2', body: 'Our coordinator built it into the timeline. Here’s the story that sold us on it: setnayan.com/v/tala-studio', createdAt: ago(60), removed: false, mine: false },
      { id: 'r3', label: 'Guest · M4', body: 'Removed by Setnayan — it broke the house rules.', createdAt: ago(50), removed: true, mine: false },
      { id: 'r4', label: 'Guest · 3F', body: 'Thank you both — that story helps.', createdAt: ago(40), removed: false, mine: false },
    ],
  },
};

export function ArticlesLab({ screen }: { screen: string }) {
  if (screen === 'thread' || screen === 'signedout') {
    const signedIn = screen === 'thread';
    return (
      <ThreadView
        topicId={ID}
        read={THREAD}
        eventLabel={label}
        list={signedIn ? LIST : null}
        signedIn={signedIn}
        paused={false}
        postAs="Guest · 3F"
      />
    );
  }
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold text-ink">Articles</h1>
        <ArticlesFilters q="" eventType="" sort="newest" events={EVENTS} />
        <TopicList read={screen === 'empty' ? { ok: false } : LIST} eventLabel={label} filtered={false} />
      </section>
      <aside aria-hidden className="hidden lg:flex lg:items-center lg:justify-center lg:rounded-2xl lg:bg-ink/[0.03] lg:text-sm lg:text-ink/60">
        Pick a topic to read it here.
      </aside>
      <NewTopic postAs="Guest · 3F" events={EVENTS} paused={false} />
    </main>
  );
}
