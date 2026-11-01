import { Star } from 'lucide-react';

/**
 * Pro + Ultra — the shop's pinned best review, in the card column (supplier website by plan, owner-approved
 * 2026-10-30; "universal" calling card 2026-09-10). The same review the shop pinned in My Shop › Website, which also
 * still leads the Reviews list below; this is its first words beside the facts. Not framed: nothing here is pressed.
 */
export function PinnedReviewCard({
  quote,
  stars,
  author,
  when,
}: {
  quote: string;
  stars: number | null;
  author: string;
  when: string | null;
}) {
  return (
    <figure data-shop-pinned-review="" className="space-y-1 border-l-2 border-terracotta/40 pl-3">
      <blockquote className="font-serif text-base italic leading-snug text-ink/85">“{quote}”</blockquote>
      <figcaption className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink/55">
        {stars !== null ? (
          <span className="inline-flex items-center gap-0.5" aria-label={`${stars} of 5 stars`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                aria-hidden
                className={`h-3 w-3 ${i < Math.round(stars) ? 'fill-warn-400 text-warn-500' : 'text-ink/25'}`}
                strokeWidth={1.75}
              />
            ))}
          </span>
        ) : null}
        <span>{author}</span>
        {when ? <span>· {when}</span> : null}
        <a href="#reviews" className="inline-flex min-h-[44px] items-center text-link hover:underline">
          · All reviews
        </a>
      </figcaption>
    </figure>
  );
}
