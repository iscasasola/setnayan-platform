'use client';

/**
 * story-lens.tsx — the room, at the minute you are reading.
 *
 * `01_The_Story.md` §3.4 + §5 · `04` rules 2 and 7 · `05` §4 · `08` step 2.3 ·
 * ported from `prototypes/story.html`'s `.lens` and its `ROOM` plan.
 *
 * A sticky top-down plan beside the entries. Five states, all of them derived
 * (`lib/story-room.ts` holds the derivation and its guard); the tables light up
 * by how many photographs came from them at this minute, and the loudest burns
 * gold.
 *
 * ── 🔒 THE PLAN CARRIES TABLE NUMBERS AND PHOTO HEAT. NEVER NAMES. ─────────
 * A review BLOCKER: an earlier design published 108 first names on a seating
 * chart. There is no name in this component, no prop that could carry one, and
 * `the-room-never-names-anyone.test.ts` reads this file and fails if one
 * appears. A guest's own table and their tablemates are a different surface, on
 * their own account.
 *
 * ── 🔒 OWNER LOCK 6 ────────────────────────────────────────────────────────
 * Assigned seats exist only while the reception venue is in use — the owner
 * caught the prototype lighting tables during the ceremony. `seatsAreShown` is
 * the only test, and it reads the couple's own run of show, never the hour.
 *
 * ── IT IS HIDDEN FROM ASSISTIVE TECHNOLOGY, ON PURPOSE ─────────────────────
 * Every fact it shows is already in the reading order: each minute's own "In
 * the room" layer says the same thing in words, in the entry, where a screen
 * reader meets it. A sticky panel that rewrites itself on every scroll frame is
 * a live region nobody asked for — it would interrupt the story to re-announce
 * a diagram of it. So the fact is carried in the entry and the picture is
 * marked `aria-hidden`; nothing is available only here.
 */

import { useEffect, useState } from 'react';

import { subscribeReaderPosition } from '@/lib/story-reader-position';
import { formatClock, manilaMinuteOfDay, type VenueBlock } from '@/lib/story-spine';
import {
  heatClassOf,
  lensNote,
  lensStateAt,
  lensStateLabel,
  loudestTable,
  seatsAreShown,
  type LensState,
  type StoryRoom,
  type TableHeat,
} from '@/lib/story-room';

/** The plan's own coordinate space — the prototype's, so the geometry ports. */
const W = 340;
const H = 236;
const PAD = 6;
const IN_W = W - PAD * 2;
const IN_H = H - PAD * 2;

const px = (pct: number) => PAD + (pct / 100) * IN_W;
const py = (pct: number) => PAD + (pct / 100) * IN_H;

export type StoryLensProps = {
  room: StoryRoom;
  blocks: VenueBlock[];
  /**
   * Heat per written minute, ALREADY through `drawnHeat` on the server. A
   * reader who may not have the guests' layer receives an empty list for every
   * minute — nothing to draw, rather than a plan of tables measured at zero.
   */
  heat: Array<{ atMs: number; tables: TableHeat[] }>;
  /** True when this reader's guests' layer is withheld, so the note can say so. */
  heatWithheld: boolean;
  /** The instant the story opens on, before the reader reaches an entry. */
  openingAtMs: number | null;
};

export function StoryLens({ room, blocks, heat, heatWithheld, openingAtMs }: StoryLensProps) {
  const [atMs, setAtMs] = useState<number | null>(openingAtMs);

  useEffect(() => {
    return subscribeReaderPosition((pos) => {
      if (!pos.entry) {
        setAtMs(openingAtMs);
        return;
      }
      const n = Number(pos.entry.dataset.storyAt);
      setAtMs(Number.isFinite(n) ? n : openingAtMs);
    });
  }, [openingAtMs]);

  const state: LensState = atMs == null ? 'not_built' : lensStateAt(atMs, blocks, room);
  const showSeats = seatsAreShown(state);

  /*
    The heat of THIS minute. Matched on the instant the entry carries, which is
    the same instant the server bucketed the heat by — never re-derived from a
    time of day, which would put a day-2 minute on a day-1 table.
  */
  const tables = showSeats && atMs != null ? (heat.find((h) => h.atMs === atMs)?.tables ?? []) : [];
  const loudestId = loudestTable(tables);
  const loudest = room.tables.find((t) => t.id === loudestId) ?? null;
  const alsoShooting = tables.filter((t) => t.captures > 0 && t.tableId !== loudestId).length;

  return (
    <aside className="hidden min-[1100px]:block" aria-hidden="true">
      <div className="sticky top-[7.5rem]">
        <div className="overflow-hidden rounded-md border border-ink/15">
          <div className="flex items-baseline justify-between gap-3 border-b border-ink/15 px-3 py-2.5">
            <b className="font-condensed text-base font-extrabold uppercase tracking-[0.04em]">
              The room
            </b>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">
              {lensStateLabel(state)}
            </span>
          </div>

          <RoomPlan room={room} state={state} tables={tables} />

          <p className="border-t border-ink/15 px-3 py-2.5 text-xs leading-relaxed text-ink/60">
            {lensNote({
              state,
              opensAt: receptionOpensAt(blocks),
              loudestLabel: loudest?.label ?? null,
              alsoShooting,
              heatWithheld,
            })}
          </p>
        </div>
      </div>
    </aside>
  );
}

/**
 * When the reception opens, from the block that opens it.
 *
 * ⚠ NEVER THE LITERAL "5:30 PM" (`05` §4). A time typed into copy is a time
 * that is right for one wedding. This reads the first seated block's own start
 * and renders it, or says nothing at all when the couple has not scheduled one.
 */
function receptionOpensAt(blocks: readonly VenueBlock[]): string | null {
  const seated = blocks
    .filter((b) => b.blockType === 'reception' || b.blockType === 'dinner')
    .sort((a, b) => a.startMs - b.startMs)[0];
  if (!seated) return null;
  const minute = manilaMinuteOfDay(new Date(seated.startMs).toISOString());
  if (minute == null) return null;
  const { t, ap } = formatClock(minute);
  return `${t} ${ap}`;
}

/**
 * The plan itself.
 *
 * The venue rectangle, the stage and the dance floor the couple placed, and
 * then EITHER the ceremony's rows OR the reception's tables — never both, and
 * neither before the room was drawn.
 */
function RoomPlan({
  room,
  state,
  tables,
}: {
  room: StoryRoom;
  state: LensState;
  tables: readonly TableHeat[];
}) {
  const showSeats = seatsAreShown(state);
  const rows = state === 'ceremony';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`block h-auto w-full ${state === 'no_venue' ? 'opacity-25' : ''}`}
      role="presentation"
    >
      <rect
        x={PAD}
        y={PAD}
        width={IN_W}
        height={IN_H}
        rx={12}
        className="fill-ink/5 stroke-ink/15"
        strokeWidth={1}
      />

      {room.stage ? (
        <rect
          x={px(room.stage.xPct)}
          y={py(room.stage.yPct)}
          width={(room.stage.wPct / 100) * IN_W}
          height={(room.stage.hPct / 100) * IN_H}
          rx={3}
          className="fill-ink/15"
        />
      ) : null}

      {room.dance && showSeats ? (
        <rect
          x={px(room.dance.xPct)}
          y={py(room.dance.yPct)}
          width={(room.dance.wPct / 100) * IN_W}
          height={(room.dance.hPct / 100) * IN_H}
          rx={4}
          className="fill-none stroke-ink/25"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ) : null}

      {/*
        THE CEREMONY — rows facing the front, and NO tables. Owner lock 6 in
        pictures: before the reception a photograph belongs to a person, not to
        a seat, so there is nothing here to light.
      */}
      {rows
        ? Array.from({ length: 7 }, (_, r) => (
            <g key={r}>
              <rect
                x={52}
                y={58 + r * 18}
                width={104}
                height={7}
                rx={3.5}
                className="fill-ink/10 stroke-ink/20"
                strokeWidth={1}
              />
              <rect
                x={184}
                y={58 + r * 18}
                width={104}
                height={7}
                rx={3.5}
                className="fill-ink/10 stroke-ink/20"
                strokeWidth={1}
              />
            </g>
          ))
        : null}

      {/* THE RECEPTION — the tables the couple placed, lit by this minute. */}
      {showSeats
        ? room.tables.map((t) => {
            const heat = heatClassOf(t.id, tables);
            const fill =
              heat === 'hot'
                ? 'fill-terracotta-700'
                : heat === 'warm'
                  ? 'fill-terracotta-700/40'
                  : 'fill-ink/5';
            const stroke = heat === 'cold' ? 'stroke-ink/25' : 'stroke-terracotta-700';
            const label = heat === 'hot' ? 'fill-cream' : 'fill-ink/60';
            const cx = px(t.xPct);
            const cy = py(t.yPct);
            const wide = t.shape !== 'round' && t.shape !== 'sweetheart';
            return (
              <g key={t.id}>
                {t.shape === 'round' ? (
                  <circle cx={cx} cy={cy} r={15} className={`${fill} ${stroke}`} strokeWidth={1.1} />
                ) : (
                  <rect
                    x={cx - (wide ? 30 : 17)}
                    y={cy - 10}
                    width={wide ? 60 : 34}
                    height={20}
                    rx={4}
                    className={`${fill} ${stroke}`}
                    strokeWidth={1.1}
                  />
                )}
                {/*
                  13 USER UNITS, NOT 8.5 — AND THE LAYOUT MOVED TO THE TYPE.
                  The prototype sets these at 8.5px, which renders at about
                  eight real pixels: illegible to the guest this floor exists
                  for, and `lint-guest-legibility` fails it. A font-size inside
                  a viewBox is in USER UNITS, so what matters is what it
                  measures on screen: the lens column is 320px against a
                  340-unit box, so 13 units lands at ~12.2 real px — over the
                  floor. The tables were made bigger to hold it, which is the
                  right way round (S9 paid for learning this on the dial's hour
                  stamps). Marking it `legibility-ok` and leaving it at 8.5
                  would have been the other way round.
                */}
                <text
                  x={cx}
                  y={cy + 4.5}
                  textAnchor="middle"
                  className={`font-condensed text-[13px] font-bold tracking-[0.04em] ${label}`}
                >
                  {t.label}
                </text>
              </g>
            );
          })
        : null}
    </svg>
  );
}
