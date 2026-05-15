import { deriveMonogram, resolveMonogram } from '@/lib/monogram';

/**
 * Circular monogram badge — iteration 0000 § event switcher (locked 2026-05-15).
 *
 * Renders the per-event monogram as the left-anchor of the dashboard chrome.
 * The text falls back to the derived monogram from `display_name` when the
 * couple has not set `events.monogram_text` yet (V1 scope is text-only — SVG
 * upload arrives with the Monogram Hero upgrade in iteration 0004).
 *
 * The pure presentational shape — no Link, no long-press — keeps it reusable
 * from both the outer dashboard chrome and the per-event header.
 */

type Event = {
  display_name: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
};

type Size = 'sm' | 'md';

const SIZE_TOKENS: Record<Size, { box: string; text: string }> = {
  sm: { box: 'h-7 w-7', text: 'text-[10px]' },
  md: { box: 'h-9 w-9', text: 'text-xs' },
};

export function EventMonogram({
  event,
  size = 'md',
  className,
}: {
  event: Event;
  size?: Size;
  className?: string;
}) {
  const { text, color } = resolveMonogram({
    display_name: event.display_name,
    monogram_text: event.monogram_text,
    monogram_color: event.monogram_color,
  });
  const { box, text: textSize } = SIZE_TOKENS[size];

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-cream font-serif italic font-semibold ${box} ${textSize} ${
        className ?? ''
      }`.trim()}
      style={{ color, borderColor: color }}
    >
      {text}
    </span>
  );
}

/**
 * Empty-state "+" monogram — iteration 0000 § event switcher. Rendered when
 * the user has zero events and is therefore on the create-event empty state.
 */
export function EmptyEventMonogram({
  size = 'md',
  className,
}: {
  size?: Size;
  className?: string;
}) {
  const { box, text } = SIZE_TOKENS[size];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-terracotta/50 bg-cream font-semibold text-terracotta ${box} ${text} ${
        className ?? ''
      }`.trim()}
    >
      +
    </span>
  );
}

// Re-export deriveMonogram so callers don't have to import from two places
// when they just want the default label.
export { deriveMonogram };
