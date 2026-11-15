import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isPausedFromArticles, listArticleTopics, readArticleThread, viewerLabelInTopic } from '@/lib/articles.server';
import { articleEventChoices } from '../_components/articles-viewer';
import { ThreadView } from '../_components/thread-view';

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
    <ThreadView
      topicId={topicId}
      read={read}
      eventLabel={label}
      list={list}
      signedIn={signedIn}
      paused={paused !== false}
      postAs={postAs}
    />
  );
}
