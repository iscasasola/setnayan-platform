/**
 * 🧺 A VIEW-ONLY SAMPLE OF THE BUNDLE MAKER — the lock explainer's "What it looks like" (the shared lock draws it inert).
 * The maker's own rows, in its own order, with NO money in them: a sample may not carry a peso figure that no card of
 * this shop and no ruling stated (house rule — never type a money number that is not in a ruling or the catalogue).
 */
import { Lock } from 'lucide-react';

const ROWS = ['Your first card · at its lowest', 'Your second card · at its lowest', 'Extra bundle discount · pesos only'];

export function BundlePreviewSample() {
  return (
    <div className="space-y-2 opacity-70" data-bundle-sample="">
      <div className="flex items-center justify-between border-b border-ink/10 pb-2">
        <span>
          <b className="block text-[15px] font-semibold text-ink">New total</b>
          <small className="block text-[12.5px] text-ink/60">2 cards · at their lowest</small>
        </span>
        <span className="font-mono text-[16px] text-ink/50">₱ —</span>
      </div>
      {ROWS.map((r) => (
        <div key={r} className="flex min-h-10 items-center gap-2 text-[14px] text-ink/75">
          <Lock aria-hidden className="h-3.5 w-3.5 text-ink/40" strokeWidth={1.75} />
          <span className="flex-1">{r}</span>
          <span className="font-mono text-ink/40">₱ —</span>
        </div>
      ))}
      <p className="text-[12.5px] text-ink/60">Payment plan for the bundle · adds up to the new total</p>
    </div>
  );
}
