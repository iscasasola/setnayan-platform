/**
 * notification-place.ts — WHICH PART OF SETNAYAN A NOTIFICATION IS FROM.
 *
 * Owner, 2026-11-13, over the live pop-over: *"how do we identify if it is from an event they are making or an event
 * they are invited to or a user notification … we need to be able to easily identify to see if they will jump to an
 * event dashboard, or their supplier dashboard, or something"*. Approved drawing (Option A):
 * `Setnayan/prototypes/notifications_place_2026-11-13/index.html` — its § 6 "For the builder" is the contract.
 *
 * ONE RULE FOR THE PART, shared by the bell's row and the phone push (it used to live inside
 * `lib/push-send.server.ts subjectFor()`, which only the push could call):
 *
 *   `/vendor-dashboard…`        → the shop        "SetnaProd · Your shop"
 *   `/admin…`                   → Setnayan HQ     "Setnayan HQ · Admin"
 *   an event (`event_id`, or a `/dashboard/<uuid>` link)  → the event  "Maria & Jose · You organise" / "· Invited"
 *   anything else               → your account    "Your account" (the phone: "Setnayan · Your account")
 *
 * The STANCE of an event is `event_members.member_type` through `eventStance()` (lib/event-board.ts) — the rule
 * Home's cards use for their stance chip — said short: organiser → "You organise", invited → "Invited", helper →
 * "You help".
 *
 * 🔒 HONEST READS. When the place cannot be said — the event was removed (`event_id` SET NULL, the link dead), the
 * person sits on several shops (`/vendor-dashboard/…` names none), or the read failed — the place is `null`, and a
 * null place is DRAWN as the words "Place didn't load" (`placeLineWords`). Never a blank tile, never a guessed place.
 *
 * Pure: no I/O, no React. The reads live in `lib/notifications.ts fetchNotificationEventPlaces` (one batch for the
 * whole list) and in `lib/push-send.server.ts` (one notice). 🔒 lib/notification-place.test.ts
 */
import { eventStance, type EventStance } from './event-board';
import { eventIdFromRelatedUrl } from './notification-event-id';

export type NotificationPart = 'event' | 'shop' | 'hq' | 'account';

/** The words a null place is drawn with. A row's place line is never blank. */
export const PLACE_DIDNT_LOAD = 'Place didn’t load';

export const SHOP_STANCE = 'Your shop';
export const ACCOUNT_NAME = 'Your account';
export const HQ_NAME = 'Setnayan HQ';
export const HQ_STANCE = 'Admin';

/** Whose notice is this? The one rule — the row and the push both ask it. */
export function notificationPart(relatedUrl: string | null | undefined, eventId: string | null | undefined): NotificationPart {
  const url = relatedUrl ?? '';
  if (url.startsWith('/vendor-dashboard')) return 'shop';
  if (url.startsWith('/admin')) return 'hq';
  if (eventId || eventIdFromRelatedUrl(url)) return 'event';
  return 'account';
}

/** An event link whose event is gone: the link names an event, the row's `event_id` was set null by the delete. */
export function eventWasRemoved(relatedUrl: string | null | undefined, eventId: string | null | undefined): boolean {
  return !eventId && eventIdFromRelatedUrl(relatedUrl) !== null;
}

const STANCE_WORDS: Record<EventStance, string> = {
  organiser: 'You organise',
  invited: 'Invited',
  helper: 'You help',
};

/** "You organise" · "Invited" · "You help" — or null when this login holds no seat on the event. */
export function eventStanceWords(memberType: string | null | undefined): string | null {
  if (!memberType) return null;
  const stance = eventStance(memberType as Parameters<typeof eventStance>[0]);
  return stance ? STANCE_WORDS[stance] : null;
}

// ── the facts a place is made from ──────────────────────────────────────────────────────────────────────────────

/** What one event's mark needs — the EventMonogram columns — plus its name and this login's seat on it. */
export type EventPlaceFact = {
  event_id: string;
  display_name: string;
  /** `event_members.member_type` for (event, this login), or null when there is no seat. */
  member_type: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_font_key: string | null;
  monogram_style: string | null;
  monogram_frame_key: string | null;
  monogram_custom_svg: string | null;
  monogram_uploaded_svg: string | null;
};

/** Who is reading — the account menu's facts (`SwitcherData`), already read by every layout that draws the bell. */
export type PlaceWho = {
  /** The person's own picture (presigned), or null → their initial. */
  photoUrl: string | null;
  photoFrame?: { x: number; y: number; zoom: number } | null;
  /** One letter for the picture-less circle, or null when even that was not read. */
  initial: string | null;
  /** Every shop this login can open (`reachableShops`). One → a shop notice names it; several → it cannot. */
  shops: ReadonlyArray<{ name: string; logoUrl: string | null }>;
};

/** The pure projection of the account menu's data. Structural, so this file never imports the server reader. */
export function placeWhoFromSwitcher(data: {
  displayName: string | null;
  email: string;
  photoUrl: string | null;
  photoFrame?: { x: number; y: number; zoom: number } | null;
  context: { shops: ReadonlyArray<{ name: string; logoUrl: string | null }> };
}): PlaceWho {
  const letter = (data.displayName?.trim() || data.email?.trim() || '').charAt(0).toUpperCase();
  return {
    photoUrl: data.photoUrl,
    photoFrame: data.photoFrame ?? null,
    initial: letter || null,
    shops: data.context.shops.map((s) => ({ name: s.name, logoUrl: s.logoUrl })),
  };
}

/**
 * Everything the list needs to place its rows. `events` null = the batch read failed (every event row then says
 * "Place didn't load"); `who` null = the account menu was not read.
 */
export type NotificationPlaceFacts = {
  events: ReadonlyMap<string, EventPlaceFact> | null;
  who: PlaceWho | null;
};

export type NotificationPlace =
  | { part: 'event'; name: string; stance: string | null; event: EventPlaceFact }
  | { part: 'shop'; name: string; stance: typeof SHOP_STANCE; logoUrl: string | null }
  | { part: 'account'; name: typeof ACCOUNT_NAME; stance: null; photoUrl: string | null; photoFrame: PlaceWho['photoFrame']; initial: string | null }
  | { part: 'hq'; name: typeof HQ_NAME; stance: typeof HQ_STANCE };

/** One row's place, or null when it cannot be said honestly. */
export function resolveNotificationPlace(
  row: { related_url: string | null; event_id?: string | null },
  facts: NotificationPlaceFacts | null | undefined,
): NotificationPlace | null {
  const eventId = row.event_id ?? null;
  const part = notificationPart(row.related_url, eventId);
  switch (part) {
    case 'hq':
      return { part: 'hq', name: HQ_NAME, stance: HQ_STANCE };
    case 'account': {
      const who = facts?.who ?? null;
      return {
        part: 'account',
        name: ACCOUNT_NAME,
        stance: null,
        photoUrl: who?.photoUrl ?? null,
        photoFrame: who?.photoFrame ?? null,
        initial: who?.initial ?? null,
      };
    }
    case 'shop': {
      // Owned shops are capped at one; several means a helper seat, and `/vendor-dashboard/…` names no shop.
      const shops = facts?.who?.shops ?? [];
      const only = shops.length === 1 ? shops[0] : undefined;
      const name = only?.name?.trim();
      return only && name ? { part: 'shop', name, stance: SHOP_STANCE, logoUrl: only.logoUrl } : null;
    }
    case 'event': {
      // The event was removed (event_id SET NULL), or the link is a public page the emitter did not tag.
      const id = eventId ?? eventIdFromRelatedUrl(row.related_url);
      if (!eventId || !id) return null;
      const event = facts?.events?.get(id);
      const name = event?.display_name?.trim();
      if (!event || !name) return null;
      return { part: 'event', name, stance: eventStanceWords(event.member_type), event };
    }
  }
}

// ── the words ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The quiet line above the title: **name** · stance — or the "didn't load" words. Never blank. */
export function placeLineWords(place: NotificationPlace | null): { name: string; stance: string | null; missing: boolean } {
  if (!place) return { name: PLACE_DIDNT_LOAD, stance: null, missing: true };
  return { name: place.name, stance: place.stance, missing: false };
}

/** The place line as one string — the ⓘ's label and the row's accessible name. */
export function placeLineText(place: NotificationPlace | null): string {
  const w = placeLineWords(place);
  return w.stance ? `${w.name} · ${w.stance}` : w.name;
}

const UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/** "guests" → "Guests" · "save-the-date" → "Save the date". */
function sectionWord(seg: string | undefined): string | null {
  if (!seg || UUIDISH.test(seg)) return null;
  const w = decodeURIComponent(seg).replace(/[-_]+/g, ' ').trim();
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : null;
}

function splitLink(url: string): { segs: string[]; query: URLSearchParams } {
  const [path = '', q = ''] = url.split('#')[0]!.split('?');
  return { segs: path.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

/** What the ⓘ holds: "Opens Maria & Jose › Guests". Where the press lands, said before it is pressed. */
export function opensWords(
  place: NotificationPlace | null,
  row: { related_url: string | null; event_id?: string | null },
): string {
  const url = row.related_url;
  if (!place && eventWasRemoved(url, row.event_id)) return 'This event was removed — the notice stays';
  if (!url || !url.startsWith('/')) return 'Nothing to open — the notice stays';
  const { segs, query } = splitLink(url);
  const seg = query.get('seg');
  if (!place) {
    const tail = segs.slice(1).map(sectionWord).find(Boolean) ?? null;
    return tail ? `Opens ${tail}` : 'Opens its page';
  }
  switch (place.part) {
    case 'event': {
      if (segs[0] !== 'dashboard') return `Opens ${place.name} — the event page`;
      const s = sectionWord(segs[2]);
      return s ? `Opens ${place.name} › ${s}` : `Opens ${place.name}`;
    }
    case 'shop': {
      const s = sectionWord(segs[1]);
      return s ? `Opens ${place.name} › ${s}` : `Opens ${place.name}`;
    }
    case 'hq': {
      const s = sectionWord(segs[1]) ?? sectionWord(query.get('tab') ?? undefined);
      return s ? `Opens HQ › ${s}` : 'Opens HQ';
    }
    case 'account': {
      const s = sectionWord(seg ?? undefined) ?? sectionWord(segs[segs[0] === 'dashboard' ? 1 : 0]);
      return s ? `Opens ${s}` : 'Opens your account';
    }
  }
}
