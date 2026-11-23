'use client';

/**
 * 🏛 SHOP › SPACES — the screen (drawing screens 2, 3 and 7's lock, specs prototypes/spaces_final_screens_2026-11-19.html;
 * DECISION_LOG 19 Nov "SHOP PAGE FINAL + SPACES COMBINED WITH ROOMS & SEATING").
 *
 *   · A grid of tiles, one per space, each saying what holds it on the picked day (the date opens on Today; one PickMenu
 *     changes it). Tap a tile → its sheet; a booked tile's sheet names who holds it (no trip to Clients › Dates).
 *   · The thumb row: ONE box that searches and adds (🔍 → ＋, the shipped `ThumbField.onAdd`) and the sliders (Show: All +
 *     the six kinds). Adding opens the sheet on the kind the shop's categories point to (or the last one added).
 *   · 🔒 "Make it a floor plan" — every paid plan, the shared lock (problem → solution). Inert while the paywall switch is off.
 *
 * A save never resets the screen: every op hands back the page's one read for the same day. A refused read says so
 * (never "no spaces yet"); a refused DAY read draws the tiles with no day words rather than "Free".
 */
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw, SlidersHorizontal } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ThumbRow } from '@/components/thumb-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FormRows } from '@/app/_components/form-row';
import { LockedFeature } from '@/app/_components/lock/locked-feature';
import { ShopNotice } from '../../_components/kit';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import {
  SHOW_CHOICES,
  choiceOf,
  dateChoices,
  dayWords,
  matchesSearch,
  tileLine,
  tilesOnDay,
  type KindChoice,
  type Space,
  type TileState,
} from '@/lib/spaces';
import type { SpacesRead } from '@/lib/spaces.server';
import { spacesWrite, type SpacesOp } from '../actions';
import { SpaceSheet, PAID_NEED, type SheetMode } from './space-sheet';
import styles from './spaces-screen.module.css';

export function SpacesScreen({
  initial,
  today,
  proOpen,
  shopKind,
  firstHall,
}: {
  initial: SpacesRead | null;
  /** The shop's calendar day (Asia/Manila), YYYY-MM-DD. */
  today: string;
  proOpen: boolean;
  /** The kind the shop's categories point to — first in the add sheet. */
  shopKind: KindChoice | null;
  firstHall: { widthM: number | null; lengthM: number | null; seated: number | null } | null;
}) {
  const router = useRouter();
  const [read, setRead] = useState<SpacesRead | null>(initial);
  const [date, setDate] = useState(initial?.day?.date ?? today);
  const [show, setShow] = useState<'all' | KindChoice>('all');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [last, setLast] = useState<KindChoice | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'warn'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (op: SpacesOp, done?: string, day = date) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const r = await spacesWrite(op, day);
        if (r.ok) {
          setRead(r.read);
          setMsg(done ? { tone: 'success', text: done } : null);
          if (op.op === 'addSpaces') setLast(choiceOf(op.input.kind));
        } else setMsg({ tone: 'warn', text: r.error });
        resolve(r.ok);
      }),
    );

  const dates = useMemo(() => dateChoices(today), [today]);
  const states = useMemo(
    () => (read?.day ? tilesOnDay(read.day.date, read.spaces, read.day.bookings, read.day.blocks) : new Map<string, TileState>()),
    [read],
  );

  if (read === null) {
    return (
      <div className="mt-4 space-y-3" role="alert" data-spaces-refused="">
        <ShopNotice tone="warn">Couldn&rsquo;t load your spaces just now. Nothing was changed.</ShopNotice>
        <ActionButton
          tone="neutral"
          icon={RotateCw}
          label="Try again"
          className="!h-11"
          onClick={() => {
            // one-render: keep (retry) — the read was refused; Try again re-asks the server, no action answered with a render.
            router.refresh();
          }}
        />
      </div>
    );
  }

  const shown = read.spaces.filter((s) => (show === 'all' || choiceOf(s.kind) === show) && matchesSearch(s, q));
  const dayLabel = dayWords(date);
  const hasHallsOrRooms = read.spaces.some((s) => s.kind === 'hall' || s.kind === 'room');

  return (
    <div className="mt-3 space-y-4 pb-28" aria-busy={pending} data-spaces-screen="">
      <div className="flex min-h-11 items-center justify-between gap-3" data-spaces-date="">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">{dayLabel}</span>
          <span className="block text-[12.5px] text-ink/70">Tiles follow this date</span>
        </span>
        <PickMenu
          label="Date"
          value={date}
          compact
          dataAttr="data-spaces-date-pick"
          options={dates}
          onPick={(k) => {
            setDate(k);
            void run({ op: 'read' }, undefined, k);
          }}
        />
      </div>

      {msg ? (
        <ShopNotice tone={msg.tone} role={msg.tone === 'warn' ? 'alert' : 'status'}>
          {msg.text}
        </ShopNotice>
      ) : null}
      {!read.day ? (
        <ShopNotice tone="warn" role="alert">
          Couldn&rsquo;t read who holds what on {dayLabel}. The tiles say nothing about the day.
        </ShopNotice>
      ) : null}

      {read.spaces.length === 0 ? (
        <p className="text-[14px] text-ink/70" data-spaces-empty="">
          No spaces yet. Type in the box below to add your first.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-[14px] text-ink/70" data-spaces-none-match="">
          Nothing matches. Tap ＋ in the box to add it.
        </p>
      ) : (
        <ul className={styles.grid} data-spaces-grid="">
          {shown.map((s) => (
            <li key={s.id}>
              <Tile space={s} state={states.get(s.id) ?? null} onOpen={() => setSheet({ mode: 'edit', space: s, state: states.get(s.id) ?? null })} />
            </li>
          ))}
        </ul>
      )}

      {hasHallsOrRooms && !proOpen ? (
        <FormRows width="wide" data="spaces-floor-plan-lock">
          <LockedFeature lock="space_floor_plan" need={PAID_NEED} line="Halls and rooms only" data="spaces-floor-plan" />
        </FormRows>
      ) : null}

      <SupplierThumbRow
        name="spaces"
        label="Spaces actions"
        row={
          <ThumbRow
            name="spaces"
            field={{
              placeholder: 'Search or add a space',
              input: { value: q, onChange: (e) => setQ(e.currentTarget.value), 'data-spaces-search': '' },
              onClear: () => setQ(''),
              onAdd: (typed) => setSheet({ mode: 'new', choice: last ?? shopKind ?? 'hall', typed }),
              query: q,
              matches: shown.length > 0,
            }}
            right={[
              {
                menu: SHOW_CHOICES.map((c) => ({ key: c.key, label: c.label })),
                label: 'Show',
                value: show,
                onPick: (k) => setShow(k as 'all' | KindChoice),
                mark: 'data-spaces-show',
                face: (
                  <span aria-hidden>
                    <SlidersHorizontal className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                ),
              },
            ]}
          />
        }
      />

      {sheet ? (
        <SpaceSheet
          key={sheet.mode === 'edit' ? sheet.space.id : `new-${sheet.choice}`}
          open
          onClose={() => setSheet(null)}
          at={sheet}
          spaces={read.spaces}
          tables={read.tables}
          proOpen={proOpen}
          dayLabel={dayLabel}
          firstHall={firstHall}
          run={(op, done) => run(op, done)}
        />
      ) : null}
    </div>
  );
}

/** One tile: name, its line, and what holds it on the day. A tile is pressed, so it wears a frame. */
function Tile({ space, state, onOpen }: { space: Space; state: TileState | null; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={`sn-press ${styles.tile}`} data-space-tile={space.id} data-space-tile-kind={space.kind} aria-haspopup="dialog">
      <span className="block truncate text-[15px] font-semibold text-ink">{space.name}</span>
      <span className="block truncate text-[13px] text-ink/70">{tileLine(space)}</span>
      {state ? (
        <span className={styles.state} data-tone={state.tone} data-space-state={state.tone}>
          {state.word}
        </span>
      ) : null}
    </button>
  );
}
