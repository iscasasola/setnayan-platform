/**
 * /dev/articles-lab — the articles screens' OWN view components over the approved drawing's sample rows
 * (drawing v15 "Articles" · "An article" · "Write a post"): no sign-in, no database, nothing written. DEV-ONLY:
 * production builds do not compile `page.lab.tsx`, and the first statement 404s in production anyway.
 *
 *   ?screen=feed      the feed (Tag ▾ · Sort ▾ · Write a post) — default
 *   ?screen=article   an article: two paragraphs, a setnayan.com card, an outside link as text, four replies
 *   ?screen=write     Write a post, a first post (asks "Post as")
 *   ?screen=write-shop Write a post as a shop (no name asked — always the shop)
 *   ?screen=refused   the feed's read was refused — said, never "No posts yet"
 *   ?screen=signed-out the article, signed out ("Sign in to reply")
 */
import { notFound } from 'next/navigation';
import { ArticlesFeedView } from '@/app/(shell)/articles/_components/feed-view';
import { ArticleView } from '@/app/(shell)/articles/[slug]/article-view';
import { WriteSheet } from '@/app/(shell)/articles/_components/write-sheet';
import { LAB_ARTICLE, LAB_FEED, LAB_SIGNED_OUT, LAB_TAGS, LAB_WRITER_FIRST, LAB_WRITER_SHOP } from './fixture';

export default async function ArticlesLabPage({ searchParams }: { searchParams: Promise<{ screen?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { screen = 'feed' } = await searchParams;

  if (screen === 'article') return <ArticleView res={{ ok: true, data: LAB_ARTICLE }} writer={LAB_WRITER_FIRST} />;
  if (screen === 'signed-out') return <ArticleView res={{ ok: true, data: LAB_ARTICLE }} writer={LAB_SIGNED_OUT} />;
  if (screen === 'refused') return <ArticlesFeedView res={{ ok: false }} tag={null} sort="newest" />;
  if (screen === 'write' || screen === 'write-shop') {
    const w = screen === 'write' ? LAB_WRITER_FIRST : LAB_WRITER_SHOP;
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:px-6">
        <div>
          <WriteSheet shopName={w.signedIn ? w.shopName : null} postingName={w.signedIn ? w.postingName : null} error={null} />
        </div>
      </main>
    );
  }
  return <ArticlesFeedView res={{ ok: true, data: { articles: LAB_FEED, tags: LAB_TAGS } }} tag={null} sort="newest" />;
}
