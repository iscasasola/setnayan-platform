'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Counter } from '@/app/_components/counter';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import { TABLE_TYPE_CATALOG, type TableType } from '@/lib/seating';

/**
 * ＋ ADD A TABLE WITHOUT A SHEET (owner 2026-11-20, "Yes, your picks" — DECISION_LOG "GUESTS › SEATS, ROUND TWO";
 * drawing § 9 frames 2 · 3). The fault it replaces, live at 375: ＋ → "New table…" → a sheet → scroll past 13 shape
 * tiles → "Add table" → the sheet STAYED OPEN (now a guest list) → close it → find the table.
 *
 *   · ONE row above the Add box: Shape ▾ · Seats − 10 +. Round · 10 by default.
 *   · The name is already in the box ("Table 3"); ＋ adds it.
 *   · The floor shows where it lands while this is open (the editor draws the ghost from `onDraft`).
 *   · The box closes BY ITSELF when the table is added (the editor unmounts it); ✕ or Esc cancels.
 *
 * "Round ▾" lists Round 8 · Round 10 · Round 12, then "More shapes…", which opens the same menu on all 13. Picking a
 * shape sets its seats.
 *
 * ▾ "Table ▾" AT THE BOX'S RIGHT END (drawing § 9: *"Orange ＋ menu → 'Table ▾' at the Add box's right end"*): what else
 * the plan can add — New table · Entrance · Service door · Dance floor · Cocktail area · Sign · Supplier booth. The list
 * and its handler are the editor's own (`seatAddOptions` · `onSeatAdd`, the thumb row's ＋ menu) — never a copy.
 *
 * Presentational: `onAdd` is the editor's (`createTable`, the row it joins). 🔒 a-table-is-added-without-a-sheet.test.ts
 */
export type TableDraft = { label: string; type: TableType; capacity: number };

/** The three shapes the menu opens on; every other type is behind "More shapes…". */
export const QUICK_TABLE_TYPES: readonly TableType[] = ['round_8', 'round_10', 'round_12'];
export const DEFAULT_TABLE_TYPE: TableType = 'round_10';
const MORE = '__more__';

const seatsOf = (t: TableType) => TABLE_TYPE_CATALOG.find((c) => c.type === t)?.defaultCapacity ?? 10;
/** "Round (10 seats)" → "Round 10" in the list, "Round" on the button. */
const shortLabel = (t: TableType) => (TABLE_TYPE_CATALOG.find((c) => c.type === t)?.label ?? 'Table').replace(/\s*\(.*\)$/, '');

export function AddTableBar({
  defaultLabel,
  busy,
  onDraft,
  onAdd,
  onCancel,
  kinds,
}: {
  /** The next free name — "Table 3". */
  defaultLabel: string;
  busy: boolean;
  /** The shape and seats as they stand — the floor draws where that table would land. */
  onDraft: (d: { type: TableType; capacity: number }) => void;
  onAdd: (d: TableDraft) => void;
  onCancel: () => void;
  /** "Table ▾" — the editor's add list (its "table" row is this box) and the handler that adds the others. */
  kinds?: { options: readonly PickOption[]; onPick: (key: string) => void } | null;
}) {
  const [type, setType] = useState<TableType>(DEFAULT_TABLE_TYPE);
  const [capacity, setCapacity] = useState(seatsOf(DEFAULT_TABLE_TYPE));
  const [allShapes, setAllShapes] = useState(false);
  const [label, setLabel] = useState(defaultLabel);
  const max = seatsOf(type);
  const draft = useRef(onDraft);
  draft.current = onDraft;
  useEffect(() => {
    draft.current({ type, capacity });
  }, [type, capacity]);
  const shown = allShapes || !QUICK_TABLE_TYPES.includes(type) ? TABLE_TYPE_CATALOG.map((c) => c.type) : QUICK_TABLE_TYPES;
  const name = label.trim();
  const add = () => {
    if (!name || busy) return;
    onAdd({ label: name, type, capacity });
  };
  return (
    <form
      data-floor-add=""
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div className="flex min-h-11 items-center gap-2 px-1">
        <span className="text-xs text-ink/70">Shape</span>
        <PickMenu
          label="Table shape"
          value={type}
          buttonText={shortLabel(type)}
          options={[
            ...shown.map((t) => ({ key: t, label: `${shortLabel(t)} ${seatsOf(t)}`.replace(/(\d+) \1$/, '$1') })),
            ...(shown.length < TABLE_TYPE_CATALOG.length ? [{ key: MORE, label: 'More shapes…' }] : []),
          ]}
          onPick={(k) => {
            if (k === MORE) return setAllShapes(true);
            const t = k as TableType;
            setType(t);
            setCapacity(seatsOf(t)); // picking a shape sets its seats
          }}
          dataAttr="data-floor-add-shape"
          compact
          opensUp
          className="shrink-0 border border-ink/15"
        />
        <span className="min-w-0 flex-1" />
        <span className="text-xs text-ink/70">Seats</span>
        <Counter
          value={capacity}
          label="Seats at this table"
          onLess={() => setCapacity((c) => Math.max(1, c - 1))}
          onMore={() => setCapacity((c) => Math.min(max, c + 1))}
          lessDisabled={capacity <= 1}
          moreDisabled={capacity >= max}
          lessLabel={capacity <= 1 ? 'A table has at least one seat' : 'One seat less'}
          moreLabel={capacity >= max ? `This shape seats up to ${max}` : 'One seat more'}
          data="floor-add-seats"
        />
      </div>
      <div className="flex min-h-12 items-center gap-1 rounded-full border-2 border-terracotta bg-raised py-0.5 pl-1 pr-1">
        <button
          type="submit"
          disabled={!name || busy}
          aria-label={`Add ${name || 'the table'}`}
          data-floor-add-go=""
          className="sn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-terracotta-700 disabled:opacity-40"
        >
          <Plus aria-hidden className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <input // field-ok: the Add box itself — the thumb row's terracotta add pill (drawing § 9), not a form row
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={64}
          enterKeyHint="done"
          aria-label="Table name"
          placeholder="Table name"
          data-floor-add-name=""
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-ink/50"
        />
        {kinds ? (
          <PickMenu
            label="What to add"
            value="table"
            buttonText="Table"
            options={kinds.options}
            onPick={kinds.onPick}
            dataAttr="data-floor-add-kind"
            opensUp
            className="shrink-0"
          />
        ) : null}
        <button type="button" onClick={onCancel} aria-label="Cancel adding a table" data-floor-add-cancel="" className="sn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70">
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}
