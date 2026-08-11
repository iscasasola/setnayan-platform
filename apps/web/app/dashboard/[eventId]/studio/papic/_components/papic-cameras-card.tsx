import { Camera } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { setCameraShots } from '../actions';

/**
 * YOUR CAMERAS — give one its own shots, or take the unspent ones back.
 *
 * ── WHAT THIS REPLACED, AND WHY ────────────────────────────────────────────
 * This card used to sell "Papic One": a dedicated camera you BOUGHT, which
 * arrived with its own shots baked in at its own price. The owner collapsed
 * Papic to one product on 2026-08-11 — *"the host can dedicated a specific
 * number of shots for a specific QR code. and the rest can be distributed to
 * the rest"* — so a dedicated camera is no longer a purchase. You buy shots
 * once, and this is where you decide which of them belong to one camera alone.
 *
 * Cameras themselves are now free and unlimited. That costs us nothing: a
 * camera holding no shots of its own simply draws the shared pot the couple
 * already paid for.
 *
 * ── EVERY CAMERA IS LISTED, NOT JUST THE ONES WITH A BALANCE ───────────────
 * The old card listed only cameras that already HELD dedicated shots, because
 * those were the only ones a reload could target. Listing only those now would
 * be a circular door: you could only give shots to a camera that already had
 * some, which is exactly the shape of the bug papic-buy-urgency.test.ts exists
 * to stop. A camera at zero is the normal case and the main thing a host wants
 * to act on.
 *
 * ── THE NUMBER IN THE BOX IS A TARGET ──────────────────────────────────────
 * It shows what the camera holds and you type what it should hold. Lowering it
 * is how shots come back. Framing it as "add N more" would have needed a second
 * control to undo it, and a hand-out with no way back strands the shots on the
 * wrong QR permanently.
 *
 * Display only — every rule about whether a move is allowed is enforced inside
 * papic_dedicate_shots, under a row lock. Nothing here re-derives it.
 */

/**
 * The refusals the action can come back with. Spelled out because a raw code on
 * screen tells the host nothing, and a refusal they cannot read is
 * indistinguishable from a button that did nothing at all.
 */
const ERROR_COPY: Record<string, string> = {
  unknown_camera: "That camera isn't part of this event any more. Pick another one.",
  not_enough_left:
    "You don't have that many shots left to share out. Take some back from another camera, or add more shots.",
  already_shot:
    "That camera has already taken more shots than that. You can only take back the ones it hasn't used.",
  bad_number: 'Enter a whole number of shots — 0 or more.',
  failed: "We couldn't change that just now. Nothing moved. Please try again.",
};

type EventCamera = {
  seatId: string;
  seatIndex: number;
  /** Shots that belong to this camera alone — grants plus what the host handed it. */
  dedicated: number;
  /** Of those, how many it has already taken. Cannot be handed back. */
  used: number;
};

export async function PapicCamerasCard({
  eventId,
  error,
  justSet,
}: {
  eventId: string;
  error?: string | null;
  justSet?: string | null;
}) {
  const admin = createAdminClient();
  const [cameras, shared] = await Promise.all([
    listEventCameras(admin, eventId),
    sharedRemaining(admin, eventId),
  ]);

  if (cameras.length === 0) return null;

  const handedOut = cameras.reduce((sum, c) => sum + c.dedicated, 0);

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
          <Camera aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
          Your cameras
        </p>
        <p className="text-sm text-ink/70">
          Give a camera its own shots and nobody else can spend them — handy for
          whoever you trust with the important moments. Everything you don&apos;t
          hand out stays in the shared pot that every guest shoots from. You can
          take back any shots a camera hasn&apos;t used yet.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700">
          {ERROR_COPY[error] ?? ERROR_COPY.failed}
        </p>
      )}
      {!error && justSet != null && (
        <p className="rounded-xl border border-emerald-600/30 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-800">
          Saved. That camera now has {Number(justSet).toLocaleString('en-PH')}{' '}
          {Number(justSet) === 1 ? 'shot' : 'shots'} of its own.
        </p>
      )}

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-ink/60">Shared pot</dt>
          <dd className="font-medium text-ink">{shared.toLocaleString('en-PH')} left</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink/60">Handed out</dt>
          <dd className="font-medium text-ink">{handedOut.toLocaleString('en-PH')}</dd>
        </div>
      </dl>

      <ul className="divide-y divide-ink/10">
        {cameras.map((c, i) => (
          <li key={c.seatId} className="py-3">
            <form action={setCameraShots} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="seat_id" value={c.seatId} />

              <label className="min-w-0 flex-1 space-y-1">
                <span className="block text-sm font-medium text-ink">Camera {i + 1}</span>
                <span className="block text-xs text-ink/60">
                  {c.dedicated === 0
                    ? 'Shooting from the shared pot'
                    : `${c.dedicated.toLocaleString('en-PH')} of its own` +
                      (c.used > 0 ? ` · ${c.used.toLocaleString('en-PH')} already taken` : '')}
                </span>
              </label>

              <label className="space-y-1">
                <span className="block text-xs font-medium text-ink/70">Its own shots</span>
                <input
                  type="number"
                  name="shots"
                  min={c.used}
                  max={c.dedicated + shared}
                  step={1}
                  defaultValue={c.dedicated}
                  inputMode="numeric"
                  className="w-28 rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-800"
              >
                Save
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Every camera on the event, with what it holds of its own.
 *
 * Admin client on purpose: the grants, allocations and per-seat usage ledgers
 * all carry no read policy (service-role / SECURITY DEFINER only), exactly like
 * the pool meter's read. Display only — the fail-closed gate is
 * papic_reserve_camera_points.
 *
 * ⚠ DEDICATED = GRANTS + ALLOCATION, and both halves have to be read here.
 * Grants are what a pre-2026-08-11 Papic One purchase left behind; the
 * allocation is what the host has handed out since. A card that read only one
 * would show a camera as empty while the capture gate treats it as funded, and
 * the host would hand it shots it did not need.
 *
 * Degrades to an empty list on any read problem rather than throwing: a missing
 * list hides this card, which is recoverable; a thrown error takes down the
 * whole Papic studio page, which is not.
 */
async function listEventCameras(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<EventCamera[]> {
  try {
    const { data: seats, error } = await admin
      .from('paparazzi_seats')
      .select('seat_id, seat_index')
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .order('seat_index', { ascending: true });
    if (error || !Array.isArray(seats) || seats.length === 0) return [];

    const seatIds = seats.map((s) => String((s as { seat_id?: unknown }).seat_id ?? ''));

    const [{ data: grants }, { data: allocs }, { data: usage }] = await Promise.all([
      admin
        .from('papic_event_point_grants')
        .select('seat_id, points')
        .eq('event_id', eventId)
        .not('seat_id', 'is', null),
      admin.from('papic_seat_allocations').select('seat_id, points').eq('event_id', eventId),
      admin.from('papic_seat_point_usage').select('seat_id, points_used').in('seat_id', seatIds),
    ]);

    const dedicated = new Map<string, number>();
    const add = (id: string, n: number) => {
      if (!id || !Number.isFinite(n)) return;
      dedicated.set(id, (dedicated.get(id) ?? 0) + n);
    };
    for (const g of grants ?? []) {
      add(String((g as { seat_id?: unknown }).seat_id ?? ''), Number((g as { points?: unknown }).points ?? 0));
    }
    for (const a of allocs ?? []) {
      add(String((a as { seat_id?: unknown }).seat_id ?? ''), Number((a as { points?: unknown }).points ?? 0));
    }

    const used = new Map<string, number>();
    for (const u of usage ?? []) {
      used.set(
        String((u as { seat_id?: unknown }).seat_id ?? ''),
        Number((u as { points_used?: unknown }).points_used ?? 0),
      );
    }

    return seats.map((s) => {
      const id = String((s as { seat_id?: unknown }).seat_id ?? '');
      return {
        seatId: id,
        seatIndex: Number((s as { seat_index?: unknown }).seat_index ?? 0),
        dedicated: dedicated.get(id) ?? 0,
        used: used.get(id) ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/**
 * What is still in the shared pot.
 *
 * ⚠ Falls back to 0, and 0 is the SAFE direction here: it caps the number box
 * at what the camera already holds, so a failed read can only ever refuse a
 * hand-out the host could have made — never permit one they could not. The
 * database refuses it properly either way; this is the box's hint, not the gate.
 */
async function sharedRemaining(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<number> {
  try {
    const { data, error } = await admin.rpc('papic_event_pool_status', { p_event_id: eventId });
    if (error) return 0;
    const row = Array.isArray(data) ? data[0] : data;
    const n = Number((row as { remaining_points?: unknown } | null)?.remaining_points ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
