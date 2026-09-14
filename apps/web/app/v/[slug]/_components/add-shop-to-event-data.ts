/**
 * add-shop-to-event-data.ts — WHICH of your celebrations is this shop for?
 *
 * ── WHAT IT REPLACES (measured on origin/main, 2026-09-14) ─────────────────
 * The shop page never asked which celebration a visit was about. It took
 * `events[0]` and scoped everything to it — the existing-thread lookup, the
 * composer, and the inquiry that eventually puts this shop on somebody's list:
 *
 *     app/v/[slug]/page.tsx        `coupleEventId = events[0]?.event_id ?? null`
 *     app/v/[slug]/inquiry-actions.ts  `: (events[0]?.event_id ?? null)`
 *
 * ⚠ `events[0]` IS NOT ARBITRARY — a first draft of this file said it was, and
 * that was wrong. `fetchUserEvents` puts no `.order()` on the query, but it
 * SORTS THE ROWS IN JS before returning: `is_primary` first, then soonest
 * `event_date`, dateless last. So `events[0]` means "your primary celebration,
 * otherwise the soonest one". A real rule — just an invisible one the couple
 * never chose and is never shown.
 *
 * 🔑 IT IS GENUINELY UNDECIDED ONLY AMONG TIES. The comparator returns 0 for a
 * tie and `Array.prototype.sort` is stable, so tied rows keep whatever order the
 * unordered query returned. Nothing enforces a single primary: an account with
 * TWO events flagged `is_primary = true` was measured on 2026-09-08 (see
 * `saveVendorToPicks`), and for that couple which event won was arbitrary per
 * request. Two celebrations sharing a date, or both dateless, tie the same way.
 *
 * Either way the couple is not asked. Someone planning a wedding AND their
 * parents' anniversary asked a caterer a question from the shop page and could
 * not tell, and was not told, which celebration it attached to.
 *
 * ── WHY THIS RESOLVER AND NOT A NEW RULE ──────────────────────────────────
 * The picker already exists — `app/_components/marketing/add-to-event*` — built
 * to the owner's 2026-08-21 ruling: pick which event, "only ... events that is
 * compatible to this", "the ongoing and upcoming only". This is that picker's
 * data shape for a SHOP rather than a Studio service, so the drawer, its search,
 * its empty sentences and its create row are the shipped ones.
 *
 * 🔑 THE FILTERING RULE IS REUSED UNTOUCHED. `eventsForStudioApp` takes a
 * `ServiceGate` — `Pick<StudioApp,'surface'>` — and its own docblock says "a
 * service with no `surface` is universal and skips this gate". A shop IS
 * universal: a caterer is not incompatible with a birthday. So this passes a
 * surfaceless gate and gets gates 1 and 2 exactly as shipped — "yours to change"
 * and "ongoing and upcoming only" — without a second copy of either predicate,
 * and without editing the rule.
 *
 * 🔑 NOTHING IS WRITTEN, same as the Studio picker. Each row is a LINK back to
 * this shop carrying `?event=`, so choosing is navigation. No order, no charge,
 * no mutation, and no new server action — the page then scopes itself to the
 * chosen celebration and the existing inquiry action receives it as the
 * `eventId` it already validates.
 */
import 'server-only';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { resolveProfile, type EventTypeProfile } from '@/lib/event-type-profile';
import { manilaTodayISO } from '@/lib/event-board';
import {
  eventsForStudioApp,
  emptyPickerReason,
  type PickableEvent,
} from '@/lib/events-for-studio-app';
import type { AddToEventOption } from '@/app/_components/marketing/add-to-event-data';

export type AddShopToEventState =
  | { signedIn: false }
  | { signedIn: true; options: AddToEventOption[]; emptyReason: string | null };

/**
 * A shop is compatible with every kind of celebration, so it carries no
 * `surface` and `eventsForStudioApp` skips its third gate. Named rather than
 * inlined so the reason is greppable from the rule it is passed to.
 */
const SHOP_IS_UNIVERSAL = {} as const;

/** Where a row goes: this same shop, now scoped to that celebration. */
export function shopEventHref(slug: string, eventId: string): string {
  return `/v/${encodeURIComponent(slug)}?event=${encodeURIComponent(eventId)}`;
}

/**
 * Fails soft to `{ signedIn: false }` — the page then renders exactly what a
 * signed-out visitor sees, which works for everybody. A throw here would blank a
 * public shop page.
 */
export const resolveAddShopToEvent = cache(
  async (slug: string): Promise<AddShopToEventState> => {
    const signedOut = { signedIn: false } as const;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return signedOut;

      // ORGANISER memberships only. Being invited to somebody's wedding is not
      // permission to attach a shop to it; `eventsForStudioApp` checks the
      // stance again from member_type, so this is a narrowing, not the gate.
      const events = await fetchUserEvents(supabase, user.id, 'couple');

      // One profile read per DISTINCT type — `resolveProfile` is React-cache()d,
      // and it is read for the celebration's own WORD ("wedding", "birthday"),
      // not for a compatibility check a shop does not have.
      const types = Array.from(new Set(events.map((e) => e.event_type ?? 'wedding')));
      const profiles = new Map<string, EventTypeProfile | null>();
      await Promise.all(
        types.map(async (t) => {
          try {
            profiles.set(t, await resolveProfile(t));
          } catch {
            profiles.set(t, null);
          }
        }),
      );

      const pickable: PickableEvent[] = events.map((e) => ({
        eventId: e.event_id,
        title: e.display_name,
        eventDate: e.event_date,
        eventEndDate: e.event_end_date ?? null,
        archived: e.archived,
        memberType: e.member_type,
        profile: profiles.get(e.event_type ?? 'wedding') ?? null,
      }));

      const result = eventsForStudioApp(SHOP_IS_UNIVERSAL, pickable, manilaTodayISO());

      return {
        signedIn: true,
        options: result.pickable.map((e) => ({
          eventId: e.eventId,
          title: e.title,
          kindWord: e.profile?.terminology?.eventWord ?? 'celebration',
          dateISO: e.eventDate,
          href: shopEventHref(slug, e.eventId),
        })),
        emptyReason: emptyPickerReason(result),
      };
    } catch {
      return signedOut;
    }
  },
);
