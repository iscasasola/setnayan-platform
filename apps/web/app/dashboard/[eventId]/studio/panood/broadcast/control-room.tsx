'use client';

import { useState, useTransition } from 'react';
import {
  Radio,
  Star,
  Video,
  Images,
  Sparkles,
  Tv,
  AlertTriangle,
  Wand2,
  Camera,
  MonitorPlay,
} from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  setProgramSource,
  setLive,
  fireMoment,
  setScreenSource,
  markHighlight,
  type ControlActionResult,
} from './actions';
import type { PanoodMomentRow } from '@/lib/panood-moments';
import type { PanoodControlState } from '@/lib/panood-control';

// Client-safe row shapes. The server page (broadcast/page.tsx) STRIPS server-only
// secrets — the camera claim_qr_token (a per-camera seat-hijack credential) and
// the screen pairing_code — before this data crosses into the 'use client'
// boundary, so they never reach the browser / RSC payload. These types
// intentionally omit them; the console only needs index/label/status/source.
type PanoodCameraRow = {
  id: number;
  camera_index: number;
  label: string | null;
  status: string;
};
type PanoodScreenRow = {
  id: number;
  screen_index: number;
  name: string | null;
  current_source: string;
  status: string;
};

/**
 * The REAL Panood multicam control room (iteration 0011, PR4) — client console.
 *
 * Layout (from the agreed prototypes + the switcher-UI research):
 *   • PROGRAM monitor — always-on, shows what's broadcasting (the anchor).
 *   • SOURCES rail — tally-bordered thumbnails: every camera + the two walls
 *     (Photo wall / Live background) as sources; tap = it's live (single-stage
 *     default — Preview/Take Director Mode is a later opt-in, NOT this PR).
 *   • MOMENT DIRECTOR — big one-tap moment buttons (the PRIMARY control for a
 *     non-engineer); tapping recomposes program + walls in one move.
 *   • SCREENS manager — per venue screen mode/source.
 *   • Go-live toggle + Mark.
 *
 * Every control calls a server action that PERSISTS to the control plane, then
 * we revalidate (the page is a server component, so the persisted state re-reads
 * on the next render). We use a pending transition + optimistic local echo so
 * the tally border / active chip flips instantly, then settles to server truth.
 *
 * Video feeds are PLACEHOLDERS — clearly labeled "preview — live video arrives
 * with the streaming rollout". No engine is wired yet.
 *
 * Responsive (locked mobile ruleset): desktop = a board; mobile = PROGRAM on
 * top + a swipeable camera strip + a bottom tab (Moments / Cameras / Walls) +
 * a thumb-zone Go-live.
 */

const WALL_SOURCES = [
  { key: 'photos', label: 'Photo wall', Icon: Images },
  { key: 'live_bg', label: 'Live background', Icon: Sparkles },
] as const;

const SCREEN_MODES = [
  { key: 'photos', label: 'Photos' },
  { key: 'mirror', label: 'Mirror' },
  { key: 'live_bg', label: 'Live bg' },
  { key: 'off', label: 'Off' },
] as const;

type MobileTab = 'moments' | 'cameras' | 'walls';

function cameraSourceKey(cam: PanoodCameraRow): string {
  return `cam${cam.camera_index}`;
}

function cameraLabel(cam: PanoodCameraRow): string {
  return cam.label?.trim() || `Camera ${cam.camera_index}`;
}

export function PanoodControlRoom({
  eventId,
  cameras,
  screens,
  moments,
  controlState,
}: {
  eventId: string;
  cameras: PanoodCameraRow[];
  screens: PanoodScreenRow[];
  moments: PanoodMomentRow[];
  controlState: PanoodControlState | null;
}) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // Optimistic local echo of the control plane — flips instantly on tap, then
  // the revalidated server render becomes the source of truth on next paint.
  const [program, setProgram] = useState<string | null>(
    controlState?.program_source ?? null,
  );
  const [live, setLiveLocal] = useState<boolean>(controlState?.is_live ?? false);
  const [activeMoment, setActiveMoment] = useState<number | null>(
    controlState?.active_moment_id ?? null,
  );
  const [screenSources, setScreenSources] = useState<Record<number, string>>(() =>
    Object.fromEntries(screens.map((s) => [s.id, s.current_source])),
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>('moments');

  function run(
    action: () => Promise<ControlActionResult>,
    onError?: () => void,
  ): void {
    startTransition(async () => {
      const res = await action();
      if ('error' in res) {
        toast.error(res.error);
        onError?.();
      }
    });
  }

  function handleSetProgram(source: string): void {
    const prev = program;
    setProgram(source); // optimistic
    setActiveMoment(null); // a manual cut clears the active-moment highlight
    run(
      () => setProgramSource(eventId, source),
      () => setProgram(prev),
    );
  }

  function handleFireMoment(moment: PanoodMomentRow): void {
    const prevProgram = program;
    const prevMoment = activeMoment;
    setActiveMoment(moment.id); // optimistic
    if (moment.config?.program_source) setProgram(moment.config.program_source);
    if (moment.config?.walls_source) {
      // optimistic walls echo
      setScreenSources((cur: Record<number, string>) => {
        const next = { ...cur };
        for (const s of screens) next[s.id] = moment.config!.walls_source!;
        return next;
      });
    }
    run(
      () => fireMoment(eventId, moment.id),
      () => {
        setActiveMoment(prevMoment);
        setProgram(prevProgram);
      },
    );
  }

  function handleSetScreen(screen: PanoodScreenRow, source: string): void {
    const prev = screenSources[screen.id] ?? screen.current_source;
    setScreenSources((cur: Record<number, string>) => ({ ...cur, [screen.id]: source }));
    run(
      () => setScreenSource(eventId, screen.id, source),
      () =>
        setScreenSources((cur: Record<number, string>) => ({
          ...cur,
          [screen.id]: prev,
        })),
    );
  }

  function handleToggleLive(): void {
    const next = !live;
    setLiveLocal(next); // optimistic
    run(
      () => setLive(eventId, next),
      () => setLiveLocal(!next),
    );
  }

  function handleMark(): void {
    run(async () => {
      const res = await markHighlight(eventId);
      if ('ok' in res) {
        toast.success('Highlight marked');
      }
      return res;
    });
  }

  const programLabel = labelForSource(program, cameras);

  return (
    <div className="space-y-5">
      {/* Preview-mode honesty banner */}
      <div className="rounded-lg border border-warn-300/60 bg-warn-50 p-3 text-sm text-warn-900">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={2} />
          Live control — video preview pending
        </span>
        <p className="mt-1">
          Your taps below are <strong>real</strong> and saved — they set the program
          source, fire moments, and route your venue screens right now. The video tiles
          are placeholders; live video arrives with the streaming rollout.
        </p>
      </div>

      {/* ===== DESKTOP BOARD ===== */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Left column: program + sources + moments */}
        <div className="space-y-5">
          <ProgramMonitor label={programLabel} live={live} />
          <SourcesRail
            cameras={cameras}
            program={program}
            onPick={handleSetProgram}
            disabled={isPending}
          />
          <MomentDirector
            moments={moments}
            activeMoment={activeMoment}
            onFire={handleFireMoment}
            disabled={isPending}
          />
        </div>

        {/* Right column: go-live + mark + screens */}
        <div className="space-y-5">
          <GoLivePanel
            live={live}
            onToggle={handleToggleLive}
            onMark={handleMark}
            disabled={isPending}
          />
          <ScreensManager
            screens={screens}
            sources={screenSources}
            onRoute={handleSetScreen}
            disabled={isPending}
          />
        </div>
      </div>

      {/* ===== MOBILE STACK ===== */}
      <div className="space-y-4 lg:hidden">
        <ProgramMonitor label={programLabel} live={live} />

        {/* Swipeable camera strip — always visible above the tabs */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {cameras.length === 0 ? (
            <p className="px-2 py-3 text-xs text-ink/55">
              No cameras provisioned yet — add them in Panood setup.
            </p>
          ) : (
            cameras.map((cam) => (
              <button
                key={cam.id}
                type="button"
                disabled={isPending}
                onClick={() => handleSetProgram(cameraSourceKey(cam))}
                className={`w-32 shrink-0 ${sourceTileClass(
                  program === cameraSourceKey(cam),
                )}`}
              >
                <SourceTileBody
                  Icon={Camera}
                  label={cameraLabel(cam)}
                  onAir={program === cameraSourceKey(cam)}
                  status={cam.status}
                />
              </button>
            ))
          )}
        </div>

        {/* Tab body */}
        <div className="min-h-[8rem]">
          {mobileTab === 'moments' && (
            <MomentDirector
              moments={moments}
              activeMoment={activeMoment}
              onFire={handleFireMoment}
              disabled={isPending}
            />
          )}
          {mobileTab === 'cameras' && (
            <SourcesRail
              cameras={cameras}
              program={program}
              onPick={handleSetProgram}
              disabled={isPending}
            />
          )}
          {mobileTab === 'walls' && (
            <ScreensManager
              screens={screens}
              sources={screenSources}
              onRoute={handleSetScreen}
              disabled={isPending}
            />
          )}
        </div>

        {/* Bottom tabs */}
        <nav
          aria-label="Control sections"
          className="sticky bottom-[5.5rem] z-10 grid grid-cols-3 gap-1 rounded-full border border-ink/10 bg-cream/95 p-1 shadow-sm backdrop-blur"
        >
          {(
            [
              { key: 'moments', label: 'Moments', Icon: Wand2 },
              { key: 'cameras', label: 'Cameras', Icon: Camera },
              { key: 'walls', label: 'Walls', Icon: MonitorPlay },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMobileTab(t.key)}
              className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium ${
                mobileTab === t.key
                  ? 'bg-ink text-cream'
                  : 'text-ink/65 hover:bg-ink/5'
              }`}
            >
              <t.Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Thumb-zone Go-live */}
        <div className="sticky bottom-3 z-10">
          <button
            type="button"
            onClick={handleToggleLive}
            disabled={isPending}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold shadow-md disabled:opacity-60 ${
              live
                ? 'bg-danger-600 text-cream'
                : 'bg-terracotta text-cream'
            }`}
          >
            <Radio aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            {live ? 'End broadcast' : 'Go live'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function labelForSource(source: string | null, cameras: PanoodCameraRow[]): string {
  if (!source) return 'Nothing on program yet';
  const cam = cameras.find((c) => cameraSourceKey(c) === source);
  if (cam) return cameraLabel(cam);
  const wall = WALL_SOURCES.find((w) => w.key === source);
  if (wall) return wall.label;
  return source;
}

function ProgramMonitor({ label, live }: { label: string; live: boolean }) {
  return (
    <section aria-label="Program monitor" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">
          Program
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
            live ? 'bg-danger-600 text-cream' : 'bg-ink/10 text-ink/60'
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              live ? 'animate-pulse bg-cream' : 'bg-ink/40'
            }`}
          />
          {live ? 'On air' : 'Off air'}
        </span>
      </div>
      <div
        className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border-2 bg-ink/90 text-cream/80 ${
          live ? 'border-danger-500' : 'border-ink/15'
        }`}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_70%)]"
        />
        <div className="relative text-center">
          <Tv aria-hidden className="mx-auto h-8 w-8 text-cream/60" strokeWidth={1.5} />
          <p className="mt-2 text-sm font-medium text-cream">{label}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/55">
            preview — live video arrives with the streaming rollout
          </p>
        </div>
      </div>
    </section>
  );
}

function sourceTileClass(onAir: boolean): string {
  return `overflow-hidden rounded-xl border-2 text-left transition-colors disabled:opacity-60 ${
    onAir
      ? 'border-danger-500 ring-2 ring-danger-500/30'
      : 'border-ink/10 hover:border-terracotta/50'
  }`;
}

function SourceTileBody({
  Icon,
  label,
  onAir,
  status,
}: {
  Icon: typeof Camera;
  label: string;
  onAir: boolean;
  status?: string;
}) {
  return (
    <>
      <div className="relative flex aspect-video items-center justify-center bg-ink/85 text-cream/70">
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.5} />
        {onAir && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-danger-600 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-cream">
            On air
          </span>
        )}
        {status && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-ink/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-cream/80">
            {status}
          </span>
        )}
      </div>
      <p className="truncate px-2 py-1.5 text-xs font-medium text-ink">{label}</p>
    </>
  );
}

function SourcesRail({
  cameras,
  program,
  onPick,
  disabled,
}: {
  cameras: PanoodCameraRow[];
  program: string | null;
  onPick: (source: string) => void;
  disabled: boolean;
}) {
  return (
    <section
      aria-label="Sources"
      className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">
          Sources
        </h2>
        <span className="text-[11px] text-ink/45">Tap a source to put it on air</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {cameras.map((cam) => {
          const key = cameraSourceKey(cam);
          const onAir = program === key;
          return (
            <button
              key={cam.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(key)}
              className={sourceTileClass(onAir)}
            >
              <SourceTileBody
                Icon={Camera}
                label={cameraLabel(cam)}
                onAir={onAir}
                status={cam.status}
              />
            </button>
          );
        })}

        {/* Walls as sources */}
        {WALL_SOURCES.map((wall) => {
          const onAir = program === wall.key;
          return (
            <button
              key={wall.key}
              type="button"
              disabled={disabled}
              onClick={() => onPick(wall.key)}
              className={sourceTileClass(onAir)}
            >
              <SourceTileBody Icon={wall.Icon} label={wall.label} onAir={onAir} />
            </button>
          );
        })}
      </div>

      {cameras.length === 0 && (
        <p className="text-xs text-ink/55">
          No cameras provisioned yet. Add camera operators in Panood setup — they’ll
          appear here as live sources.
        </p>
      )}

      {/* Audio-meter placeholders */}
      <div className="space-y-1 border-t border-ink/10 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
          Audio (preview)
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div aria-hidden className="h-full w-0 bg-success-400" />
        </div>
        <p className="text-[10px] text-ink/45">
          Live level meters arrive with the streaming rollout.
        </p>
      </div>
    </section>
  );
}

function MomentDirector({
  moments,
  activeMoment,
  onFire,
  disabled,
}: {
  moments: PanoodMomentRow[];
  activeMoment: number | null;
  onFire: (moment: PanoodMomentRow) => void;
  disabled: boolean;
}) {
  return (
    <section
      aria-label="Moment director"
      className="space-y-3 rounded-2xl border border-terracotta/25 bg-terracotta/5 p-4"
    >
      <div className="flex items-center gap-2">
        <Wand2 aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-terracotta-700">
          Moment director
        </h2>
      </div>
      <p className="text-xs text-ink/60">
        One tap recomposes the whole shot — the easiest way to run the show.
      </p>

      {moments.length === 0 ? (
        <p className="text-xs text-ink/55">
          Your moment rail is being set up — refresh in a moment.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {moments.map((m) => {
            const active = activeMoment === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabled}
                onClick={() => onFire(m)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-4 text-center transition-colors disabled:opacity-60 ${
                  active
                    ? 'border-terracotta bg-terracotta text-cream'
                    : 'border-ink/10 bg-cream text-ink hover:border-terracotta/50'
                }`}
              >
                <Star
                  aria-hidden
                  className={`h-5 w-5 ${active ? 'text-cream' : 'text-terracotta'}`}
                  strokeWidth={1.75}
                />
                <span className="text-xs font-semibold leading-tight">{m.label}</span>
                {active && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream/80">
                    Live
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GoLivePanel({
  live,
  onToggle,
  onMark,
  disabled,
}: {
  live: boolean;
  onToggle: () => void;
  onMark: () => void;
  disabled: boolean;
}) {
  return (
    <section
      aria-label="Broadcast controls"
      className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">
        Broadcast
      </h2>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold disabled:opacity-60 ${
          live ? 'bg-danger-600 text-cream' : 'bg-terracotta text-cream'
        }`}
      >
        <Radio aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        {live ? 'End broadcast' : 'Go live'}
      </button>
      <button
        type="button"
        onClick={onMark}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm font-medium text-ink hover:border-terracotta/40 disabled:opacity-60"
      >
        <Star aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        Mark highlight
      </button>
      <p className="text-[11px] text-ink/55">
        Mark a beat (vows, first kiss, first dance) and AI Highlight reels pull it
        first. Highlight saving lands with the streaming rollout.
      </p>
    </section>
  );
}

function ScreensManager({
  screens,
  sources,
  onRoute,
  disabled,
}: {
  screens: PanoodScreenRow[];
  sources: Record<number, string>;
  onRoute: (screen: PanoodScreenRow, source: string) => void;
  disabled: boolean;
}) {
  return (
    <section
      aria-label="Venue screens"
      className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4"
    >
      <div className="flex items-center gap-2">
        <MonitorPlay aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink/55">
          Venue screens
        </h2>
      </div>

      {screens.length === 0 ? (
        <p className="text-xs text-ink/55">
          No venue screens registered yet. Register displays in Panood setup to route
          photos, a mirror of the broadcast, or your live background to each one.
        </p>
      ) : (
        <ul className="space-y-3">
          {screens.map((screen) => {
            const current = sources[screen.id] ?? screen.current_source;
            return (
              <li
                key={screen.id}
                className="rounded-xl border border-ink/10 bg-cream/60 p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Video aria-hidden className="h-3.5 w-3.5 text-ink/45" strokeWidth={2} />
                  <span className="text-sm font-medium text-ink">
                    {screen.name?.trim() || `Screen ${screen.screen_index}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SCREEN_MODES.map((mode) => {
                    const on = current === mode.key;
                    return (
                      <button
                        key={mode.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => onRoute(screen, mode.key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                          on
                            ? 'bg-ink text-cream'
                            : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
