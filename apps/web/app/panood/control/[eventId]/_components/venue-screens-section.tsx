import { AlertCircle, Lock, MonitorPlay, Plus, PowerOff, RefreshCw, Sparkles, Trash2, Tv } from 'lucide-react';
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import type { PanoodScreenRow } from '@/lib/panood-screens';
import {
  LIVE_SCREEN_MODES,
  LIVE_SCREEN_MODE_LABEL,
  MAX_LIVE_SCREENS,
  MIRROR_DELAY_NOTICE,
  VENUE_SCREENS_LOCKED_MESSAGE,
  canAddScreen,
  defaultScreenName,
  isLiveScreenMode,
  mirrorHasSource,
  pairCodeUsable,
  screenPresence,
  type LiveScreenMode,
} from '@/lib/live-screens';
import {
  addLiveScreen,
  reissueLiveScreenCode,
  removeLiveScreen,
  renameLiveScreen,
  setAllLiveScreensMode,
  setLiveScreenMode,
} from '../screens-actions';

/**
 * VENUE SCREENS (DAY-12) — the controller's screens manager.
 *
 * Owner rulings 2026-09-20: screens live here; each shows live background,
 * mirror or off — never the photo wall; a mirroring screen says it is behind.
 * SEPARATE owner ruling, same day: screens come WITH the paid Live Studio
 * unlock — no second charge. `entitled` (== the controller's own
 * `broadcastWindow.reason !== 'not-owned'`) decides whether this section's
 * writable controls render; the server actions (screens-actions.ts `gate()`)
 * enforce the same rule independently, so a stale render can never write.
 * Removing a screen is the one control that survives being locked — cleanup.
 *
 * `screens === null` means the read was REFUSED, and that is said out loud.
 * Rendering it as an empty list would tell a host mid-event that their paired
 * TVs do not exist — the "failure that renders like emptiness" this repo has
 * fixed seven times.
 */

const MODE_ICON: Record<LiveScreenMode, typeof Tv> = {
  live_bg: Sparkles,
  mirror: MonitorPlay,
  off: PowerOff,
};

const BTN =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors';
const BTN_IDLE = 'border-ink/15 bg-white text-ink/75 hover:border-terracotta/50 hover:text-ink';
const BTN_ON = 'border-burgundy bg-burgundy text-cream';

export function VenueScreensSection({
  eventId,
  screens,
  hasWatchUrl,
  pairUrlBase,
  nowMs,
  banner,
  entitled,
  unlockHref,
  unlockCtaLabel,
}: {
  eventId: string;
  screens: PanoodScreenRow[] | null;
  /** Whether the event has a YouTube watch link the mirror can embed. */
  hasWatchUrl: boolean;
  /** e.g. https://www.setnayan.com/live */
  pairUrlBase: string;
  nowMs: number;
  banner: string | null;
  /** Owner ruling 2026-09-20: screens come WITH the paid Live Studio unlock. */
  entitled: boolean;
  /** The controller's EXISTING unlock detail page — never a second purchase path. */
  unlockHref: string;
  unlockCtaLabel: string;
}) {
  const active = (screens ?? []).filter((s) => !s.revoked_at);
  const pairHost = pairUrlBase.replace(/^https?:\/\//, '');

  return (
    <section id="screens" aria-labelledby="screens-heading" className="sn-tile space-y-4 p-5 sm:p-6">
      <div className="space-y-1">
        <p className="sn-eye">Venue screens</p>
        <h2 id="screens-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Tv aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Screens in the room
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Any TV, projector or LED wall with a browser. Add a screen here, open{' '}
          <strong className="font-mono text-ink/85">{pairHost}</strong> on it, and type its code. Then choose
          what each one shows: your monogram, your livestream, or nothing. Up to {MAX_LIVE_SCREENS} screens.
        </p>
      </div>

      {banner ? (
        <p role="status" className="rounded-xl border border-ink/15 bg-cream px-3 py-2 text-sm text-ink/80">
          {banner}
        </p>
      ) : null}

      {!entitled ? (
        <Link
          href={unlockHref}
          data-testid="venue-screens-locked"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-terracotta/40 bg-terracotta/[0.07] px-3.5 py-2.5 text-xs leading-snug text-ink/75 transition-colors hover:bg-terracotta/[0.12]"
        >
          <Lock aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{VENUE_SCREENS_LOCKED_MESSAGE}</span>
            Add, pair and drive a TV once Live Studio is unlocked. Already-added screens stay
            listed and removable below.
          </span>
          <span className="shrink-0 rounded-lg bg-mulberry px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-cream">
            {unlockCtaLabel}
          </span>
        </Link>
      ) : null}

      {screens === null ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger-300/70 bg-danger-50 px-3 py-2 text-sm text-danger-900">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          We couldn&rsquo;t load your screens just now. Any screen already connected keeps showing what you last
          chose. Reload in a moment.
        </p>
      ) : null}

      {entitled && !hasWatchUrl ? (
        <p className="flex items-start gap-2 rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2 text-xs text-ink/65">
          <MonitorPlay aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Mirroring needs your YouTube watch link (under &ldquo;How guests watch&rdquo;). Until it is saved, a screen
          set to mirror shows your live background instead.
        </p>
      ) : null}

      {entitled && active.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/50">All screens</span>
          {LIVE_SCREEN_MODES.map((mode) => {
            const Icon = MODE_ICON[mode];
            return (
              <form key={mode} action={setAllLiveScreensMode}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="mode" value={mode} />
                <SubmitButton pendingLabel="…" className={`${BTN} ${BTN_IDLE}`}>
                  <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {LIVE_SCREEN_MODE_LABEL[mode]}
                </SubmitButton>
              </form>
            );
          })}
        </div>
      ) : null}

      {active.length > 0 ? (
        <ul className="space-y-3">
          {active.map((s) => (
            <ScreenRow
              key={s.id}
              eventId={eventId}
              screen={s}
              nowMs={nowMs}
              pairHost={pairHost}
              entitled={entitled}
            />
          ))}
        </ul>
      ) : screens !== null ? (
        <p className="text-sm text-ink/60">No screens yet.</p>
      ) : null}

      {entitled && screens !== null && canAddScreen(active.length) ? (
        <form action={addLiveScreen} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="event_id" value={eventId} />
          <input
            type="text"
            name="name"
            maxLength={40}
            placeholder="Name it — e.g. Stage left, Lobby"
            className="min-h-[44px] flex-1 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
          />
          <SubmitButton
            pendingLabel="Adding…"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-burgundy/20 bg-burgundy px-4 text-sm font-semibold text-cream transition-colors hover:bg-burgundy/90"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Add a screen
          </SubmitButton>
        </form>
      ) : null}
    </section>
  );
}

function ScreenRow({
  eventId,
  screen,
  nowMs,
  pairHost,
  entitled,
}: {
  eventId: string;
  screen: PanoodScreenRow;
  nowMs: number;
  pairHost: string;
  entitled: boolean;
}) {
  const presence = screenPresence(screen, nowMs);
  const mode: LiveScreenMode = isLiveScreenMode(screen.current_source) ? screen.current_source : 'live_bg';
  const name = screen.name ?? defaultScreenName(screen.screen_index);
  const codeLive = pairCodeUsable(screen, nowMs);

  // LOCKED: every write below except Remove is refused server-side too
  // (screens-actions.ts `gate()`), so the row only offers what it can do —
  // rename, mode and re-code all disappear, and Remove (cleanup) stays.
  if (!entitled) {
    return (
      <li className="sn-row space-y-2 p-4" data-testid="venue-screen-row">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</span>
          <PresencePill presence={presence} />
        </div>
        <p className="text-xs text-ink/55">Locked with Live Studio. It can still be removed.</p>
        <form action={removeLiveScreen}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="screen_id" value={screen.id} />
          <SubmitButton pendingLabel="…" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/60 hover:text-burgundy">
            <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Remove
          </SubmitButton>
        </form>
      </li>
    );
  }

  return (
    <li className="sn-row space-y-3 p-4" data-testid="venue-screen-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form action={renameLiveScreen} className="flex min-w-0 flex-1 items-center gap-2">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="screen_id" value={screen.id} />
          <label htmlFor={`screen-name-${screen.id}`} className="sr-only">
            Screen name
          </label>
          <input
            id={`screen-name-${screen.id}`}
            name="name"
            defaultValue={screen.name ?? ''}
            placeholder={defaultScreenName(screen.screen_index)}
            maxLength={40}
            className="min-h-[36px] min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-ink hover:border-ink/15 focus:border-terracotta focus:outline-none"
          />
          <SubmitButton pendingLabel="…" className="text-xs font-semibold text-ink/50 hover:text-ink">
            Rename
          </SubmitButton>
        </form>
        <PresencePill presence={presence} />
      </div>

      {presence === 'waiting' ? (
        codeLive && screen.pairing_code ? (
          <p className="text-sm text-ink/75">
            On {name}, open <strong className="font-mono">{pairHost}</strong> and type{' '}
            <strong className="font-mono text-base tracking-[0.2em] text-ink" data-testid="screen-pair-code">
              {screen.pairing_code}
            </strong>
          </p>
        ) : (
          <p className="text-sm text-ink/65">This code has expired. Get a new one below.</p>
        )
      ) : null}

      <div className="flex flex-wrap gap-2" role="group" aria-label={`What ${name} shows`}>
        {LIVE_SCREEN_MODES.map((m) => {
          const Icon = MODE_ICON[m];
          const on = m === mode;
          return (
            <form key={m} action={setLiveScreenMode}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="screen_id" value={screen.id} />
              <input type="hidden" name="mode" value={m} />
              <SubmitButton pendingLabel="…" aria-pressed={on} className={`${BTN} ${on ? BTN_ON : BTN_IDLE}`}>
                <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {LIVE_SCREEN_MODE_LABEL[m]}
              </SubmitButton>
            </form>
          );
        })}
      </div>
      {mode === 'mirror' ? <p className="text-xs text-ink/55">The screen shows: &ldquo;{MIRROR_DELAY_NOTICE}&rdquo;</p> : null}

      <div className="flex flex-wrap gap-3 border-t border-ink/10 pt-3">
        <form action={reissueLiveScreenCode}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="screen_id" value={screen.id} />
          <SubmitButton pendingLabel="…" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/60 hover:text-ink">
            <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {presence === 'waiting' ? 'New code' : 'Swap device (new code)'}
          </SubmitButton>
        </form>
        <form action={removeLiveScreen}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="screen_id" value={screen.id} />
          <SubmitButton pendingLabel="…" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/60 hover:text-burgundy">
            <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Remove
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

function PresencePill({ presence }: { presence: ReturnType<typeof screenPresence> }) {
  const [label, cls] =
    presence === 'on'
      ? ['Connected', 'border-success-300/70 bg-success-50 text-success-900']
      : presence === 'not_responding'
        ? ['Not responding', 'border-danger-300/70 bg-danger-50 text-danger-900']
        : ['Waiting to connect', 'border-ink/15 bg-cream text-ink/70'];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
  );
}
