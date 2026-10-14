import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guestRead } from '@/lib/guest-read';
import { eventRowOnce } from '@/lib/event-row-once';
import { fetchEgiftMethods } from '@/lib/egift';
import { giftRegistryHref } from '@/lib/gift-registry';
import { viewerIsRecognisedForEvent } from '@/lib/pabuya-recognition';
import { readGuestWishList } from '@/lib/wish-list.server';
import { wishListShownToGuests } from '@/lib/wish-list-studio';
import { GIFT_GIVER_FIELDS } from '@/lib/wish-list';
import { wishListShape } from '@/lib/wish-list-guest';
import { fixedSceneStyleOf } from '@/lib/fixed-scene-style-of';
import { partLookAttr } from '@/lib/scene-styles-parts';
import { readGuestSessionForEvent } from '@/lib/guest-one-path.server';
import { guestDisplayName } from '@/lib/guests';
import { eventWordsFor } from '../../_lib/event-words';
import type { GiftRecordReader } from '../_components/wish-list';
import { giftCardsFor, type GiftPageContent } from './gift-cards';

/**
 * 🎁 THE ONE READER OF THE E-GIFTS CONTENT — `/[slug]/pabuya` and the Welcome page's E-Gifts both call this, so what a
 * reader sees cannot differ between them (owner 2026-10-14: E-Gifts on the Welcome page, not behind a door).
 *
 * 🔒 IT DECIDES WHAT, NEVER WHETHER. Who may open the gift page at all is each caller's own gate, asked BEFORE this
 * runs: the page's (`isPabuyaPublicRouteEnabled` · "Accept gifts?" · the website surface · `canViewSlugEvent` · the
 * part the couple hid), and the Welcome's — the door's own rule, `resolveGuestDoorways(...).pabuya`, which is gated
 * on what the page demands (`_lib/site-nav.ts`, "THE DOORS THAT ARE NOT SLOTS") and drawn only where the couple has
 * not hidden E-Gifts (`welcomeParts`). What it decides is the part the owner ruled on twice: the payment
 * identifiers, shown only to a reader the event RECOGNISES (`viewerIsRecognisedForEvent` → `giftCardsFor`).
 *
 * Reads via the SERVICE-ROLE client the caller hands in, exactly as the page always did (events has no anon-read
 * policy; the page reads service-role behind its published-visibility gate). Only ENABLED methods are fetched, so a
 * hidden destination never leaks. A failed read THROWS (the guest boundary, `lib/guest-read.ts`).
 */
export type GiftPageEvent = {
  event_id: string;
  display_name: string | null;
  event_type: string | null;
  gifts_on?: boolean | null;
  style_preferences?: unknown;
  /** Handed in when the caller already holds it (the gift page reads it; the Maker's canvas has the DRAFT's). */
  pabuya_message?: string | null;
  gift_registry_url?: string | null;
};

export async function loadGiftPage(admin: SupabaseClient, event: GiftPageEvent): Promise<GiftPageContent> {
  /*
    🎁 WHO IS READING, FOR "I SENT IT" (owner 2026-10-08). The RSVP's own identity read —
    this browser's invitation for THIS event, or the signed-in account's own seat at it —
    and then the guest row itself, which must be this event's and not removed. It decides
    two things only: whose name the record sheet shows ("from your invitation"), and whose
    own gifts are marked "You sent". The WRITE asks all of it again on the server
    (`lib/gift-record.server.ts`); nothing here is trusted by it.
  */
  const guestSession = await readGuestSessionForEvent(event.event_id);
  /* 🔌 A failed read throws (the guest boundary, `lib/guest-read.ts`) — never "open your own invitation link" to a
     guest whose invitation IS this browser's: a reader the read could not see is not a reader who is not there. */
  const readerRow = guestSession
    ? ((await guestRead('pabuya (gift reader)', () =>
        admin
          .from('guests')
          .select(GIFT_GIVER_FIELDS)
          .eq('guest_id', guestSession.guest_id)
          .eq('event_id', event.event_id)
          .maybeSingle(),
      )) as { guest_id: string; display_name: string | null; first_name: string | null; last_name: string | null; deleted_at: string | null } | null)
    : null;
  const reader = readerRow && readerRow.deleted_at == null ? readerRow : null;
  const giftReader: GiftRecordReader = {
    eventId: event.event_id,
    giverName: reader ? guestDisplayName({ display_name: reader.display_name, first_name: reader.first_name ?? '', last_name: reader.last_name ?? '' }) : '',
    recognised: reader != null,
  };

  /* The couple's words and registry link: from the caller when it holds them (the page's own read; the Maker's
     drafted row), else from the row this render already holds (`eventRowOnce`) or one read of its own. */
  const ownWords =
    'pabuya_message' in event && 'gift_registry_url' in event
      ? null
      : eventRowOnce(admin, event.event_id, 'pabuya_message, gift_registry_url', () =>
          admin.from('events').select('pabuya_message, gift_registry_url').eq('event_id', event.event_id).maybeSingle(),
        );

  /*
    Does this event RECOGNISE the reader? A guest who opened their personal link
    or scanned their QR carries a session for this event; a host is signed in
    and holds an `event_members` row. Anybody else — including somebody the
    couple forwarded the link to — is a passer-by. The two arms, and the
    `isHostMemberType`-never-`Boolean(row)` warning that goes with them, live in
    `lib/pabuya-recognition.ts` — the one function BOTH doors onto the
    identifiers import (this content, and the permanent QR route
    `/api/pabuya/qr/[publicId]`).
  */
  const [methods, wishRead, viewerIsRecognised, stored, words] = await Promise.all([
    fetchEgiftMethods(admin, event.event_id, {
      enabledOnly: true,
    }),
    /* 🎁 The wish list is read beside the ways to give — same service-role client, same gate
       (owner 2026-10-08). It reads ONE sum per wish and no giver's name, words or
       screenshot (`readGuestWishList`). */
    readGuestWishList(admin, event.event_id, reader?.guest_id ?? null),
    viewerIsRecognisedForEvent(event.event_id),
    ownWords,
    // This event type's word for whoever is throwing it. Wedding → 'couple'.
    eventWordsFor(event.event_type),
  ]);
  /* 🔌 A refused read of the couple's words is not "they wrote none" — it throws, like every read above. */
  if (stored?.error) throw new Error(`loadGiftPage: could not read the gift words for ${event.event_id}: ${stored.error.message}`);
  const own = (stored?.data ?? null) as { pabuya_message?: string | null; gift_registry_url?: string | null } | null;
  const message = ('pabuya_message' in event ? event.pabuya_message : own?.pabuya_message) ?? null;
  const registryUrl = ('gift_registry_url' in event ? event.gift_registry_url : own?.gift_registry_url) ?? null;

  /*
    IS THE LIST SHOWN? One rule, the Studio's own (`wishListShownToGuests`): gifts
    accepted · at least one way to give switched on · at least one wish. With no way
    to give a guest could not send for a wish, so the list is KEPT but not drawn —
    and the Studio says so to the couple. A read that failed draws no list either:
    never wishes with nothing sent beside them.
  */
  const wishes =
    wishRead.read &&
    wishListShownToGuests({ giftsOn: event.gifts_on, methods, wishCount: wishRead.wishes.length })
      ? wishRead.wishes
      : [];
  /* The list wears the E-Gifts look already picked in Stages › Style (the Invitation's
     gift block) — no second picker. */
  const wishShape = wishListShape(partLookAttr('gifts', fixedSceneStyleOf(event.style_preferences, 'gifts', 'rsvp', event.event_type)));

  const { cards, identifiersWithheld, howToSend } = giftCardsFor(methods, viewerIsRecognised);

  // The event's own name when it has one; otherwise this event type's word.
  const hostName = event.display_name ?? words.theOrganizer;
  return {
    eventId: event.event_id,
    words,
    hostName,
    displayName: event.display_name,
    hostPossessive: event.display_name ? `${event.display_name}’s` : words.theOrganizerPossessive,
    message: typeof message === 'string' && message ? message : null,
    registryHref: giftRegistryHref(registryUrl),
    wishes,
    wishShape,
    cards,
    identifiersWithheld,
    howToSend,
    reader: giftReader,
  };
}
