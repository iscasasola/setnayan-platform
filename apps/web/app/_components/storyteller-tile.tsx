import Link from 'next/link';
import { Play, BookOpen } from 'lucide-react';
import { CreatorBadge } from '@/app/_components/creator-badge';
import { formatAudienceCount } from '@/lib/creator-audience';
import type { StorytellerTileItem } from '@/lib/storytellers';

/**
 * StorytellerTile — the byline-forward card for a featured creator chapter
 * (PR-D · Storytellers council verdict 2026-07-16 §3.2). Deliberately its OWN
 * tile grammar, never the editorial Chronicle nameplate:
 *
 *   • byline first — "A chapter by @slug" + the Storyteller badge (the
 *     provenance signal, extending the isSample-badge precedent);
 *   • kind chip + view count (editorial tiles NEVER show view counts;
 *     chapter tiles always may — two voices, two grammars);
 *   • YouTube-derived thumbnail hero (V1 thumbnail rule — a featured chapter
 *     always has one; the admin feature action refuses non-YouTube embeds);
 *   • links to the chapter's CANONICAL page /u/[slug]/c/[id] (noindex there;
 *     all SEO equity stays on the hub).
 *
 * ROUTE-AGNOSTIC: imports nothing from /realstories page code — reused as-is
 * by the /realstories shelf and the /v/[slug] "Featured in these stories"
 * strip, and by any future standalone /storytellers page (verdict Phase S4).
 *
 * `editorialHref` (optional) renders the cross-rail "Read the editorial" chip
 * as a SIBLING link below the card (never a nested anchor) when the chapter's
 * event also has a consented published editorial.
 */
export function StorytellerTile({
  item,
  editorialHref,
}: {
  item: StorytellerTileItem;
  editorialHref?: string | null;
}) {
  return (
    <div className="flex flex-col">
      <Link
        href={item.href}
        className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white transition-colors hover:border-terracotta/40 sm:rounded-3xl"
      >
        {/* YouTube-derived thumbnail hero (V1 rule — always present when featured). */}
        <div className="relative aspect-video w-full overflow-hidden bg-ink/5">
          {item.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            />
          ) : null}
          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            <Play aria-hidden className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
            Watch
          </span>
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-ink">
            {item.kindLabel}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
          {/* Byline first — the storyteller IS the voice. */}
          <div className="flex flex-wrap items-center gap-2">
            <CreatorBadge size="sm" />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
              A chapter by @{item.ownerSlug}
            </span>
          </div>
          <h3 className="m-serif text-[1.15rem] italic leading-snug text-ink">
            {item.title}
          </h3>
          <p className="mt-auto font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {formatAudienceCount(item.viewCount)}{' '}
            {item.viewCount === 1 ? 'view' : 'views'}
          </p>
        </div>
      </Link>

      {/* Cross-rail: this chapter's event also has a consented editorial —
          a sibling link, never a nested anchor (same rule as the Team chips). */}
      {editorialHref ? (
        <div className="mt-2 px-0.5">
          <Link
            href={editorialHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink/75 transition-colors hover:border-terracotta/40 hover:bg-white hover:text-ink"
          >
            <BookOpen aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Read the editorial
          </Link>
        </div>
      ) : null}
    </div>
  );
}
