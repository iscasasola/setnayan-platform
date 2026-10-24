'use server';

/**
 * 🎛 "PICK WHAT SHOWS" — THE READ, ON THE TAP (owner 2026-10-24: the Event Hub tile's small button opens, in place,
 * "the existing choice of which Event Hub stage or parts are live").
 *
 * Nothing here is new: it is Home's Event Hub card's own read (`readHomeHubCard` — the part switches' table and the
 * page guests see now). Read only when somebody opens the sheet — Home is the most-opened screen, so its own view pays
 * nothing for the table (the same rule as Papic's `papicBuySizes`). The Apply bar is NOT read here: its loader reads
 * the "view as a free couple" switch, which a server action must never see — Home renders `HubDraftDock` instead.
 *
 * 🔒 Hosts only — the gate the draft's own save uses (`hubDraftAction` → `requireHostMembershipOrThrow`), so the sheet
 * never draws switches a viewer could not save. A failed read is said, never an empty list.
 */
import { createClient } from '@/lib/supabase/server';
import { readHomeHubCard } from '@/lib/home-hub-card.server';
import { requireHostMembershipOrThrow } from '@/lib/host-gate';
import type { HomeHubPickRead } from './hub-pick-types';

export async function readHomeHubPick(eventId: string): Promise<HomeHubPickRead> {
  if (typeof eventId !== 'string' || eventId.length === 0) return { ok: false, reason: 'unread' };
  try {
    await requireHostMembershipOrThrow(eventId);
  } catch {
    return { ok: false, reason: 'not_host' };
  }
  const supabase = await createClient();
  const read = await readHomeHubCard(supabase, eventId).catch(() => ({ ok: false }) as const);
  if (!read.ok) return { ok: false, reason: 'unread' };
  return { ok: true, table: read.table, stage: read.stage, draftUnread: read.draftUnread };
}
