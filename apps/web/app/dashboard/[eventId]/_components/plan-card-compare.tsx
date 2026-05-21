'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GitCompare, X, Check, Clock } from 'lucide-react';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import type { PlanCardPick } from '@/lib/wedding-plan-groups';

const MAX_COMPARE = 3;

type Props = {
  eventId: string;
  groupLabel: string;
  /** Canonical categories that count toward this planner group. Splits the
   *  comparison into per-canonical rows for multi-canonical groups
   *  (Attire & Rings → bridal gown / suit / rings, etc.). */
  groupCategories: ReadonlyArray<VendorCategory>;
  picks: ReadonlyArray<PlanCardPick>;
};

function formatPHP(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function rawStatusLabel(raw: string | null): string {
  if (!raw) return 'Considering';
  return raw
    .split('_')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Inline compare dialog for a single planner card. Triggered by the
 * "Compare N" button next to Search/Add. Surfaces only when the couple
 * has ≥ 2 picks in the group; per-canonical sub-rows for multi-canonical
 * groups so a bridal-gown comparison doesn't get mashed up against the
 * groom's-suit comparison.
 *
 * Native `<dialog>` element — picks up ESC + focus trap + backdrop for
 * free. Backdrop click is wired manually since the native attribute
 * (`closedby`) isn't yet stable across browsers.
 */
export function PlanCardCompare({
  eventId,
  groupLabel,
  groupCategories,
  picks,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [, setOpen] = useState(false);

  const openDialog = () => {
    setOpen(true);
    dialogRef.current?.showModal();
  };
  const closeDialog = () => {
    setOpen(false);
    dialogRef.current?.close();
  };

  // Keep state in sync with native dismissals (ESC, backdrop).
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onClose = () => setOpen(false);
    dlg.addEventListener('close', onClose);
    return () => dlg.removeEventListener('close', onClose);
  }, []);

  // Group picks by canonical. Order matches the PlanGroup.categories
  // array so the rendering matches the spec's expected layout.
  const byCategory: Map<VendorCategory, PlanCardPick[]> = new Map();
  for (const cat of groupCategories) byCategory.set(cat, []);
  for (const p of picks) {
    if (byCategory.has(p.category)) byCategory.get(p.category)!.push(p);
  }
  const sections = Array.from(byCategory.entries()).filter(
    ([, list]) => list.length > 0,
  );

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
      >
        <GitCompare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Compare {picks.length}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
        className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl rounded-2xl border border-ink/10 bg-cream p-0 shadow-xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Compare picks
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {groupLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-ink/55 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="max-h-[calc(90dvh-76px)] space-y-6 overflow-y-auto px-5 py-5">
          {sections.length === 0 ? (
            <p className="text-sm text-ink/55">No picks in this group yet.</p>
          ) : (
            sections.map(([cat, list]) => {
              const cols = list.slice(0, MAX_COMPARE);
              const colsClass =
                cols.length === 1
                  ? 'grid-cols-1'
                  : cols.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-3';
              return (
                <section key={cat} className="space-y-3">
                  <header className="flex items-baseline justify-between gap-2">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                      {VENDOR_CATEGORY_LABEL[cat] ?? cat}
                    </h3>
                    <span className="font-mono text-[10px] text-ink/40">
                      {list.length === 1
                        ? '1 pick'
                        : list.length <= MAX_COMPARE
                          ? `${list.length} picks`
                          : `${MAX_COMPARE} of ${list.length} picks`}
                    </span>
                  </header>
                  <div className={`grid gap-3 ${colsClass}`}>
                    {cols.map((p) => (
                      <article
                        key={p.vendor_id}
                        className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-cream p-3"
                      >
                        <header className="space-y-1">
                          <h4 className="text-sm font-semibold leading-tight text-ink">
                            {p.vendor_name}
                          </h4>
                          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                            {VENDOR_CATEGORY_LABEL[p.category] ?? p.category}
                          </p>
                        </header>
                        <p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${
                              p.status === 'locked'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-ink/5 text-ink/65'
                            }`}
                          >
                            {p.status === 'locked' ? (
                              <Check aria-hidden className="h-3 w-3" strokeWidth={2} />
                            ) : (
                              <Clock
                                aria-hidden
                                className="h-3 w-3"
                                strokeWidth={1.75}
                              />
                            )}
                            {rawStatusLabel(p.raw_status)}
                          </span>
                        </p>
                        <dl className="space-y-1 text-xs">
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink/55">Cost</dt>
                            <dd className="font-mono text-ink">
                              {formatPHP(p.total_cost_php)}
                            </dd>
                          </div>
                          {p.deposit_paid_php !== null ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink/55">Deposit</dt>
                              <dd className="font-mono text-ink/80">
                                {formatPHP(p.deposit_paid_php)}
                              </dd>
                            </div>
                          ) : null}
                          {p.contact_email || p.contact_phone ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-ink/55">Contact</dt>
                              <dd className="min-w-0 text-right text-[11px] text-ink/70">
                                {p.contact_email ? (
                                  <div className="truncate">{p.contact_email}</div>
                                ) : null}
                                {p.contact_phone ? <div>{p.contact_phone}</div> : null}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                        {p.notes ? (
                          <p className="line-clamp-4 rounded-md bg-ink/[0.04] px-2 py-1.5 text-[11px] leading-snug text-ink/70">
                            {p.notes}
                          </p>
                        ) : null}
                        <Link
                          href={`/dashboard/${eventId}/vendors`}
                          className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-terracotta hover:underline"
                        >
                          Manage in vendor tracker →
                        </Link>
                      </article>
                    ))}
                  </div>
                  {list.length > MAX_COMPARE ? (
                    <p className="font-mono text-[10px] text-ink/40">
                      Showing the first {MAX_COMPARE} of {list.length} — reorder or remove in the vendor tracker.
                    </p>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
      </dialog>
    </>
  );
}
