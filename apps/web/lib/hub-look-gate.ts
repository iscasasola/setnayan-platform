import 'server-only';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { lookWriteAllowed, type LookChange } from '@/lib/hub-look-pro';

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

/** Is this write allowed? Reads Pro only when the answer depends on it. */
export async function lookProAllows(eventId: string, change: LookChange): Promise<boolean> {
  if (lookWriteAllowed(false, change)) return true;
  const ownsPro = await eventCoupleWebsiteProActive(createAdminClient(), eventId);
  return lookWriteAllowed(ownsPro, change);
}

/**
 * Refuse a look write a free couple may not make — to the one Event Hub Pro buy
 * surface, the same destination every existing Pro refusal uses. Returns only
 * when the write is allowed.
 */
export async function requireLookPro(eventId: string, change: LookChange): Promise<void> {
  if (!(await lookProAllows(eventId, change))) {
    redirect(`/dashboard/${eventId}/studio/website-pro`);
  }
}
