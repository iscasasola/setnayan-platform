'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, RotateCcw, Undo } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import {
  GUESTS_SEE_COLUMNS,
  GUESTS_SEE_WORDS as W,
  guestsSeeApplyLabel,
  guestsSeeBackToPicks,
  guestsSeeChanges,
  guestsSeeKept,
  guestsSeeLeaveLine,
  guestsSeeOn,
  guestsSeePatch,
  guestsSeeToggle,
  type GuestsSeeCell,
  type GuestsSeeRow,
  type GuestsSeeTable,
  type GuestsSeeWrites,
} from '@/lib/guests-see-table';
import type { ElementDraftAction } from '../../website/editor/_components/element-sheet';
import { MAKER_PART_OPS_EVENT, type MakerPartRaw } from './maker-part-ops';
import { MakerSheet } from './stages-studio-parts';

/**
 * 🗂 "WHAT GUESTS SEE" — the sheet (owner 2026-10-10: *"i like the 5 columns."* · *"give them freedom to pick what
 * they want to add. but have our recommendation as the checked one"*; prototype `maker_what_guests_see_2026-10-10.html`
 * case A). Opened from the row of that name in Studio ▾.
 *
 * It draws the table the server built (`lib/guests-see-build.ts` — every box read from the page's own answer) and
 * runs the handlers of `lib/guests-see-table.ts`. It decides nothing itself.
 *
 * SAVING IS THE MAKER'S: ticks wait here; "Apply · N changes" puts exactly those N `stage_show` entries into the Event
 * Hub DRAFT in one save, through the work area's draft door (the door the eye and the block tools use) — and the
 * Maker's own ✓ publishes, as always. ↺ takes back the last tap. Closing with ticks waiting asks first.
 *
 * In the Studio parts' own chunk: nothing of it is in the Maker's first load.
 */

/** The work area, asked as the block tools ask it (`stage-panel/block-animate.tsx` `draftDoor`): the table it was handed, and its draft door. */
export function guestsSeeWorkArea(): { eventId: string; table: GuestsSeeTable; door: ElementDraftAction } | null {
  if (typeof window === 'undefined') return null;
  let got: MakerPartRaw | null = null;
  window.dispatchEvent(new CustomEvent(MAKER_PART_OPS_EVENT, { detail: (raw: MakerPartRaw) => (got = raw) }));
  const raw = got as MakerPartRaw | null;
  const table = raw?.navigator?.guestsSee;
  /* The door is the work area's own (the shipped draft action on a real event, the lab's stand-in in the lab) — never
     imported here, so this file stays free of the server's modules. No door, no sheet: the row is not offered. */
  const door = raw?.elementEditing?.draftAction;
  if (!raw || !table || !door) return null;
  return { eventId: raw.eventId, table, door };
}

const HEAD = 'w-12 shrink-0 px-0.5 text-center text-[9.5px] font-semibold leading-[1.15] text-ink/60';
const CELL = 'relative flex h-11 w-12 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ink/40';

function Mark({ cell, on }: { cell: GuestsSeeCell; on: boolean }) {
  if (cell.kind === 'dash') return <span aria-hidden data-gs-mark="dash" className="h-[2px] w-3 rounded-full bg-ink/35" />;
  if (cell.kind === 'locked') {
    return on ? (
      <Check aria-hidden data-gs-mark="locked-on" className="h-4 w-4 text-ink/35" strokeWidth={2.5} />
    ) : (
      <span aria-hidden data-gs-mark="locked-off" className="h-[2px] w-2 rounded-full bg-ink/15" />
    );
  }
  return (
    <>
      <span
        aria-hidden
        data-gs-mark={on ? 'on' : 'off'}
        className={`flex h-[22px] w-[22px] items-center justify-center rounded-md border-[1.5px] ${on ? 'border-ink bg-ink text-white' : 'border-ink/30 bg-white text-transparent'}`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      {cell.ourPick ? <span aria-hidden data-gs-pick="" className="absolute bottom-1 h-1 w-1 rounded-full bg-terracotta" /> : null}
    </>
  );
}

export function GuestsSeeSheet({ onClose }: { onClose: () => void }) {
  const [area] = useState(guestsSeeWorkArea);
  const [table, setTable] = useState<GuestsSeeTable | null>(area?.table ?? null);
  const [writes, setWrites] = useState<GuestsSeeWrites>({});
  const [undo, setUndo] = useState<GuestsSeeWrites[]>([]);
  const [line, setLine] = useState<string>(W.quiet);
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const n = guestsSeeChanges(writes);

  const close = () => (n > 0 ? setAsking(true) : onClose());
  /* Escape (and the scrim) ask first while ticks are waiting — the sheet's own close does the same. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || n === 0) return;
      e.stopPropagation();
      setAsking(true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [n]);

  if (!area || !table) return null;

  const tap = (row: GuestsSeeRow, col: number) => {
    const r = guestsSeeToggle(table, writes, row.key, col);
    setLine(r.line);
    if (!r.changed) return;
    setUndo((u) => [...u, writes]);
    setWrites(r.writes);
  };
  const backToPicks = () => {
    const r = guestsSeeBackToPicks(table, writes);
    setLine(r.line);
    if (!r.changed) return;
    setUndo((u) => [...u, writes]);
    setWrites(r.writes);
  };
  const takeBack = () => {
    if (undo.length === 0) return setLine(W.nothingToUndo);
    setWrites(undo[undo.length - 1]!);
    setUndo((u) => u.slice(0, -1));
    setLine(W.undone);
  };
  const apply = () => {
    const patch = guestsSeePatch(writes);
    if (!patch) return setLine(W.nothingToApply);
    const sent = writes;
    start(async () => {
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set('patch', JSON.stringify(patch));
        /* The Maker's ONE refresh (the eye's own, `editor-shell.tsx`): the canvas reloads for the render it brings. */
        const r = await makerSave(() => area.door(area.eventId, fd), requestMakerRefresh);
        if (!r.ok) return setLine(r.error || W.notKept);
        setTable(guestsSeeKept(table, sent));
        setWrites({});
        setUndo([]);
        setLine(W.kept);
      } catch {
        setLine(W.notKept);
      }
    });
  };

  return (
    <MakerSheet label={W.title} onClose={close} everyWidth tall>
      <div data-guests-see="" className="flex min-h-full flex-col">
        <div role="table" aria-label={W.title} className="flex-1 px-1">
          <div role="row" className="sticky top-0 z-10 flex items-end bg-white pb-1.5 pt-1">
            <span role="columnheader" className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/45">
              {W.shownAt}
            </span>
            {GUESTS_SEE_COLUMNS.map((c) => (
              <span key={c.key} role="columnheader" data-gs-col={c.key} className={HEAD}>
                {c.label}
              </span>
            ))}
          </div>
          {table.groups.map((g) => (
            <div key={g.title} role="rowgroup" data-gs-group={g.title}>
              <p className="pb-0.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/45">{g.title}</p>
              {g.rows.map((row) => (
                <div key={row.key} role="row" data-gs-row={row.key} className="flex items-center border-t border-ink/10">
                  <span role="rowheader" className="min-w-0 flex-1 py-1 pr-1 text-[13.5px] font-medium leading-tight text-ink">
                    <span className="block break-words">{row.label}</span>
                    {row.note ? <span className="block text-[11px] font-normal leading-snug text-ink/55">{row.note}</span> : null}
                    {row.empty ? <span className="block text-[11px] font-normal leading-snug text-ink/55">{W.emptyNote}</span> : null}
                  </span>
                  {row.cells.map((cell, col) => {
                    const on = guestsSeeOn(row, col, writes);
                    const name = `${row.label} · ${GUESTS_SEE_COLUMNS[col]!.label}`;
                    return cell.kind === 'box' ? (
                      <button
                        key={col}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={cell.ourPick ? `${name} · ${W.ourPick}` : name}
                        data-gs-cell="box"
                        disabled={pending}
                        onClick={() => tap(row, col)}
                        className={`${CELL} active:scale-95`}
                      >
                        <Mark cell={cell} on={on} />
                      </button>
                    ) : (
                      <button
                        key={col}
                        type="button"
                        aria-disabled="true"
                        aria-label={`${name} · ${cell.why}`}
                        data-gs-cell={cell.kind}
                        onClick={() => tap(row, col)}
                        className={CELL}
                      >
                        <Mark cell={cell} on={on} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
          <p className="px-0.5 pb-3 pt-3 text-[11.5px] leading-snug text-ink/55">{W.rsvpCaption}</p>
        </div>

        {/* THE LOWER THIRD — what the last tap did · the key · the three buttons. */}
        <div data-gs-lower="" className="sticky bottom-0 z-10 border-t border-ink/10 bg-white px-1 pb-1 pt-2">
          {asking ? (
            <div data-gs-leave="" className="flex flex-col gap-2">
              <p className="text-[13.5px] font-semibold text-ink">{W.leaveTitle}</p>
              <p className="text-[12.5px] leading-snug text-ink/65">{guestsSeeLeaveLine(n)}</p>
              <div className="flex gap-2">
                <ActionButton tone="neutral" icon={Undo} label={W.keepEditing} onClick={() => setAsking(false)} className="flex-1 justify-center" />
                <ActionButton tone="danger" icon={Check} label={W.leave} onClick={onClose} className="flex-1 justify-center" />
              </div>
            </div>
          ) : (
            <>
              <p role="status" aria-live="polite" data-gs-line="" className={`min-h-[2.4em] text-[13px] leading-snug ${line === W.quiet ? 'text-ink/55' : 'font-medium text-ink'}`}>
                {line}
              </p>
              <ul aria-label="Key" className="flex flex-wrap gap-x-3 gap-y-0.5 py-1.5 text-[11px] text-ink/60">
                {(
                  [
                    [{ kind: 'box', on: true, ourPick: false, base: true, choice: null }, true, W.legendOn],
                    [{ kind: 'box', on: false, ourPick: false, base: false, choice: null }, false, W.legendOff],
                    [null, false, W.legendPick],
                    [{ kind: 'locked', on: true, why: '' }, true, W.legendLocked],
                    [{ kind: 'dash', why: '' }, false, W.legendDash],
                  ] as Array<[GuestsSeeCell | null, boolean, string]>
                ).map(([cell, on, words]) => (
                  <li key={words} className="flex items-center gap-1.5">
                    <span aria-hidden className="relative flex h-5 w-5 scale-75 items-center justify-center">
                      {cell ? <Mark cell={cell} on={on} /> : <span className="h-1 w-1 rounded-full bg-terracotta" />}
                    </span>
                    {words}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2">
                <ActionButton tone="neutral" icon={Undo} label={W.undo} iconOnly onClick={takeBack} disabled={pending} data-testid="guests-see-undo" />
                <ActionButton tone="neutral" icon={RotateCcw} label={W.back} quiet onClick={backToPicks} disabled={pending} className="min-w-0 flex-1 justify-center" data-testid="guests-see-back" />
                <ActionButton tone="brand" icon={Check} label={guestsSeeApplyLabel(n)} main waiting={n === 0 || pending} onClick={apply} className="min-w-0 flex-1 justify-center" data-testid="guests-see-apply" />
              </div>
            </>
          )}
        </div>
      </div>
    </MakerSheet>
  );
}
