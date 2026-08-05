'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * The couple takes ONE supplier's photos out of their gallery — or puts them
 * back.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────
 * Everything a booked supplier shoots lands in the couple's gallery, and the
 * couple's only levers were the platform-wide privacy control (not theirs) and
 * hiding photos one at a time. "I don't want the caterer's shots in my wedding
 * album" meant two hundred taps.
 *
 * ── THE WRITE SHIPS WITH THE READ, ON PURPOSE ───────────────────────────────
 * This project has twice shipped a column that everything READ and nothing ever
 * WROTE — face auto-tagging sat dead for seven weeks, and the livestream
 * audience flag hid the broadcast from every anonymous viewer on every event.
 * Both looked complete: the column existed, the readers were correct, the flag
 * was green. Neither had a handle.
 *
 * So this action and its control land in the same change as the column and the
 * gallery filter. A switch with no way to flip it is not a feature, it is a
 * default with extra steps.
 *
 * ── IT ONLY EVER REMOVES ────────────────────────────────────────────────────
 * Hiding cannot expose anything, so there is no consent step here and no
 * two-party handshake. The supplier keeps their own view of their own work —
 * this is the couple's album, not the supplier's archive — and **nothing is
 * deleted**. If a couple ever wants a supplier's captures actually gone, that
 * is a different feature and must not reuse this flag.
 *
 * The couple's OWN client does the write: `event_vendors_couple_write` already
 * grants them the row. No service-role, so a bug here cannot reach past what
 * the couple could already do by hand.
 */
export async function setVendorCapturesHidden(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  // ⚠ `vendor_id` is the PRIMARY KEY of event_vendors — verified against the
  // live schema, not assumed. `event_vendor_id` (which reads more naturally and
  // is what other modules call the value they PASS) does not exist as a column.
  const vendorRowId = String(formData.get('vendor_id') ?? '').trim();
  const hidden = String(formData.get('hidden') ?? '') === '1';

  const back = `/dashboard/${eventId}/studio/papic`;
  if (!eventId || !vendorRowId) redirect(back);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);

  // Scoped by event as well as by id: the RLS policy is the real gate, but a
  // mismatched pair should fail as "not found", never edit a row on some other
  // couple's event.
  const { error } = await supabase
    .from('event_vendors')
    .update({ papic_captures_hidden: hidden })
    .eq('vendor_id', vendorRowId)
    .eq('event_id', eventId);

  if (error) redirect(`${back}?vendorMedia=error`);

  revalidatePath(back);
  redirect(`${back}?vendorMedia=${hidden ? 'hidden' : 'shown'}`);
}
