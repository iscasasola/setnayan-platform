import { StorytellerTile } from '@/app/_components/storyteller-tile';
import type { StorytellerTileItem } from '@/lib/storytellers';

/**
 * StorytellersShelf — "From Our Storytellers" on /realstories (PR-D · council
 * verdict 2026-07-16 §3.2). Sits BELOW the editorial cascade (the Chronicle
 * tiles — untouched), rendering ONLY owner-featured chapters in the
 * byline-forward Storyteller tile grammar.
 *
 * THE SELF-GATE: with ZERO featured chapters this renders NOTHING — not even
 * a heading. No dead shelf, no "coming soon", no chapter-sample mechanism
 * ever. That empty-return is what keeps the whole PR dark until the owner's
 * first Feature click in /admin/studio.
 *
 * The anchor id `storytellers` is the /storytellers redirect target
 * (/realstories#storytellers) — the speakable word with zero second page.
 * `editorialHrefByEvent` is composed by the PAGE (which already loads the
 * consented showcases) — this component and its tile/loader modules import
 * nothing from the page code (route-agnostic build rule).
 */
export function StorytellersShelf({
  items,
  editorialHrefByEvent,
}: {
  items: StorytellerTileItem[];
  editorialHrefByEvent?: ReadonlyMap<string, string>;
}) {
  if (items.length === 0) return null;

  return (
    <section id="storytellers" aria-label="From Our Storytellers" className="mt-14 scroll-mt-24 sm:mt-16">
      <div className="mb-4 max-w-2xl space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          From Our Storytellers
        </h2>
        <p className="text-sm text-ink/60">
          Chapters told first-hand by the people who lived them — their own
          finished edit, embedded from their own channel, with the real vendors
          and moments behind it.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <StorytellerTile
            key={it.publicId}
            item={it}
            editorialHref={
              it.eventId ? editorialHrefByEvent?.get(it.eventId) ?? null : null
            }
          />
        ))}
      </div>
    </section>
  );
}
