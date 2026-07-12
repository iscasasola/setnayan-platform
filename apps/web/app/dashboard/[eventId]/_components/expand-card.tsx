'use client';

import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * <ExpandCard> — a doorstep card that EXPANDS IN PLACE instead of navigating
 * away.
 *
 * Owner directive 2026-07-13: "when some cells are clicked on the dashboard, it
 * tends to load the whole screen instead of it expanding the place where it
 * should only load … we just want isolated loading. only those that needs to be
 * loaded." This reasserts the owner's original "does not expand and collapse"
 * note on the "Around your event" band and REVERSES the whole-card stretched-
 * link doorway shipped in PR #3188 (the Event Overview council's "depth =
 * navigation, no accordion" conclusion) — flagged in the changelog for the
 * record.
 *
 * WHY this shape gives "isolated loading":
 *   • The expanded body (`children`) is server-rendered by the parent and
 *     handed in as an already-serialized RSC node. Toggling open/closed is
 *     PURE CLIENT STATE — it mounts/unmounts content that is already in the
 *     flight payload, so there is NO navigation, NO route change, NO full-page
 *     skeleton, and NO re-fetch. The card's data was already loaded once (for
 *     its collapsed summary/count); expanding never loads it "again and again".
 *   • The whole HEADER is the toggle (large tap target). The old whole-card
 *     stretched <Link> is gone; the full-page editor stays reachable as a
 *     SECONDARY affordance (`fullHref`) at the card's foot, so deep work still
 *     has a doorway — it is no longer the only, screen-reloading option.
 *
 * A11y: real <button> with aria-expanded + aria-controls; the body region is
 * labelled by a stable useId(). Keyboard-operable for free.
 */
export function ExpandCard({
  title,
  badge,
  preview,
  children,
  fullHref,
  fullLabel = 'Open the full page',
  defaultOpen = false,
  cardClassName = 'm-card',
  hairline,
}: {
  /** Card heading, e.g. "Your team". */
  title: string;
  /** Optional count/status pill rendered next to the title. */
  badge?: ReactNode;
  /** Substantive one-glance summary shown while COLLAPSED (never a dead teaser). */
  preview?: ReactNode;
  /**
   * Full detail, server-rendered by the parent; shown IN PLACE while expanded.
   * When null/false (e.g. an empty card with nothing to reveal) the card
   * renders STATIC — no toggle, no chevron — so a click never opens onto
   * nothing.
   */
  children?: ReactNode;
  /** Secondary doorway to the full editor route (kept, but no longer the only path). */
  fullHref?: string;
  /** Label for the secondary full-page link. */
  fullLabel?: string;
  /** Start expanded (auto-density for content-rich cards). */
  defaultOpen?: boolean;
  /** The parent's computed card class (plain `m-card` or the AI-accent variant). */
  cardClassName?: string;
  /** Optional premium gold hairline node from the parent (AI state). */
  hairline?: ReactNode;
}) {
  const expandable = children != null && children !== false;
  const [open, setOpen] = useState(defaultOpen && expandable);
  const bodyId = useId();

  return (
    <article className={`${cardClassName} relative px-5 py-4`}>
      {hairline}
      {/* WAI-ARIA accordion pattern: the heading wraps the toggle button, so
       *  the control's accessible name is the card title (+ its count badge).
       *  Empty cards render a plain heading — no button, no chevron. */}
      <h3 className="mb-2">
        {expandable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 text-left"
          >
            <span className="m-serif text-[16.5px] text-ink">{title}</span>
            {badge}
            <ChevronDown
              aria-hidden
              strokeWidth={2.25}
              className={`ml-auto h-4 w-4 flex-none text-ink/40 transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : (
          <span className="flex w-full items-center gap-2.5">
            <span className="m-serif text-[16.5px] text-ink">{title}</span>
            {badge}
          </span>
        )}
      </h3>

      <div id={bodyId}>{expandable && open ? children : preview}</div>

      {fullHref ? (
        <Link
          href={fullHref}
          className="mt-2.5 inline-flex items-center gap-1 border-t border-ink/5 pt-2 text-xs font-bold text-mulberry transition-colors hover:text-mulberry-700"
        >
          {fullLabel}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
    </article>
  );
}
