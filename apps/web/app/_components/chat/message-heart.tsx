'use client';

import { heartChip } from '@/lib/chat-hearts';

/**
 * ♥ THE HEART UNDER A BUBBLE (THE ONE BUILD, v111 "tap = heart"). Tapping the BUBBLE toggles your heart (the stream
 * owns that tap); this chip is the same toggle as a real, named button — so it works from a keyboard and a screen reader
 * — and shows the count: nothing at 0 (the button is still there for the keyboard, visually hidden), "♥" at 1, "♥ N"
 * from 2. Filled when YOUR heart is on. Nothing here makes a message a decision.
 */
export function MessageHeart({
  count,
  mine,
  onToggle,
  alignEnd,
}: {
  count: number;
  /** Your own heart is on. */
  mine: boolean;
  onToggle: () => void;
  /** Under your own bubble (right-aligned). */
  alignEnd: boolean;
}) {
  const chip = heartChip(count);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={mine}
      aria-label={mine ? 'Take your heart back' : 'Heart this message'}
      data-chat-heart={count}
      className={
        chip
          ? `-mt-1.5 inline-flex min-h-6 items-center rounded-full border px-1.5 text-[12px] leading-5 shadow-sm ${
              alignEnd ? 'mr-1 self-end' : 'ml-[38px]'
            } ${mine ? 'border-terracotta/40 bg-white text-terracotta-700' : 'border-ink/10 bg-white text-ink/60'}`
          : 'sr-only focus:not-sr-only focus:inline-flex focus:min-h-6 focus:rounded-full focus:border focus:px-1.5'
      }
    >
      {chip ?? '♥'}
    </button>
  );
}
