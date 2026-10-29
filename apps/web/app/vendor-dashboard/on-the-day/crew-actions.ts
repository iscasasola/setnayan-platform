'use server';

/**
 * 📱 THE CREW QR — the supplier's side (owner 2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND
 * SEE ONLY THE EVENT HUB"; prototype `hubCrew` + `crewQrSheet`). Make the event's ONE crew QR, replace it (the printed
 * one stops working; phones already in stay in), turn it off (every pass under it ends), and decide each phone:
 * Allow · Member / Helper · Remove.
 *
 * RLS IS THE BOUNDARY (migration `…_crew_join_the_suppliers_event_hub_by_qr.sql`): every write here runs under the
 * CALLER'S OWN client, where only the shop's admins may touch its crew QR and passes, only on an event the shop is
 * booked on, and a pass's who / where never moves (a trigger raises). The re-checks below exist to answer in words
 * rather than with a policy error — and the booking fee locks the event's crew like the rest of its room.
 */
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { eventFeeBlocksAction } from '@/lib/vendor-event-fee-access.server';
import { crewRoleOf, type CrewRole } from '@/lib/crew-pass';

export type CrewActionResult = { ok: true } | { ok: false; error: string };

const HUB = '/vendor-dashboard/on-the-day';

/** The signed-in admin's shop, booked on this event and not locked by its fee — or the words why not. */
async function shopForEvent(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' } as const;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { error: 'No supplier profile.' } as const;
  const bookings = await fetchVendorRoomEvents(supabase, profile.vendor_profile_id);
  if (!bookings.some((b) => b.eventId === eventId)) return { error: 'Your shop is not booked on this event.' } as const;
  const feeBlocked = await eventFeeBlocksAction(profile.vendor_profile_id, eventId);
  if (feeBlocked) return { error: feeBlocked } as const;
  return { supabase, shop: profile.vendor_profile_id } as const;
}

/** One change to an event's crew — ONE exported action on purpose: every export is a Vercel route, and the budget is
 *  shared (`lint-server-action-budget.mjs`). */
export type CrewChange =
  | { kind: 'make' } // make the event's crew QR (one per event per shop)
  | { kind: 'replace' } // the old QR stops working; phones already allowed stay in
  | { kind: 'off' } // the QR stops working and every pass under it ends
  | { kind: 'decide'; passId: string; status?: 'allowed' | 'removed'; role?: CrewRole }; // Allow · role · Remove

export async function changeCrew(eventId: string, change: CrewChange): Promise<CrewActionResult> {
  const s = await shopForEvent(eventId);
  if ('error' in s) return { ok: false, error: s.error ?? 'Could not save.' };
  const result =
    change.kind === 'make'
      ? await make(s, eventId)
      : change.kind === 'replace'
        ? await replace(s, eventId)
        : change.kind === 'off'
          ? await off(s, eventId)
          : await decide(s, eventId, change);
  if (result.ok) revalidatePath(HUB);
  return result;
}

type Shop = { supabase: Awaited<ReturnType<typeof createClient>>; shop: string };

async function make({ supabase, shop }: Shop, eventId: string): Promise<CrewActionResult> {
  const { error } = await supabase.from('vendor_crew_codes').insert({ vendor_profile_id: shop, event_id: eventId });
  if (!error || error.code === '23505') return { ok: true }; // already made — the page shows it
  if (/no date yet/i.test(error.message)) return { ok: false, error: 'This event has no date yet — a crew pass needs a day to end on.' };
  return { ok: false, error: 'Only the shop’s owner or an admin can make the crew QR.' };
}

async function replace({ supabase, shop }: Shop, eventId: string): Promise<CrewActionResult> {
  const { data, error } = await supabase
    .from('vendor_crew_codes')
    .update({ token: randomBytes(16).toString('hex') })
    .eq('vendor_profile_id', shop)
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !data?.length) return { ok: false, error: 'Couldn’t replace the crew QR — only the owner or an admin can.' };
  return { ok: true };
}

async function off({ supabase, shop }: Shop, eventId: string): Promise<CrewActionResult> {
  const { data, error } = await supabase
    .from('vendor_crew_codes')
    .delete()
    .eq('vendor_profile_id', shop)
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !data?.length) return { ok: false, error: 'Couldn’t turn the crew QR off — only the owner or an admin can.' };
  return { ok: true };
}

async function decide(
  { supabase, shop }: Shop,
  eventId: string,
  d: { passId: string; status?: 'allowed' | 'removed'; role?: CrewRole },
): Promise<CrewActionResult> {
  const patch: { status?: 'allowed' | 'removed'; crew_role?: CrewRole } = {};
  if (d.status === 'allowed' || d.status === 'removed') patch.status = d.status;
  if (d.role) patch.crew_role = crewRoleOf(d.role);
  if (!patch.status && !patch.crew_role) return { ok: false, error: 'Nothing to change.' };
  const { data, error } = await supabase
    .from('vendor_crew_passes')
    .update(patch)
    .eq('pass_id', d.passId)
    .eq('vendor_profile_id', shop)
    .eq('event_id', eventId)
    .select('pass_id');
  if (error || !data?.length) return { ok: false, error: 'Couldn’t save — only the owner or an admin can decide the crew.' };
  return { ok: true };
}
