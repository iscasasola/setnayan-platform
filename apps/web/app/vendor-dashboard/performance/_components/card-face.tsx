import type { ReactNode } from 'react';

/**
 * 🃏 THE CAROUSEL FACE — the one frame every Analytics card wears in Shop's carousel (THE ONE BUILD A3 W8, lane C4).
 * Each shipped card (`capacity-card` · `conversion-deals-card` · `price-position-card` · `roi-attribution-card` ·
 * `funnel-benchmark-card`) draws its own body inside it through its `compact` prop — the SAME component, its own
 * data and words; only the frame is shared. Title · one quiet window word · the picture · one line.
 */
export function CardFace({
  title,
  window,
  line,
  children,
  data,
}: {
  title: string;
  /** "Next 13 weeks" · "This year" · "Your region". */
  window: string;
  /** The one line under the picture — honest: "Couldn't load" when the read failed. */
  line: ReactNode;
  children: ReactNode;
  data: string;
}) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl bg-[color:var(--m-card,#fff)] p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-ink/10" data-card-face={data}>
      <div>
        <b className="block text-[15px] font-semibold leading-tight text-ink">{title}</b>
        <small className="text-[12px] text-ink/55">{window}</small>
      </div>
      <div className="min-h-[96px] flex-1">{children}</div>
      <p className="border-t border-ink/10 pt-2 text-[13px] leading-snug text-ink/75">{line}</p>
    </div>
  );
}
