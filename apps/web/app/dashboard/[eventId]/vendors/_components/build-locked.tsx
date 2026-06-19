/**
 * BuildLocked — the Services takeover's "Lock" tab (Budget "Build").
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md` + the 0016 Plan Builder sync.
 *
 * Two sections:
 *   1. "Ready to lock" — the couple's BUILD PICKS (event_build_picks · Shortlist
 *      "Add to build") that aren't finalized yet. Each gets the canonical
 *      `AccordionLockButton` → finalizeVendor (the hardened conflict + soft-hold
 *      gates), relocated here from the Shortlist card per the 0016 sync.
 *   2. "Locked in" — the FINALIZED picks, read-only, with the committed total +
 *      the Date/Budget/Location summary tiles.
 */
import { Lock as LockIcon, CheckCircle2 } from 'lucide-react';
import type { PlanBudgetModel } from '@/lib/vendors-plan-budget';
import { AccordionLockButton } from './accordion-lock';

const peso = (centavos: number) => `₱${Math.round((centavos ?? 0) / 100).toLocaleString('en-PH')}`;
const pesoFromPhp = (php: number | null) =>
  php == null ? null : `₱${Math.round(php).toLocaleString('en-PH')}`;

// Mirrors LOCKED_STATUSES in vendors-plan-budget.ts (raw event_vendors.status).
const LOCKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

const LOCK_BTN_CLASS =
  'mt-2 inline-flex w-full items-center justify-center rounded-[10px] bg-mulberry px-3 py-2.5 text-[12.5px] font-semibold text-cream transition-colors hover:bg-mulberry-700 disabled:opacity-60';

/** The committed anchors shown as summary tiles atop the locked list (prototype
 *  `.lock-sum`). Date label + region come from the event; budget + committed come
 *  off the model. */
export type LockSummary = { dateLabel: string | null; budgetPhp: number | null; region: string | null };

export function BuildLocked({
  model,
  eventId,
  summary,
}: {
  model: PlanBudgetModel;
  eventId: string;
  summary?: LockSummary;
}) {
  // Finalized picks (the committed list).
  const lockedRows = model.folders.flatMap((f) =>
    f.children.flatMap((c) =>
      c.picks
        .filter((p) => p.raw_status && LOCKED.has(p.raw_status))
        .map((p) => ({
          folder: f.label,
          group: c.label,
          name: p.vendor_name ?? 'Vendor',
          cost: p.rolled_cost_php,
        })),
    ),
  );

  // Build picks NOT yet locked — the "ready to confirm" queue. Multi-pick
  // categories (Look/Booths/Prints) contribute every build pick; single-pick one.
  const toLockRows = model.folders.flatMap((f) =>
    f.children.flatMap((c) =>
      c.buildPickVendorIds.flatMap((vid) => {
        const p = c.picks.find((pp) => pp.vendor_id === vid);
        if (!p) return [];
        if (p.raw_status && LOCKED.has(p.raw_status)) return []; // already locked → other list
        return [
          {
            folder: f.label,
            group: c.label,
            groupId: c.groupId,
            vendorId: p.vendor_id,
            name: p.marketplace_business_name ?? p.vendor_name ?? 'Vendor',
            cost: p.rolled_cost_php,
          },
        ];
      }),
    ),
  );

  if (lockedRows.length === 0 && toLockRows.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <LockIcon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 className="text-lg font-semibold text-ink">Nothing to lock yet</h2>
        <p className="text-sm text-ink/60">
          Add vendors to your build from the Shortlist, then come back here to lock them in — that
          confirms your pick, updates your budget, and notifies the vendor.
        </p>
      </div>
    );
  }

  const toLockTotal = toLockRows.reduce((s, r) => s + (r.cost ?? 0), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-1 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl italic text-ink">Lock your build</h2>
        <span className="font-display text-xl italic text-ink/80">{peso(model.chosenCentavos)}</span>
      </div>

      {/* Committed-anchor summary tiles (prototype `.lock-sum`). */}
      <div className="grid grid-cols-2 gap-3">
        <LockTile k="Date" v={summary?.dateLabel ?? '—'} />
        <LockTile k="Budget" v={pesoFromPhp(summary?.budgetPhp ?? null) ?? '—'} />
        <LockTile k="Location" v={summary?.region ?? '—'} />
        <LockTile k="Committed" v={peso(model.chosenCentavos)} accent />
      </div>

      {/* 1 · Ready to lock — build picks awaiting the hardened finalize. */}
      {toLockRows.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg italic text-ink/85">Ready to lock</h3>
            <span className="text-xs text-ink/55">{pesoFromPhp(toLockTotal)} in your build</span>
          </div>
          {toLockRows.map((r) => (
            <div
              key={`${r.groupId}-${r.vendorId}`}
              className="rounded-xl border border-ink/10 bg-cream px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                    {r.folder} · {r.group}
                  </span>
                </span>
                {pesoFromPhp(r.cost) && (
                  <span className="shrink-0 text-sm font-medium text-ink/75">{pesoFromPhp(r.cost)}</span>
                )}
              </div>
              <AccordionLockButton
                eventId={eventId}
                groupId={r.groupId}
                groupLabel={r.group}
                vendorId={r.vendorId}
                vendorName={r.name}
                label="Lock to confirm"
                pendingLabel="Locking…"
                className={LOCK_BTN_CLASS}
                wrapperClassName=""
              />
            </div>
          ))}
        </section>
      )}

      {/* 2 · Locked in — the finalized, read-only list. */}
      {lockedRows.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-lg italic text-ink/85">Locked in</h3>
          <ul className="space-y-2">
            {lockedRows.map((r, i) => (
              <li
                key={`${r.group}-${r.name}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50/60 px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" strokeWidth={1.75} aria-hidden />
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
        </section>
      )}
    </div>
  );
}

function LockTile({ k, v, accent = false }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream px-4 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink/50">{k}</div>
      <div className={`mt-1 truncate font-display text-lg italic ${accent ? 'text-terracotta' : 'text-ink'}`}>
        {v}
      </div>
    </div>
  );
}
