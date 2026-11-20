'use client';

/**
 * event-today-list.tsx — THE EVENT'S TODAY, ONE LIST (owner 20 Nov 2026: *"make the Today of the event dashboard run
 * like the Focus of Admin and Today of Suppliers Dashboard"* · *"Yes, build it"*; drawing
 * `prototypes/event_today_focus_2026-11-20/` v3, parts A · B). The 19 Nov Today v3 rules, on the SHARED parts — never a
 * third shape:
 *
 *   · the rows arrive already ordered by urgency (`lib/event-today.ts` → `orderByUrgency`): red (Overdue · Today),
 *     amber (Soon), then the rest — a word plus the colour, a tint and a 4 px edge;
 *   · TAP — the row opens as a card where it sits, the answer inside (the shipped part, handed in from the server as
 *     `bodies`), ending "Open in <page> ›" and, never on a red row, "Do it tomorrow";
 *   · DRAG RIGHT — its page · DRAG LEFT — "Do it tomorrow" (`useTodayDrag` / `TwoWayPanes`, the supplier's and admin's
 *     own gesture); a red row moves a third and springs back with "Urgent · can't go to tomorrow". No delete;
 *   · "Do it tomorrow" is THIS PERSON'S alone (`todayPutOff`, scope `event` → `event_today_put_offs`): owner, verbatim —
 *     *"one host may choose to do it tomorrow but the other host hasn't"*. Put-off rows sit under "Tomorrow N".
 *
 * One row open at a time. Nothing here answers anything: a payment opens the shipped Pay door, a task wears the
 * shipped tick (`PlanningTick`), an ask holds its shipped part.
 * 🔒 app/dashboard/[eventId]/event-today-is-focus-shaped.test.ts
 */
import Link from 'next/link';
import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { CalendarClock, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Image as ImageIcon, List, Mail, MonitorSmartphone, RotateCw, Smartphone, Store, UserRound, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PeekToast, type PeekToastTone } from '@/app/_components/toast/peek-toast';
import { TwoWayPanes, useTodayDrag } from '@/app/_components/two-way-drag';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { todayPutOff } from '@/app/_actions/today-put-off-actions';
import { PUT_OFF_WORDS, canPutOff } from '@/lib/today-put-off';
import { formatCount } from '@/lib/format-number';
import type { EventTodayIcon, EventTodayRow } from '@/lib/event-today';
import { PlanningTick } from '../schedule/_components/schedule-lazy';

const ICONS: Record<EventTodayIcon, typeof Wallet> = {
  pay: Wallet,
  person: UserRound,
  mail: Mail,
  cal: CalendarDays,
  list: List,
  image: ImageIcon,
  shop: Store,
  hub: MonitorSmartphone,
  phone: Smartphone,
  warn: RotateCw,
};

type ListCtx = {
  eventId: string;
  openKey: string | null;
  setOpen: (key: string | null) => void;
  putOff: (key: string) => void;
  refuse: () => void;
  go: (href: string) => void;
  reload: () => void;
};
const Ctx = createContext<ListCtx | null>(null);

/**
 * The list's holder: which row is open, and the put-off toasts ("Moved to tomorrow · Undo", "Urgent · can't go to
 * tomorrow", a refusal) — above the rows, because a put-off row LEAVES the list when Home re-draws.
 */
export function EventTodayGroup({ eventId, children }: { eventId: string; children: ReactNode }) {
  const router = useContext(AppRouterContext);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [peek, setPeek] = useState<{ n: number; text: string; tone: PeekToastTone; undo: string | null } | null>(null);
  const [, start] = useTransition();
  const say = useCallback((text: string, tone: PeekToastTone, undo: string | null = null) => setPeek((p) => ({ n: (p?.n ?? 0) + 1, text, tone, undo })), []);
  const run = useCallback(
    (op: 'put' | 'undo', key: string) =>
      start(async () => {
        // 🔑 Per person, per event: the record is this viewer's own (`scope: 'event'`), never the task's.
        const r = await todayPutOff({ op, key, scope: 'event', eventId }).catch(() => ({ ok: false, message: PUT_OFF_WORDS.failed }));
        // A refusal is SAID and the row stays; the action re-drew Home, so its answer carries the new list.
        if (r.ok && op === 'put') setOpenKey((k) => (k === key ? null : k));
        say(r.message, r.ok ? 'ok' : 'bad', r.ok && op === 'put' ? key : null);
      }),
    [eventId, say],
  );
  const value = useMemo<ListCtx>(
    () => ({
      eventId,
      openKey,
      setOpen: setOpenKey,
      putOff: (key) => run('put', key),
      refuse: () => say(PUT_OFF_WORDS.refused, 'note'),
      // one-render: keep (navigation) — a drag right opens the row's own page, like "Open in page ›"
      go: (href) => (router ? router.push(href) : window.location.assign(href)),
      // one-render: keep (retry) — a row whose read failed, pressed by the person; no write came before it.
      // Never a whole-page reload (a-save-never-resets-the-screen): the reads run again in place.
      reload: () => router?.refresh(),
    }),
    [eventId, openKey, run, say, router],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {peek && typeof document !== 'undefined'
        ? createPortal(
            <PeekToast key={peek.n} tone={peek.tone} data="event-today-put-off" onGone={() => setPeek(null)} action={peek.undo ? { label: PUT_OFF_WORDS.undo, onPress: () => run('undo', peek.undo!) } : undefined}>
              {peek.text}
            </PeekToast>,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}

const LINK = 'et-link inline-flex min-h-11 items-center text-[14px] font-semibold';

/** The level word in its colour, in front of the row's line ("Overdue · ₱40,000 · 39 days late"). */
function LevelLine({ row }: { row: EventTodayRow }) {
  const u = row.urgency;
  return (
    <span className="block text-[13px] leading-[1.35] text-[color:var(--sn-ink-500)]" data-event-today-line="">
      {u ? (
        <>
          <span data-event-today-level={u.level} className="font-semibold" style={{ color: u.level === 'red' ? 'var(--sn-danger)' : 'var(--sn-warning-deep)' }}>
            {u.word}
          </span>
          {row.line ? ' · ' : ''}
        </>
      ) : null}
      {row.line}
    </span>
  );
}

/** ONE row of the list — closed it drags both ways; tapped it is a card where it sits. `children` = its shipped answer. */
export function EventTodayRowItem({ row, children }: { row: EventTodayRow; children?: ReactNode }) {
  const g = useContext(Ctx);
  const open = g?.openKey === row.key;
  const level = row.urgency?.level ?? null;
  const red = level === 'red';
  const head = useRef<HTMLButtonElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  // 🎞 The shared reveal-on-open: the card opened in place is scrolled into view, as every Fold is.
  const intend = useRevealOnOpen(Boolean(open), () => ({ head: head.current, end: body.current }), { cause: 'press', intentMs: 4000 });
  const { tx, dragging, handlers, armed } = useTodayDrag({
    enabled: Boolean(g) && !open,
    red,
    onOpen: () => (row.href ? g?.go(row.href) : undefined),
    onTomorrow: () => (row.putOff ? g?.putOff(row.key) : undefined),
    onRefuse: () => g?.refuse(),
  });
  const edge = red ? 'rgb(var(--color-danger))' : level === 'amber' ? 'rgb(var(--color-warn))' : null;
  const tint = red ? 'var(--sn-danger-soft)' : level === 'amber' ? 'var(--sn-warning-soft)' : undefined;
  const moved = tx !== 0 || dragging;
  const Icon = ICONS[row.icon];
  const tick = row.task?.tick ?? null;
  return (
    <li
      data-event-today-row={row.key}
      data-event-today-kind={row.kind}
      data-event-today-urgency={level ?? undefined}
      data-event-today-card={open ? 'open' : undefined}
      data-event-today-swipe={open ? undefined : red ? 'right-only' : 'both'}
      {...(row.task ? { 'data-home-todo-row': row.task.id } : {})}
      className={`relative isolate list-none ${
        open
          ? '-mx-2 my-2 rounded-[var(--sn-frame-radius)] bg-frame px-2 shadow-sn-frame'
          : level
            ? '-mx-4 overflow-hidden rounded-r-2xl pl-3 pr-4 sm:-mx-6 sm:pl-5 sm:pr-6 xl:mx-0 xl:pl-3 xl:pr-3'
            : 'overflow-hidden border-b border-[color:var(--sn-line)]'
      }`}
      style={{ ...(edge ? { borderLeft: `4px solid ${edge}` } : {}), ...(!open && tint ? { background: tint } : {}) }}
    >
      {moved && !open ? <TwoWayPanes tx={tx} armed={armed} red={red} /> : null}
      <div
        {...handlers}
        data-event-today-drag-front=""
        className={moved && !open ? 'relative z-10 bg-page' : 'relative'}
        style={{
          ...(moved && !open && tint ? { background: `linear-gradient(${tint}, ${tint}), rgb(var(--sn-page-bg))` } : {}),
          // No transform at rest (a transform frames every `position: fixed` inside the row). The snap back is the
          // shipped Release.
          transform: tx === 0 && !dragging ? undefined : `translateX(${tx}px)`,
          transition: dragging ? 'none' : 'transform var(--sn-m-swipe-snap) var(--sn-m-settle)',
          touchAction: 'pan-y',
        }}
      >
        <div className="flex min-h-16 items-center gap-3 py-2.5">
          {/* A plan task keeps the shipped tick circle: tap it and the task is done, saved in place. */}
          {tick && g ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center" data-event-today-tick="">
              <PlanningTick eventId={g.eventId} kind={tick.kind} id={tick.id} done={false} title={row.title} />
            </span>
          ) : (
            <span
              aria-hidden
              data-row-icon=""
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
              style={
                red
                  ? { background: 'rgb(var(--color-danger))', color: 'rgb(var(--sn-frame-bg))' }
                  : level === 'amber'
                    ? { background: 'rgb(var(--sn-frame-bg))', color: 'var(--sn-warning-deep)' }
                    : { background: 'color-mix(in srgb, rgb(var(--color-ink)) 6%, transparent)', color: 'var(--sn-ink-900)' }
              }
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
          )}
          <button
            ref={head}
            type="button"
            aria-expanded={Boolean(open)}
            onClick={() => {
              intend();
              g?.setOpen(open ? null : row.key);
            }}
            className="et-open flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
            data-event-today-open=""
          >
            <span className="grid min-w-0 flex-1">
              <span className="text-[15px] font-semibold leading-[1.3] text-[color:var(--sn-ink-900)] [overflow-wrap:anywhere]">{row.title}</span>
              <LevelLine row={row} />
            </span>
            {row.pay && !open ? null : open ? (
              <ChevronUp aria-hidden className="h-[18px] w-[18px] shrink-0 text-sn-accent" strokeWidth={2} />
            ) : (
              <ChevronDown aria-hidden className="h-[18px] w-[18px] shrink-0 text-sn-accent" strokeWidth={2} />
            )}
          </button>
          {/* A payment's closed row ends with Pay — the shipped door to that payment's own Pay sheet. */}
          {row.pay && !open ? <ActionButton tone="neutral" icon={Wallet} label="Pay" name={`${row.title} — Pay ${row.pay.amount}`} href={row.pay.href} data-event-today-pay="" /> : null}
        </div>
      </div>
      {open ? (
        <div ref={body} className="flex flex-col gap-1 pb-3 pl-12 pr-1 max-[380px]:pl-1" data-event-today-card-body="">
          {row.pay ? (
            <>
              <p className="text-[15px] font-semibold text-[color:var(--sn-ink-900)]">{row.pay.what}</p>
              <p className="text-[14px] text-[color:var(--sn-ink-500)]">{row.line}</p>
              <span className="mt-1 self-start">
                <ActionButton tone="brand" main icon={Wallet} label={`Pay ${row.pay.amount}`} href={row.pay.href} data-event-today-pay-open="" />
              </span>
            </>
          ) : null}
          {row.task ? <p className="text-[14px] text-[color:var(--sn-ink-500)]">{tick ? 'Tap the circle when it is done.' : 'Open it in your plan to finish it.'}</p> : null}
          {row.say ? <p className="text-[14px] text-[color:var(--sn-ink-500)]">{row.say}</p> : null}
          {row.names && row.names.length > 0 ? (
            <p className="text-[15px] font-semibold text-[color:var(--sn-ink-900)] [overflow-wrap:anywhere]" data-event-today-names="">
              {row.names.join(' · ')}
            </p>
          ) : null}
          {children}
          {row.door && !children ? (
            <span className="mt-1 self-start">
              <ActionButton tone="brand" main icon={ChevronRight} label={row.door.label} href={row.door.href} data-event-today-door="" />
            </span>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-x-5" data-event-today-card-foot="">
            {row.href ? (
              <Link href={row.href} className={`${LINK} text-sn-accent`} data-event-today-open-in-page="">
                Open in {row.page} ›
              </Link>
            ) : null}
            {/* Never on a red card: an urgent task cannot go to tomorrow. */}
            {row.putOff && canPutOff(level) ? (
              <button type="button" onClick={() => g?.putOff(row.key)} className={`${LINK} text-[color:var(--sn-ink-500)]`} data-event-today-do-it-tomorrow="">
                {PUT_OFF_WORDS.link}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** A read that failed, as a row: it SAYS so, and the press opens its page or runs the reads again. */
export function EventTodayUnreadRow({ row }: { row: EventTodayRow }) {
  const g = useContext(Ctx);
  const inner = (
    <>
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: 'var(--sn-warning-soft)', color: 'var(--sn-warning-deep)' }}>
        <RotateCw className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      <span className="grid min-w-0 flex-1 text-left">
        <span className="text-[15px] font-semibold leading-[1.3] text-[color:var(--sn-ink-900)]">{row.title}</span>
        <span className="text-[13px] text-[color:var(--sn-ink-500)]">{row.line}</span>
      </span>
      <ChevronRight aria-hidden className="h-[18px] w-[18px] shrink-0 text-sn-accent" strokeWidth={2} />
    </>
  );
  const cls = 'et-unread flex min-h-16 w-full items-center gap-3 py-2.5';
  const marks = row.key === 'unread:plan' ? { 'data-home-todo-reload': '' } : {};
  return (
    <li className="list-none border-b border-[color:var(--sn-line)]" data-event-today-row={row.key} data-event-today-kind="unread" role="status">
      {row.reload || !row.href ? (
        <button type="button" className={cls} onClick={() => g?.reload()} {...marks}>
          {inner}
        </button>
      ) : (
        <Link href={row.href} className={cls}>
          {inner}
        </Link>
      )}
    </li>
  );
}

/** "Tomorrow N" — the rows this person put off, folded at the end and out of the count; each is back by itself. */
export function EventTodayTomorrow({ rows }: { rows: readonly EventTodayRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="group border-y border-[color:var(--sn-line)]" data-event-today-tomorrow={rows.length}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
        <span className="hc-k2 !m-0">
          <span className="hc-k2-name">{PUT_OFF_WORDS.heading}</span>
          <em>{formatCount(rows.length)}</em>
        </span>
        <ChevronDown aria-hidden className="h-[18px] w-[18px] text-[color:var(--sn-ink-500)] transition-transform group-open:rotate-180" strokeWidth={2} />
      </summary>
      <ul className="m-0 p-0">
        {rows.map((row) => {
          const Icon = row.task ? CalendarClock : ICONS[row.icon];
          return (
            <li key={row.key} className="flex min-h-16 list-none items-center gap-3 py-2.5 opacity-80" data-event-today-put-off={row.key}>
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: 'color-mix(in srgb, rgb(var(--color-ink)) 6%, transparent)', color: 'var(--sn-ink-900)' }}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="text-[15px] font-semibold leading-[1.3] text-[color:var(--sn-ink-900)] [overflow-wrap:anywhere]">{row.title}</span>
                <span className="text-[13px] text-[color:var(--sn-ink-500)]">{PUT_OFF_WORDS.back}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
