import { StoryCard } from '@/app/blog/_components/story-card';
import type { BlogArticle } from '@/lib/blog';

/**
 * JournalRail — "From our articles" on /realstories (Warm Editorial port E4 ·
 * FABLE Public Marketplace spec § 3.3, state § 4.B item 6).
 *
 * Frame 4e wanted the Journal folded INTO the stories grid as one publication.
 * Merging the two would erase the two-voice shelf grammar the council locked,
 * so the same intent lands as a clearly LABELLED rail underneath: these are
 * guides, not somebody's story, and the label says so before the first card.
 *
 * IT RENDERS A REAL JOURNAL CARD. `StoryCard` is imported from the Journal
 * index's own folder, not re-drawn here — the serif, radius, meta line and
 * hover all travel with the Journal content by construction, and there is no
 * second copy to drift.
 *
 * THE SELF-GATE: fewer than 2 published articles ⇒ this renders NOTHING — no
 * heading, no eyebrow, no empty shell. Same shape as StorytellersShelf's
 * zero-return. A rail of one is a rail that looks broken.
 *
 * FAILED READ vs GENUINE ZERO — there is no read. `publishedBlogArticles()` is
 * a filter over an in-code constant (lib/blog.ts): no database, no network, no
 * `{ error }` to swallow. It either returns an array or the module never
 * imported, which is a build failure and not a runtime state. So this component
 * deliberately has NO try/catch and NO "articles coming soon" branch — either
 * would manufacture a failure mode that cannot occur and would make the one
 * real zero (every article still future-dated) read as an outage.
 *
 * NOT in the page's JSON-LD. The /realstories ItemList is editorial-only on
 * purpose; listing Journal URLs there would advertise planning guides as real
 * stories in structured data.
 */
export function JournalRail({ articles }: { articles: BlogArticle[] }) {
  if (articles.length < 2) return null;

  return (
    <section aria-label="From our articles" className="mt-14 sm:mt-16">
      <div className="mb-4 max-w-2xl space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta-700">
          From our articles
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Practical guides for planning your own.
        </h2>
      </div>
      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-3">
        {articles.map((a) => (
          <StoryCard key={a.slug} article={a} />
        ))}
      </div>
    </section>
  );
}
