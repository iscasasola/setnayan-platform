/**
 * /dev/articles-lab — ARTICLES on fixture data: no sign-in, no database.
 * DEV-ONLY: production builds never compile this file (`.lab.tsx`), and it 404s first thing if they ever did
 * (`the-lab-never-ships.test.ts`). Draws the REAL list (`TopicList` + `ArticlesFilters` + `NewTopic`) and the REAL
 * thread (`ThreadView`) that /articles and /articles/<topic> draw. Topics and names are the prototype's samples.
 *
 *   ?screen=list       the topic list (signed in)
 *   ?screen=thread     a topic and its replies (signed in), one reply removed by Setnayan
 *   ?screen=signedout  the same topic by its exact link, signed out (read-only)
 *   ?screen=empty      the list when the read was refused (never "No topics yet")
 */
import { notFound } from 'next/navigation';

export default async function ArticlesLabPage({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { screen } = await searchParams;
    const { ArticlesLab } = await import('./lab-view');
    return <ArticlesLab screen={screen ?? 'list'} />;
  }
}
