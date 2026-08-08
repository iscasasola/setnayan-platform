import { Camera } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPapicOneTiers } from '@/lib/papic-one';
import { papicOneRungPhrase } from '@/lib/papic-tier-copy';
import { purchasePapicOneCamera } from '../actions';

/**
 * Papic ONE — buy a dedicated camera, or RELOAD one you already have.
 *
 * The MINIMAL server seam for the two-type model (owner-locked 2026-07-29).
 * Deliberately plain: the polished card ships with the Papic onboarding cards
 * in a later PR, and shipping a beautiful card here would mean building it
 * twice. What this must NOT be is absent — a reload path with no doorway is a
 * mechanic nobody can reach, and the free One camera it tops up is armed for
 * every event from this PR onward.
 *
 * Every number on screen is DERIVED: rung points from papic_one_tiers, rung
 * price from platform_retail_catalog_v2, the phrase itself from
 * lib/papic-tier-copy.ts. Nothing here spells a peso figure or a shot count.
 *
 * The reload picker lists the event's cameras that HOLD a dedicated balance —
 * i.e. the free One camera and any bought One cameras. Cameras that draw the
 * shared pool are not reloadable by definition (their shots are the pool's),
 * so offering them here would sell a couple something that cannot happen.
 */
/**
 * The refusals the buy action can redirect with. Spelled out here rather than
 * shown raw, because "unknown_camera" on screen tells the couple nothing — and a
 * refusal they cannot read is indistinguishable from a button that did nothing.
 */
const ERROR_COPY: Record<string, string> = {
  unknown_rung: 'That option is no longer available. Pick one of the sizes below.',
  unavailable: 'That option is not on sale right now. Try another size.',
  unknown_camera: "That camera isn't part of this event any more. Pick another one.",
  camera_failed: "We couldn't set the camera up, so nothing was charged. Please try again.",
  order_failed: "We couldn't start that order, so nothing was charged. Please try again.",
};

export async function PapicOneCard({
  eventId,
  error,
}: {
  eventId: string;
  error?: string | null;
}) {
  const admin = createAdminClient();

  const [tiers, cameras] = await Promise.all([
    fetchPapicOneTiers(admin),
    listDedicatedCameras(admin, eventId),
  ]);
  if (tiers.length === 0) return null;

  const prices = await fetchRungPrices(
    admin,
    tiers.map((t) => t.serviceCode),
  );

  const rungs = tiers
    .map((t) => ({ ...t, pricePhp: prices.get(t.serviceCode) ?? null }))
    .filter((t) => t.pricePhp != null && t.pricePhp > 0);
  if (rungs.length === 0) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
          <Camera aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
          Papic One — a camera of its own
        </p>
        <p className="text-sm text-ink/70">
          One camera, its own QR, and its own shots. Nobody else can spend them.
          You can add more shots to a camera you already have — the QR stays the
          same, so whoever is holding it keeps shooting.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700">
          {ERROR_COPY[error] ?? 'Something went wrong, and nothing was charged. Please try again.'}
        </p>
      )}

      {cameras.length > 0 && (
        <ul className="space-y-1 text-sm text-ink/70">
          {cameras.map((c) => (
            <li key={c.seatId}>
              Camera #{c.seatIndex} — {c.remaining.toLocaleString('en-PH')} of{' '}
              {c.total.toLocaleString('en-PH')} shots left
            </li>
          ))}
        </ul>
      )}

      <form action={purchasePapicOneCamera} className="space-y-3">
        <input type="hidden" name="event_id" value={eventId} />

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70">How many shots</span>
          <select
            name="service_code"
            className="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
          >
            {rungs.map((r) => (
              <option key={r.serviceCode} value={r.serviceCode}>
                {papicOneRungPhrase(r.points, r.pricePhp as number)}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/70">Which camera</span>
          <select
            name="reload_seat_id"
            className="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">A new camera (new QR)</option>
            {cameras.map((c) => (
              <option key={c.seatId} value={c.seatId}>
                Add to camera #{c.seatIndex} (keeps its QR)
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-800"
        >
          Continue to payment
        </button>
      </form>
    </section>
  );
}

type DedicatedCamera = {
  seatId: string;
  seatIndex: number;
  total: number;
  remaining: number;
};

/**
 * The event's cameras that hold a DEDICATED balance. Admin client on purpose:
 * the grants + per-seat usage ledgers carry no read policy (service-role /
 * SECURITY DEFINER only), exactly like the pool meter's read. Display only —
 * the fail-closed gate is papic_reserve_camera_points.
 *
 * Degrades to an empty list on any read problem rather than throwing: a missing
 * balance hides the reload option, which is recoverable; a thrown error would
 * take down the whole Papic studio page, which is not.
 */
async function listDedicatedCameras(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<DedicatedCamera[]> {
  try {
    const { data: grants, error } = await admin
      .from('papic_event_point_grants')
      .select('seat_id, points')
      .eq('event_id', eventId)
      .not('seat_id', 'is', null);
    if (error || !Array.isArray(grants) || grants.length === 0) return [];

    const totals = new Map<string, number>();
    for (const g of grants) {
      const id = String((g as { seat_id?: unknown }).seat_id ?? '');
      if (!id) continue;
      totals.set(id, (totals.get(id) ?? 0) + Number((g as { points?: unknown }).points ?? 0));
    }
    const seatIds = [...totals.keys()];
    if (seatIds.length === 0) return [];

    const [{ data: seats }, { data: usage }] = await Promise.all([
      admin
        .from('paparazzi_seats')
        .select('seat_id, seat_index')
        .in('seat_id', seatIds)
        .is('revoked_at', null),
      admin
        .from('papic_seat_point_usage')
        .select('seat_id, points_used')
        .in('seat_id', seatIds),
    ]);

    const used = new Map<string, number>();
    for (const u of usage ?? []) {
      used.set(
        String((u as { seat_id?: unknown }).seat_id ?? ''),
        Number((u as { points_used?: unknown }).points_used ?? 0),
      );
    }

    return (seats ?? [])
      .map((s) => {
        const id = String((s as { seat_id?: unknown }).seat_id ?? '');
        const total = totals.get(id) ?? 0;
        return {
          seatId: id,
          seatIndex: Number((s as { seat_index?: unknown }).seat_index ?? 0),
          total,
          remaining: Math.max(0, total - (used.get(id) ?? 0)),
        };
      })
      .sort((a, b) => a.seatIndex - b.seatIndex);
  } catch {
    return [];
  }
}

/** Live rung prices, straight from the catalog — the single billing source. */
async function fetchRungPrices(
  admin: ReturnType<typeof createAdminClient>,
  codes: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (codes.length === 0) return out;
  try {
    const { data, error } = await admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, is_active')
      .in('service_code', codes as string[]);
    if (error || !Array.isArray(data)) return out;
    for (const row of data) {
      if ((row as { is_active?: unknown }).is_active !== true) continue;
      const n = Number((row as { retail_price_php?: unknown }).retail_price_php ?? 0);
      if (Number.isFinite(n) && n > 0) {
        out.set(String((row as { service_code?: unknown }).service_code ?? ''), n);
      }
    }
    return out;
  } catch {
    return out;
  }
}
