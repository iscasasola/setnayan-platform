'use server';

/**
 * proxy-actions.ts — 🧍‍♀️➡️🧍 THE GUEST CARD'S "Proxy ▾" (owner 2026-10-27, DECISION_LOG "A ROLE HOLDER CAN SEND A PROXY").
 *
 * ONE server action (the route budget, `lint-server-action-budget.mjs`), four moves, all on the ROLE HOLDER's row:
 *   · `link`   — an existing guest stands in (`represented_by_guest_id`). The database checks who may stand in for whom
 *                and MOVES THE SEAT to the proxy (trigger `the_proxy_takes_the_seat`).
 *   · `add`    — "Add someone": a new guest on the holder's side and group, then linked as above.
 *   · `remove` — nobody stands in any more; the seat comes back to the holder (same trigger).
 *   · `keep`   — the holder said they can come after all and the host keeps the proxy: re-stamps `represented_since`,
 *                which is all the card's question reads. Never changes the reply or the link.
 * Returns `{ ok }` so the card saves IN PLACE (no screen reset), and a refusal says the database's own sentence.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { holdsARole, PROXY_NEEDS_A_ROLE } from '@/lib/guest-proxy';
import { parseGuestInput } from '@/lib/guest-parse';
import { addSingleGuest } from './inline-actions';
import type { GuestGroupCategory, GuestRole, GuestSide } from '@/lib/guests';

export type ProxyMove =
  | { kind: 'link'; proxyGuestId: string }
  | { kind: 'add'; name: string }
  | { kind: 'remove' }
  | { kind: 'keep' };

export type ProxyResult = { ok: true; proxyGuestId: string | null } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The database's own sentence for a refused link (the trigger's words), else a plain one. */
function refusalWords(message: string | undefined): string {
  const m = message ?? '';
  if (/duplicate key|guests_represented_by_once_idx/i.test(m)) return 'That guest already stands in for someone else.';
  if (/locked|finalized/i.test(m)) return 'Your guest list is finalized — the proxy could not be changed.';
  // The trigger's sentences are written for a host (a_proxy_stands_in_for_a_role).
  if (/stand in|stands in|role|couple|\+1 seat|guest of this event|removed from the list|request|own place/i.test(m)) return m;
  return 'The proxy could not be saved just now — nothing was changed. Please try again.';
}

export async function setGuestProxy(eventId: string, holderGuestId: string, move: ProxyMove): Promise<ProxyResult> {
  const helper = await limitedHelperRefusal(eventId, 'guest_list');
  if (helper) return { ok: false, error: helper };
  if (!UUID.test(holderGuestId)) return { ok: false, error: 'Guest not found.' };
  const supabase = await createClient();

  const { data: holder, error: holderErr } = await supabase
    .from('guests')
    .select('guest_id, role, extra_roles, side, group_category, represented_by_guest_id')
    .eq('event_id', eventId)
    .eq('guest_id', holderGuestId)
    .is('deleted_at', null)
    .maybeSingle();
  if (holderErr || !holder) return { ok: false, error: 'This guest could not be read just now — nothing was changed.' };
  const h = holder as {
    guest_id: string;
    role: GuestRole;
    extra_roles: GuestRole[] | null;
    side: GuestSide;
    group_category: GuestGroupCategory;
    represented_by_guest_id: string | null;
  };
  // 🛂 Server-side, never only the card's: a plain guest is never offered a proxy, and never given one.
  if (move.kind !== 'remove' && move.kind !== 'keep' && !holdsARole(h)) return { ok: false, error: PROXY_NEEDS_A_ROLE };

  let proxyId: string | null = null;
  if (move.kind === 'link') {
    if (!UUID.test(move.proxyGuestId)) return { ok: false, error: 'Pick a guest from the list.' };
    proxyId = move.proxyGuestId;
  } else if (move.kind === 'add') {
    const typed = move.name.trim().replace(/\s+/g, ' ');
    if (!typed) return { ok: false, error: 'Type the name of the person standing in.' };
    const draft = { ...parseGuestInput(typed, { defaultSide: h.side }), plusOnes: 0, groups: [], roleHint: null, groupCategory: h.group_category };
    if (!draft.firstName) return { ok: false, error: 'Type the name of the person standing in.' };
    const added = await addSingleGuest(eventId, draft);
    if (!added.ok) return { ok: false, error: added.error };
    proxyId = added.guest.guest_id;
  }

  if (move.kind === 'keep') {
    const { error } = await supabase
      .from('guests')
      .update({ represented_since: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('guest_id', holderGuestId)
      .not('represented_by_guest_id', 'is', null);
    if (error) return { ok: false, error: refusalWords(error.message) };
  } else {
    const { data: wrote, error } = await supabase
      .from('guests')
      .update({ represented_by_guest_id: proxyId, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('guest_id', holderGuestId)
      .select('guest_id');
    if (error) return { ok: false, error: refusalWords(error.message) };
    // A zero-row UPDATE is success-shaped: the policy refused it.
    if ((wrote ?? []).length === 0) return { ok: false, error: 'You can’t change this guest’s proxy.' };
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath(`/dashboard/${eventId}/seating`);
  return { ok: true, proxyGuestId: move.kind === 'keep' ? h.represented_by_guest_id : proxyId };
}
