'use server';

import { createClient } from '@/lib/supabase/server';

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
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('vendor_upsert_cocktail_booth', {
    p_event_id: eventId,
    p_booth_id: boothId,
    p_booth_type: boothType,
    p_label: label,
    p_x: x,
    p_y: y,
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
