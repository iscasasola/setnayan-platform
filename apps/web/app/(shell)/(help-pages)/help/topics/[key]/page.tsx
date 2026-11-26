import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { HELP_TOPICS, helpTopicsFor } from '@/lib/help';
import { isStoreShellRequest } from '@/lib/request-platform';
import { topicsForCoverage } from '@/lib/help-ask-core';
import { helpPlace, helpSignInDoor } from '@/lib/help/help-place';
import { routes } from '@/lib/routes';
import { HelpTopicView } from './topic-view';

/*
  ⚠ NO loading.tsx BESIDE THIS PAGE: it calls notFound() for a topic this help does not have, and a loading boundary
  commits HTTP 200 before the body runs (the soft-404 trap, see app/(shell)/help/loading.tsx — and why these pages sit in the (help-pages) group, outside that folder).
*/

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ for?: string; role?: string; refer?: string; open?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { key } = await params;
  const topic = HELP_TOPICS.find((t) => t.key === key);
  return topic
    ? {
        title: `${topic.label} · Help`,
        // Its own description, built from the topic's own answers, not the site-wide one (final check A1-161).
        description: `Setnayan help on ${topic.label.toLowerCase()}: ${topic.articles
          .slice(0, 3)
          .map((a) => a.title)
          .join(' · ')}`,
        alternates: { canonical: routes.help.topic(key) },
      }
    : { title: 'Help', robots: { index: false, follow: true } };
}

/**
 * 📗 A TOPIC — the Guide & Help drawing, screen 3 (owner "Approved" 21 Nov 2026, re-confirmed 22 Nov; corpus
 * `prototypes/guide_help_2026-11-20/index.html`): the topic's name and its one line, its GUIDES on top (rows in one
 * white card, `lib/help/guides.ts`), then its ANSWERS, one open at a time, each with Take me there and Did this answer
 * it? (the 13 Nov parts, `help-ask-view.tsx`). It replaces the 13 Nov full-screen topic tile.
 *
 * Only a topic of THIS help opens (coverage = the active account, `lib/help/help-place.ts`); any other is a 404, never
 * another account's answers. The answers are read from `lib/help.ts` through its exports — nothing here writes one.
 */
export default async function HelpTopicPage({ params, searchParams }: Props) {
  const [{ key }, search, user, storeShell] = await Promise.all([params, searchParams, getCurrentUser(), isStoreShellRequest()]);
  const place = helpPlace(search, Boolean(user && !user.is_anonymous));
  // This help's topic, as written; the view picks the reader's words (the iPhone app's own). A topic whose every answer
  // is about a part the app does not include is not in the app's help — a 404 there, as on /help's list.
  const topic = topicsForCoverage(HELP_TOPICS, place.coverage).find((t) => t.key === key);
  if (!topic) {
    // 🚪 Signed out, an account's topic opens a sign-in door that comes back here (final check A1-081).
    const accountHas = (['user', 'supplier'] as const).some((c) => topicsForCoverage(HELP_TOPICS, c).some((t) => t.key === key));
    if (place.coverage === 'public' && accountHas) redirect(helpSignInDoor(routes.help.topic(key), search));
    notFound();
  }
  if (helpTopicsFor([topic], storeShell).length === 0) notFound();

  return <HelpTopicView place={place} topic={topic} storeShell={storeShell} open={typeof search.open === 'string' ? search.open : null} />;
}
