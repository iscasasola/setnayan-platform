'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode, type TouchEvent as ReactTouchEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarClock, Check, Lock } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { ActionButton } from '@/components/action-button';
import { PeekToast, type PeekToastTone } from '@/app/_components/toast/peek-toast';
import { SWIPE_REVEAL_PX, swipeBegin, swipeMove, type SwipeDrag } from '@/app/_components/swipe-to-delete';
import { todayPutOff } from '@/app/_actions/today-put-off-actions';
import { SupplierToast } from './supplier-toast';
import { TODAY_ASIDE_COOKIE, readTodayAside, setAside } from '@/lib/today-aside';
import { PUT_OFF_WORDS, canPutOff, dragArmed, dragOffset, dragOutcome } from '@/lib/today-put-off';

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

type Group = {
  openKey: string | null;
  setOpen: (key: string | null) => void;
  /** ⏭ v3 part 2 — "Do it tomorrow" (drag left, or the open card's link). Says the outcome with Undo. */
  putOff: (key: string) => void;
  /** 🔴 A red row dragged left: it springs back and the toast says why. */
  refuse: () => void;
};
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
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ n: number; text: string } | null>(null);
  // ⏭ The drag's own toasts (v3 part 2): "Moved to tomorrow · Undo", "Urgent · can't go to tomorrow", a failure.
  const [peek, setPeek] = useState<{ n: number; text: string; tone: PeekToastTone; undo: string | null } | null>(null);
  const [, startTransition] = useTransition();
  const moving = useRef<string | null>(null);
  const prev = useRef(rows);
  useEffect(() => {
    const before = prev.current;
    prev.current = rows;
    if (!openKey) return;
    if (rows.some((r) => r.key === openKey)) return;
    // A row put off to tomorrow left on purpose — it was not answered: no "next of its kind", no "✓ Saved".
    if (moving.current === openKey) {
      moving.current = null;
      return setOpenKey(null);
    }
    // The open row left the list — it was answered. Open the next of its kind, if one is still waiting.
    const gone = before.find((r) => r.key === openKey);
    if (!gone) return setOpenKey(null);
    const next = rows.find((r) => r.kind === gone.kind) ?? null;
    setOpenKey(next ? next.key : null);
    setToast((t) => ({ n: (t?.n ?? 0) + 1, text: DONE_WORD[gone.kind] ?? '✓ Saved' }));
  }, [rows, openKey]);
  const say = useCallback((text: string, tone: PeekToastTone, undo: string | null = null) => setPeek((t) => ({ n: (t?.n ?? 0) + 1, text, tone, undo })), []);
  const run = useCallback(
    (op: 'put' | 'undo', key: string) => {
      if (op === 'put') moving.current = key;
      startTransition(async () => {
        const r = await todayPutOff({ op, key }).catch(() => ({ ok: false, message: PUT_OFF_WORDS.failed }));
        // 🔑 A refusal is SAID, and the row stays (the server re-draws nothing on a failed write) — never a silent no-op.
        if (!r.ok) {
          moving.current = null;
          return say(r.message, 'bad');
        }
        say(r.message, 'ok', op === 'put' ? key : null);
        // one-render: keep (server-action) — the action revalidated Today; this pulls the re-drawn list in place
        router.refresh();
      });
    },
    [router, say],
  );
  const value = useMemo(
    () => ({ openKey, setOpen: setOpenKey, putOff: (key: string) => run('put', key), refuse: () => say(PUT_OFF_WORDS.refused, 'note') }),
    [openKey, run, say],
  );
  return (
    <QuickGroup.Provider value={value}>
      {children}
      {toast ? <SupplierToast key={toast.n} text={toast.text} tone="ok" line={false} /> : null}
      {peek && typeof document !== 'undefined'
        ? createPortal(
            <PeekToast
              key={peek.n}
              tone={peek.tone}
              data="today-put-off"
              onGone={() => setPeek(null)}
              action={peek.undo ? { label: PUT_OFF_WORDS.undo, onPress: () => run('undo', peek.undo!) } : undefined}
            >
              {peek.text}
            </PeekToast>,
            document.body,
          )
        : null}
    </QuickGroup.Provider>
  );
}

/**
 * ⏭↔ THE TWO DRAGS (Today v3 part 2 — owner 19 Nov: *"drag left to do tomorrow / drag right open it"*; drawing V3 · 2,
 * 2b). The shipped swipe's own gesture (`swipeBegin` · `swipeMove` from `swipe-to-delete.tsx` — the axis lock on the
 * first 8 px, a still finger is not a swipe, the 84 px area, nothing visible on touch-down) in BOTH directions:
 *   · RIGHT past halfway → the task's own page (the same place as "Open in page ›");
 *   · LEFT past halfway → "Do it tomorrow", with "Moved to tomorrow · Undo";
 *   · a RED row dragged left moves about a third as far and springs back, with "Urgent · can't go to tomorrow";
 *   · short of halfway → it springs back (Release, 220 ms).
 * Only a CLOSED row drags: an open card holds a reply box, and a drag there would fight the text. No ✕, no delete —
 * a task leaves only by being finished, or by going to tomorrow ("you cannot delete a task until its complete").
 */
function useTodayDrag({ enabled, red, onOpen, onTomorrow, onRefuse }: { enabled: boolean; red: boolean; onOpen: () => void; onTomorrow: () => void; onRefuse: () => void }) {
  const [tx, setTx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<SwipeDrag>({ ...swipeBegin(0, 0, 0), active: false });
  const end = () => {
    const d = drag.current;
    drag.current = { ...d, active: false };
    setDragging(false);
    if (!d.horiz) return;
    const outcome = dragOutcome(tx, red, SWIPE_REVEAL_PX);
    setTx(0);
    if (outcome === 'open') onOpen();
    else if (outcome === 'tomorrow') onTomorrow();
    else if (outcome === 'refused') onRefuse();
  };
  const handlers = enabled
    ? {
        onTouchStart: (e: ReactTouchEvent) => {
          const t = e.touches[0];
          if (t) drag.current = swipeBegin(t.clientX, t.clientY, 0, e.timeStamp);
        },
        onTouchMove: (e: ReactTouchEvent) => {
          const t = e.touches[0];
          if (!t) return;
          // The shipped gesture decides the axis; this row then follows the finger BOTH ways.
          const { drag: next } = swipeMove(drag.current, t.clientX, t.clientY, e.timeStamp);
          drag.current = next;
          if (!next.active) return setDragging(false);
          if (!next.horiz) return;
          setDragging(true);
          setTx(dragOffset(t.clientX - next.x, red, SWIPE_REVEAL_PX));
        },
        onTouchEnd: end,
        onTouchCancel: end,
        onClickCapture: (e: ReactMouseEvent) => {
          if (drag.current.moved) {
            // The click a drag ends in — not a tap.
            e.preventDefault();
            e.stopPropagation();
            drag.current = { ...drag.current, moved: false };
          }
        },
      }
    : {};
  return { tx, dragging, handlers, armed: dragArmed(tx, red, SWIPE_REVEAL_PX) };
}

/** One task row: the shared fold, controlled by its group so only one is ever open — and, closed, it drags both ways. */
export function TodayQuickRow({
  rowKey,
  title,
  line,
  lead,
  aside,
  urgency = null,
  foot = null,
  href = null,
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
  /** v3 part 2: the task's own page — where a drag right goes (the same link as "Open in page ›"). */
  href?: string | null;
  children: ReactNode;
}) {
  const g = useContext(QuickGroup);
  const router = useRouter();
  const open = g ? g.openKey === rowKey : undefined;
  const red = urgency === 'red';
  const { tx, dragging, handlers, armed } = useTodayDrag({
    enabled: Boolean(g && href && !open),
    red,
    // one-render: keep (navigation) — a drag right opens the task's own page, like "Open in page ›"
    onOpen: () => (href ? router.push(href) : undefined),
    onTomorrow: () => g?.putOff(rowKey),
    onRefuse: () => g?.refuse(),
  });
  const edge = urgency === 'red' ? 'rgb(var(--color-danger))' : urgency === 'amber' ? 'rgb(var(--color-warn))' : null;
  const tint = urgency === 'red' ? 'var(--sn-danger-soft)' : urgency === 'amber' ? 'var(--sn-warning-soft)' : undefined;
  const moved = tx !== 0 || dragging;
  return (
    <div
      data-today-quick-row={rowKey}
      data-today-urgency={urgency ?? undefined}
      data-today-card={open ? 'open' : undefined}
      data-today-swipe={href && !open ? (red ? 'right-only' : 'both') : undefined}
      // 🃏 TAPPED, THE ROW BECOMES A CARD IN PLACE (owner 19 Nov: "just expand it and it becomes a card" · "no pop up"):
      // the shared frame fades in around the SAME row; a closed row stays a flat list row with its divider and its tint.
      className={`relative isolate ${
        open
          ? '-mx-2.5 my-2 rounded-[var(--sn-frame-radius)] bg-frame px-2.5 shadow-sn-frame'
          : `overflow-hidden border-t border-ink/10 first:border-t-0${urgency ? ' -mx-2.5 rounded-r-xl px-2.5' : ''}`
      }`}
      style={{ ...(edge ? { borderLeft: `4px solid ${edge}` } : {}), ...(!open && tint ? { background: tint } : {}) }}
    >
      {/* The two panes behind a closed row — drawn only while it moves, so a still row shows no colour at its edges.
          Each is a ready-coloured layer that fades in past halfway (motion "Status change", Quick). */}
      {moved && !open ? (
        <>
          <span
            aria-hidden
            data-today-drag-pane="open"
            className="absolute inset-y-0 left-0 flex items-center gap-1.5 px-3 text-[12.5px] font-bold text-white"
            style={{ width: SWIPE_REVEAL_PX, transition: 'opacity var(--sn-m-quick) var(--sn-m-settle)', background: 'rgb(var(--sn-accent-rgb, 194 78 37))', opacity: tx > 0 ? (armed === 'open' ? 1 : 0.55) : 0 }}
          >
            <ArrowRight className="h-4 w-4 flex-none" strokeWidth={2} /> Open in page ›
          </span>
          <span
            aria-hidden
            data-today-drag-pane={red ? 'refused' : 'tomorrow'}
            className="absolute inset-y-0 right-0 flex items-center justify-end gap-1.5 px-3 text-right text-[12.5px] font-bold"
            style={{
              width: SWIPE_REVEAL_PX,
              transition: 'opacity var(--sn-m-quick) var(--sn-m-settle)',
              background: red ? 'rgb(var(--color-danger))' : 'color-mix(in srgb, rgb(var(--color-info, 45 90 146)) 16%, rgb(var(--sn-page-bg)))',
              color: red ? '#fff' : 'rgb(var(--color-info, 45 90 146))',
              opacity: tx < 0 ? (armed === 'tomorrow' || red ? 1 : 0.55) : 0,
            }}
          >
            {red ? <Lock className="h-4 w-4 flex-none" strokeWidth={2} /> : <CalendarClock className="h-4 w-4 flex-none" strokeWidth={2} />}
            {red ? 'Can’t push — urgent' : PUT_OFF_WORDS.pane}
          </span>
        </>
      ) : null}
      <div
        {...handlers}
        data-today-drag-front=""
        className={moved && !open ? 'relative z-10 bg-page' : 'relative'}
        style={{
          ...(moved && !open && tint ? { background: `linear-gradient(${tint}, ${tint}), rgb(var(--sn-page-bg))` } : {}),
          // No transform at rest (a transform frames every `position: fixed` inside the row). The snap back is the
          // shipped Release: 220 ms on Settle.
          transform: tx === 0 && !dragging ? undefined : `translateX(${tx}px)`,
          transition: dragging ? 'none' : 'transform var(--sn-m-swipe-snap) var(--sn-m-settle)',
          touchAction: 'pan-y',
        }}
      >
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
          <div className="pb-3 pl-[48px] max-[380px]:pl-0">
            {children}
            {foot ? <div className="mt-1 flex flex-wrap gap-x-5" data-today-card-foot="">{foot}</div> : null}
          </div>
        </Fold>
      </div>
    </div>
  );
}

/**
 * ⏭ "Do it tomorrow" as a plain link at the end of an open card — for people who do not swipe (ruled 19 Nov). Never
 * drawn on a red card (`canPutOff`): an urgent task cannot go to tomorrow.
 */
export function TodayTomorrowLink({ rowKey, level }: { rowKey: string; level: 'red' | 'amber' | null }) {
  const g = useContext(QuickGroup);
  if (!g || !canPutOff(level)) return null;
  return (
    <button type="button" data-today-do-it-tomorrow="" onClick={() => g.putOff(rowKey)} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sn-accent">
      {PUT_OFF_WORDS.link}
    </button>
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
