import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  /** The tier that unlocks it, e.g. "Pro Vendor" — worn as a pill. */
  tierLabel: string;
  /** "The live request queue is a Pro tool" */
  title: string;
  /**
   * What one upgrade unlocks. ⚠ Never write a literal SETNAYAN price here —
   * prices come from the live catalog; a peso figure in a component is a
   * defect (and CI's price-literal guard will reject it).
   */
  blurb: string;
  /** The single unlock step — usually a gold "See pricing" link/button. */
  action: ReactNode;
  /**
   * The real feature, ghosted behind the lock — show what's behind the gate
   * instead of a blank wall. Rendered blurred, inert, and hidden from
   * assistive tech; use representative content, never real rows the account
   * is not entitled to read.
   */
  preview?: ReactNode;
};

// State 04 · LOCKED — a paid feature. The feature itself sits ghosted behind
// a gold lock with the single step to unlock. Gold frame = entitlement;
// distinct from Empty (centred terracotta teach) and Denied (slate, role).
export function LockedState({ tierLabel, title, blurb, action, preview }: Props) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border-t-[3px] border-terracotta">
      {preview ? (
        <div aria-hidden className="pointer-events-none select-none opacity-45 blur-[2.5px]">
          {preview}
        </div>
      ) : null}
      <div
        className={
          preview
            ? 'absolute inset-0 flex flex-col items-center justify-center bg-cream/70 px-6 text-center'
            : 'flex flex-col items-center justify-center px-6 py-12 text-center'
        }
      >
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-terracotta/30 bg-cream text-terracotta-700">
          <Lock aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="mb-2 rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta-700">
          {tierLabel}
        </span>
        <h3 className="text-base font-extrabold tracking-tight text-ink">{title}</h3>
        <p className="mt-1.5 max-w-xs text-sm text-ink/65">{blurb}</p>
        <div className="mt-3.5">{action}</div>
      </div>
    </div>
  );
}
