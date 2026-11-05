/**
 * moment-march-step.ts — 🚶 "THIS IS A MARCH" ON A MOMENT, the server half (migration 20271301571290).
 *
 * ⚖ Owner 2026-11-01 (DECISION_LOG "A MOMENT PICKS WHICH MARCH; MARCHES ARE MADE IN MARCH, WITH GUESTS PICKED"):
 * *"When we say this is a march. It picks which march. So in march we can create a march similar to schedule"* ·
 * *"And pick guests to add to the march."* The moment sheet's dropdown lists the marches plus + New march.
 *
 *   · march_set — the moment is that march (`march_key`), or "Not a march". Only the moment's row is written: removing
 *                 the link never deletes the march (the database's own terms, `a-moment-picks-a-march.db.test.ts`).
 *   · march_new — a new march, made by the SAME writer Guests › March uses (`addMarchGroup`: the group, then its place
 *                 at the end of the section order), then linked. Its guests are picked in Guests › March.
 *
 * 🔑 NOT A SERVER ACTION. No `'use server'`: plain functions the Schedule's own update door calls through its
 * `moment_op` branch (+0 to the route budget). Each answers in words and reads back what it wrote.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getHostUserId, limitedHelperRefusal } from '@/lib/host-gate';
import { readAllGroups } from '@/lib/entourage-write';
import { newOwnGroupKey } from '@/lib/march-drag';
import { NOT_A_MARCH, isMarchKey, marchNameFrom } from '@/lib/schedule-chapters';
import { linkMomentMarch, type Wrote } from '@/lib/schedule-chapters.server';
import { addMarchGroup } from '../guests/march-group-step';

export async function runMomentMarch(
  supabase: SupabaseClient,
  op: 'march_set' | 'march_new',
  eventId: string,
  momentId: string,
  fd: FormData,
): Promise<Wrote<string>> {
  if (op === 'march_set') {
    const raw = fd.get('march_key');
    if (raw === NOT_A_MARCH || raw === '') return linkMomentMarch(supabase, eventId, momentId, null);
    if (!isMarchKey(raw)) return { ok: false, error: 'Pick a march from the list.' };
    return linkMomentMarch(supabase, eventId, momentId, raw);
  }

  const name = marchNameFrom(fd.get('march_name'));
  if (!name.ok) return name;
  // Making a march is the guest list's — asked here in words, before the writer's own gates (which redirect).
  const refused = await limitedHelperRefusal(eventId, 'guest_list');
  if (refused) return { ok: false, error: refused };
  if ((await getHostUserId(eventId)) === null) {
    return { ok: false, error: 'Only the hosts make a new march — pick one already made.' };
  }
  const order = await readAllGroups(eventId);
  if (!order.ok) return { ok: false, error: order.reason };
  const key = newOwnGroupKey();
  const made = await addMarchGroup(eventId, key, name.name, order.full[order.full.length - 1] ?? null);
  if (!made.ok) return { ok: false, error: made.reason };
  const linked = await linkMomentMarch(supabase, eventId, momentId, key);
  if (!linked.ok) {
    return { ok: false, error: `${name.name} was made in Guests › March, but this moment didn’t change — pick it from the list.` };
  }
  return { ok: true, value: key };
}
