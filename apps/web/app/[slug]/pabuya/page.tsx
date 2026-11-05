import { RoomFooter } from '../_components/room-footer';
import { loadRoomLinks } from '../_lib/room-links.server';
import { partDoorHidden } from '../_lib/part-door.server';
import { cache } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Logo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { guestRead } from '@/lib/guest-read';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { giftIsMoneyDance } from '../_lib/event-words';
import { canViewSlugEvent } from '@/lib/slug-access';
import { isPabuyaPublicRouteEnabled } from '@/lib/egift';
import { giftsAreOn } from '@/lib/event-answers';
import { loadGiftPage } from './_lib/gift-page.server';
import { GiftPageBody } from './_components/gift-page-body';

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
  // 🔌 A failed read throws (the guest boundary) — never "This link can't be
  // found." for an event that is there (lib/guest-read.ts).
  const data = await guestRead('pabuya (event)', () =>
    admin
      .from('events')
      .select(
        'event_id, slug, display_name, event_type, role_palette, invite_theme, std_background, monogram_text, monogram_color, site_button_color, landing_page_visibility, pabuya_message, gifts_on, gift_registry_url, style_preferences',
      )
      .ilike('slug', slug)
      .maybeSingle(),
  );
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
  // 👁 The couple hid E-Gifts on the stage the event is at ("What guests see"): the same exit as "Accept gifts? — No"
  // above — there is no gift page — for a guest who kept the address. One reading: `_lib/part-door.server.ts`.
  if (await partDoorHidden(createAdminClient(), event.event_id, 'gifts')) notFound();

  const admin = createAdminClient();
  /* 🎁 EVERYTHING ON THIS PAGE BELOW ITS TITLE — the couple's words, the registry, the wish list, the ways to give
     (identifiers withheld from a reader the event does not recognise) — is read by ONE reader and drawn by ONE
     component, the same two the Welcome page's E-Gifts uses (owner 2026-10-14). Asked only AFTER every gate above. */
  const content = await loadGiftPage(admin, event);
  const { words, hostName, howToSend } = content;

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

  // `pabuyaViewerAllowed: true` is EARNED — this IS the money-gift page, and it
  // ran `canViewSlugEvent` above and redirected away if it failed.
  const roomLinks = await loadRoomLinks({
    event,
    current: 'gifts',
    pabuyaViewerAllowed: true,
  });
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          {/* min-h-[40px] (mobile audit item 3: this icon-only back link
              measured 26px). */}
          <Link href={`/${slug}`} className="flex min-h-[44px] min-w-[44px] items-center gap-2 text-ink">
            <Logo height={26} />
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink/70">
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

        <GiftPageBody content={content} />

        <footer className="mt-12 border-t border-ink/10 pt-8 text-center">
          <p className="font-display text-xl italic text-mulberry">
            Ang laki ng pasasalamat namin.
          </p>
          <p className="mt-1 text-sm text-ink/70">— {hostName}</p>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-ink/70">
            Kept safe on Setnayan
          </p>
        </footer>
      </div>
      <RoomFooter links={roomLinks} />
    </main>
  );
}
