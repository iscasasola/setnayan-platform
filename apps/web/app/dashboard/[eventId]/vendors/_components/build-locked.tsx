/**
 * BuildLocked — the Services takeover's "Lock" tab (Budget "Build").
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * Read-only consolidated list of the couple's FINALIZED (locked) picks across all
 * folders — the vendors they've committed to — with the chosen total. Locking
 * itself stays the existing `finalizeVendor` flow on the Shortlist cards
 * (`accordion-lock.tsx`); this tab is the "what's locked" view. Server component
 * (pure render), passed as the takeover's `lockSlot`.
 */
import { Lock as LockIcon, CheckCircle2 } from 'lucide-react';
import type { PlanBudgetModel } from '@/lib/vendors-plan-budget';

const peso = (centavos: number) => `₱${Math.round((centavos ?? 0) / 100).toLocaleString('en-PH')}`;
const pesoFromPhp = (php: number | null) =>
  php == null ? null : `₱${Math.round(php).toLocaleString('en-PH')}`;

// Mirrors LOCKED_STATUSES in vendors-plan-budget.ts (raw event_vendors.status).
const LOCKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

export function BuildLocked({ model }: { model: PlanBudgetModel }) {
  const rows = model.folders.flatMap((f) =>
    f.children.flatMap((c) =>
      c.picks
        .filter((p) => p.raw_status && LOCKED.has(p.raw_status))
        .map((p) => ({
          folder: f.label,
          group: c.label,
          name: p.vendor_name,
          cost: p.rolled_cost_php,
        })),
    ),
  );

  if (rows.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <LockIcon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 className="text-lg font-semibold text-ink">Nothing locked yet</h2>
        <p className="text-sm text-ink/60">
          When you finalize a vendor from your Shortlist, they appear here as a confirmed part of your
          wedding.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-1 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl italic text-ink">Locked in</h2>
        <span className="font-display text-xl italic text-ink/80">{peso(model.chosenCentavos)}</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={`${r.group}-${r.name}-${i}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                  {r.folder} · {r.group}
                </span>
              </span>
            </span>
            {pesoFromPhp(r.cost) && (
              <span className="shrink-0 text-sm font-medium text-ink/75">{pesoFromPhp(r.cost)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
