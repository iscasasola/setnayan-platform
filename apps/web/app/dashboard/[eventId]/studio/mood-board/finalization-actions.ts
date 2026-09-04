'use server';

/**
 * MB12 · the COUPLE's half of the per-part finalization handshake.
 *
 * Four acts, one per RPC: ask · withdraw the ask · ask to re-open · withdraw
 * the re-open. The supplier's half lives in
 * `app/vendor-dashboard/clients/[eventId]/finalization-actions.ts`.
 *
 * ── WHAT THIS FILE ENFORCES, AND WHAT THE DATABASE ENFORCES ────────────────
 * 🔑 THE TWO HALVES OF "NO FINALIZE WITHOUT A BOOKED SUPPLIER IN CATEGORY" ARE
 * DELIBERATELY IN DIFFERENT PLACES, BECAUSE ONLY ONE OF THEM CAN BE.
 *
 *   · BOOKED — enforced in `request_part_finalization` (SQL). The four
 *     CONFIRMED statuses are a fact the database holds, and the table grants
 *     `authenticated` no INSERT at all, so a client that skips this action
 *     entirely and calls the RPC by hand is still refused. That is the security
 *     half, and it is not in TypeScript.
 *   · IN CATEGORY — enforced here, because the slot → trade map is TypeScript
 *     (`MOODBOARD_SLOT_TRADES`, MB10) and the database cannot read it. Passing
 *     the required services into the RPC as a parameter would look stronger and
 *     be weaker: a caller who chooses the parameter can choose an empty one.
 *
 * Saying that plainly matters more than pretending both live in one place. The
 * category check is a CORRECTNESS gate (do not ask a caterer to agree to a
 * gown); the booked check is a SECURITY gate (do not let a couple manufacture
 * a stranger's agreement), and the security gate is the one in the database.
 *
 * ── THE NOTIFICATION AND THE ALLOWLIST ARE ONE MECHANISM ───────────────────
 * Every emit here uses a type that is BOTH in `NotificationType` and in
 * `EMAIL_ENABLED_TYPES` (lib/notification-emit.ts). A supplier who has 48 hours
 * to answer and never opens the dashboard is exactly the person an in-app-only
 * tray badge cannot reach — having the notification without the allowlist entry
 * is indistinguishable from having neither.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { sanitizeRolePalette, sanitizePaletteStyle } from '@/lib/mood-board';
import { sanitizeReceptionDesign } from '@/lib/reception-scene';
import { derivedBoardFor, effectiveMajors } from '@/lib/mood-board-derive';
import {
  buildDesignSnapshot,
  canonicalServicesForPart,
  isFinalizablePartId,
  renderPartLabel,
} from '@/lib/moodboard-finalization';

export type FinalizationActionResult =
  | { status: 'ok' }
  | { status: 'not_finalizable_part' }
  | { status: 'not_booked' }
  | { status: 'not_in_category' }
  | { status: 'already'; current?: string }
  | { status: 'error'; message: string };

/**
 * Ask one booked supplier to agree to one part of the design.
 *
 * ⚠ THE SNAPSHOT IS BUILT HERE, ON THE SERVER, FROM THE STORED BOARD — never
 * taken from the client. A snapshot posted by the browser is a design the
 * couple could claim the supplier agreed to; reading `events.role_palette` back
 * means the recorded agreement is the board the supplier will actually see.
 */
export async function requestPartFinalization(
  eventId: string,
  partId: string,
  vendorId: string,
): Promise<FinalizationActionResult> {
  if (!isFinalizablePartId(partId)) return { status: 'not_finalizable_part' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: eventRow, error: eventErr } = await supabase
    .from('events')
    .select('role_palette, reception_design, display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventErr) return { status: 'error', message: eventErr.message };
  if (!eventRow) return { status: 'error', message: 'Event not found' };

  // ── IN CATEGORY. See the header for why this half is here and not in SQL.
  // Read through the couple's own client so RLS still applies: a couple can
  // only see their own bookings, and asking about somebody else's supplier
  // fails here before the RPC's own event check has to.
  const { data: booking, error: bookingErr } = await supabase
    .from('event_vendors')
    .select('vendor_id, event_id, vendor_name, marketplace_vendor_id')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (bookingErr) return { status: 'error', message: bookingErr.message };
  if (!booking) return { status: 'not_booked' };

  const needed = canonicalServicesForPart(partId);
  if (needed.length === 0) return { status: 'not_in_category' };

  let services: string[] = [];
  if (booking.marketplace_vendor_id) {
    const { data: shop } = await supabase
      .from('vendor_profiles')
      .select('services')
      .eq('vendor_profile_id', booking.marketplace_vendor_id)
      .maybeSingle();
    services = ((shop as { services?: string[] } | null)?.services ?? []).filter(Boolean);
  }
  if (!services.some((s) => needed.includes(s))) return { status: 'not_in_category' };

  const palette = sanitizeRolePalette(eventRow.role_palette);
  const design = sanitizeReceptionDesign(eventRow.reception_design);
  const derived = derivedBoardFor(
    effectiveMajors(palette),
    sanitizePaletteStyle(palette.palette_style),
  );
  const snapshot = buildDesignSnapshot(partId, palette, derived, design);

  const { data, error } = await supabase.rpc('request_part_finalization', {
    p_event_id: eventId,
    p_part_id: partId,
    p_vendor_id: vendorId,
    p_snapshot: snapshot,
  });
  if (error) return { status: 'error', message: error.message };
  const env = (data ?? {}) as { status?: string; current?: string };
  if (env.status === 'not_booked') return { status: 'not_booked' };
  if (env.status === 'already') return { status: 'already', current: env.current };
  if (env.status !== 'ok') return { status: 'error', message: env.status ?? 'unknown' };

  // Fail-soft: the ask is recorded. An unsent notification must never roll it
  // back — but it must also never be the only thing that reached the supplier,
  // which is why the type is on the email allowlist.
  await notifyShopOwner(booking.marketplace_vendor_id, {
    type: 'part_finalization_requested',
    title: `${eventDisplay(eventRow.display_name)} wants your sign-off`,
    body:
      `${eventDisplay(eventRow.display_name)} has asked you to agree to their ` +
      `${renderPartLabel(partId)}. You have 48 hours to agree or turn it down — ` +
      `once you agree, that part stops changing.`,
    relatedUrl: `/vendor-dashboard/clients/${eventId}/mood-board`,
    tag: 'requestPartFinalization',
    eventId,
  });

  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  return { status: 'ok' };
}

/** Withdraw a still-pending ask. Refused by the RPC once the supplier has
 *  agreed — un-finalizing needs the counter-handshake. */
export async function cancelPartFinalization(
  eventId: string,
  finalizationId: string,
): Promise<FinalizationActionResult> {
  return simpleCoupleRpc(eventId, 'cancel_part_finalization_request', finalizationId);
}

/**
 * Ask the supplier to release a part they already agreed to.
 *
 * Releases NOTHING by itself — the part stays frozen until the supplier
 * answers, and stays frozen if they never do. Silence is not consent in either
 * direction.
 */
export async function requestPartReopen(
  eventId: string,
  finalizationId: string,
): Promise<FinalizationActionResult> {
  const result = await simpleCoupleRpc(eventId, 'request_part_reopen', finalizationId);
  if (result.status !== 'ok') return result;

  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('moodboard_part_finalizations')
      .select('part_id, vendor_id')
      .eq('finalization_id', finalizationId)
      .maybeSingle();
    const { data: ev } = await admin
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle();
    const { data: booking } = row
      ? await admin
          .from('event_vendors')
          .select('marketplace_vendor_id')
          .eq('vendor_id', (row as { vendor_id: string }).vendor_id)
          .maybeSingle()
      : { data: null };
    await notifyShopOwner(
      (booking as { marketplace_vendor_id: string | null } | null)?.marketplace_vendor_id ?? null,
      {
        type: 'part_reopen_requested',
        title: `${eventDisplay((ev as { display_name?: string } | null)?.display_name)} wants to change a part you agreed to`,
        body:
          `They would like to re-open the ${renderPartLabel((row as { part_id: string } | null)?.part_id ?? '')} ` +
          `you signed off on. Nothing changes until you say yes — if you do not answer within ` +
          `48 hours it stays exactly as agreed.`,
        relatedUrl: `/vendor-dashboard/clients/${eventId}/mood-board`,
        tag: 'requestPartReopen',
        eventId,
      },
    );
  } catch (e) {
    console.error(
      `[requestPartReopen] notify failed for finalization_id=${finalizationId} event_id=${eventId}:`,
      e,
    );
  }
  return { status: 'ok' };
}

/** The couple changes their mind about re-opening. The supplier keeps the
 *  agreement they gave. */
export async function cancelPartReopen(
  eventId: string,
  finalizationId: string,
): Promise<FinalizationActionResult> {
  return simpleCoupleRpc(eventId, 'cancel_part_reopen_request', finalizationId);
}

/* ── shared plumbing ─────────────────────────────────────────────────────── */

async function simpleCoupleRpc(
  eventId: string,
  fn: 'cancel_part_finalization_request' | 'request_part_reopen' | 'cancel_part_reopen_request',
  finalizationId: string,
): Promise<FinalizationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc(fn, { p_finalization_id: finalizationId });
  if (error) return { status: 'error', message: error.message };
  const env = (data ?? {}) as { status?: string; current?: string };
  if (env.status === 'ok') {
    revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
    return { status: 'ok' };
  }
  if (env.status === 'already') return { status: 'already', current: env.current };
  return { status: 'error', message: env.status ?? 'unknown' };
}

function eventDisplay(name: string | null | undefined): string {
  return (name ?? '').trim() || 'A couple';
}

/**
 * Reach the shop behind a booking.
 *
 * A booking with no `marketplace_vendor_id` is a supplier the couple added
 * themselves — there is no Setnayan account to notify, and that is not an
 * error. It is also not reachable in practice for this handshake: such a shop
 * has no `services[]`, so the category check above already refused.
 */
async function notifyShopOwner(
  marketplaceVendorId: string | null,
  args: {
    type: 'part_finalization_requested' | 'part_reopen_requested';
    title: string;
    body: string;
    relatedUrl: string;
    tag: string;
    eventId: string;
  },
): Promise<void> {
  if (!marketplaceVendorId) return;
  try {
    const admin = createAdminClient();
    const { data: shop } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', marketplaceVendorId)
      .maybeSingle();
    const userId = (shop as { user_id: string | null } | null)?.user_id ?? null;
    if (!userId) return;
    await emitNotification({
      userId,
      type: args.type,
      title: args.title,
      body: args.body,
      relatedUrl: args.relatedUrl,
    });
  } catch (e) {
    console.error(
      `[${args.tag}] ${args.type} notify failed for event_id=${args.eventId}:`,
      e,
    );
  }
}
