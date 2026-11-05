import 'server-only';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventHubOwnership, eventHubPartActive } from '@/lib/couple-website-pro';
import { lookWriteAllowed, type LookChange } from '@/lib/hub-look-pro';
import type { HubOwnership, HubPartId } from '@/lib/hub-parts';

/**
 * apps/web/lib/hub-look-gate.ts
 *
 * THE SERVER HALF of `lib/hub-look-pro.ts` — the real gate. The editor's lock
 * is presentation; a server action is a public POST, so every writer of the
 * Event Hub's LOOK calls one of these two before it writes.
 *
 * NOT a `'use server'` module and it exports no actions: these are helpers the
 * existing actions call, so the route count does not move.
 *
 * 🔑 THE SKU IS READ WITH THE ADMIN CLIENT, as `website/colors/actions.ts` and
 * the custom-sections gate do. `orders` RLS is purchaser-scoped, so through the
 * couple's own session a co-host who did not place the order would read "not
 * Pro" and be refused a look their event paid for.
 *
 * 🔑 A REMOVAL NEVER READS THE SKU. `lookWriteAllowed(false, 'remove')` is
 * already true, so taking a look off cannot fail on an entitlement read — the
 * one write a free couple must always be able to make.
 */

/**
 * Is this write allowed? Reads ownership only when the answer depends on it.
 *
 * 💎 PART BY PART (owner 2026-10-22): every look write names the ONE part it
 * belongs to (`HUB_PRO_GATES` in `lib/hub-parts.ts`) — owning that part, Full
 * Pro, or the cap allows it; owning another part does not.
 */
export async function lookProAllows(eventId: string, change: LookChange, part: HubPartId): Promise<boolean> {
  if (lookWriteAllowed(false, change)) return true;
  const owns = await eventHubPartActive(createAdminClient(), eventId, part);
  return lookWriteAllowed(owns, change);
}

/**
 * Everything the event holds, for the Maker's ✓ Apply — the one write that
 * carries many parts at once (`planHubDraftApply` asks each item of it).
 * Admin client for the same co-host reason as above.
 */
export async function hubOwnershipForWrite(eventId: string): Promise<HubOwnership> {
  return eventHubOwnership(createAdminClient(), eventId, 'active');
}

/**
 * Refuse a look write a couple without its part may not make — to the one Event
 * Hub Pro buy surface, the same destination every existing Pro refusal uses.
 * Returns only when the write is allowed.
 */
export async function requireLookPro(eventId: string, change: LookChange, part: HubPartId): Promise<void> {
  if (!(await lookProAllows(eventId, change, part))) {
    redirect(`/dashboard/${eventId}/studio/website-pro`);
  }
}
