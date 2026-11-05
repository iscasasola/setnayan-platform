import 'server-only';

/**
 * lib/home-hub-card.server.ts — WHAT HOME'S EVENT HUB CARD READS (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 2: *"on home, we can pick what part of event hub will be
 * active. and if it is on or off? like papic?"*).
 *
 * Nothing here is new knowledge. The card shows:
 *   · who can view and the link — `events.landing_page_visibility` / `slug`, in the Maker's words (`whoCanViewLabel`);
 *   · which page guests see now — `resolveHubStage`, the Event Hub control's own answer;
 *   · the parts of each page and whether guests meet them — "What guests see" (`buildGuestsSeeTable`), built from
 *     the SAME inputs the Maker builds it from (`website/editor/page.tsx` → `buildMakerNavigatorData`): the live
 *     `invitation_widgets` rows with the DRAFT laid over them, the section content map, the type's parts, the solemn
 *     register, the countdown and "Accept gifts?". A tap on Home writes the Maker's own draft (`hubDraftAction`), so
 *     the card, the Maker and the Apply bar are one answer.
 *
 * 🔒 HONEST READS. The event row refused → `{ ok: false }` and the card says "couldn't load" (never "Private", never
 * an empty list). The widget rows refused → no table (the card draws no switch over rows it could not read). The draft
 * refused → the live rows, flagged `draftUnread` (the dock beside it already says "could not read your draft").
 * Held by `app/dashboard/[eventId]/_components/home-cards/home-cards-read-honestly.test.ts`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { countdownTargetMs } from '@/lib/countdown-target';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { ENTOURAGE_ROLES } from '@/lib/entourage';
import { readHubDraft } from '@/lib/hub-draft-store';
import { overlayHubDraftEvent, overlayHubDraftWidgets } from '@/lib/hub-draft';
import { isWidgetType, type InvitationWidgetRow, type LifecyclePhase } from '@/lib/invitation-widgets';
import { computeSectionContentMap } from '@/lib/website-section-content';
import { buildGuestsSeeTable } from '@/lib/guests-see-build';
import type { GuestsSeeTable } from '@/lib/guests-see-table';
import { resolveHubStage } from '@/lib/event-hub-control';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { eventHubOwnership } from '@/lib/couple-website-pro';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';

export type HomeHubCardRead =
  | { ok: false }
  | {
      ok: true;
      /** The event's slug and its public page's path (`/slug`, or the owner's) — null when it has no slug yet. */
      slug: string | null;
      path: string | null;
      /** `landing_page_visibility` as stored. */
      visibility: string | null;
      /** Which page the link shows now — null when the date could not place it. */
      stage: LifecyclePhase | null;
      /** "What guests see", the draft laid over — null when the scene rows could not be read. */
      table: GuestsSeeTable | null;
      /** The draft could not be read — the table shows the live rows. */
      draftUnread: boolean;
      /** Event Hub Pro parts this event holds (Full Pro counts as all) — null when unread. */
      proParts: { full: boolean; count: number } | null;
    };

export async function readHomeHubCard(supabase: SupabaseClient, eventId: string): Promise<HomeHubCardRead> {
  const [eventRes, widgetsRes, draftRead, entourageRes, ownerSlug, ownership] = await Promise.all([
    supabase
      .from('events')
      .select(
        'slug, landing_page_visibility, event_date, event_end_date, cleared_at, timezone, std_invitation_launch_date, event_type, website_open_browse, gifts_on, venue_name, venue_address, venue_latitude, venue_longitude, love_story, special_message, what_to_bring, our_photos',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('invitation_widgets')
      .select('widget_id, event_id, widget_type, display_order, is_visible, is_always_on, tier, config_json, created_at, updated_at, mode, audience')
      .eq('event_id', eventId),
    readHubDraft(supabase, eventId).then(
      (draft) => ({ draft, unread: false }),
      () => ({ draft: null, unread: true }),
    ),
    supabase
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .or(`role.in.(${ENTOURAGE_ROLES.join(',')}),extra_roles.ov.{${ENTOURAGE_ROLES.join(',')}}`),
    resolveEventOwnerSlug(createAdminClient(), eventId).catch((): null => null),
    eventHubOwnership(supabase, eventId).catch((): null => null),
  ]);

  if (eventRes.error || !eventRes.data) return { ok: false };
  const event = eventRes.data;

  const stage = resolveHubStage({
    measured: true,
    eventDate: event.event_date ?? null,
    eventEndDate: event.event_end_date ?? null,
    clearedAt: event.cleared_at ?? null,
    timezone: event.timezone ?? null,
    slug: event.slug ?? null,
    invitationLaunchDate: event.std_invitation_launch_date ?? null,
  });

  let table: GuestsSeeTable | null = null;
  if (!widgetsRes.error) {
    const live = ((widgetsRes.data ?? []) as Array<Omit<InvitationWidgetRow, 'widget_type'> & { widget_type: string }>).filter(
      (r): r is InvitationWidgetRow => isWidgetType(r.widget_type),
    );
    const widgets = overlayHubDraftWidgets(live, draftRead.draft);
    const drafted = overlayHubDraftEvent(event as Record<string, unknown>, draftRead.draft) as typeof event;
    const eventType = (event.event_type as string | null) ?? 'wedding';
    const [content, profile, words] = await Promise.all([
      computeSectionContentMap(supabase, eventId, event as Parameters<typeof computeSectionContentMap>[2], widgets),
      resolveProfile(eventType),
      eventWordsFor(eventType),
    ]);
    const countdownMs = countdownTargetMs(event.event_date ?? null, event.timezone ?? undefined);
    const entourage = entourageRes.error ? null : entourageRes.count;
    table = buildGuestsSeeTable({
      widgets,
      openBrowse: event.website_open_browse === true,
      weddingOnlyParts: resolveWeddingOnlyParts(profile),
      content,
      solemn: words.solemn,
      countdownPast: countdownMs !== null && countdownMs <= Date.now(),
      hasEntourage: entourage === null ? true : entourage > 0,
      giftsOff: (drafted as { gifts_on?: boolean | null }).gifts_on === false,
    });
  }

  return {
    ok: true,
    slug: event.slug ?? null,
    path: event.slug ? publicEventPath(event.slug, ownerSlug) : null,
    visibility: event.landing_page_visibility ?? null,
    stage,
    table,
    draftUnread: draftRead.unread,
    proParts: ownership ? { full: ownership.full, count: ownership.parts.size } : null,
  };
}
