/**
 * add-to-event-data.ts — which celebrations this service may be added to, for
 * the person looking at its page.
 *
 * Owner ruling, 2026-08-21, over three messages: the service page is IDENTICAL
 * signed out and signed in except for one button — *"each service when opened
 * will have a button to add to event"* — and pressing it *"will let them pick
 * which event this will be added to"*, showing *"only ... events that is
 * compatible to this"* and *"the ongoing and upcoming only"*.
 *
 * ─── WHY THE FILTERING HAPPENS HERE AND NOT IN THE CLIENT ────────────────
 * `lib/events-for-studio-app.ts` reaches `surfaceEnabled`, which lives in
 * `event-type-profile.ts` alongside a Supabase server client. Importing that
 * chain from a `'use client'` component would drag the server client into the
 * browser bundle. So the server decides and the client only draws — which also
 * means a stranger's browser never receives the names of somebody's
 * celebrations.
 *
 * 🔑 NOTHING IS WRITTEN. "Add to an event" resolves to `addOnHref`, the door
 * this product already uses to open a service inside an event. No order, no
 * charge, no mutation — the button is navigation, and that is the whole reason
 * it can ship without a payment path behind it.
 */
import 'server-only';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { resolveProfile, type EventTypeProfile } from '@/lib/event-type-profile';
import { manilaTodayISO } from '@/lib/event-board';
import { addOnHref } from '@/lib/add-ons-catalog';
import { studioApp } from '@/lib/studio-apps';
import {
  eventsForStudioApp,
  emptyPickerReason,
  type PickableEvent,
} from '@/lib/events-for-studio-app';

export type AddToEventOption = {
  eventId: string;
  /** the celebration's own name, as its owner typed it */
  title: string;
  /** 'wedding' | 'celebration' … — the profile's OWN word, never invented here */
  kindWord: string;
  dateISO: string | null;
  /** where pressing it goes: this service, inside that celebration */
  href: string;
};

export type AddToEventState =
  | { signedIn: false }
  | {
      signedIn: true;
      serviceName: string;
      options: AddToEventOption[];
      /** null when there IS something to pick */
      emptyReason: string | null;
    };

/**
 * Fails soft to `{ signedIn: false }`, and that is the correct direction: the
 * page then shows its ordinary "start planning" call to action, which works for
 * everybody. A thrown error here would blank a public marketing page.
 */
export const resolveAddToEvent = cache(
  async (studioKey: string): Promise<AddToEventState> => {
    const signedOut = { signedIn: false } as const;
    try {
      const app = studioApp(studioKey);
      if (!app) return signedOut;

      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return signedOut;

      // ORGANISER events only — `fetchUserEvents` already drops memberships a
      // person has hidden. Being invited to a wedding is not permission to bolt
      // a service onto it; `eventsForStudioApp` enforces that again from the
      // member_type, so this is a narrowing rather than the gate itself.
      const events = await fetchUserEvents(supabase, user.id, 'couple');

      /*
        One profile read per DISTINCT type, not per event. `resolveProfile` is
        React-cache()d at source, so this costs nothing extra when the rail has
        already asked — but resolving inside a per-event loop would still read
        the same type repeatedly within one render for somebody with four
        weddings.
      */
      const types = Array.from(new Set(events.map((e) => e.event_type ?? 'wedding')));
      const profiles = new Map<string, EventTypeProfile | null>();
      await Promise.all(
        types.map(async (t) => {
          try {
            profiles.set(t, await resolveProfile(t));
          } catch {
            // null is NOT "incompatible" — it is "could not check", and
            // `eventsForStudioApp` reports it separately so an empty list is
            // never mis-explained to a person as "you have none".
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

      const result = eventsForStudioApp(app, pickable, manilaTodayISO());

      return {
        signedIn: true,
        serviceName: app.name,
        options: result.pickable.map((e) => ({
          eventId: e.eventId,
          title: e.title,
          // the profile's own word for this kind of celebration. Falls back to
          // the neutral one rather than to a guessed label.
          kindWord: e.profile?.terminology?.eventWord ?? 'celebration',
          dateISO: e.eventDate,
          // A service with no in-app surface of its own opens the celebration
          // itself, so every row lands somewhere real.
          href: app.addOnKey
            ? addOnHref(app.addOnKey, e.eventId)
            : `/dashboard/${e.eventId}`,
        })),
        emptyReason: emptyPickerReason(result),
      };
    } catch {
      return signedOut;
    }
  },
);
