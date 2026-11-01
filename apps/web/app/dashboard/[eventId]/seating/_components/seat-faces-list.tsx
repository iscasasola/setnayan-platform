'use client';

import { Armchair, ChevronDown, UserRound } from 'lucide-react';
import { formatCount } from '@/lib/format-number';

/**
 * 🗂 R4 · GUESTS › SEATS › LIST — EVERY TABLE A FOLDABLE HEADER, ITS PEOPLE A ROW OF FACES (owner 2026-10-29, verbatim:
 * *"the accordion categories similar to suppliers and how we can do that same concept to list mode of seat plan"* ·
 * *"instead of names in row, we only show the guest profile icons per table. and space for blank seats per table"*).
 *
 * PRESENTATIONAL ONLY. The seating editor keeps every piece of state and every save; it hands this its own units (linked
 * tables once), the faces it already draws on the plan (`SeatingGuest` — photo, else initials, in the guest's colour) and
 * its handlers. The header is the house foldable header (`.sn-acc-head` + `.sn-acc-chip`, the one Guests › List and
 * Suppliers wear): chip · "Table 3" · "8 of 10". Under it the faces wrap to the width, then one dashed blank per free
 * seat — so "8 of 10" is eight faces and two blanks. "To seat" leads (the coming guests with no chair).
 *
 *   tap a FACE  → `onFace` (the editor opens their guest card, with Remove · Swap);
 *   tap a BLANK → `onBlank` (Pick a guest — or, while someone is being moved, they sit there).
 *
 * ♿ Every face is a button named by the guest ("Ana Reyes, Table 3, seat 4"); every blank says which seat it is.
 */
/** `placed` — who placed the seat, spoken with it ("placed by you", lib/seat-why.ts); absent = not recorded, nothing said. */
export type FaceGuest = { id: string; name: string; initials: string; photo: string | null; color: string; placed?: string | null };
export type FaceSlot = { kind: 'face'; guest: FaceGuest; tableId: string; seat: number } | { kind: 'blank'; tableId: string; seat: number };
export type FaceUnit = { key: string; label: string; sub: string; seated: number; capacity: number; slots: FaceSlot[] };

function Face({ g, picked, onPress, where, dim }: { g: FaceGuest; picked: boolean; onPress: () => void; where: string; dim: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${g.name}, ${where}${g.placed ? `, ${g.placed}` : ''}`}
      aria-pressed={picked}
      title={g.placed ? `${g.name} · ${g.placed}` : g.name}
      data-seat-placed-by={g.placed ? '' : undefined}
      data-seat-face={g.id}
      data-seat-dim={dim ? '' : undefined}
      className={`sn-press relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold text-cream transition-opacity ${
        picked ? 'ring-2 ring-terracotta ring-offset-2 ring-offset-cream' : ''
      } ${dim ? 'opacity-25' : ''}`}
      style={g.photo ? undefined : { backgroundColor: g.color }}
    >
      {g.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary (R2 / Google), as the plan's own seat badge
        <img src={g.photo} alt="" className="h-full w-full object-cover" />
      ) : (
        g.initials
      )}
    </button>
  );
}

function Blank({ onPress, label, armed }: { onPress: () => void; label: string; armed: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      data-seat-blank=""
      className={`sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed ${
        armed ? 'border-terracotta text-terracotta' : 'border-ink/25 text-ink/30'
      }`}
    >
      <Armchair aria-hidden className="h-4 w-4" strokeWidth={1.6} />
    </button>
  );
}

function Fold({
  id,
  label,
  tally,
  icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  /** Already formatted ("8 of 10", `formatCount`). */
  tally: string;
  icon: 'table' | 'people';
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section data-seat-fold={id} data-open={open ? 'true' : 'false'} className="min-w-0">
      {/* 📌 STICKY UNDER THE TOP (R4 slice 4, prototype `.acc-h{position:sticky}`): an open table's header stays at the top
          of this list's own scroll while its seats pass under it, on the list's own ground. */}
      <div className="sn-acc-head sticky top-0 z-[2] bg-[var(--gs-paper,rgb(var(--color-cream)))]" data-open={open ? '' : undefined} data-seat-fold-head="">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-12 w-full items-center gap-3 px-1 text-left">
          <span className="sn-acc-chip inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden>
            {icon === 'table' ? <Armchair className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <UserRound className="h-[18px] w-[18px]" strokeWidth={1.9} />}
          </span>
          {/* ✂ A table's name WRAPS, never cut (owner v15 — names are never ellipsized; up to three lines). */}
          <span className="line-clamp-3 min-w-0 flex-1 text-[14px] font-semibold tracking-[0.04em] text-ink [overflow-wrap:anywhere]">{label}</span>
          <span className="shrink-0 text-[13px] tabular-nums text-ink/60">{tally}</span>
          <ChevronDown aria-hidden className={`h-[18px] w-[18px] shrink-0 text-ink/45 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.9} />
        </button>
      </div>
      {open ? <div className="flex flex-wrap gap-2 px-1 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

export function SeatFacesList({
  units,
  unseated,
  pickedId,
  onFace,
  onBlank,
  closed,
  onToggle,
  dim = () => false,
}: {
  units: FaceUnit[];
  /** The coming guests with no chair — faces only (a section has no seats of its own). */
  unseated: FaceGuest[];
  /** The guest being moved (a blank they are tapped onto seats them). */
  pickedId: string | null;
  onFace: (guestId: string) => void;
  onBlank: (tableId: string, seat: number) => void;
  /** ⇕ The folded headers — held by the editor, so the thumb row's ⇕ opens or folds them all (R4 slice 1). */
  closed: ReadonlySet<string>;
  onToggle: (key: string) => void;
  /** ⇅ A face the shared Show or the search leaves out — drawn faint, its seat still taken. */
  dim?: (guestId: string) => boolean;
}) {
  const toggle = onToggle;
  return (
    <div data-seat-faces-list="" className="absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-28 pt-1">
      {unseated.length > 0 ? (
        <Fold id="unseated" label="To seat" tally={formatCount(unseated.length)} icon="people" open={!closed.has('unseated')} onToggle={() => toggle('unseated')}>
          {unseated.map((g) => (
            <Face key={g.id} g={g} picked={pickedId === g.id} onPress={() => onFace(g.id)} where="no seat yet" dim={dim(g.id)} />
          ))}
        </Fold>
      ) : null}
      {units.length === 0 ? (
        <p className="px-1 py-8 text-center text-[13.5px] text-ink/60" data-seat-faces-empty="">
          No tables yet — add one with ＋ Table.
        </p>
      ) : null}
      {units.map((u) => (
        <Fold key={u.key} id={u.key} label={u.label} tally={`${formatCount(u.seated)} of ${formatCount(u.capacity)}`} icon="table" open={!closed.has(u.key)} onToggle={() => toggle(u.key)}>
          {u.slots.map((s) =>
            s.kind === 'face' ? (
              <Face key={`${s.tableId}:${s.seat}`} g={s.guest} picked={pickedId === s.guest.id} onPress={() => onFace(s.guest.id)} where={`${u.label}, seat ${s.seat + 1}`} dim={dim(s.guest.id)} />
            ) : (
              <Blank key={`${s.tableId}:${s.seat}`} armed={pickedId !== null} onPress={() => onBlank(s.tableId, s.seat)} label={`${u.label}, empty seat ${s.seat + 1}`} />
            ),
          )}
        </Fold>
      ))}
    </div>
  );
}
