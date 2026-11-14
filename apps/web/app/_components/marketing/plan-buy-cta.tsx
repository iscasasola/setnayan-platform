/**
 * 💰 THE PLAN BUY DOOR on public pages (RW-13) — the "Add to an event" picker the service pages already use
 * (`AddToEvent`, from `add-to-event-cta.tsx`), pointed at the event's plan screen instead of a studio app. Signed out:
 * one link to sign in and come back. Signed in: the picker lists the person's own events (organiser memberships,
 * not archived); each row opens that event's plan screen at this plan's card, where its checkout drawer is.
 * A server component; no new server action. Every figure stays on the plan screen, read from the catalogue there.
 */
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { manilaTodayISO } from '@/lib/event-board';
import { PLAN_NAME, PLAN_SIGN_IN_HREF, planScreenHref, type PlanKey } from '@/lib/plan-buy-doors';
import { AddToEvent } from './add-to-event';
import type { AddToEventOption } from './add-to-event-data';

const QUIET =
  'inline-flex min-h-[44px] items-center text-[15px] font-semibold text-terracotta-700 underline-offset-2 hover:underline';

async function planOptions(plan: PlanKey): Promise<AddToEventOption[] | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) return null;
    const today = manilaTodayISO();
    const events = await fetchUserEvents(supabase, user.id, 'couple');
    return events
      .filter((e) => !e.archived)
      // A plan is for an event still ahead (or today) — a finished event has nothing left to unlock for its day.
      .filter((e) => !e.event_date || (e.event_end_date ?? e.event_date) >= today)
      .map((e) => ({
        eventId: e.event_id,
        title: e.display_name,
        kindWord: 'event',
        dateISO: e.event_date,
        href: planScreenHref(e.event_id, plan),
      }));
  } catch {
    return null;
  }
}

export async function PlanBuyCta({ plan }: { plan: PlanKey }) {
  const options = await planOptions(plan);
  if (options === null) {
    return (
      <Link href={PLAN_SIGN_IN_HREF} className={QUIET} data-plan-buy={plan} data-plan-buy-state="signed-out">
        Sign in to get {PLAN_NAME[plan]}
      </Link>
    );
  }
  return (
    <span className="inline-flex" data-plan-buy={plan} data-plan-buy-state="signed-in">
      <AddToEvent
        serviceName={PLAN_NAME[plan]}
        options={options}
        emptyReason={options.length === 0 ? 'You have no event ahead yet — start one, then add the plan to it.' : null}
        createHref="/start"
        createLabel="Free to start"
      />
    </span>
  );
}
