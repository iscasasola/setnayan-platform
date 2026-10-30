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
 */

import type { ReactNode } from 'react';
import { Eye, Footprints, Maximize2, Minimize2, Play, Sparkles, Square, Users } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/** One round glass tool: 44 px, a frame because it is pressable. */
const TOOL =
  'pointer-events-auto inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/60 aria-pressed:bg-white aria-pressed:text-ink';

export type RoomViewToolsProps = {
  playing: boolean;
  onPlay: (on: boolean) => void;
  walking: boolean;
  onWalk: (on: boolean) => void;
  crowdActive: boolean;
  canWalkEveryone: boolean;
  onWalkEveryone: () => void;
  onClearCrowd: () => void;
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
  fullscreen: boolean;
  onFullscreen: () => void;
  /** Switches to the 2D plan — where every edit lives. */
  onShow2d: () => void;
  /** The legend, the theme name and what the room is not drawing — the ⓘ's body below the 2D line. */
  about: ReactNode;
};

export function RoomViewTools(p: RoomViewToolsProps) {
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
      {p.playing && (p.dancingCount > 0 || p.sayHi) ? (
        <div className="flex flex-wrap gap-2">
          {p.dancingCount > 0 ? (
            <button type="button" onClick={p.onClearFloor} className={TOOL}>
              Sit everyone down · {formatCount(p.dancingCount)}
            </button>
          ) : null}
          {p.sayHi}
        </div>
      ) : null}
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => p.onPlay(!p.playing)}
            aria-pressed={p.playing}
            aria-label={p.playing ? 'Stop' : 'Play'}
            title={p.playing ? 'Stop' : 'Play — the room as your guests see it'}
            className={TOOL}
          >
            {p.playing ? <Square className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          </button>
          {p.playing ? (
            <>
              <button
                type="button"
                onClick={() => p.onWalk(!p.walking)}
                aria-pressed={p.walking}
                aria-label={p.walking ? 'Exit walk' : 'Walk around'}
                title={p.walking ? 'Exit walk' : 'Walk around'}
                className={TOOL}
              >
                <Footprints className="h-4 w-4" aria-hidden />
              </button>
              {!p.walking ? (
                <button
                  type="button"
                  onClick={p.crowdActive ? p.onClearCrowd : p.onWalkEveryone}
                  disabled={!p.crowdActive && !p.canWalkEveryone}
                  aria-pressed={p.crowdActive}
                  aria-label={p.crowdActive ? 'Clear the room' : 'Walk everyone in'}
                  title={p.crowdActive ? 'Clear the room' : 'Walk everyone in'}
                  className={`${TOOL} disabled:opacity-40`}
                >
                  <Users className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {p.onAccents ? (
            <button type="button" onClick={p.onAccents} aria-label="Accents" title="Accents" className={TOOL} data-room-accents="">
              <Sparkles className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <PickMenu
            label="Show in the room"
            value={null}
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
            trigger={<Eye className="h-4 w-4" aria-hidden />}
            className={TOOL}
            dataAttr="data-room-show"
          />
          {/* The ⓘ opens UPWARD (`.sn-tip` hangs below by default, and below is the room's clipped edge). */}
          <span className="pointer-events-auto inline-flex h-11 items-center rounded-full border border-white/20 bg-black/45 px-3 text-xs font-medium text-white/85 backdrop-blur-md [&>span>button]:border-white/40 [&>span>button]:text-white [&_.sn-tip]:bottom-full [&_.sn-tip]:top-auto [&_.sn-tip]:pb-2 [&_.sn-tip]:pt-0">
            <InfoTip label="View only" align="end">
              <span className="block space-y-2 text-left">
                <span className="block">Editing happens in 2D — tables, seats and the floor are all set on the 2D plan.</span>
                <button
                  type="button"
                  onClick={p.onShow2d}
                  data-room-show-2d=""
                  className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm font-medium text-ink hover:bg-ink/5"
                >
                  Switch to 2D
                </button>
                <span className="block text-ink/60">Drag to look around · pinch or scroll to zoom.</span>
                {p.about}
              </span>
            </InfoTip>
          </span>
          <button
            type="button"
            onClick={p.onFullscreen}
            aria-label={p.fullscreen ? 'Exit full screen' : 'Enter full screen'}
            title={p.fullscreen ? 'Exit full screen' : 'Full screen'}
            className={TOOL}
          >
            {p.fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
