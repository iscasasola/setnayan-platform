'use client';

/**
 * FocusRow — ONE admin Focus item, the supplier's Today rules (Today v3 part 4 — owner 19 Nov 2026: *"this applies to
 * admin and supplier's today"*; ruled: *"Admin Focus opens in place too. The tapped item becomes a card where it sits.
 * No sheet over the list"*; drawing `Today, tap opens a card` v3.5, V3 · 4).
 *
 *   · TAP on a list row (`goes`) — straight to the list's own page: it has nothing to open here (L7 · D2, 27 Nov).
 *   · TAP — the row becomes a card in place (the shipped request card, drawn on the server and handed in as children).
 *     The open card is still the address (`/admin?card=<key>`), so a reload keeps it; a tap on its top closes it.
 *   · DRAG RIGHT — the item's own page (the queue page — the row's href without `?card=`).
 *   · DRAG LEFT — "Do it tomorrow", FOR THIS ADMIN ONLY (`todayPutOff` scope admin), with Undo. A red (Overdue) row
 *     springs back with "Urgent · can't go to tomorrow" and has no "Do it tomorrow" link. No delete.
 * The gesture is the supplier's own (`two-way-drag.tsx`).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { PeekToast, type PeekToastTone } from '@/app/_components/toast/peek-toast';
import { TwoWayPanes, useTodayDrag } from '@/app/_components/two-way-drag';
import { todayPutOff } from '@/app/_actions/today-put-off-actions';
import { PUT_OFF_WORDS, canPutOff } from '@/lib/today-put-off';

type FocusList = { run: (op: 'put' | 'undo', key: string) => void; refuse: () => void };
const FocusListCtx = createContext<FocusList | null>(null);

/**
 * The one list's toast holder: a put-off row LEAVES the list (Focus re-draws), so its "Moved to tomorrow · Undo" must
 * live above the rows, not in the row that just left.
 */
export function FocusList({ children }: { children: ReactNode }) {
  const [peek, setPeek] = useState<{ n: number; text: string; tone: PeekToastTone; undo: string | null } | null>(null);
  const [, start] = useTransition();
  const say = useCallback((text: string, tone: PeekToastTone, undo: string | null = null) => setPeek((p) => ({ n: (p?.n ?? 0) + 1, text, tone, undo })), []);
  const run = useCallback(
    (op: 'put' | 'undo', key: string) =>
      start(async () => {
        const r = await todayPutOff({ op, key, scope: 'admin' }).catch(() => ({ ok: false, message: PUT_OFF_WORDS.failed }));
        // A refusal is said and the row stays; the action revalidated Focus, so its answer carries the re-drawn list.
        say(r.message, r.ok ? 'ok' : 'bad', r.ok && op === 'put' ? key : null);
      }),
    [say],
  );
  const value = useMemo(() => ({ run, refuse: () => say(PUT_OFF_WORDS.refused, 'note') }), [run, say]);
  return (
    <FocusListCtx.Provider value={value}>
      <ul data-focus-one-list="">{children}</ul>
      {peek && typeof document !== 'undefined'
        ? createPortal(
            <PeekToast key={peek.n} tone={peek.tone} data="focus-put-off" onGone={() => setPeek(null)} action={peek.undo ? { label: PUT_OFF_WORDS.undo, onPress: () => run('undo', peek.undo!) } : undefined}>
              {peek.text}
            </PeekToast>,
            document.body,
          )
        : null}
    </FocusListCtx.Provider>
  );
}

export function FocusRow({
  itemKey,
  mark,
  markStyle,
  title,
  sub,
  level,
  open,
  goes = false,
  openHref,
  pageHref,
  children,
}: {
  itemKey: string;
  mark: string;
  markStyle: CSSProperties;
  title: string;
  sub: string;
  level: 'red' | 'amber' | null;
  open: boolean;
  /** A list worked on its own page: the tap IS the way there (`openHref` = that page), and no card opens. */
  goes?: boolean;
  openHref: string;
  pageHref: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const list = useContext(FocusListCtx);
  // 🎞 The shared reveal-on-open: the card opened in place is scrolled into view, as every Fold is.
  const head = useRef<HTMLAnchorElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const intend = useRevealOnOpen(open, () => ({ head: head.current, end: body.current }), { cause: 'press', intentMs: 4000 });
  const red = level === 'red';
  const run = (op: 'put' | 'undo') => list?.run(op, itemKey);
  const { tx, dragging, handlers, armed } = useTodayDrag({
    enabled: !open && Boolean(list),
    red,
    // one-render: keep (navigation) — a drag right opens the item's own page, like "Open in page ›"
    onOpen: () => router.push(pageHref),
    onTomorrow: () => run('put'),
    onRefuse: () => list?.refuse(),
  });
  const edge = red ? 'rgb(var(--color-danger))' : level === 'amber' ? 'rgb(var(--color-warn))' : null;
  const tint = red ? 'var(--sn-danger-soft)' : level === 'amber' ? 'var(--sn-warning-soft)' : undefined;
  const moved = tx !== 0 || dragging;
  return (
    <li
      data-focus-row-key={itemKey}
      data-focus-urgency={level ?? undefined}
      data-focus-card={open ? 'open' : undefined}
      data-focus-swipe={open ? undefined : red ? 'right-only' : 'both'}
      className={`relative isolate ${open ? 'mx-2 my-2 rounded-[var(--sn-frame-radius)] bg-frame shadow-sn-frame' : 'overflow-hidden border-t'}`}
      style={{ borderColor: 'var(--sn-line)', ...(edge ? { borderLeft: `4px solid ${edge}` } : {}), ...(!open && tint ? { background: tint } : {}) }}
    >
      {moved && !open ? <TwoWayPanes tx={tx} armed={armed} red={red} /> : null}
      <div
        {...handlers}
        className={moved && !open ? 'relative z-10 bg-page' : 'relative'}
        style={{
          ...(moved && !open && tint ? { background: `linear-gradient(${tint}, ${tint}), rgb(var(--sn-page-bg))` } : {}),
          transform: tx === 0 && !dragging ? undefined : `translateX(${tx}px)`,
          transition: dragging ? 'none' : 'transform var(--sn-m-swipe-snap) var(--sn-m-settle)',
          touchAction: 'pan-y',
        }}
      >
        <Link
          ref={head}
          href={open ? '/admin' : openHref}
          scroll={goes}
          onClick={goes ? undefined : intend}
          aria-expanded={goes ? undefined : open}
          className="flex min-h-16 items-center gap-3 px-4 py-2.5"
          data-focus-row=""
          data-focus-goes={goes ? '' : undefined}
        >
          <span aria-hidden className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-md font-extrabold" style={markStyle}>
            {mark}
          </span>
          <span className="grid min-w-0 flex-1">
            <span className="truncate text-[15px] font-semibold text-[color:var(--sn-ink-900)]">{title}</span>
            <span className="truncate text-[13px]" style={{ color: red ? 'var(--sn-danger)' : 'var(--sn-ink-500)', fontWeight: red ? 600 : 400 }}>
              {sub}
            </span>
          </span>
          {goes ? (
            <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--sn-ink-500)]" />
          ) : open ? (
            <ChevronUp aria-hidden className="h-5 w-5 shrink-0 text-sn-accent" />
          ) : (
            <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--sn-ink-500)]" />
          )}
        </Link>
      </div>
      {open ? (
        <div ref={body} className="flex flex-col gap-2 px-4 pb-3" data-focus-card-body="">
          {children}
          <div className="flex flex-wrap gap-x-5" data-focus-card-foot="">
            <a href={pageHref} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sn-accent" data-focus-open-in-page="">
              Open in page ›
            </a>
            {canPutOff(level) ? (
              <button type="button" onClick={() => run('put')} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sn-accent" data-focus-do-it-tomorrow="">
                {PUT_OFF_WORDS.link}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
