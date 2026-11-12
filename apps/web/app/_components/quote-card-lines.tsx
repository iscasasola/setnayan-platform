import { MessageCircleQuestion } from 'lucide-react';
import { formatCentavos } from '@/lib/vendor-proposals';

/** A line as both callers hold it — the stream's stored row (label may be null) and the builder's composed one. */
export type QuoteCardLine = { label: string | null; detail?: string | null; amount_centavos: number | null };

/**
 * THE LINES ON A QUOTE CARD IN THE CONVERSATION — the first five, then "+ N more in the full quote".
 *
 * One component for both ends of the same card: the stream draws it on every quote the couple and the supplier read
 * (`chat-message-stream.tsx`), and the supplier's quote screen draws it under "As they see it" (`proposal-maker.tsx`,
 * simpler supplier dashboard step 4) — so the preview is the shipped card's own markup, never a redrawing of it.
 *
 * ✋ `onAsk` (ruling 6076 — an ask STARTS FROM THE PART): the hosts' live quote hands it in (`AskChangeDoor`), and every
 * line becomes the door to "Ask for a change" on THAT line — the same row, pressable, its name carried into the ask.
 */
export function QuoteCardLines({ items, onAsk }: { items: readonly QuoteCardLine[]; onAsk?: (label: string) => void }) {
  const shown = items.filter((li) => li.label?.trim());
  if (shown.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 border-t border-terracotta/20 pt-2 text-xs text-ink/70">
      {shown.slice(0, 5).map((li, i) => {
        const words = (
          <>
            <span className="min-w-0 truncate">
              {li.label}
              {li.detail ? <span className="text-ink/45"> · {li.detail}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">
              {typeof li.amount_centavos === 'number' ? formatCentavos(li.amount_centavos) : 'Complimentary'}
            </span>
          </>
        );
        return onAsk ? (
          <li key={i}>
            <button
              type="button"
              onClick={() => onAsk(li.label!.trim())}
              aria-label={`Ask for a change: ${li.label!.trim()}`}
              className="-mx-1 flex min-h-9 w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 text-left hover:bg-terracotta/[0.08]"
              data-ask-part="line"
            >
              <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">{words}</span>
              <MessageCircleQuestion aria-hidden className="h-3.5 w-3.5 shrink-0 text-mulberry" />
            </button>
          </li>
        ) : (
          <li key={i} className="flex items-baseline justify-between gap-3">
            {words}
          </li>
        );
      })}
      {shown.length > 5 ? <li className="text-ink/45">+ {shown.length - 5} more in the full quote</li> : null}
    </ul>
  );
}
