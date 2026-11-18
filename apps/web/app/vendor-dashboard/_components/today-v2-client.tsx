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

/** One quick row: the shared fold, controlled by its group so only one is ever open. */
export function TodayQuickRow({
  rowKey,
  title,
  line,
  lead,
  aside,
  children,
}: {
  rowKey: string;
  title: string;
  line: string;
  lead: ReactNode;
  aside: ReactNode;
  children: ReactNode;
}) {
  const g = useContext(QuickGroup);
  const open = g ? g.openKey === rowKey : undefined;
  return (
    <div data-today-quick-row={rowKey} className="border-t border-ink/10 first:border-t-0">
      <Fold
        title={title}
        line={line}
        wrap
        lead={lead}
        aside={aside}
        data="today-quick"
        open={open}
        onOpenChange={g ? (next) => g.setOpen(next ? rowKey : null) : undefined}
      >
        <div className="pb-3 pl-[48px] max-[380px]:pl-0">{children}</div>
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
