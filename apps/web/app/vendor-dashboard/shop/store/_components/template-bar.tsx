import { formatCount } from '@/lib/format-number';
import { KIND_WORD, type PlanPart, type TemplateKind } from '@/lib/toolkit-templates';

/**
 * 🧩 The two marks every template carries (Toolkit templates drawing, "Colour by kind"): the coloured kind word, and a
 * payment plan's parts as one bar drawn in ink inside a hairline frame. No hooks — shared by the server rows and the
 * plan editor.
 */

/** The coloured kind word: "Payment plan" (green) · "Availability" (amber). */
export function KindWord({ of }: { of: TemplateKind }) {
  return (
    <span className="font-semibold" style={{ color: of === 'pay' ? 'rgb(var(--color-ok))' : 'rgb(var(--color-warn))' }} data-template-kind={of}>
      {KIND_WORD[of]}
    </span>
  );
}

/** A payment plan's parts as one bar: each part as wide as its percent, its percent inside (tabular figures). */
export function PlanBar({ parts, small = false }: { parts: readonly Pick<PlanPart, 'pct'>[]; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex w-full overflow-hidden rounded border border-[color:var(--sn-hair)] ${small ? 'h-6' : 'h-8'}`}
      data-template-bar=""
    >
      {parts.map((x, i) => (
        <span
          key={i}
          className={`grid min-w-0 place-items-center text-sn-sm font-semibold tabular-nums text-ink ${i > 0 ? 'border-l border-[color:var(--sn-hair)]' : ''}`}
          style={{ width: `${x.pct}%` }}
        >
          {x.pct >= 10 ? `${formatCount(x.pct)}%` : ''}
        </span>
      ))}
    </span>
  );
}

