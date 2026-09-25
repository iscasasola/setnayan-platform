import {
  MAKER_EVENT_MEDIA_BYTES_CAP,
  formatMakerMediaMeterLabel,
  makerMediaMeterState,
} from '@/lib/maker-media-limits';

/**
 * THE 100 MB METER — Event Hub Maker, Phase 4 (DECISION_LOG 2026-09-25).
 *
 * A pure presentational read of `makerMediaMeterState` (`lib/maker-media-limits.ts`)
 * — no data fetching here, so it mounts the same whether the caller read
 * `events.couple_media_bytes` from a server component or a client refresh.
 * Exported for the Maker shell (Phase 1) to place in its inspector; this file
 * owns the METER, not where it sits in the chrome.
 *
 * No CSS import — Tailwind utility classes only, the same tokens
 * `app/_components/file-upload.tsx`'s own progress bar already uses, so the
 * two read as one visual language rather than two components that happen to
 * sit near each other.
 */
export function MakerMediaMeter({
  usedBytes,
  capBytes = MAKER_EVENT_MEDIA_BYTES_CAP,
  className,
}: {
  /** `events.couple_media_bytes` for this event — bytes, already compressed. */
  usedBytes: number;
  /** Defaults to the owner's 100 MB allowance; a prop only so a test can shrink it. */
  capBytes?: number;
  className?: string;
}) {
  const state = makerMediaMeterState(usedBytes, capBytes);
  return (
    <div className={className ? `space-y-1 ${className}` : 'space-y-1'}>
      <div className="flex items-center justify-between text-xs font-medium text-ink/75">
        <span>Storage</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
          {formatMakerMediaMeterLabel(state)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(state.pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Event media storage used"
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            state.isFull
              ? 'bg-danger-700'
              : state.isNear
                ? 'bg-terracotta'
                : 'bg-mulberry'
          }`}
          style={{ width: `${state.pct}%` }}
        />
      </div>
      {state.isFull ? (
        <p className="text-[10px] text-danger-700">
          You’ve used your event’s full storage allowance — remove something to add more.
        </p>
      ) : state.isNear ? (
        <p className="text-[10px] text-ink/55">Getting close to your event’s storage allowance.</p>
      ) : null}
    </div>
  );
}
