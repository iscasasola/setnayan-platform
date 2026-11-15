import Link from 'next/link';
import { relativeTime } from '@/lib/activity';
import { formatCount } from '@/lib/format-number';
import type { ArticleRead, ArticleTopicCard } from '@/lib/articles.server';

/**
 * The topic rows (prototype screen 1): title · "Wedding · 24 replies · 2h" ·
 * the count on the right. 🔑 A refused read says so — it never draws "No topics
 * yet" (the same disease the guest list once had: an error that looked exactly
 * like an empty room).
 */
export function TopicList({
  read,
  eventLabel,
  activeId,
  filtered,
}: {
  read: ArticleRead<ArticleTopicCard[]>;
  eventLabel: (key: string | null) => string | null;
  activeId?: string;
  filtered: boolean;
}) {
  if (!read.ok) {
    return (
      <p role="alert" data-articles-read-failed="" className="rounded-xl bg-terracotta/5 px-4 py-3 text-sm text-terracotta-800">
        We couldn’t load the topics just now. Please try again in a moment.
      </p>
    );
  }
  if (read.value.length === 0) {
    return (
      <p className="px-1 py-6 text-sm text-ink/70">
        {filtered ? 'No topics match that yet.' : 'No topics yet. Start the first one with New topic.'}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-ink/10" data-articles-list="">
      {read.value.map((t) => {
        const ev = eventLabel(t.eventType);
        const replies = `${formatCount(t.replyCount)} ${t.replyCount === 1 ? 'reply' : 'replies'}`;
        return (
          <li key={t.publicId}>
            <Link
              href={`/articles/${t.publicId}`}
              aria-current={activeId === t.publicId ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 px-1 py-3 hover:bg-ink/[0.03] ${activeId === t.publicId ? 'bg-ink/[0.05]' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{t.title}</span>
                <span className="block text-xs text-ink/70">
                  {[ev, replies, relativeTime(t.createdAt)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span
                aria-hidden
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-ink/[0.06] px-2 text-xs font-semibold tabular-nums text-ink/80"
              >
                {formatCount(t.replyCount)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
