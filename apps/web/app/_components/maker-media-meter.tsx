import Link from 'next/link';
import {
  coupleMediaCapBytes,
  formatMakerMediaMB,
  formatMakerMediaMeterLabel,
  makerMediaMeterState,
} from '@/lib/maker-media-limits';

/**
 * THE MEDIA METER — Event Hub Maker, Phase 4 (DECISION_LOG 2026-09-25); the
 * allowance follows the plan since 2026-10-15 (Free 10 MB · Event Hub Pro 500 MB).
 *
 * A pure presentational read of `makerMediaMeterState` (`lib/maker-media-limits.ts`)
 * — no data fetching here, so it mounts the same whether the caller read
 * `events.couple_media_bytes` from a server component or a client refresh.
 * Exported for the Maker shell (Phase 1) to place in its inspector; this file
 * owns the METER, not where it sits in the chrome.
 *
 * THE NUMBER IS THE PLAN'S: the caller passes the `capBytes` that
 * `coupleMediaCapBytes(isPro)` names for this event — never a constant of its
 * own. A FREE couple who has used the whole allowance reads ONE line about Pro
 * (◆ — Pro marks itself, it never blocks; no padlock) with "Unlock Pro" on the
 * existing upgrade path when the caller passes `proHref`.
 *
 * No CSS import — Tailwind utility classes only, the same tokens
 * `app/_components/file-upload.tsx`'s own progress bar already uses, so the
 * two read as one visual language rather than two components that happen to
 * sit near each other.
 */
export function MakerMediaMeter({
  usedBytes,
  capBytes,
  proHref,
  className,
}: {
  /** `events.couple_media_bytes` for this event — bytes, already compressed. */
  usedBytes: number;
  /** `coupleMediaCapBytes(isPro)` for this event — the plan's number, never a literal. */
  capBytes: number;
  /** The existing Event Hub Pro buy path. Given ONLY to a Free event — its presence is what makes this a Free meter. */
  proHref?: string | null;
  className?: string;
}) {
  const state = makerMediaMeterState(usedBytes, capBytes);
  const proBytes = coupleMediaCapBytes(true);
  const offerPro = Boolean(proHref) && state.capBytes < proBytes;
  return (
    <div className={className ? `space-y-1 ${className}` : 'space-y-1'}>
      <p className="text-xs font-medium text-ink/75">{formatMakerMediaMeterLabel(state)}</p>
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
      {state.isFull && offerPro ? (
        <p className="text-xs text-ink/75">
          ◆ Event Hub Pro gives you {formatMakerMediaMB(proBytes)}.{' '}
          {/* 12 px words, pressed at 44+ (`.sn-hit` — batch 7 R2: it was 10 px in a 13 px box). */}
          <Link href={proHref as string} className="sn-hit inline-block text-xs font-medium underline underline-offset-2">
            Unlock Pro
          </Link>
        </p>
      ) : null}
    </div>
  );
}
