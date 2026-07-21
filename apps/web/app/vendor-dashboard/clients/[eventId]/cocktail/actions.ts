'use server';

import { createClient } from '@/lib/supabase/server';
import { vendorQrGuardRejects } from '@/lib/vendor-qr-media-guard';
import { VENDOR_QR_MEDIA_ERROR } from '@/lib/vendor-qr-guard-shared';

/**
 * Vendor cocktail-area write actions — thin wrappers over the SECURITY DEFINER
 * RPCs that carry ALL the authorization (booked + eligible category + couple
 * revoke switch + own-booth-only for the booth tier). Nothing here is trusted
 * to gate; the database does. Each returns { ok } or { error } so the client
 * can roll back an optimistic update.
 */

type Result =
  | { ok: true; boothId?: string; signId?: string }
  | { ok: false; error: string };

function rpcError(message: string | undefined): string {
  // Map the RPC's RAISE codes to friendly copy; default to a generic line.
  switch (message) {
    case 'not_arranger':
      return 'Only the stylist / decor team can resize the room or edit signs.';
    case 'not_your_booth':
      return 'You can only move your own booth.';
    case 'vendor_edit_off':
      return 'The couple has turned off vendor editing for this area.';
    case 'too_many_booths':
      return 'This area is full — remove a booth first.';
    case 'too_many_signs':
      return 'You’ve reached the sign limit.';
    case 'not_a_vendor':
      return 'Only a vendor account can do that.';
    case 'not_booked':
      return 'You’re not booked on this event yet.';
    case 'booth_frozen':
      return 'Booth designs lock 24 hours before the event, so nothing changes under the couple on the day.';
    case 'poster_ref_too_long':
      return 'That upload reference is too long. Please re-upload the poster.';
    default:
      return 'That change didn’t save. Please try again.';
  }
}

export async function setCocktailArea(
  eventId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('vendor_set_cocktail_area', {
    p_event_id: eventId,
    p_x: x,
    p_y: y,
    p_w: w,
    p_h: h,
    p_label: label,
  });
  return error ? { ok: false, error: rpcError(error.message) } : { ok: true };
}

export async function upsertCocktailBooth(
  eventId: string,
  boothId: string | null,
  boothType: string,
  label: string,
  x: number,
  y: number,
  offerings: string | null = null,
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('vendor_upsert_cocktail_booth', {
    p_event_id: eventId,
    p_booth_id: boothId,
    p_booth_type: boothType,
    p_label: label,
    p_x: x,
    p_y: y,
    p_offerings: offerings,
  });
  return error
    ? { ok: false, error: rpcError(error.message) }
    : { ok: true, boothId: data as string };
}

export async function moveCocktailBooth(
  eventId: string,
  boothId: string,
  x: number,
  y: number,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('vendor_move_cocktail_booth', {
    p_event_id: eventId,
    p_booth_id: boothId,
    p_x: x,
    p_y: y,
  });
  return error ? { ok: false, error: rpcError(error.message) } : { ok: true };
}

export async function deleteCocktailBooth(eventId: string, boothId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('vendor_delete_cocktail_booth', {
    p_event_id: eventId,
    p_booth_id: boothId,
  });
  return error ? { ok: false, error: rpcError(error.message) } : { ok: true };
}

export async function upsertSign(
  eventId: string,
  signId: string | null,
  label: string,
  x: number,
  y: number,
  rotation: number,
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('vendor_upsert_sign', {
    p_event_id: eventId,
    p_sign_id: signId,
    p_label: label,
    p_x: x,
    p_y: y,
    p_rotation: rotation,
  });
  return error
    ? { ok: false, error: rpcError(error.message) }
    : { ok: true, signId: data as string };
}

export async function moveSign(
  eventId: string,
  signId: string,
  x: number,
  y: number,
  rotation: number,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('vendor_move_sign', {
    p_event_id: eventId,
    p_sign_id: signId,
    p_x: x,
    p_y: y,
    p_rotation: rotation,
  });
  return error ? { ok: false, error: rpcError(error.message) } : { ok: true };
}

export async function deleteSign(eventId: string, signId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('vendor_delete_sign', {
    p_event_id: eventId,
    p_sign_id: signId,
  });
  return error ? { ok: false, error: rpcError(error.message) } : { ok: true };
}

/**
 * Set (or clear, with null) the vendor's per-event booth POSTER — their own
 * design for THIS couple's event, shown on the booth beside the account-level
 * logo. `posterRef` is the raw `r2://bucket/key` emitted by FileUpload; scene
 * assembly resolves it to a display URL.
 *
 * Same thin-wrapper contract as everything above: the SECURITY DEFINER RPC
 * carries the whole gate (is a vendor AND is BOOKED on this event). Note the
 * RPC deliberately does NOT require the cocktail-room switches — the poster
 * belongs to the vendor's presence at the event, not to one room — so a vendor
 * whose booth sits in the reception can still dress it.
 */
export async function setBoothPoster(
  eventId: string,
  posterRef: string | null,
): Promise<Result> {
  // QR-in-media guard (owner-locked 2026-07-03), same authoritative server-side
  // reject the website media path uses. A poster is a MORE obvious vector than
  // a logo — it's large, vendor-composed artwork shown to every guest walking
  // the room, so a funnel QR smuggled into it would be read by phones in the
  // venue. Fails OPEN on scanner trouble (never blocks an honest vendor); the
  // admin retro-scan is the backstop.
  if (posterRef) {
    const hit = await vendorQrGuardRejects([posterRef]);
    if (hit) return { ok: false, error: VENDOR_QR_MEDIA_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('vendor_set_booth_poster', {
    p_event_id: eventId,
    p_poster_ref: posterRef,
  });
  return error ? { ok: false, error: rpcError(error.message) } : { ok: true };
}
