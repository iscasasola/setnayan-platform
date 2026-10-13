'use client';

import { useState } from 'react';
import { PhoneTableDock } from '../../dashboard/[eventId]/seating/_components/seat-plan-phone';
import { Counter } from '@/app/_components/counter';
import { seatCounter, seatStepWords } from '@/lib/seat-counter';

/**
 * /dev/details-lab?seat=1 — THE TABLE'S SHEET ON A PHONE, with no sign-in and no database (2026-10-13, the seat counter's walk).
 * The REAL sheet (`PhoneTableDock`), the REAL Counter and the REAL rules (`lib/seat-counter.ts`), over ONE table held here:
 * Table 10, 10 chairs, 6 seated in chairs 1–6, chairs 9 and 10 removed (the prototype's own table). The editor's save
 * (`setTableSeat`) is stood in by this state — nothing leaves the page. The editor's wiring of the same pieces is held by
 * `lib/the-counter-is-one-drawing.test.ts`.
 *   `&removed=6,7,8,9` — start with those chairs (0-based) removed; `&seated=0,1,…` — those chairs taken.
 */
export function SeatLab({ removed: removed0, seated: seated0 }: { removed: number[]; seated: number[] }) {
  const CAP = 10;
  const [removed, setRemoved] = useState<Set<number>>(() => new Set(removed0));
  const [note, setNote] = useState<{ seat: number; removed: boolean } | null>(null);
  const [label, setLabel] = useState('Table 10');
  const [type, setType] = useState('round');
  const occupied = Array.from({ length: CAP }, (_, i) => seated0.includes(i));
  const c = seatCounter({ capacity: CAP, removed, occupied });
  const toggle = (seat: number, gone: boolean) =>
    setRemoved((r) => {
      const n = new Set(r);
      if (gone) n.add(seat);
      else n.delete(seat);
      return n;
    });
  const less = () => {
    if (c.less === null) return;
    toggle(c.less, true);
    setNote({ seat: c.less, removed: true });
  };
  const more = () => {
    if (c.more === null) return;
    toggle(c.more, false);
    setNote({ seat: c.more, removed: false });
  };
  const noop = () => {};
  return (
    <div className="flex min-h-dvh flex-col justify-end bg-cream">
      {/* The plan above the sheet: the table's chairs as the canvas draws them — taken · empty · removed. */}
      <div data-seat-lab-plan="" className="flex flex-1 items-center justify-center">
        <svg viewBox="-80 -80 160 160" className="h-56 w-56" aria-label={`${label}: ${c.value} chairs, ${c.seated} seated`}>
          <circle r="44" className="fill-white stroke-ink/30" strokeWidth="1.5" />
          <text y="-2" textAnchor="middle" className="fill-ink text-[11px] font-semibold">
            {label}
          </text>
          <text y="13" textAnchor="middle" className="fill-ink/55 text-[10px]">
            {c.seated}/{c.value} seated
          </text>
          {Array.from({ length: CAP }, (_, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / CAP;
            const gone = removed.has(i);
            return (
              <circle
                key={i}
                data-seat-lab-chair={gone ? 'removed' : occupied[i] ? 'taken' : 'empty'}
                cx={Math.cos(a) * 58}
                cy={Math.sin(a) * 58}
                r="6"
                className={gone ? 'fill-none stroke-ink/30' : occupied[i] ? 'fill-sn-accent' : 'fill-ink/25'}
                strokeDasharray={gone ? '2 2' : undefined}
              />
            );
          })}
        </svg>
      </div>
      <div className="rounded-t-3xl bg-cream px-4 pb-6 pt-2 shadow-[0_-10px_40px_-20px_rgba(0,0,0,.5)]">
        <p className="pb-1 text-center text-[12.5px] text-ink/55">
          You&rsquo;re editing · <b className="font-semibold text-ink/75">Seat plan › {label}</b>
        </p>
        <PhoneTableDock
          tableId="T10"
          tableLabel={label}
          typeValue={type}
          typeOptions={[
            { key: 'round', label: 'Round' },
            { key: 'long', label: 'Long table' },
            { key: 'square', label: 'Square' },
          ]}
          typeWord={type === 'round' ? 'Round' : type === 'long' ? 'Long table' : 'Square'}
          onRename={setLabel}
          onPickType={setType}
          seats={
            <Counter
              label="Seats at this table"
              data="seats"
              value={c.value}
              onLess={less}
              onMore={more}
              lessDisabled={c.less === null}
              moreDisabled={c.more === null}
              lessLabel={c.lessLabel}
              moreLabel={c.moreLabel}
            />
          }
          seatsLine={c.line}
          seatNote={
            note
              ? {
                  words: seatStepWords(note.seat, note.removed),
                  onUndo: () => {
                    toggle(note.seat, !note.removed);
                    setNote(null);
                  },
                }
              : null
          }
          canEdit
          onRotate={noop}
          onEditChairs={noop}
          linked={false}
          onUnlink={noop}
          linkPressed={false}
          onLink={noop}
          seatPeople={null}
          onDone={noop}
          onDelete={noop}
        />
      </div>
    </div>
  );
}
