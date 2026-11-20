'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { ActionButton } from '@/components/action-button';
import { SupplierToast } from './supplier-toast';
import { TODAY_ASIDE_COOKIE, readTodayAside, setAside } from '@/lib/today-aside';

/**
 * 📋 TODAY v2 — THE QUICK ROWS, ANSWERED ON THE ROW (owner 18 Nov, `Today, one task` v2).
 *
 * ONE row open at a time (the shipped fold rule): opening a second closes the first. When an answer takes a row off
 * the list (the server re-draws Today after the shipped action), the NEXT row of the same kind opens by itself — post a
 * review reply and the next waiting review is already open — with a short "✓ Reply posted" toast. No kind left → the
 * list stays shut and the row has moved to Done today. Nothing here answers anything: the forms inside each row are the
 * shipped ones (`overview-sections.tsx`), posting to the shipped actions.
 * 🔒 app/vendor-dashboard/_components/today-is-one-task.test.ts
 */

type Group = { openKey: string | null; setOpen: (key: string | null) => void };
const QuickGroup = createContext<Group | null>(null);

/** The word the toast says after a row of this kind is answered (drawing part 8, "Done"). */
const DONE_WORD: Readonly<Record<string, string>> = {
  review: '✓ Reply posted',
  lock: '✓ Saved',
  date_change: '✓ Saved',
  mark_complete: '✓ Saved',
  meeting: '✓ Saved',
};

export function TodayQuickGroup({ rows, children }: { rows: ReadonlyArray<{ key: string; kind: string }>; children: ReactNode }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ n: number; text: string } | null>(null);
  const prev = useRef(rows);
  useEffect(() => {
    const before = prev.current;
    prev.current = rows;
    if (!openKey) return;
    if (rows.some((r) => r.key === openKey)) return;
    // The open row left the list — it was answered. Open the next of its kind, if one is still waiting.
    const gone = before.find((r) => r.key === openKey);
    if (!gone) return setOpenKey(null);
    const next = rows.find((r) => r.kind === gone.kind) ?? null;
    setOpenKey(next ? next.key : null);
    setToast((t) => ({ n: (t?.n ?? 0) + 1, text: DONE_WORD[gone.kind] ?? '✓ Saved' }));
  }, [rows, openKey]);
  const value = useMemo(() => ({ openKey, setOpen: setOpenKey }), [openKey]);
  return (
    <QuickGroup.Provider value={value}>
      {children}
      {toast ? <SupplierToast key={toast.n} text={toast.text} tone="ok" line={false} /> : null}
    </QuickGroup.Provider>
  );
}

/** The level's colour on the row's round icon (drawing V3 · 3 `.u.red .ico` · `.u.amb .ico`). */
const URGENT_ICON = {
  red: '[&_[data-row-icon]]:!bg-[rgb(var(--color-danger))] [&_[data-row-icon]]:!text-white',
  amber: '[&_[data-row-icon]]:!bg-[rgb(var(--color-warn))] [&_[data-row-icon]]:!text-white',
} as const;

/** One quick row: the shared fold, controlled by its group so only one is ever open. */
export function TodayQuickRow({
  rowKey,
  title,
  line,
  lead,
  aside,
  urgency = null,
  foot = null,
  attrs,
  below = null,
  children,
}: {
  rowKey: string;
  title: string;
  line: string;
  lead: ReactNode;
  aside: ReactNode;
  /** v3: the row's level — a tint and an edge while closed, the edge on the card's frame while open. */
  urgency?: 'red' | 'amber' | null;
  /** v3: the open card's small links under the answer ("Open in page ›"). */
  foot?: ReactNode;
  /** Extra data attributes on the row (a fee bill's `data-fee-bill-today`, so Today's search finds it as a payment). */
  attrs?: Record<`data-${string}`, string>;
  /**
   * Drawn UNDER the row's line, shut or open (drawing V3 · 3 `.bg`: the badge tag sits under the line, so at 390 px the
   * line is not squeezed by a pill and a tag side by side). Fold's own `between` slot.
   */
  below?: ReactNode;
  children: ReactNode;
}) {
  const g = useContext(QuickGroup);
  const open = g ? g.openKey === rowKey : undefined;
  const edge = urgency === 'red' ? 'rgb(var(--color-danger))' : urgency === 'amber' ? 'rgb(var(--color-warn))' : null;
  const tint = urgency === 'red' ? 'var(--sn-danger-soft)' : urgency === 'amber' ? 'var(--sn-warning-soft)' : undefined;
  return (
    <div
      {...attrs}
      data-today-quick-row={rowKey}
      data-today-urgency={urgency ?? undefined}
      data-today-card={open ? 'open' : undefined}
      // 🃏 TAPPED, THE ROW BECOMES A CARD IN PLACE (owner 19 Nov: "just expand it and it becomes a card" · "no pop up"):
      // the shared frame fades in around the SAME row; a closed row stays a flat list row with its divider and its tint.
      className={
        open
          ? '-mx-2.5 my-2 rounded-[var(--sn-frame-radius)] bg-frame px-2.5 shadow-sn-frame'
          : urgency
            ? // Drawing V3 · 3 `.u`: no divider, 4 px apart, the edge on the left and the round on the right; the row's
              // icon wears the level's colour (`.u.red .ico` / `.u.amb .ico`).
              `-mx-2.5 mt-1 rounded-r-xl px-2.5 ${urgency === 'red' ? URGENT_ICON.red : URGENT_ICON.amber}`
            : 'border-t border-ink/10 first:border-t-0'
      }
      style={{ ...(edge ? { borderLeft: `4px solid ${edge}` } : {}), ...(!open && tint ? { background: tint } : {}) }}
    >
      <Fold
        title={title}
        line={line}
        wrap
        lead={lead}
        aside={aside}
        data="today-quick"
        between={below ? <div className="-mt-2.5 pb-2.5 pl-[44px]">{below}</div> : undefined}
        open={open}
        onOpenChange={g ? (next) => g.setOpen(next ? rowKey : null) : undefined}
      >
        <div className="pb-3 pl-[48px] max-[380px]:pl-0">
          {children}
          {foot ? <div className="mt-1 flex flex-wrap gap-x-5" data-today-card-foot="">{foot}</div> : null}
        </div>
      </Fold>
    </div>
  );
}

/**
 * "Got it" (a lapsed ask) · "Not now" (a credit or gift row) — one press, the row leaves Today. Kept in the
 * first-party cookie `lib/today-aside.ts` describes (no table, no server action); the page re-reads it on refresh.
 */
export function TodayAsideButton({ rowKey, how, label, onDesk, todayIso }: { rowKey: string; how: 'notNow' | 'gotIt'; label: string; onDesk: readonly string[]; todayIso: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <span data-today-aside={how} className="contents">
      <ActionButton
        tone="neutral"
        icon={<Check aria-hidden="true" strokeWidth={1.9} />}
        label={label}
        waiting={busy}
        className="min-h-11"
        onClick={() => {
          setBusy(true);
          try {
            const raw = document.cookie.split('; ').find((c) => c.startsWith(`${TODAY_ASIDE_COOKIE}=`))?.slice(TODAY_ASIDE_COOKIE.length + 1) ?? null;
            const value = setAside(readTodayAside(raw, todayIso), rowKey, how, onDesk);
            document.cookie = `${TODAY_ASIDE_COOKIE}=${value}; path=/vendor-dashboard; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
          } catch {
            // A blocked cookie only means the row stays listed — nothing is lost.
          }
          // one-render: keep (client-write) — the choice is a cookie this browser just wrote; no server action ran, so nothing else redraws the list
          router.refresh();
        }}
      />
    </span>
  );
}
