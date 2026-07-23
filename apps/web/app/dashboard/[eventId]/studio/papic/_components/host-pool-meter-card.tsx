import { Gauge } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolBarEnabled } from '@/lib/papic-pool-bar-flag';
import { fetchHostPoolMeter } from '@/lib/papic-pool-meter';
import {
  PAPIC_POINTS_PER_CLIP,
  PAPIC_POINTS_PER_PHOTO,
} from '@/lib/papic-cameras';

/**
 * Host Papic Pool Meter — the couple's READ-ONLY view of the event capture
 * pool (build ③ PR-1, study § 3.4 "parity pool-meter card"). Server
 * component, self-gating like its siblings (LiveWallCard et al.):
 *
 *   1. env flag NEXT_PUBLIC_PAPIC_POOL_BAR (off by default) → null;
 *   2. membership — the event row is read under the VIEWER'S RLS session, so
 *      a non-member resolves nothing and the card renders null (same posture
 *      as the sibling cards' own-session entitlement reads);
 *   3. pool applies — events with neither a flat pass nor any ledger grant
 *      read back "pool absent" and get no meter (nothing is metered there).
 *
 * The numbers come from the SHIPPED reader (papic_event_pool_status via
 * fetchEventPoolStatus → fetchHostPoolMeter) — the same truth the fail-closed
 * reserve RPC enforces on the capture path. Display only: this card never
 * gates anything, and deliberately carries NO purchase copy or doorway — the
 * top-up path is a later, separately-supervised PR.
 *
 * NOTE (owner 2026-07-23): Papic One camera points are conceptually DEDICATED
 * per camera, but the shipped ledger pools them event-wide (no seat scoping on
 * grants or usage) — so this meter truthfully shows the one shared pool the
 * reserve RPC actually enforces. See lib/papic-pool-meter.ts header.
 */
export async function HostPoolMeterCard({ eventId }: { eventId: string }) {
  if (!papicPoolBarEnabled()) return null;

  // Membership gate — under the viewer's own RLS session, not the admin client.
  const supabase = await createClient();
  const { data: memberEvent } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!memberEvent) return null;

  // Pool read — admin client on purpose: the pool ledger carries no read
  // policy (SECURITY DEFINER RPC), exactly like the shipped capture-path read.
  const meter = await fetchHostPoolMeter(createAdminClient(), eventId);
  if (!meter) return null;

  const fmt = (n: number) => n.toLocaleString('en-PH');
  const barPct = Math.max(meter.pctRemaining, meter.level === 'exhausted' ? 0 : 2);

  const barFill =
    meter.level === 'exhausted'
      ? 'bg-red-500'
      : meter.level === 'low'
        ? 'bg-amber-500'
        : 'bg-terracotta';

  return (
    <section
      className={`rounded-2xl border p-5 sm:p-6 ${
        meter.level === 'exhausted'
          ? 'border-red-300/80 bg-red-50/60'
          : meter.level === 'low'
            ? 'border-amber-300/80 bg-amber-50/60'
            : 'border-ink/10 bg-surface'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Gauge aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
            Capture pool
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Your event&rsquo;s shared pool of capture points —{' '}
            {PAPIC_POINTS_PER_PHOTO === 1
              ? 'a photo is 1 point'
              : `a photo is ${PAPIC_POINTS_PER_PHOTO} points`}
            , a 10-second clip is {PAPIC_POINTS_PER_CLIP}.
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
            {fmt(meter.remainingPoints)}
          </span>
          <span className="block text-xs text-ink/55">
            of {fmt(meter.totalPoints)} points left
          </span>
        </p>
      </div>

      <div
        role="meter"
        aria-label="Capture points remaining"
        aria-valuemin={0}
        aria-valuemax={meter.totalPoints}
        aria-valuenow={meter.remainingPoints}
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-ink/10"
      >
        <div
          className={`h-full rounded-full transition-[width] ${barFill}`}
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-ink/55">
          {fmt(meter.usedPoints)} used
          {meter.grantedPoints > 0 ? (
            <> · includes {fmt(meter.grantedPoints)} added points</>
          ) : null}
        </span>
        {meter.level === 'exhausted' ? (
          <span className="font-medium text-red-700">
            Pool exhausted — cameras can&rsquo;t capture more.
          </span>
        ) : meter.level === 'low' ? (
          <span className="font-medium text-amber-800">
            Running low — under 10% of your pool remains.
          </span>
        ) : null}
      </div>
    </section>
  );
}
