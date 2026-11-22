'use client';

/**
 * 👁 THE 3D ROOM'S TOOLS — the room is VIEW-ONLY (owner 2026-10-30, *"let's make 3d become view only because all are
 * plottend on the 2d"*). Every seat, table and floor edit lives on the 2D plan and the List; what stays here only changes
 * what you LOOK at, plus the Accents sheet (owner 2026-10-30: *"these doesn't need placement. just activate and its
 * there"* — nothing is plotted, so picking an accent is not a placement).
 *
 * WHERE THEY SIT is the approved Guests prototype (carry-2026-10-29/guests-proto, `render3D`): the room is drawn clean,
 * and its own few controls sit in ONE row along its bottom edge — the thumb zone — never as panels over the room.
 * The choices that are a set (tablecloths, centrepieces, the colour peek) are ONE dropdown (`Show ▾`).
 *
 * Nothing here writes the plan. `room-is-view-only.test.ts` holds that.
 *
 * 🗺 NO ⤢ (owner, iPhone app, 2026-10-30: *"we can remove that button … They are all full screen"*). The room is the
 * whole screen in Guests › Seats › 3D already — the row sits in the thumb zone, above the bottom nav, never over the
 * middle of the room. 🔒 lib/maps-are-always-full-screen.test.ts
 *
 * 🔤 EVERY CONTROL HAS A WORD (owner 2026-11-20, "Yes, your picks"; drawing § 6): ONE row of three, the same size —
 * Walk in · Accents · View only. ▶ became "Walk in"; ✨ is "Accents" (the same sheet); 👁 Show ▾ and the "View only ⓘ"
 * became one "View only" button, which reads "Editing" while this person holds the seat plan's edit. It opens a card:
 * who is editing and "Take over" (the seat plan's OWN take-over, handed down — `seat-room-link.ts`; the room takes no
 * lock), then Switch to 2D, Show ▾ and what the ⓘ said. Walking around and walking everyone in keep their words on the
 * line above while the room plays. In Guests the thumb row's search walks a guest to their seat, so Guide me leaves the
 * row there; a room drawn on its own keeps it. 🔒 the-room-says-its-controls.test.ts
 */

import { useState, type ReactNode } from 'react';
import { ArrowLeftRight, Eye, Footprints, Navigation, Pencil, Play, Sparkles, Square, Users } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ActionButton } from '@/components/action-button';
import type { SeatRoomLock } from '@/app/dashboard/[eventId]/seating/_components/seat-room-link';

/** One round glass tool: 44 px, a frame because it is pressable. */
const TOOL =
  'pointer-events-auto inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/60 aria-pressed:bg-raised aria-pressed:text-ink';
/** The main row's tools: one size each, icon and word. */
const MAIN = `${TOOL} min-w-0 flex-1 basis-0 whitespace-nowrap`;

export type RoomViewToolsProps = {
  playing: boolean;
  onPlay: (on: boolean) => void;
  walking: boolean;
  onWalk: (on: boolean) => void;
  crowdActive: boolean;
  canWalkEveryone: boolean;
  onWalkEveryone: () => void;
  onClearCrowd: () => void;
  /** 🧭 Guide me — pick a seated guest, watch them walk from the entrance to their seat (`seatApproachPath`). */
  guide: { options: readonly { key: string; label: string }[]; onPick: (guestId: string) => void; active: string | null };
  /** The thumb row's search does Guide me (Guests) — the row then leaves it out. */
  guideInSearch?: boolean;
  /** The seat plan's edit lock, as the plan hands it down (Guests); null when no plan holds one here. */
  lock?: SeatRoomLock | null;
  dancingCount: number;
  onClearFloor: () => void;
  sayHi: ReactNode;
  showCloth: boolean;
  showAccents: boolean;
  onShowCloth: (on: boolean) => void;
  onShowAccents: (on: boolean) => void;
  paletteKey: string;
  palettes: readonly { key: string; label: string }[];
  onPalette: (key: string) => void;
  /** Opens the Accents sheet; null when the viewer may not change accents. */
  onAccents: (() => void) | null;
  /** Switches to the 2D plan — where every edit lives. */
  onShow2d: () => void;
  /** The legend, the theme name and what the room is not drawing — the View only card's foot. */
  about: ReactNode;
};

/**
 * 🔒 The View only card's first line: who holds the seat plan's edit, and the plan's own "Take over" — or, when this
 * person holds it, that they do. After a press that did not take it (the holder is still active), it says so.
 */
export function RoomLockLine({ lock, tried, onTakeOver }: { lock: SeatRoomLock; tried: boolean; onTakeOver: () => void }) {
  if (lock.holding) {
    return (
      <p data-room-lock="mine" className="font-semibold">
        You are editing. Seats change on the 2D plan.
      </p>
    );
  }
  return (
    <div data-room-lock="" className="flex items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold [overflow-wrap:anywhere]">{lock.holder ?? 'Someone'} is editing</span>
        <span className="block text-xs text-ink/70">{tried && !lock.waiting ? 'Still theirs. Take over works once they stop.' : 'Take over to change seats.'}</span>
      </span>
      <ActionButton tone="brand" main icon={Pencil} label="Take over" waiting={lock.waiting} onClick={onTakeOver} data-room-take-over="" />
    </div>
  );
}

export function RoomViewTools(p: RoomViewToolsProps) {
  const [viewOpen, setViewOpen] = useState(false);
  /** "Take over" was pressed and the lock is still theirs — say so, never a press that looks like nothing happened. */
  const [tried, setTried] = useState(false);
  const lock = p.lock ?? null;
  const picked = [
    ...(p.showCloth ? ['cloth'] : []),
    ...(p.showAccents ? ['accents'] : []),
    `pal:${p.paletteKey}`,
  ];
  return (
    <div
      data-room-view-tools=""
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
    >
      {p.playing ? (
        <div className="flex flex-wrap gap-2" data-room-play-row="">
          <button type="button" onClick={() => p.onWalk(!p.walking)} aria-pressed={p.walking} className={TOOL}>
            <Footprints className="h-4 w-4" aria-hidden />
            {p.walking ? 'Exit walk' : 'Walk around'}
          </button>
          {!p.walking ? (
            <button
              type="button"
              onClick={p.crowdActive ? p.onClearCrowd : p.onWalkEveryone}
              disabled={!p.crowdActive && !p.canWalkEveryone}
              aria-pressed={p.crowdActive}
              className={`${TOOL} disabled:opacity-40`}
            >
              <Users className="h-4 w-4" aria-hidden />
              {p.crowdActive ? 'Clear the room' : 'Walk everyone in'}
            </button>
          ) : null}
          {p.dancingCount > 0 ? (
            <button type="button" onClick={p.onClearFloor} className={TOOL}>
              Sit everyone down · {formatCount(p.dancingCount)}
            </button>
          ) : null}
          {p.sayHi}
        </div>
      ) : null}
      {viewOpen ? (
        // A floating card over the room (a popover), not a section that opens in place: the press says so with
        // aria-haspopup, so it is not a hand-rolled fold (every-fold-reveals-on-open.test.ts).
        <div data-room-view-card="" role="dialog" aria-label="View only" className="sn-frame pointer-events-auto flex flex-col gap-2 p-3 text-sm text-ink">
          {lock ? (
            <RoomLockLine
              lock={lock}
              tried={tried}
              onTakeOver={() => {
                setTried(true);
                lock.onTakeOver();
              }}
            />
          ) : null}
          <span className="block text-ink/70">Editing happens in 2D — tables, seats and the floor.</span>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton tone="neutral" icon={ArrowLeftRight} label="Switch to 2D" onClick={p.onShow2d} data-room-show-2d="" />
            <PickMenu
              label="Show in the room"
              value={null}
              buttonText="Show"
              picked={picked}
              doneNote="Only on this screen — nothing is saved."
              options={[
                { key: 'cloth', label: 'Tablecloths', group: 'Show' },
                { key: 'accents', label: 'Centerpieces', group: 'Show' },
                ...p.palettes.map((pl) => ({ key: `pal:${pl.key}`, label: pl.label, group: 'Colours' })),
              ]}
              onPick={(k) => {
                if (k === 'cloth') p.onShowCloth(!p.showCloth);
                else if (k === 'accents') p.onShowAccents(!p.showAccents);
                else if (k.startsWith('pal:')) p.onPalette(k.slice(4));
              }}
              opensUp
              dataAttr="data-room-show"
            />
          </div>
          <span className="block text-xs text-ink/70">Drag to look around · pinch or scroll to zoom.</span>
          <span className="block space-y-2 text-xs">{p.about}</span>
        </div>
      ) : null}
      <div data-room-tools-row="" className="flex items-center gap-2">
        {p.guideInSearch ? null : (
          /* 🧭 GUIDE ME (owner 2026-11-01): the one test the view-only room runs — a guest's walk to their seat. In Guests
             the thumb row's search does it, so it is only here when the room is drawn on its own. */
          <PickMenu
            label="Guide me to a seat"
            value={p.guide.active}
            options={
              p.guide.options.length
                ? p.guide.options.map((o) => ({ key: o.key, label: o.label }))
                : [{ key: '-', label: 'Nobody is seated yet', disabledNote: 'Seat someone on the List or in 2D' }]
            }
            onPick={(k) => {
              if (k !== '-') p.guide.onPick(k);
            }}
            trigger={
              <>
                <Navigation className="h-4 w-4" aria-hidden />
                Guide me
              </>
            }
            className={MAIN}
            dataAttr="data-room-guide"
          />
        )}
        <button type="button" onClick={() => p.onPlay(!p.playing)} aria-pressed={p.playing} className={MAIN} data-room-walk-in="">
          {p.playing ? <Square className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {p.playing ? 'Stop' : 'Walk in'}
        </button>
        {p.onAccents ? (
          <button type="button" onClick={p.onAccents} className={MAIN} data-room-accents="">
            <Sparkles className="h-4 w-4" aria-hidden />
            Accents
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setViewOpen((o) => !o);
            setTried(false);
          }}
          aria-expanded={viewOpen}
          aria-haspopup="dialog"
          className={MAIN}
          data-room-view-only=""
        >
          <Eye className="h-4 w-4" aria-hidden />
          {lock?.holding ? 'Editing' : 'View only'}
        </button>
      </div>
    </div>
  );
}
