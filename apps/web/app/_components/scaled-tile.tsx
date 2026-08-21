import Link from 'next/link';
import { Play } from 'lucide-react';

import { weighYearWithFloor, type ChapterWeight } from '@/lib/chapter-weight';

/**
 * ScaledTile — one item, at the size its own contents earn.
 *
 * ── WHY THIS IS A SHARED COMPONENT AND NOT A PAGE'S PRIVATE MARKUP ──────────
 * A site audit on 2026-08-21 judged every customer-facing surface against the
 * person's page and reached the same conclusion twice, independently:
 *
 *   *"The three-size system exists in exactly ONE file — 484 lines of styling
 *    pasted inside the person page itself, and the three size names appear
 *    nowhere else in the codebase. Nothing can reuse it. That is why the site
 *    does not match it — not because anyone disagreed with it."*
 *
 * The measured reason nothing improves page-by-page: **there is no shared card
 * in this product.** 106 separate card files, and 717 more files hand-drawing
 * the same shape. One edit fixes one page. This is the piece that changes that.
 *
 * ── THE RULE IT CARRIES ─────────────────────────────────────────────────────
 * An item with a picture AND writing takes the width. An item with one of them
 * takes a strip. An item with neither takes a line. The size is DERIVED from
 * what the item holds (lib/chapter-weight.ts) — never chosen by hand, because
 * the two publications measured with the least per-item authoring both
 * abandoned variation entirely rather than art-direct each item, and a rule
 * that needs a person to say "this one is big" stops happening in week two.
 *
 * 🔑 NO PICTURE MEANS NO PICTURE-SHAPED HOLE. When there is no image the frame
 * element is not rendered at all — the item is SMALLER, not empty. The audit
 * found six blank bordered frames on the page selling photography and called
 * them worse than nothing; this component makes that shape impossible.
 *
 * ⚖ IT CARRIES NO SUBJECT-MATTER OPINION. Nothing here knows about chapters,
 * celebrations, vendors or articles — callers translate their own rows into
 * `ScaledItem`. That is what lets the stories shelf, the marketplace, a shop
 * page and a couple's page all use it without any of them teaching it their
 * vocabulary.
 */

export type ScaledItem = {
  /** Stable key. */
  id: string;
  href: string;
  title: string;
  /** Small caps line above the title — "Chapter 2 · Wedding · 12 August". */
  kicker?: string | null;
  /** One sentence. NEVER an essay: the lead slot is built for somebody with two
   *  sentences and four hundred photographs. Callers truncate. */
  excerpt?: string | null;
  /** An already-displayable URL. Absent ⇒ this item renders smaller. */
  imageUrl?: string | null;
  /** e.g. "412 photos". Rendered only when there is an image to put it on. */
  imageNote?: string | null;
  /** Shows a play affordance over the image. */
  hasVideo?: boolean;
  /** The line item's left column, and the fallback when there is no excerpt. */
  meta?: string | null;
  /** What the lead's call to action says. */
  cue?: string | null;
};

/** The two facts the size is derived from — nothing else. */
function factsOf(item: ScaledItem) {
  return {
    hasPicture: !!item.imageUrl,
    hasWriting: !!(item.excerpt && item.excerpt.trim().length > 0),
  };
}

export function ScaledTile({
  item,
  weight,
}: {
  item: ScaledItem;
  weight: ChapterWeight;
}) {
  if (weight === 'line') {
    return (
      <li className="sn-line">
        <Link href={item.href} className="sn-line-a">
          <span className="sn-line-d">{item.meta ?? ''}</span>
          <span className="sn-line-t">{item.title}</span>
        </Link>
      </li>
    );
  }

  if (weight === 'lead') {
    return (
      <li className="sn-lead">
        <Link href={item.href} className="sn-lead-a">
          {item.imageUrl ? (
            <span className="sn-shot sn-lead-shot">
              {/* A dead or expired image cannot be detected server-side without
                  a fetch, so the frame carries its own ground and the img an
                  empty alt: it degrades to a neutral panel, never a broken
                  glyph. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="sn-shot-img"
              />
              {item.imageNote ? <span className="sn-shot-note">{item.imageNote}</span> : null}
              {item.hasVideo ? (
                <span aria-hidden className="sn-shot-play">
                  <Play className="sn-shot-play-i" fill="currentColor" strokeWidth={0} />
                </span>
              ) : null}
            </span>
          ) : null}
          <span className="sn-lead-b">
            {item.kicker ? <span className="sn-kick">{item.kicker}</span> : null}
            <span className="sn-lead-t">{item.title}</span>
            {item.excerpt ? <span className="sn-lead-x">{item.excerpt}</span> : null}
            {item.cue ? <span className="sn-cue">{item.cue} &rarr;</span> : null}
          </span>
        </Link>
      </li>
    );
  }

  return (
    <li className="sn-med">
      <Link href={item.href} className="sn-med-a">
        {item.imageUrl ? (
          <span className="sn-shot sn-med-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="sn-shot-img"
            />
          </span>
        ) : null}
        <span className="sn-med-b">
          {item.kicker ? <span className="sn-kick">{item.kicker}</span> : null}
          <span className="sn-med-t">{item.title}</span>
          {item.excerpt ? (
            <span className="sn-med-x">{item.excerpt}</span>
          ) : item.meta ? (
            <span className="sn-med-x">{item.meta}</span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

/**
 * A group of items, each at the size it earns.
 *
 * ⚠ ORDER MATTERS AND IS THE CALLER'S. The first item eligible for the lead
 * takes it — a group has at most one, because two full-width blocks side by
 * side is the layout saying scale means nothing. Hand items over in the order
 * they should be read.
 */
export function ScaledTileList({
  items,
  className,
}: {
  items: readonly ScaledItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  const weights = weighYearWithFloor(items.map(factsOf));
  return (
    <ol className={className ?? 'sn-scaled'}>
      {items.map((item, i) => (
        <ScaledTile key={item.id} item={item} weight={weights[i] ?? 'line'} />
      ))}
    </ol>
  );
}
