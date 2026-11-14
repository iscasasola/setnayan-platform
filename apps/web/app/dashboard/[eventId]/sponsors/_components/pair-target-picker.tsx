'use client';

import { PickMenu } from '../../website/editor/_components/pick-menu';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import {
  PRINCIPAL_PAIR_DEFAULT,
  PRINCIPAL_PAIR_MAX,
  PRINCIPAL_PAIR_MIN,
} from '@/lib/event-sponsors';

/** Per-event localStorage prefix. Owner-reported 2026-05-24: the prior
 *  global key `setnayan_principal_pair_target` leaked pair-count picks
 *  across events — a host who picked "8 pairs" on Event A would see Event
 *  B's picker pre-fill to 8 instead of the default 4 on first visit. The
 *  STORAGE_KEY is now built from eventId so each event keeps its own
 *  history. Matches the `${STORAGE_KEY_PREFIX}${eventId}` pattern from
 *  `apps/web/app/_components/auto-preload-on-event-day.tsx`. */
const STORAGE_KEY_PREFIX = 'setnayan:principal_pair_target:';
const storageKeyFor = (eventId: string) => `${STORAGE_KEY_PREFIX}${eventId}`;

type Props = {
  /** Event scope · drives the per-event localStorage key so pair-count
   *  picks don't leak across the host's events (owner-reported 2026-05-24). */
  eventId: string;
  /** Server-resolved target (clamped to [MIN, MAX]). The picker reads from
   *  the URL ?pairs= param; this prop is the displayed value. */
  currentTarget: number;
  /** Highest pair_index already in use — picker can't drop below this without
   *  removing sponsors first. Surfaced as a disabled-decrease hint. */
  highestUsedPair: number;
};

/**
 * Lets the host pick how many principal-sponsor pairs they want to invite
 * (2–12). Filipino weddings most commonly invite 4 pairs (8 individuals);
 * elaborate weddings can run up to 12 pairs (24 individuals).
 *
 * Persistence:
 *   - Active value lives in the URL ?pairs= query param so the count
 *     survives reload + revalidation + sharing the link with a co-host.
 *   - We also mirror to localStorage (PER-EVENT key) so the next visit
 *     pre-selects the host's previous pick when ?pairs= isn't supplied,
 *     without leaking across events.
 *
 * No DB column — target is a UX shape, not durable data. The schema doesn't
 * care how many slots are visible; only filled rows are persisted.
 */
export function PairTargetPicker({ eventId, currentTarget, highestUsedPair }: Props) {
  const STORAGE_KEY = storageKeyFor(eventId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Mirror current selection to localStorage so the next visit pre-selects.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(currentTarget));
    } catch {
      /* localStorage may be blocked — best-effort only */
    }
  }, [currentTarget]);

  // On first mount, if the URL doesn't carry ?pairs=, hydrate from
  // localStorage. This avoids a flash of the default value for repeat visits.
  useEffect(() => {
    const urlVal = searchParams.get('pairs');
    if (urlVal !== null) return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const n = Number.parseInt(saved, 10);
      if (Number.isNaN(n)) return;
      if (n < PRINCIPAL_PAIR_MIN || n > PRINCIPAL_PAIR_MAX) return;
      if (n === currentTarget) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set('pairs', String(n));
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    } catch {
      /* best-effort */
    }
    // We deliberately depend only on first-mount inputs — running on every
    // searchParams change would loop. eslint-disable-next-line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTarget(n: number) {
    const clamped = Math.max(
      Math.max(PRINCIPAL_PAIR_MIN, highestUsedPair),
      Math.min(PRINCIPAL_PAIR_MAX, n),
    );
    const params = new URLSearchParams(searchParams.toString());
    params.set('pairs', String(clamped));
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const options: number[] = [];
  for (let i = PRINCIPAL_PAIR_MIN; i <= PRINCIPAL_PAIR_MAX; i += 1) options.push(i);

  return (
    <div className="inline-flex flex-wrap items-center gap-2" aria-busy={isPending || undefined}>
      <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
        Pairs to invite
      </span>
      {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rule 4): the ▾ picker. A count below the pairs already filled was never
          pickable (it was a disabled option) — it is simply not offered. */}
      <PickMenu
        label="Pairs to invite"
        value={String(currentTarget)}
        options={options
          .filter((n) => n >= highestUsedPair)
          .map((n) => ({ key: String(n), label: `${n} pairs (${n * 2} ninong/ninang)` }))}
        onPick={(k) => {
          if (!isPending) setTarget(Number.parseInt(k, 10));
        }}
        dataAttr="data-sponsor-pairs"
      />
      {highestUsedPair > PRINCIPAL_PAIR_DEFAULT ? (
        <span className="text-xs text-ink/70">
          Remove sponsors from a pair to drop below {highestUsedPair}.
        </span>
      ) : null}
      <noscript>
        <Link
          href={`?pairs=${PRINCIPAL_PAIR_DEFAULT}`}
          className="text-xs text-terracotta underline"
        >
          Reset to {PRINCIPAL_PAIR_DEFAULT} pairs
        </Link>
      </noscript>
    </div>
  );
}
