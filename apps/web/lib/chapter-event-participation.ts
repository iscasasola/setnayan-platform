import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { isFinishedEvent, manilaTodayISO } from '@/lib/event-board';

/**
 * Who may attach a chapter to a celebration, and what that gets them.
 *
 * Owner, 2026-08-15 — two rulings that only work together:
 *   "vendors who are part of that event can create a content for that event."
 *   "they can create a column for that story, and the user can decide to add it
 *    or not."
 *
 * 🔑 THE MODEL IS NOT ASK-BEFORE-YOU-WRITE. A supplier who worked the day is
 * never blocked from telling their side — the piece is theirs and appears on
 * their own page either way. The couple decides only whether it is ADDED to
 * THEIR day. Nobody waits on anybody to create. (This is the owner's shape and
 * it retires the request-and-approve handshake in the design record's D2.)
 *
 * 🛑 THE TWO HALVES ARE ONE UNIT. Widening who may attach WITHOUT the host's
 * include-control would let a business hang a public page off a family's
 * wedding with no say from that family — strictly worse than the hosts-only
 * behaviour it replaces. Never ship the widening alone.
 */

/** How this account is tied to the celebration. */
export type EventTie = 'host' | 'vendor';

export type LinkableEvent = {
  event_id: string;
  label: string;
  tie: EventTie;
  /** The celebration's day (`YYYY-MM-DD`), or null while the date is unset. */
  day: string | null;
};

/**
 * The celebrations this account may attach a chapter to: the ones they HOST,
 * plus the ones their shop was BOOKED on.
 *
 * ⚠ A booked supplier is a participant, not a host. Attaching is theirs; being
 * shown on the couple's day is not — see `host_included_at`, which the database
 * stamps only when the author is the host.
 *
 * 🪤 A failed read returns an empty list rather than a partial one, and the
 * ACTION re-checks the tie before storing, so a lost list can never become a
 * wrong link.
 */
export async function loadLinkableEvents(
  userId: string,
  options: { keepEventIds?: ReadonlyArray<string | null>; todayISO?: string } = {},
): Promise<LinkableEvent[]> {
  const admin = createAdminClient();
  const out = new Map<string, Candidate>();
  const todayISO = options.todayISO ?? manilaTodayISO();
  const keep = new Set((options.keepEventIds ?? []).filter((id): id is string => !!id));

  const { data: hosted, error: hostedErr } = await admin
    .from('event_members')
    .select(
      'event_id, member_type, events:event_id ( display_name, event_date, event_end_date, archived, event_type )',
    )
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  if (!hostedErr) {
    for (const row of hosted ?? []) out.set(...entry(row, 'host'));
  }

  // Booked supplier: the account's shops, then the celebrations those shops
  // were booked on. `event_vendors.linked_vendor_profile_id` is the same
  // evidence `resolveShoppableVendors` already trusts to call a credit real.
  const { data: shops, error: shopsErr } = await admin
    .from('vendor_profiles')
    // ⚠ `user_id`, not `owner_user_id`. A phantom column here would come back
    // as { error } rather than throwing, so every supplier's list would have
    // been silently empty — the feature would look built and do nothing.
    // Column names verified against prod before writing.
    .select('vendor_profile_id')
    .eq('user_id', userId);
  if (!shopsErr && shops && shops.length > 0) {
    const shopIds = shops.map((s) => (s as { vendor_profile_id: string }).vendor_profile_id);
    const { data: booked, error: bookedErr } = await admin
      .from('event_vendors')
      .select(
        'event_id, events:event_id ( display_name, event_date, event_end_date, archived, event_type )',
      )
      .in('linked_vendor_profile_id', shopIds);
    if (!bookedErr) {
      for (const row of booked ?? []) {
        const [id, value] = entry(row, 'vendor');
        // Hosting outranks supplying — a couple who also has a shop is still
        // the host of their own wedding, and must not be asked to approve
        // themselves.
        if (!out.has(id)) out.set(id, value);
      }
    }
  }

  // ⏳ ONLY CELEBRATIONS THAT HAVE CONCLUDED (owner 2026-08-20: *"on your story,
  // all events that concluded can be picked here"*). A chapter is the editorial
  // OF a day; offering a day that has not happened invites somebody to write it
  // in advance and file it in the chronicle ahead of the celebration it is
  // about.
  //
  // 🔑 FILTER WHAT IS OFFERED, NEVER WHAT IS ALREADY ATTACHED. A host can move
  // their own date forward, and this list is also what the SAVE path re-checks
  // — so a plain filter would silently detach a written chapter from its day the
  // next time its author fixed a typo, taking the host's inclusion decision with
  // it (the DB trigger clears it on any event change). `keepEventId` keeps the
  // chapter's current celebration in the list whatever its date now says — the
  // caller passes the days its own chapters are already attached to.
  return [...out.values()]
    .filter((e) => keep.has(e.event_id) || hasConcluded(e, todayISO))
    .map(({ event_id, label, tie, day }): LinkableEvent => ({ event_id, label, tie, day }))
    .sort((a, b) => {
      // Newest celebration first — the one they most likely came to write.
      // Undated at the tail, in name order, same rule as the events board.
      if (a.day && b.day && a.day !== b.day) return a.day < b.day ? 1 : -1;
      if (a.day && !b.day) return -1;
      if (!a.day && b.day) return 1;
      return a.label.localeCompare(b.label);
    });
}

/**
 * What the loader carries internally: the public shape plus the two fields the
 * concluded test needs. They are stripped on the way out — a picker entry has
 * no business teaching a caller how "finished" is decided.
 */
type Candidate = LinkableEvent & { endDay: string | null; archived: boolean };

/** Concluded = the same question the events board's Finished shelf asks. */
function hasConcluded(e: Candidate, todayISO: string): boolean {
  return isFinishedEvent(
    { event_date: e.day, event_end_date: e.endDay, archived: e.archived },
    todayISO,
  );
}

function entry(row: unknown, tie: EventTie): [string, Candidate] {
  const r = row as { event_id: string; events?: unknown };
  const embedded = r.events;
  const ev = (Array.isArray(embedded) ? embedded[0] : embedded) as
    | {
        display_name?: string | null;
        event_date?: string | null;
        event_end_date?: string | null;
        archived?: boolean | null;
        event_type?: string | null;
      }
    | undefined;
  const name = ev?.display_name?.trim();
  // The date is printed as a plain day string, never parsed into a Date — that
  // is how a 12 Dec wedding once read as 11 Dec west of Greenwich.
  const day = ev?.event_date ? ev.event_date.slice(0, 10) : null;
  const dayLabel = day ? ` · ${day}` : '';
  const kind = ev?.event_type ? ev.event_type.replace(/_/g, ' ') : 'celebration';
  const suffix = tie === 'vendor' ? ' — you worked this day' : '';
  return [
    r.event_id,
    {
      event_id: r.event_id,
      label: `${name || `Your ${kind}`}${dayLabel}${suffix}`,
      tie,
      day,
      endDay: ev?.event_end_date ? ev.event_end_date.slice(0, 10) : null,
      archived: ev?.archived === true,
    },
  ];
}

/**
 * Re-check a submitted event id against the account's real tie.
 *
 * 🔒 A FORM CAN BE POSTED WITH ANYTHING. Attaching surfaces that day's name,
 * date, venue and booked suppliers, so the tie is proven server-side and never
 * inferred from the list the browser was shown.
 */
export async function resolveEventTie(
  userId: string,
  eventId: string,
): Promise<EventTie | null> {
  // 🔑 THE TIE, NOT THE CALENDAR. `keepEventId` puts the submitted celebration
  // back in the list whatever its date says, so this answers the only question
  // it is asked — *is this day yours to attach* — and never turns "the host
  // moved the date" into "you may not save your own chapter". Whether a
  // not-yet-concluded day is OFFERED is a different question, answered above.
  const events = await loadLinkableEvents(userId, { keepEventIds: [eventId] });
  return events.find((e) => e.event_id === eventId)?.tie ?? null;
}
