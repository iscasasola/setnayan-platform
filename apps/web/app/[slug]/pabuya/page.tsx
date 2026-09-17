import { RoomFooter } from '../_components/room-footer';
import { loadRoomLinks } from '../_lib/room-links.server';
import { cache } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Logo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventWordsFor } from '../_lib/event-words';
import { canViewSlugEvent } from '@/lib/slug-access';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { buildSitePaletteVars } from '@/lib/site-palette';
import { fetchEgiftMethods, isPabuyaPublicRouteEnabled } from '@/lib/egift';
import { viewerIsRecognisedForEvent } from '@/lib/pabuya-recognition';
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
  title: 'A blessing',
  robots: { index: false, follow: false },
};

const fetchEvent = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from('events')
    .select(
      'event_id, slug, display_name, event_type, role_palette, landing_page_visibility, pabuya_message',
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
  const methods = await fetchEgiftMethods(admin, event.event_id, {
    enabledOnly: true,
  });

  const themeVars = buildSitePaletteVars(sanitizeRolePalette(event.role_palette));
  const wrapStyle = themeVars ? (themeVars as React.CSSProperties) : undefined;

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

  return (
    <main className="min-h-dvh bg-cream text-ink" style={wrapStyle}>
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/${slug}`} className="flex items-center gap-2 text-ink">
            <Logo height={26} />
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink/50">
            Pabuya
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-gold-deep">
            {/* Owner 2026-08-17: a wake MAY accept money — abuloy is normal at a
                Filipino wake — "with gentler wording than a wedding's digital
                money dance". Pinning cash is the dance's own gesture, so the
                solemn arm replaces the sentence, not a word in it. */}
            {words.solemn ? 'A gift of sympathy' : 'The pabuya · digital money dance'}
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium italic sm:text-4xl">
            A blessing for {hostName}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/65">
            {words.solemn ? (
              <>
                A quiet way to help {words.theOrganizer} — wherever you are in
                the world. Scan a QR or copy a handle and send it straight to
                their own account.
              </>
            ) : (
              <>
                Pin your cash on {words.theOrganizer} — wherever you are in the
                world. Scan a QR or copy a handle and send it straight to their
                own account.
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

        {cards.length > 0 ? (
          <>
            <PabuyaCardList methods={cards} />
            {/* 🔑 SAY THAT SOMETHING IS WITHHELD, AND WHY. A card showing a bank
                with no number and no QR, and no sentence, reads as a couple who
                filled the form in wrong. This is the difference between a gate
                and a bug. */}
            {identifiersWithheld ? (
              <p className="mt-4 rounded-2xl border border-dashed border-ink/20 bg-white/60 px-4 py-6 text-center text-sm text-ink/65">
                Payment details are shown to invited guests. Open your own
                invitation link, or scan your QR, and the account numbers appear here.
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-ink/20 bg-white/60 px-4 py-10 text-center text-sm text-ink/60">
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
