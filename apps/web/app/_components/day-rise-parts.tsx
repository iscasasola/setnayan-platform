/**
 * 📅 THE RISEN SCHEDULE'S PARTS — ONE DRAWING, BOTH SIDES (Unichat part F, drawing `unichat_live_v3_2026-11-20.html`
 * `riseBody('next')`). The supplier's list (`agenda-rise.tsx`, "Your part of the day") and the hosts' list
 * (`chat/whole-day-rise.tsx`, "The whole day") draw the same rows, the same event-day head and the same timeline from
 * here — never two copies of the drawing.
 *
 *   Row         the date tile (36 px) · what · its status pill (11 px, the kind's colour)        `.arow`
 *   DoneFold    "Done · N", no caret, full ink; its rows a step quieter                           `.fold`
 *   DayTimeline the day as a timeline: a dot per moment, a line between them, the stopwatch on
 *               the moments the reader may ask to move; everybody else's is a hollow dot         `.tl.day`
 * Colours come from the chat's kind tokens, so dark mode is the house's (`DARK_MODE_STANDARD`): no hex here.
 * 🔒 app/_components/the-risen-day-is-the-drawing.test.ts
 */
import { Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Agenda, AgendaKind, AgendaRow } from '@/lib/client-agenda';

/** The drawing's `.k-*` ramps, from the chat's kind tokens (light + dark). */
const KIND: Record<AgendaKind, { tile: string; pill: string; set: string }> = {
  meeting: { tile: 'bg-kind-meeting-bg text-kind-meeting', pill: 'bg-kind-meeting-bg text-kind-meeting', set: 'bg-kind-meeting text-[rgb(var(--sn-frame-bg))]' },
  payment: { tile: 'bg-kind-payment-bg text-kind-payment', pill: 'bg-kind-payment-bg text-kind-payment', set: 'bg-kind-payment text-[rgb(var(--sn-frame-bg))]' },
  quote: { tile: 'bg-kind-quote-bg text-kind-quote', pill: 'bg-kind-quote-bg text-kind-quote', set: 'bg-kind-quote text-[rgb(var(--sn-frame-bg))]' },
};

/** The risen list's column: phone width on a computer too (the drawing is one phone), centred. */
export const DAY_COLUMN = 'mx-auto grid w-full max-w-[440px] gap-5 px-4 pb-6 pt-4';

/** A section's small head (`.rsec h4`). */
export function DayHead({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-ink/60">{children}</h4>;
}

/** One dated row: the drawing's date tile · what · its status pill, in the row's kind colour. */
export function Row({ r }: { r: AgendaRow }) {
  const k = KIND[r.kind];
  const pill = r.status === 'Set' ? k.set : r.status === 'Done' ? 'bg-ink/5 text-ink/70' : k.pill;
  return (
    <div className="flex min-h-[52px] items-center gap-3 py-1" data-agenda-row={r.kind}>
      <span aria-hidden className={`flex h-9 w-9 flex-none flex-col items-center justify-center rounded-lg text-center leading-[1.1] ${k.tile}`} data-agenda-tile="">
        <small className="text-[11px] font-bold uppercase">{r.mon}</small>
        <b className="text-[13px] font-bold">{r.d}</b>
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
        <span className="sr-only">{`${r.mon} ${r.d}: `}</span>
        {r.title}
      </span>
      <span className={`flex-none whitespace-nowrap rounded-full px-2 py-px text-[11px] font-bold leading-4 ${pill}`} data-agenda-pill="">
        {r.status}
      </span>
    </div>
  );
}

/** Done · N (folded) → the week groups → "Nothing dated before the day." — the dated half of both lists. */
export function AgendaRows({ agenda, unreadLine }: { agenda: Agenda; unreadLine: string | null }) {
  return (
    <>
      {unreadLine ? (
        <p role="alert" className="text-sm font-semibold text-danger-700" data-agenda-unread="">
          {unreadLine}
        </p>
      ) : null}
      {agenda.done.length > 0 ? (
        // The drawing's fold: no caret, full ink; a press opens the rows, a step quieter.
        <details data-agenda-done="">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-[13px] font-bold text-ink [&::-webkit-details-marker]:hidden">Done · {agenda.done.length}</summary>
          <div className="opacity-75">{agenda.done.map((r) => <Row key={r.key} r={r} />)}</div>
        </details>
      ) : null}
      {agenda.groups.map((g) => (
        <section key={g.key} aria-label={g.heading} data-agenda-group="">
          <DayHead>{g.heading}</DayHead>
          {g.rows.map((r) => <Row key={r.key} r={r} />)}
        </section>
      ))}
      {agenda.nothingAhead && !unreadLine ? <p className="text-sm text-ink/70">Nothing dated before the day.</p> : null}
    </>
  );
}

export type TimelineItem = {
  key: string;
  clock: string;
  label: string;
  /** The line under it: its chapter, "· <shop>", "Outside the venue's hours". */
  sub: string;
  /** The sub line is a warning (amber). */
  warn?: boolean;
  /** The reader may ask to move it: a button with the stopwatch; else a quiet row with a hollow dot. */
  onPick?: () => void;
  /** The press's name for a screen reader ("Ask to move this: Sound check"). */
  pickLabel?: string;
  data?: Record<`data-${string}`, string>;
};

/** The day as the drawing's timeline (`.tl.day`): 64 px clock · a dot on a line · the moment · ⏱ on an askable one. */
export function DayTimeline({ items }: { items: readonly TimelineItem[] }) {
  return (
    <ul className="m-0 list-none p-0" data-day-timeline="">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const mark = (
          <>
            <span className="pt-px text-[13px] tabular-nums text-ink/60">{it.clock}</span>
            <span className="relative min-w-0 pb-3 pl-4">
              <span
                aria-hidden
                className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${it.onPick ? 'bg-kind-meeting' : 'bg-frame shadow-[inset_0_0_0_2px_rgb(var(--color-ink)/0.2)]'}`}
                data-timeline-dot={it.onPick ? 'mine' : 'other'}
              />
              {last ? null : <span aria-hidden className="absolute bottom-0 left-[3px] top-[18px] w-0.5 rounded-sm bg-kind-meeting-bg" data-timeline-line="" />}
              <b className="block truncate text-[15px] font-semibold text-ink">{it.label}</b>
              <small className={`block text-[13px] ${it.warn ? 'font-semibold text-warn-700' : 'text-ink/60'}`}>{it.sub}</small>
            </span>
          </>
        );
        return (
          <li key={it.key}>
            {it.onPick ? (
              <button
                type="button"
                className="sn-press grid min-h-11 w-full grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-x-2 text-left"
                aria-label={it.pickLabel}
                onClick={it.onPick}
                {...it.data}
              >
                {mark}
                <Timer aria-hidden className="mt-0.5 h-4 w-4 text-kind-meeting" strokeWidth={2} />
              </button>
            ) : (
              <div className="grid min-h-11 grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-x-2" {...it.data}>
                {mark}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
