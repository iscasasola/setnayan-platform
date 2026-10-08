import { RoomFooter } from '../_components/room-footer';
import { giftRegistryHref } from '@/lib/gift-registry';
import { loadRoomLinks } from '../_lib/room-links.server';
import { cache } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Logo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventWordsFor, giftIsMoneyDance } from '../_lib/event-words';
import { canViewSlugEvent } from '@/lib/slug-access';
import { fetchEgiftMethods, isPabuyaPublicRouteEnabled } from '@/lib/egift';
import { giftsAreOn } from '@/lib/event-answers';
import { viewerIsRecognisedForEvent } from '@/lib/pabuya-recognition';
import { readGuestWishList } from '@/lib/wish-list.server';
import { wishListShownToGuests } from '@/lib/wish-list-studio';
import { GIFT_GIVER_FIELDS } from '@/lib/wish-list';
import { wishListShape } from '@/lib/wish-list-guest';
import { fixedSceneStyleOf } from '@/lib/fixed-scene-style-of';
import { partLookAttr } from '@/lib/scene-styles-parts';
import { WishList, type GiftRecordReader } from './_components/wish-list';
import { GiftTell } from './_components/gift-tell';
import { readGuestSessionForEvent } from '@/lib/guest-one-path.server';
import { guestDisplayName } from '@/lib/guests';
import {
  PabuyaCardList,
  PabuyaTrustNote,
  type PabuyaMethodCard,
} from '@/app/_components/pabuya/pabuya-card-list';

/**
 * GET /[slug]/pabuya — the public "digital money dance" surface. Guests see the
 * couple's own e-gift handles + QR codes and send DIRECTLY to those accounts;
 * Setnayan never holds the money (the trust note is load-bearing).
 *
 * Reads via the SERVICE-ROLE admin client behind the published-visibility gate
 * (canViewSlugEvent), exactly like /[slug]/recap and the Live Wall — events has
 * no anon-read policy, so a public page reads service-role, not anon RLS. Only
 * ENABLED rows are fetched, so hidden destinations never leak.
 *
 * ROLLOUT: gated behind `PABUYA_PUBLIC_ROUTE_ENABLED` (isPabuyaPublicRouteEnabled)
 * — off by default → notFound(), so this net-new public surface ships dark and
 * the owner flips it on when ready. Handles are noindexed regardless.
 */

export const revalidate = 300;

// noindex — payment handles should not be search-indexed.
export const metadata = {
  title: 'E-Gifts',
  robots: { index: false, follow: false },
};

const fetchEvent = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from('events')
    .select(
      'event_id, slug, display_name, event_type, role_palette, invite_theme, std_background, monogram_text, monogram_color, site_button_color, landing_page_visibility, pabuya_message, gifts_on, gift_registry_url, style_preferences',
    )
    .ilike('slug', slug)
    .maybeSingle();
  return data as {
    event_id: string;
    slug: string | null;
    display_name: string | null;
    event_type: string | null;
    role_palette: unknown;
    landing_page_visibility: string | null;
    pabuya_message: string | null;
    gifts_on?: boolean | null;
    gift_registry_url?: string | null;
    style_preferences?: unknown;
  } | null;
});

export default async function PabuyaPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Rollout flag — off by default. The route exists but stays dark until the
  // owner sets PABUYA_PUBLIC_ROUTE_ENABLED.
  if (!isPabuyaPublicRouteEnabled()) notFound();

  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) notFound();
  // 🗂 The host answered "Accept gifts? — No" (Your info, owner 2026-10-02):
  // there is no gift page — not an apology for one.
  if (!giftsAreOn(event.gifts_on)) notFound();

  // Pabuya lives on the event website → the 'website' surface. Generic profiles
  // disable it, so non-website event types notFound (config-driven, like recap).
  if (!surfaceEnabled(await resolveProfile(event.event_type ?? 'wedding'), 'website')) {
    notFound();
  }

  // Visibility gate: strangers can't reach a private (pre-launch) page; invited
  // guests (guest-session cookie) + signed-in hosts pass. Mirrors /[slug]/recap.
  if (!(await canViewSlugEvent(event.event_id, event.landing_page_visibility))) {
    redirect(`/${slug}`);
  }

  const admin = createAdminClient();
  /* 🎁 The wish list is read beside the ways to give — same service-role client, same gate
     above (owner 2026-10-08). It reads ONE sum per wish and no giver's name, words or
     screenshot (`readGuestWishList`). */
  /*
    🎁 WHO IS READING, FOR "I SENT IT" (owner 2026-10-08). The RSVP's own identity read —
    this browser's invitation for THIS event, or the signed-in account's own seat at it —
    and then the guest row itself, which must be this event's and not removed. It decides
    two things only: whose name the record sheet shows ("from your invitation"), and whose
    own gifts are marked "You sent". The WRITE asks all of it again on the server
    (`lib/gift-record.server.ts`); nothing here is trusted by it.
  */
  const guestSession = await readGuestSessionForEvent(event.event_id);
  const readerRes = guestSession
    ? await admin
        .from('guests')
        .select(GIFT_GIVER_FIELDS)
        .eq('guest_id', guestSession.guest_id)
        .eq('event_id', event.event_id)
        .maybeSingle()
    : null;
  const readerRow =
    readerRes && !readerRes.error
      ? (readerRes.data as { guest_id: string; display_name: string | null; first_name: string | null; last_name: string | null; deleted_at: string | null } | null)
      : null;
  const reader = readerRow && readerRow.deleted_at == null ? readerRow : null;
  const giftReader: GiftRecordReader = {
    eventId: event.event_id,
    giverName: reader ? guestDisplayName({ display_name: reader.display_name, first_name: reader.first_name ?? '', last_name: reader.last_name ?? '' }) : '',
    recognised: reader != null,
  };

  const [methods, wishRead] = await Promise.all([
    fetchEgiftMethods(admin, event.event_id, {
      enabledOnly: true,
    }),
    readGuestWishList(admin, event.event_id, reader?.guest_id ?? null),
  ]);
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
     gift door) — no second picker. */
  const wishShape = wishListShape(partLookAttr('gifts', fixedSceneStyleOf(event.style_preferences, 'gifts', 'rsvp', event.event_type)));

  /*
    THE THEME REACHES HERE TOO (owner 2026-09-22: every guest page). A couple
    whose invitation is Capiz and whose money-gift page is Clean-Editorial reads
    that as a broken theme, not as a page nobody got round to.

    ⛔ AND IT IS NOT STAMPED HERE ANY MORE. The palette and `data-hub-theme` this
    page used to put on its own `<main>` are worn by `[slug]/layout.tsx` for
    every page of the guest tree (owner 2026-09-25: *"yes place it there"*).
    Re-stamping the attribute here would re-declare the theme BELOW the
    layout's inline palette and let it beat the couple's own colours.
  */

  /*
    ══ 🔒 AN ACCOUNT NUMBER IS NOT PUBLIC CONTENT ══════════════════════════════
    ⚖ Owner 2026-09-15, shown his own bank number readable at this URL with no
    session at all: **"gate the account number."**

    This page is reachable by anyone holding the link — that is deliberate and
    unchanged, because it is how a relative abroad sends a gift. What changed is
    WHO SEES THE PAYMENT IDENTIFIER. A stranger sees that the couple accept a
    bank transfer and the account's NAME; the number, and the QR that encodes
    it, are shown only to someone the event recognises.

    🔑 THE QR IS GATED WITH THE NUMBER, NOT LEFT BEHIND. A bank QR encodes the
    very account it stands for, so hiding the digits and printing the code beside
    them would be a gate with a window next to it.

    ⚖ EVERY METHOD, and it took two rulings to get here. The first — "gate the
    account number" — was about the bank, and this code gated only the bank,
    because widening a disclosure rule past what was asked is how the next person
    inherits a decision nobody made. The owner then ruled on the rest himself:
    *"gate the gcash number too."* So the shape is now one rule for every payment
    identifier, which is also one rule to reason about.
  */
  /*
    Does this event RECOGNISE the reader? A guest who opened their personal link
    or scanned their QR carries a session for this event; a host is signed in
    and holds an `event_members` row. Anybody else — including somebody the
    couple forwarded the link to — is a passer-by. The two arms, and the
    `isHostMemberType`-never-`Boolean(row)` warning that goes with them, live in
    the helper below.

    🔑 THE RULE MOVED OUT OF THIS FILE ON 2026-09-16 — it did not weaken.
     `viewerIsRecognisedForEvent` (lib/pabuya-recognition.ts) holds the same
     two arms this block held, verbatim: a guest session for THIS event, or a
     signed-in member whose type passes `isHostMemberType`.

     It had to move because the QR stopped being a presigned URL this page
     minted per-reader and became a permanent route
     (`/api/pabuya/qr/[publicId]`). That gave the identifiers a SECOND door,
     and a second door asking a weaker question would have re-opened the very
     thing the owner closed — while this page's own guard stayed green. Both
     doors import this one function now. */
  const viewerIsRecognised = await viewerIsRecognisedForEvent(event.event_id);

  const cards: PabuyaMethodCard[] = methods.map((m) => {
    /* ⚖ EVERY method, not only the bank — owner 2026-09-15, twice: "gate the
       account number", then "gate the gcash number too". A wallet handle is a
       mobile number; that it can be changed in an app makes it recoverable, not
       public. One rule for every payment identifier is also one rule to reason
       about, which is worth more than the distinction it replaces. */
    const withhold = !viewerIsRecognised;
    return {
      kind: m.method_kind,
      label: m.label,
      accountName: m.account_name,
      handle: withhold ? null : m.handle,
      note: m.note,
      qrUrl: withhold ? null : m.qrDisplayUrl,
    };
  });
  /*
    Did we withhold ANYTHING? This drives the sentence that stops a gate from
    reading as a bug.

    🔴 IT USED TO ASK ABOUT THE HANDLE ONLY. A method may legitimately be
    QR-ONLY — `saveEgiftMethod` refuses a row only when BOTH the handle and the
    QR are absent — and for such a row `handle` is null before and after
    withholding, so this returned false and the explaining sentence never
    rendered. The guest saw a card with a rail name, no number, no QR and NO
    REASON: byte-identical to a couple who filled the form in wrong. The gate
    was working and looked like a defect, which is the exact failure the
    sentence exists to prevent.

    Now: withheld if EITHER identifier was present on the row and is absent
    from the card.
  */
  /* 🎁 SAY ONLY WHAT IS THERE (guest text audit 2026-09-30). The line used to
     promise "Scan a QR or copy a handle" whatever the couple had set up — a
     bank-only page offered a QR that did not exist, and "handle" is nobody's
     word for an account number. It names the ways this couple actually has. */
  const howToSend = howToSendLine({
    qr: methods.some((m) => Boolean(m.qrDisplayUrl)),
    number: methods.some((m) => Boolean(m.handle)),
  });
  const identifiersWithheld = cards.some(
    (c, i) =>
      (c.handle === null && methods[i]?.handle != null) ||
      (c.qrUrl === null && methods[i]?.qrDisplayUrl != null),
  );

  // This event type's word for whoever is throwing it. Wedding → 'couple', so
  // both sentences below stay byte-identical for a wedding.
  const words = await eventWordsFor(event.event_type);

  // `pabuyaViewerAllowed: true` is EARNED — this IS the money-gift page, and it
  // ran `canViewSlugEvent` above and redirected away if it failed.
  const roomLinks = await loadRoomLinks({
    event,
    current: 'gifts',
    pabuyaViewerAllowed: true,
  });
  // The event's own name when it has one; otherwise that word.
  const hostName = event.display_name ?? words.theOrganizer;

  const registryHref = giftRegistryHref(event.gift_registry_url);
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          {/* min-h-[40px] (mobile audit item 3: this icon-only back link
              measured 26px). */}
          <Link href={`/${slug}`} className="flex min-h-[40px] items-center gap-2 text-ink">
            <Logo height={26} />
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink/50">
            Pabuya
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-terracotta-700">
            {/* Owner 2026-08-17: a wake MAY accept money — abuloy is normal at a
                Filipino wake — "with gentler wording than a wedding's digital
                money dance". Pinning cash is the dance's own gesture, so the
                solemn arm replaces the sentence, not a word in it. */}
            {/* 💃 The money dance is a WEDDING tradition (2026-09-30); every
                other celebratory type gets the plain eyebrow. */}
            {words.solemn
              ? 'A gift of sympathy'
              : giftIsMoneyDance(words)
                ? 'The pabuya · digital money dance'
                : 'The pabuya · E-Gifts'}
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium italic sm:text-4xl">
            E-Gifts for {hostName}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/65">
            {words.solemn ? (
              <>
                A quiet way to help {words.theOrganizer} — wherever you are in
                the world.{howToSend ? ` ${howToSend}` : ''}
              </>
            ) : giftIsMoneyDance(words) ? (
              <>
                Pin your cash on {words.theOrganizer} — wherever you are in the
                world.{howToSend ? ` ${howToSend}` : ''}
              </>
            ) : (
              <>
                Send E-Gifts to {words.theOrganizer} — wherever you are in the
                world.{howToSend ? ` ${howToSend}` : ''}
              </>
            )}
          </p>
        </div>

        {/*
          THE COUPLE'S OWN WORDS — owner 2026-09-15.

          🔑 ABOVE THE METHODS, because it is the part a guest weighs before
          deciding. The page could already say what to DO ("scan a QR"); it had
          nowhere to say WHY, and a money page without the reason reads as a
          request rather than a plan somebody is inviting you into.

          ⚠ NULL RENDERS NOTHING AT ALL — not an empty paragraph. Every event
          that has never touched this reads exactly as it did before the column
          existed, which is why there is no backfill and no default sentence.
        */}
        {event.pabuya_message ? (
          <p className="mx-auto mb-8 max-w-prose text-center text-[15px] leading-relaxed text-ink/75">
            {event.pabuya_message as string}
          </p>
        ) : null}

        {/* 🔗 THE REGISTRY (owner 2026-10-07, Studio › E-Gifts › "Paste a link to your
            registry"): one quiet link when the couple set one — http(s) only, read
            through the same rule its writer used (`giftRegistryHref`). */}
        {registryHref ? (
          <p data-gift-registry="" className="mx-auto mb-8 max-w-prose text-center text-[15px]">
            <a href={registryHref} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-ink underline underline-offset-4">
              Our gift registry ↗
            </a>
          </p>
        ) : null}

        {/* 🎁 THE WISH LIST — above the ways to give: a wish is what you give toward, the ways
            are how. Its send sheet is handed the page's OWN cards (`cards`, identifiers
            already withheld from a reader the event does not recognise), drawn a second
            time under their own element ids. */}
        {wishes.length > 0 ? (
          <WishList
            wishes={wishes}
            shape={wishShape}
            hostName={hostName}
            hostPossessive={event.display_name ? `${event.display_name}\u2019s` : words.theOrganizerPossessive}
            ways={
              <>
                <PabuyaCardList methods={cards} idScope="wish-send-handle" />
                {identifiersWithheld ? (
                  <p className="mt-3 text-center text-sm text-ink/65">
                    Payment details are shown to invited guests. Open your own invitation link, or scan your QR, and the account numbers appear here.
                  </p>
                ) : null}
              </>
            }
            record={giftReader}
          />
        ) : null}

        {cards.length > 0 ? (
          <>
            {/* With a wish list above them, the ways to give are named — without one the page is unchanged. */}
            {wishes.length > 0 ? (
              <p data-ways-to-give-eyebrow="" className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta-700">
                Ways to give
              </p>
            ) : null}
            <PabuyaCardList methods={cards} />
            {/* 🔑 SAY THAT SOMETHING IS WITHHELD, AND WHY. A card showing a bank
                with no number and no QR, and no sentence, reads as a couple who
                filled the form in wrong. This is the difference between a gate
                and a bug. */}
            {identifiersWithheld ? (
              <p className="mt-4 rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-6 text-center text-sm text-ink/65">
                Payment details are shown to invited guests. Open your own
                invitation link, or scan your QR, and the account numbers appear here.
              </p>
            ) : null}
            {/* 🎁 A gift toward NO wish: the same "show them" sheet, with no wish named. */}
            <GiftTell hostName={hostName} record={giftReader} />
          </>
        ) : registryHref ? null : (
          <p className="rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-10 text-center text-sm text-ink/60">
            {hostName} hasn&rsquo;t set up e-gifts yet. Check back soon — or
            visit their page in the meantime.
          </p>
        )}

        <div className="mt-6">
          <PabuyaTrustNote audience="guest" organizerPossessive={words.theOrganizerPossessive} />
        </div>

        <footer className="mt-12 border-t border-ink/10 pt-8 text-center">
          <p className="font-display text-xl italic text-mulberry">
            Ang laki ng pasasalamat namin.
          </p>
          <p className="mt-1 text-sm text-ink/60">— {hostName}</p>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-ink/45">
            Kept safe on Setnayan
          </p>
        </footer>
      </div>
      <RoomFooter links={roomLinks} />
    </main>
  );
}

/** The one sentence on how to send — only the ways this couple set up. */
function howToSendLine(has: { qr: boolean; number: boolean }): string | null {
  if (has.qr && has.number) return 'Scan a QR code or copy an account number, and send it straight to their own account.';
  if (has.qr) return 'Scan a QR code and send it straight to their own account.';
  if (has.number) return 'Copy an account number and send it straight to their own account.';
  return null;
}
