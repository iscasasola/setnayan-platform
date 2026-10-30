'use server';

import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/is-uuid';
import { fetchEventViewer } from '@/lib/event-viewer.server';
import { profileSetup, resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { planMyselfOn } from '@/lib/plan-myself';
import { loadEventSettings } from '../launch/_components/details-settings-load';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { readHubDraft } from '@/lib/hub-draft-store';
import { parentGuestsForEvent } from '@/lib/print-set.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { loadYourEvent } from '../launch/_components/details-your-event-load';
import { HubDraftDock } from '../website/_components/hub-draft-dock';
import { loadPeopleWithAccess } from '@/lib/people-with-access.server';
import { readClaimAccessAsks } from '@/lib/claim-access-asks.server';
import { accessFlashFrom } from '@/lib/people-with-access';
import { EventSettingsRows, type EventSettingsAccess, type EventSettingsMore } from './event-settings-rows';

/**
 * ⚙ HOME › EVENT SETTINGS — THE SHEET'S ROWS, READ AT THE TAP (owner 2026-10-29, verbatim: *"on event dashboard> home
 * the header does not show the settings icon like the other pages with settings icon. keep it there"*; DECISION_LOG
 * 2026-10-27 "APPROVED — SETTINGS PER MENU": *"Home's header ⚙ = Event Settings only"* · "INFO SPLITS BY WHAT IT IS
 * ABOUT": names · date · venues · parents live in Home › Event Settings).
 *
 * 🔑 NOT ONE NEW EDITOR. Every row is the editor that fact already has:
 *   · Names · Date · Venues — `yourEventFactEditors`, the ONE builder the Maker's Details AND Event Details' rows mount
 *     (`every-fact-has-one-editor.test.ts`), fed by the same reader (`loadYourEvent`) with the draft laid over live —
 *     exactly as `details/_components/record-editor.tsx` feeds it;
 *   · Parents — `ParentCards`, the Maker's own list + add (each parent opens THE guest card);
 *   · and the Maker's own Undo · Apply (`HubDraftDock`) on top, as Event Details carries it: these facts save into the
 *     Event Hub draft and go live at Apply — a typed name never waits on a page the couple is not on;
 *   · People with access, LAST (owner 2026-10-30, *"that shoud be inside home settings"*) — `PeopleWithAccess`, the
 *     section Event Details' "Event access" fold mounts, read by the same two readers (`loadPeopleWithAccess`,
 *     `readClaimAccessAsks`) in the SAME round as the rows above — one round per open, nothing per person.
 *
 * ⚡ Nothing here is read with Home: the ⚙ calls this once, when it is pressed (`home-settings-gear.tsx`), and again only
 * after a save asked for its one refresh. Reading never writes.
 *
 * A refusal is a plain sentence, never the database's words.
 */
export type EventSettingsResult = { ok: true; body: ReactNode } | { ok: false; reason: string };

const COULD_NOT_OPEN = 'Event settings couldn’t open just now. Nothing was changed — close it and try again.';

export async function openEventSettings(
  eventId: string,
  /** The address the sheet opened from — only a Remove's own words are read from it (`accessFlashFrom`). */
  landed?: { host_removed?: string; invite_error?: string } | null,
): Promise<EventSettingsResult> {
  if (!isUuid(eventId)) return { ok: false, reason: COULD_NOT_OPEN };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: COULD_NOT_OPEN };
    const [viewer, typeRes] = await Promise.all([
      fetchEventViewer(supabase, eventId, user.id),
      // + what the moved Event Details parts draw (Plan it myself · Put this away) — one row, read once.
      supabase.from('events').select('event_type, planning_mode, archived, display_name').eq('event_id', eventId).maybeSingle(),
    ]);
    // The couple changes the event's own facts — who may open these fields on Event Details (`canEditHub`).
    if (!viewer.isCouple) return { ok: false, reason: 'Only the hosts can change the event’s names, date and venues.' };
    if (typeRes.error || !typeRes.data) {
      if (typeRes.error) logQueryError('EventSettings.type', typeRes.error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false, reason: COULD_NOT_OPEN };
    }
    const profile = await resolveProfile(((typeRes.data as { event_type?: string | null }).event_type ?? null) || 'wedding');
    // An event whose type has no Event Hub has no Maker editor for its names · date · venues — its sheet is access alone.
    const maker = surfaceEnabled(profile, 'website');

    const admin = createAdminClient();
    const [draft, parents, people, claims, settings] = await Promise.all([
      // A draft that cannot be read shows the live values — the fields never invent a draft.
      maker ? readHubDraft(supabase, eventId).catch(() => null) : Promise.resolve(null),
      maker ? parentGuestsForEvent(eventId).catch(() => null) : Promise.resolve(null),
      // A failed read is said as a failure in the section — never "nobody else has access".
      loadPeopleWithAccess(eventId, user.id).catch((e: unknown) => {
        console.error('[event-settings] people with access failed:', e instanceof Error ? e.message : e);
        return { measured: false as const };
      }),
      readClaimAccessAsks(supabase, eventId),
      // Kind · area · guest estimate — Event Details' `settings` field, its own loader (null = unread → said).
      loadEventSettings({ supabase, eventId, userId: user.id }).catch((e: unknown) => {
        console.error('[event-settings] the event settings could not be read:', e instanceof Error ? e.message : e);
        return null;
      }),
    ]);
    const row = typeRes.data as { planning_mode?: string | null; archived?: boolean | null; display_name?: string | null };
    const more: EventSettingsMore = {
      settings: settings ?? 'failed',
      planMyself: planMyselfOn(typeof row.planning_mode === 'string' ? row.planning_mode : null),
      oneCode: profileSetup(profile).cameraDefault !== 'off',
      putAway: { archived: Boolean(row.archived), eventName: row.display_name?.trim() || 'this event' },
    };
    const flash = accessFlashFrom(landed);
    const access: EventSettingsAccess = people.measured
      ? { measured: true, rows: people.rows, addable: people.addable, claims, flash }
      : { measured: false, claims, flash };
    if (!maker) {
      return { ok: true, body: <EventSettingsRows eventId={eventId} input={null} parents={null} dock={null} access={access} more={more} /> };
    }
    const input = await loadYourEvent({
      supabase,
      admin,
      eventId,
      mayShowStdFilm: resolveWeddingOnlyParts(profile).save_the_date_film,
      parentCount: parents?.length ?? 0,
      hostCount: 0,
      drafted: (draft?.events ?? {}) as Record<string, unknown>,
      draftedVenue: draft?.widgets.venue_map?.venue ?? null,
    }).catch((e: unknown) => {
      console.error('[event-settings] your event could not be read:', e instanceof Error ? e.message : e);
      return null;
    });
    // An editor over a name it failed to read would SAVE that emptiness — say so instead.
    if (!input) return { ok: false, reason: COULD_NOT_OPEN };

    return {
      ok: true,
      body: (
        <EventSettingsRows eventId={eventId} input={input} parents={parents} dock={<HubDraftDock eventId={eventId} />} access={access} more={more} />
      ),
    };
  } catch (e) {
    console.error('[event-settings] could not open:', e instanceof Error ? e.message : e);
    return { ok: false, reason: COULD_NOT_OPEN };
  }
}
