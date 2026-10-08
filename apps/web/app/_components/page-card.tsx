'use client';

import type { ReactNode } from 'react';
import { Explain } from './explain';

/**
 * PAGE CARD — the door to a page; it reads and presses like an app button (`INTERACTION_RULES.md` § 9, kind 4;
 * approved gallery `prototypes/control_templates_2026-10-08.html` § 4).
 *
 * Owner, 2026-10-08: *"we can improve the page card as well. how they can be presented — Logo / Topic / Description
 * and a small (i) that will give a more detailed explanation"* · *"Improve Page Card so it looks like an app button
 * that feels consistent with our design"*.
 *
 *   · THE MARK is an app-icon tile in the app's accent, its picture in the ink that reads on it — one distinct mark a
 *     page (the caller's icon);
 *   · THE TOPIC — the page's name — and ONE plain line saying what is done there;
 *   · THE ⓘ is its OWN 44-px button BESIDE the card's button, never inside it (a button inside a button is not valid,
 *     and its tap would open the page): it opens the explanation (`Explain` — a centred popup with "Got it" on a
 *     phone, a note under it on a computer; one open at a time);
 *   · A PRESS answers at once: the app's one press (`PressFeel`) dips the card's button and rings it on pointer-down;
 *   · a small quiet TAG after the topic ("Full screen") and a state BADGE with its word (Ready · Missing) — a state
 *     is never colour alone;
 *   · a fact that could not be read is SAID on the card, in place of the line.
 *
 * Neutral: it knows no screen, and writes no colour for the accent (`sn-accent` only).
 */
export type PageCardBadge = { tone: 'ok' | 'wait'; word: string };

const BADGE: Record<PageCardBadge['tone'], string> = {
  ok: 'bg-success-100 text-success-700',
  wait: 'bg-warn-100 text-warn-700',
};

export function PageCard({
  mark,
  topic,
  description,
  about,
  tag = null,
  badge = null,
  problem = null,
  onOpen,
  attrs,
  data,
}: {
  /** The page's mark — an icon; the tile sizes and colours it. */
  mark: ReactNode;
  /** The page's name. */
  topic: string;
  /** ONE plain line: what is done on this page. */
  description: string;
  /** The ⓘ: its popup's words (and heading, when it is not the topic). */
  about: { title?: string; words: ReactNode };
  /** A small quiet tag after the topic — "Full screen". */
  tag?: string | null;
  /** The page's state, with its word. */
  badge?: PageCardBadge | null;
  /** Said in place of the line when the page's fact could not be read. */
  problem?: string | null;
  onOpen: () => void;
  /** The screen's own `data-*` hooks on the card's button. */
  attrs?: Readonly<Record<`data-${string}`, string>>;
  /** `data-page-card="<data>"`. */
  data?: string;
}) {
  return (
    <div
      data-page-card={data ?? ''}
      className="relative flex items-stretch gap-0.5 rounded-2xl bg-white shadow-[inset_0_1px_0_rgb(255_255_255/.9),0_8px_18px_-12px_rgb(var(--color-ink)/.35)] ring-1 ring-ink/10"
    >
      <button type="button" {...attrs} data-page-card-open="" onClick={onOpen} className="sn-press sn-press-ring flex min-h-[76px] min-w-0 flex-1 items-center gap-3.5 rounded-2xl py-3 pl-3 pr-1 text-left">
        <span
          aria-hidden
          data-page-card-mark=""
          className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-xl bg-sn-accent bg-gradient-to-br from-white/20 to-black/10 text-sn-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_4px_10px_-4px_rgb(var(--sn-accent)/.6)] [&>svg]:h-[26px] [&>svg]:w-[26px]"
        >
          {mark}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <b data-page-card-topic="" className="text-[16px] font-semibold leading-tight text-ink">
              {topic}
            </b>
            {tag ? (
              <span data-page-card-tag="" className="whitespace-nowrap rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-[0.12em] text-ink/55 ring-1 ring-ink/15">
                {tag}
              </span>
            ) : null}
            {badge ? (
              <span data-page-card-badge={badge.tone} className={`whitespace-nowrap rounded-full px-2 py-px text-[10.5px] font-bold ${BADGE[badge.tone]}`}>
                {badge.word}
              </span>
            ) : null}
          </span>
          {problem ? (
            <span data-page-card-problem="" className="mt-0.5 block text-[12.5px] font-semibold leading-snug text-danger-700">
              {problem}
            </span>
          ) : (
            <span data-page-card-line="" className="mt-0.5 block text-[12.5px] leading-snug text-ink/70">
              {description}
            </span>
          )}
        </span>
      </button>
      {/* Its own target, beside the card's button — the explanation never opens the page. */}
      <Explain title={about.title ?? topic} className="self-center">
        {about.words}
      </Explain>
    </div>
  );
}
