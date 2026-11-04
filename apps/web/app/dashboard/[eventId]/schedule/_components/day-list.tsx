'use client';

/**
 * 📋 THE EVENT DAY AS A LIST (event chapters slice 8 — owner-approved brief SCHEDULE_SLICES_8_10_BRIEF_2026-11-05; the
 * prototype `prototypes/schedule_redesign_2026-11-04.html`, frames (a) at rest · (b) the day, live · (c) filtered).
 *
 * Where chapters are drawn, the day is no longer an hour grid of giant blocks: each chapter is a row sized by its
 * content — its start large and its end small (the app font with tabular figures, never monospace), a thin spine in
 * its kind's tint, its venue, its suppliers' faces (dashed = has not picked yet) and count, and its moments inline.
 * The lines between chapters say how long is free, and where to travel. On the day, the running chapter wears a
 * terracotta top line and "Happening now · 6:12 PM". No 👁 on a row: who sees a chapter is inside its ⓘ.
 *
 * Rows: a tap opens the chapter; a swipe left removes it with Undo (the page's own warning). No row buttons.
 * Pure rules: `lib/day-list.ts`. 🔒 app/dashboard/[eventId]/schedule/the-day-is-a-list-of-chapters.test.ts
 */
import { useEffect, useRef, useState } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { draggedStart } from '@/lib/chapter-move';
import { shortClock, type DayListRow, type ListChapterRow } from '@/lib/day-list';
import { PHASE_TINT } from './day-ui';

/** ↕ The desktop board (slice 10): ≥1280 with a fine pointer only — never a tablet or a phone. */
export const BOARD_QUERY = '(min-width: 1280px) and (pointer: fine)';
/** A drag reads one pixel as one minute, snapped to 5 (`draggedStart`). It starts past this many pixels, so a tap opens. */
const DRAG_FROM_PX = 6;

function useBoard(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(BOARD_QUERY);
    const read = () => setOn(mq.matches);
    read();
    mq.addEventListener?.('change', read);
    return () => mq.removeEventListener?.('change', read);
  }, []);
  return on;
}

export function DayList({
  rows,
  canEdit,
  onOpen,
  onDelete,
  onMove,
  onAdd,
}: {
  rows: readonly DayListRow[];
  canEdit: boolean;
  onOpen: (chapterId: string) => void;
  onDelete: (chapterId: string) => void;
  /** ↕ The desktop board: a chapter dragged by N minutes (snapped to 5). Absent = no drag. */
  onMove?: (chapterId: string, minutes: number) => void;
  /** 🖥 A desktop's "+ Add a chapter" is the list's last row (slice 10); elsewhere it is the floating pill. */
  onAdd?: () => void;
}) {
  const board = useBoard();
  const drag = canEdit && board && onMove ? onMove : null;
  return (
    <ol data-day-list={rows.filter((r) => r.kind === 'chapter').length} className="font-sans">
      {rows.map((r) =>
        r.kind === 'gap' ? (
          <li key={r.id} data-day-gap="" className="grid grid-cols-[5.25rem_1fr] items-center py-2 text-[12.5px] text-ink/50">
            <span className="tabular-nums">{r.length}</span>
            <span className="border-l border-dashed border-ink/15 pl-3">{r.words}</span>
          </li>
        ) : (
          <li key={r.id} className="border-b border-ink/10 last:border-b-0">
            {canEdit ? (
              <SwipeToDelete label={`Delete ${r.chapter.label}`} onDelete={(close) => { close(); onDelete(r.id); }} radiusClass="rounded-none" surfaceClass="bg-cream">
                <ChapterRow r={r} onOpen={onOpen} onMove={drag} />
              </SwipeToDelete>
            ) : (
              <ChapterRow r={r} onOpen={onOpen} />
            )}
          </li>
        ),
      )}
      {onAdd ? (
        <li className="hidden xl:block">
          <button type="button" onClick={onAdd} data-day-add-row="" className="sn-press flex min-h-12 w-full items-center gap-2 py-3 text-[15px] font-semibold text-sn-accent">
            + Add a chapter
          </button>
        </li>
      ) : null}
    </ol>
  );
}

function ChapterRow({ r, onOpen, onMove = null }: { r: ListChapterRow; onOpen: (id: string) => void; onMove?: ((id: string, minutes: number) => void) | null }) {
  const tint = PHASE_TINT[r.chapter.block_type as keyof typeof PHASE_TINT] ?? PHASE_TINT.custom;
  // ↕ The desktop board: drag the band up or down to a new start; the start shows where it will land.
  const grab = useRef<{ y: number; moved: boolean } | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const canDrag = Boolean(onMove) && !r.chapter.time_tba;
  const landing = minutes !== null ? draggedStart(r.chapter.start_at, minutes) : null;
  return (
    <button
      type="button"
      data-day-chapter={r.id}
      data-day-now={r.now ? '' : undefined}
      data-day-draggable={canDrag ? '' : undefined}
      onPointerDown={(e) => {
        if (!canDrag || e.button !== 0) return;
        // A drag never selects the page's words.
        e.preventDefault();
        grab.current = { y: e.clientY, moved: false };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const g = grab.current;
        if (!g) return;
        const dy = e.clientY - g.y;
        if (!g.moved && Math.abs(dy) < DRAG_FROM_PX) return;
        g.moved = true;
        setMinutes(Math.round(dy / 5) * 5);
      }}
      onPointerUp={() => {
        const g = grab.current;
        grab.current = null;
        if (g?.moved && minutes !== null && minutes !== 0) onMove?.(r.id, minutes);
        if (g?.moved) setTimeout(() => setMinutes(null), 0);
      }}
      onPointerCancel={() => {
        grab.current = null;
        setMinutes(null);
      }}
      onClick={(e) => {
        // A drag is not a tap: it never opens the chapter.
        if (minutes !== null) {
          e.preventDefault();
          return;
        }
        onOpen(r.id);
      }}
      aria-label={`${r.chapter.label}, ${r.start} ${r.end}`}
      className={`sn-press grid w-full grid-cols-[5.25rem_1fr] gap-0 py-4 text-left ${r.now ? 'border-t-2 border-sn-accent' : ''} ${canDrag ? 'cursor-grab select-none active:cursor-grabbing' : ''} ${landing ? 'rounded-md ring-2 ring-sn-accent' : ''}`}
    >
      {/* ⏱ Start big, end small, then the length — tabular figures in the app font. */}
      <span className="pr-2 tabular-nums">
        <span className={`block whitespace-nowrap text-[16px] font-semibold leading-tight ${landing ? 'text-sn-accent' : 'text-ink'}`} data-day-start="">
          {landing ? shortClock(`${landing.day}T${landing.hhmm}:00.000Z`) : r.start}
        </span>
        {landing ? <span className="block text-[11px] text-ink/55" data-day-drag-hint="">snaps to 5 min</span> : null}
        <span className="block text-[12.5px] leading-snug text-ink/60">{r.end}</span>
        {r.length ? <span className="block text-[11.5px] leading-snug text-ink/45">{r.length}</span> : null}
      </span>
      <span className="relative min-w-0 pl-3">
        {/* The thin spine in the chapter's tint — its length only hints at the duration. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-full" style={{ background: tint }} />
        {r.nowWords ? (
          <span className="block text-[12px] font-semibold text-sn-accent" data-day-now-words="">
            {r.nowWords}
          </span>
        ) : null}
        <span className="block text-[17px] font-semibold leading-tight text-ink">{r.chapter.label}</span>
        <span className="block truncate text-[13px] text-ink/60">{r.chapter.location?.trim() || 'Venue TBA'}</span>
        {/* 👥 Who is on it: faces and a count; a dashed face has not picked this chapter yet. */}
        <span className="mt-1.5 flex items-center gap-1.5" data-day-faces={r.faces.length}>
          {r.faces.slice(0, 5).map((f) => (
            <span
              key={f.id}
              title={f.picking ? `${f.name} hasn’t picked a chapter yet` : f.name}
              data-day-face={f.picking ? 'picking' : 'on'}
              className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${
                f.picking ? 'border border-dashed border-ink/35 text-ink/55' : 'bg-ink/[0.07] text-ink/75'
              }`}
            >
              {f.initials}
            </span>
          ))}
          <span className="text-[12.5px] text-ink/55">{r.facesWords}</span>
        </span>
        {r.moments.length > 0 ? (
          <span className="mt-2 block border-t border-ink/10 md:grid md:grid-cols-2 md:gap-x-6" data-day-moments="">
            {r.moments.map((m) => (
              <span key={m.id} data-day-moment={m.id} className="grid grid-cols-[3.5rem_1fr] border-b border-ink/10 py-2 md:last:border-b">
                <span className="text-[14px] tabular-nums text-ink/80">{m.time}</span>
                <span className="min-w-0">
                  <span className={`block text-[15px] leading-snug ${m.backstage ? 'text-ink/60' : 'text-ink'}`}>
                    {m.backstage ? <span className="mr-1.5 text-[10.5px] uppercase tracking-[0.08em] text-gold-deep">Backstage</span> : null}
                    {m.title}
                    {m.now ? <span className="ml-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-sn-accent">Now</span> : null}
                  </span>
                  {m.sub ? <span className="block truncate text-[12.5px] text-ink/55">{m.sub}</span> : null}
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}
