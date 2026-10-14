import { formatCentavos } from '@/lib/vendor-proposals';

/** A line as both callers hold it — the stream's stored row (label may be null) and the builder's composed one. */
export type QuoteCardLine = { label: string | null; detail?: string | null; amount_centavos: number | null };

/**
 * THE LINES ON A QUOTE CARD IN THE CONVERSATION — the first five, then "+ N more in the full quote".
 *
 * One component for both ends of the same card: the stream draws it on every quote the couple and the supplier read
 * (`chat-message-stream.tsx`), and the supplier's quote screen draws it under "As they see it" (`proposal-maker.tsx`,
 * simpler supplier dashboard step 4) — so the preview is the shipped card's own markup, never a redrawing of it.
 */
export function QuoteCardLines({ items }: { items: readonly QuoteCardLine[] }) {
  const shown = items.filter((li) => li.label?.trim());
  if (shown.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 border-t border-terracotta/20 pt-2 text-xs text-ink/70">
      {shown.slice(0, 5).map((li, i) => (
        <li key={i} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">
            {li.label}
            {li.detail ? <span className="text-ink/45"> · {li.detail}</span> : null}
          </span>
          <span className="shrink-0 tabular-nums">
            {typeof li.amount_centavos === 'number' ? formatCentavos(li.amount_centavos) : 'Complimentary'}
          </span>
        </li>
      ))}
      {shown.length > 5 ? <li className="text-ink/45">+ {shown.length - 5} more in the full quote</li> : null}
    </ul>
  );
}
