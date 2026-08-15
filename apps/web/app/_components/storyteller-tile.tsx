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
 *   • hero — the YouTube-derived thumbnail when the chapter has a YouTube
 *     video, otherwise a TYPOGRAPHIC hero carrying the story's opening line.
 *     A chapter told in writing has no video to derive a poster from, and used
 *     to be dropped from the shelf entirely (owner 2026-08-12 opened chapters
 *     to editorial-first storytelling);
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
      {/* ⚠ THIS WAS ONE <Link> WRAPPING THE WHOLE CARD, AND IS NOW A SHELL.
          The byline below is a second anchor — to the storyteller's own page —
          and an <a> inside an <a> is invalid HTML that browsers recover from by
          SPLITTING the outer link, silently breaking the card's own tap target.
          Nothing in CI catches a nested anchor (`lint-nested-forms.mjs` counts
          <form> depth only), so the structure is the only guard. The card's
          press target moved onto the TITLE, whose `after:inset-0` overlay
          covers the shell — so the poster and the title still open the chapter,
          and the accessible name is the visible title rather than a duplicated
          aria-label. `relative` here is what that overlay is measured against;
          `overflow-hidden` clips it to the card. */}
      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white transition-colors hover:border-terracotta/40 sm:rounded-3xl">
        {/* HERO — two grammars, decided by what the chapter actually IS.
            With a YouTube video: the derived thumbnail + "Watch".
            Told in writing: a typographic hero carrying the opening line +
            "Read". A written story is not a video with a missing image, so it
            never renders an empty grey box with a Watch chip over it. */}
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
          ) : (
            <div className="absolute inset-0 flex items-end bg-gradient-to-br from-cream via-cream to-terracotta/10 p-4 pb-11 sm:p-5 sm:pb-12">
              {/* pb-11/pb-12 clears the absolutely-positioned Watch/Read pill,
                  which is painted after this block and would otherwise sit on
                  top of the excerpt's last line. */}
              <p className="m-serif line-clamp-3 text-[0.95rem] italic leading-snug text-ink/70">
                {/* TERMINAL FALLBACK. With neither a thumbnail nor an excerpt
                    this hero used to render as a blank gradient box — no image,
                    no text, nothing. A chapter can reach that state legitimately
                    (a very short story, or one whose first paragraph is
                    whitespace), so the kind is the floor, never nothing. */}
                {item.excerpt ?? `A ${item.kindLabel.toLowerCase()} story`}
              </p>
            </div>
          )}
          <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            {/* Keyed on hasVideo, NOT thumbUrl. Only YouTube yields a
                derivable thumbnail, so an Instagram or TikTok chapter has a
                real video and no thumb — keying on the image labelled those
                "Read" and put a book icon on a video. */}
            {item.hasVideo ? (
              <>
                <Play aria-hidden className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
                Watch
              </>
            ) : (
              <>
                <BookOpen aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
                Read
              </>
            )}
          </span>
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-ink">
            {item.kindLabel}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
          {/* Byline first — the storyteller IS the voice, and now the door to
              them. `relative z-20` lifts it above the title's stretched
              overlay; without it the handle is still underlined, still blue-
              adjacent, still announced as a link, and completely unpressable.
              ⚠ text-ink/55 → /70 is a deliberate contrast step, not a restyle:
              on the card's white ground /55 measures ~3.5:1, below the 4.5:1
              floor, and this is now an interactive control rather than a
              caption. /70 measures ~5.3:1. */}
          <div className="relative z-20 flex flex-wrap items-center gap-2">
            <CreatorBadge size="sm" />
            <Link
              href={`/u/${item.ownerSlug}`}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/70 underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:text-ink focus-visible:underline"
            >
              A chapter by @{item.ownerSlug}
            </Link>
          </div>
          <h3 className="m-serif text-[1.15rem] italic leading-snug text-ink">
            {/* The card's press target. `after:inset-0` stretches it over the
                shell, so the poster and the title both still open the chapter
                and the accessible name is the title itself. */}
            <Link href={item.href} className="after:absolute after:inset-0 after:z-10">
              {item.title}
            </Link>
          </h3>
          <p className="mt-auto font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {formatAudienceCount(item.viewCount)}{' '}
            {item.viewCount === 1 ? 'view' : 'views'}
          </p>
        </div>
      </div>

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
