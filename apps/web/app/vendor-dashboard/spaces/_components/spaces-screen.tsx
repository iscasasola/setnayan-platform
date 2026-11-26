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
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, RotateCw, SlidersHorizontal } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ThumbRow } from '@/components/thumb-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FormRows } from '@/app/_components/form-row';
import { LockedFeature } from '@/app/_components/lock/locked-feature';
import { ShopNotice } from '../../_components/kit';
import { EmptyState } from '@/app/_components/states/empty-state';
import { useToast } from '@/app/_components/toast/toast-provider';
import { PeekToast } from '@/app/_components/toast/peek-toast';
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
import { SpaceSheet, paidNeed, type SheetMode } from './space-sheet';
import styles from './spaces-screen.module.css';
import { QUICK_MS } from '@/lib/motion-table';

export function SpacesScreen({
  initial,
  today,
  proOpen,
  shopKind,
  firstHall,
  planPrice = null,
}: {
  initial: SpacesRead | null;
  /** The shop's calendar day (Asia/Manila), YYYY-MM-DD. */
  today: string;
  proOpen: boolean;
  /** The kind the shop's categories point to — first in the add sheet. */
  shopKind: KindChoice | null;
  firstHall: { widthM: number | null; lengthM: number | null; seated: number | null } | null;
  /** A7-14: the Plus plan's catalogue price, worded by the page ("₱… / month"); null = unread, no figure. */
  planPrice?: string | null;
}) {
  const router = useRouter();
  const [read, setRead] = useState<SpacesRead | null>(initial);
  const [date, setDate] = useState(initial?.day?.date ?? today);
  const [show, setShow] = useState<'all' | KindChoice>('all');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [last, setLast] = useState<KindChoice | null>(null);
  // Warnings that need reading stay in the page (a refused write, a day that could not be read); a save that landed is
  // the house toast (B4, drawing § 4a), and a removal is the Undo toast (§ 4b).
  const [msg, setMsg] = useState<{ tone: 'warn'; text: string } | null>(null);
  const [removed, setRemoved] = useState<{ id: string; name: string; connectsTo: string | null } | null>(null);
  // B4 motion (drawing § 4): the tile that is fading out (Quick 200) before it leaves the grid, and the one Undo brought
  // back, fading in (Move 320).
  const [leaving, setLeaving] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  // The pending "leave the grid" step — cleared when Undo lands first, so a late leave can never drop a returned tile.
  const leaveTimer = useRef<number | null>(null);
  const toast = useToast();
  const [pending, start] = useTransition();

  const run = (op: SpacesOp, done?: string, day = date) =>
    new Promise<boolean>((resolve) => {
      // The space as it was, read BEFORE it goes: Undo puts back its "connects to" too.
      const was = op.op === 'removeSpace' ? read?.spaces.find((x) => x.id === op.id) ?? null : null;
      start(async () => {
        const r = await spacesWrite(op, day);
        if (r.ok) {
          setMsg(null);
          if (op.op === 'removeSpace' && was) {
            // Gone at once, with Undo: the toast shows now; the tile fades (Quick) and then leaves the grid.
            setRemoved({ id: was.id, name: was.name, connectsTo: was.connectsTo });
            setLeaving(was.id);
            leaveTimer.current = window.setTimeout(() => {
              leaveTimer.current = null;
              setRead(r.read);
              setLeaving(null);
            }, QUICK_MS);
          } else {
            if (leaveTimer.current !== null) {
              window.clearTimeout(leaveTimer.current);
              leaveTimer.current = null;
              setLeaving(null);
            }
            setRead(r.read);
            if (op.op === 'restoreSpace') setReturning(op.id);
            if (done) toast.success(done);
          }
          if (op.op === 'addSpaces') setLast(choiceOf(op.input.kind));
        } else setMsg({ tone: 'warn', text: r.error });
        resolve(r.ok);
      });
    });

  /** Opens the add sheet; a message left from an earlier save is cleared so the sheet's own refusal line starts empty. */
  const openNew = (typed: string) => {
    setMsg(null);
    setSheet({ mode: 'new', choice: last ?? shopKind ?? 'hall', typed });
  };

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
      {/* B4 (§ 4c): with no spaces the date row is not drawn — there is nothing for a date to describe. */}
      {read.spaces.length > 0 ? (
      <div className="flex min-h-11 items-center justify-between gap-3" data-spaces-date="">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">{dayLabel}</span>
          <span className="block text-sn-sm text-ink/70">Tiles follow this date</span>
        </span>
        <PickMenu
          label="Date"
          value={date}
          compact
          dataAttr="data-spaces-date-pick"
          options={dates}
          onPick={(k) => {
            // A7-13: the heading moves to the new day only once that day's tiles are read — a refused read keeps the
            // old day's heading over the old day's tiles, and says so.
            void run({ op: 'read' }, undefined, k).then((ok) => {
              if (ok) setDate(k);
            });
          }}
        />
      </div>
      ) : null}

      {msg ? (
        <ShopNotice tone="warn" role="alert">
          {msg.text}
        </ShopNotice>
      ) : null}
      {!read.day ? (
        <ShopNotice tone="warn" role="alert">
          Couldn&rsquo;t read who holds what on {dayLabel}. The tiles say nothing about the day.
        </ShopNotice>
      ) : null}

      {read.spaces.length === 0 ? (
        // B4 (drawing § 4c) + A7-31: the house empty state — the fact, how the page fills, and ONE action that opens
        // the same New space sheet the ＋ in the search box opens.
        <div data-spaces-empty="">
          <EmptyState
            Icon={MapPin}
            title="No spaces yet"
            blurb="Halls, rooms and what you rent out. Set once; your cards pick from here."
            readPermitted
            action={<ActionButton tone="brand" main icon={Plus} label="Add a space" className="!h-11" onClick={() => openNew('')} data-spaces-add-first="" />}
          />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-[14px] text-ink/70" data-spaces-none-match="">
          Nothing matches. Tap ＋ in the box to add it.
        </p>
      ) : (
        <ul className={styles.grid} data-spaces-grid="">
          {shown.map((s) => (
            <li
              key={s.id}
              className={s.id === leaving ? styles.leaving : s.id === returning ? styles.returning : undefined}
              onAnimationEnd={s.id === returning ? () => setReturning(null) : undefined}
              data-spaces-tile-motion={s.id === leaving ? 'leaving' : s.id === returning ? 'returning' : undefined}
            >
              <Tile
                space={s}
                state={states.get(s.id) ?? null}
                onOpen={() => {
                  setMsg(null);
                  setSheet({ mode: 'edit', space: s, state: states.get(s.id) ?? null });
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {hasHallsOrRooms && !proOpen ? (
        <FormRows width="wide" data="spaces-floor-plan-lock">
          <LockedFeature lock="space_floor_plan" need={paidNeed(planPrice)} line="Halls and rooms only" data="spaces-floor-plan" />
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
              onAdd: (typed) => openNew(typed),
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

      {removed ? (
        // B4 (drawing § 4b): gone at once, with Undo — the guest list's removal toast, 6 s.
        <PeekToast
          key={removed.id}
          data="spaces-removed"
          onGone={() => setRemoved(null)}
          action={{
            label: 'Undo',
            onPress: () => {
              const back = removed;
              setRemoved(null);
              void run({ op: 'restoreSpace', id: back.id, connectsTo: back.connectsTo }, `${back.name} is back`);
            },
          }}
        >
          {removed.name} removed
        </PeekToast>
      ) : null}

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
          refusal={msg?.tone === 'warn' ? msg.text : null}
          planPrice={planPrice}
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
