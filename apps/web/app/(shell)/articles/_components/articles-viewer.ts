import 'server-only';
import { getEventTypeVocab } from '@/lib/event-types-db';
import {
  articleAuthorKind,
  articleLabel,
  isPausedFromArticles,
  randomArticleCode,
} from '@/lib/articles.server';
import type { EventChoice } from './article-composer';

/** The shipped event-type roster (`event_type_vocab`, active rows) as the Event ▾ choices. */
export async function articleEventChoices(): Promise<{
  events: EventChoice[];
  label: (key: string | null) => string | null;
}> {
  const vocab = await getEventTypeVocab();
  const events = vocab.map((v) => ({ key: v.key, label: v.label }));
  const byKey = new Map(events.map((e) => [e.key, e.label]));
  return { events, label: (key) => (key ? byKey.get(key) ?? null : null) };
}

/**
 * What the signed-in viewer needs to start a topic: the label they will post
 * under in a NEW topic ("Guest · 3F" / "Supplier · 7K") and whether they are
 * paused. An unreadable kind or pause reads as paused here — the write route
 * refuses in that case too, so the form never promises a post that won't land.
 */
export async function newTopicViewer(userId: string): Promise<{ postAs: string; paused: boolean }> {
  const [kind, paused] = await Promise.all([articleAuthorKind(userId), isPausedFromArticles(userId)]);
  return {
    postAs: articleLabel(kind ?? 'guest', randomArticleCode(2)),
    paused: kind === null || paused !== false,
  };
}
