import type { SupabaseClient } from '@supabase/supabase-js';
import { manilaToday } from '@/lib/std-views';
import {
  findBlockingLifeEvent,
  isGatedLifeType,
  type LifeEventCandidate,
  type LifeEventRow,
} from '@/lib/life-event-gate';

/**
 * Life-event cardinality — the wedding-guard generalized (council verdict
 * Event_Creation_Limits_Council_Verdict_2026-07-17.md § 2, owner "build it
 * now" + "limit the events accordingly" 2026-07-17).
 *
 * ONE life event IN PLANNING per (creator account × event type × honoree).
 * The honoree key: honoree_dependent_id when linked → else the normalized
 * honoree_label → else the per-type singleton slot. Legacy (pre-epoch,
 * unlabeled) rows NEVER block — no prod account is retroactively frozen out.
 * The slot frees exactly like the wedding guard's: archive, or the event date
 * passing. Wedding itself keeps wedding-guard.ts untouched and never routes
 * through here.
 *
 * Called at EVERY events-insert server action (create-event, onboarding/
 * simple, onboarding/_shared/commit-event; onboarding/wedding applies the
 * wedding guard) — the lib/life-event-gate.test.ts insert-path scan is the CI
 * backstop against a future path bypassing it. Lifestyle types (travel,
 * corporate, anniversary, …) return null immediately: zero rules, unlimited
 * (owner-verbatim), and unknown vocab types fail open to lifestyle.
 */

export type BlockingLifeEvent = {
  eventId: string;
  displayName: string;
  eventDate: string | null;
};

type MemberEventsRow = { events: LifeEventRow | LifeEventRow[] | null };

/**
 * The account's blocking in-planning life event for this candidate, or null.
 * Mirrors getInPlanningWedding's query shape (event_members member_type
 * 'couple' — the canonical event-agnostic organizer type).
 */
export async function getBlockingLifeEvent(
  supabase: SupabaseClient,
  userId: string,
  candidate: LifeEventCandidate,
): Promise<BlockingLifeEvent | null> {
  if (!isGatedLifeType(candidate.eventType)) return null;

  const { data } = await supabase
    .from('event_members')
    .select(
      'events:event_id(event_id, event_type, display_name, event_date, archived, honoree_label, honoree_dependent_id, created_at)',
    )
    .eq('user_id', userId)
    .eq('member_type', 'couple');

  const rows: LifeEventRow[] = [];
  for (const row of (data ?? []) as MemberEventsRow[]) {
    const e = row.events;
    const ev = Array.isArray(e) ? e[0] : e;
    if (ev != null && ev.event_type === candidate.eventType) rows.push(ev);
  }

  const blocking = findBlockingLifeEvent(rows, candidate, manilaToday());
  if (!blocking) return null;
  return {
    eventId: blocking.event_id,
    displayName: blocking.display_name,
    eventDate: blocking.event_date,
  };
}
