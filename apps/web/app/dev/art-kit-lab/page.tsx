import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { artKitShows } from '@/lib/art-kits';
import { DEFAULT_REVEAL_CONFIG } from '@/lib/reveal-config-pure';
import { replyCardOf } from '@/lib/guest-me-parts';
import { resolveArrivalAction } from '@/lib/arrival-action';
import { formatEventDate } from '@/lib/events';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import type { GuestLook } from '@/app/[slug]/_lib/loaders';
import { HostDraftLook } from '@/app/[slug]/_components/host-draft-look';
import { InvitationShell } from '@/app/[slug]/_components/invitation-shell';
import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { ReplyCardRow } from '@/app/[slug]/_components/guest-me-parts';
import { SpecialMessageWidget } from '@/app/[slug]/_components/special-message-widget';
import { CountdownWidget } from '@/app/[slug]/_components/countdown';
import { GuestWelcome } from '@/app/[slug]/_components/guest-welcome';
import { RevealMount } from '@/app/[slug]/_components/reveal/reveal-mount';
import { KitSeal, KitSlot, KitStyle } from '@/app/[slug]/_components/kit-piece';
import { ArtKitMotion } from '@/app/[slug]/_components/art-kit-motion';
import { EDITOR_CANVAS_HIDES_APP_CHROME } from '@/app/[slug]/_lib/editor-canvas';
import { giftCardsFor, type GiftMethodForCard, type GiftPageContent } from '@/app/[slug]/pabuya/_lib/gift-cards';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * /dev/art-kit-lab — THE VINTAGE ART KIT ON A GUEST PAGE, WITH NO DATABASE (owner 2026-10-16, DECISION_LOG
 * "APPROVED — THE VINTAGE ART KIT, AS THE PROOF SHOWS"). DEV-ONLY: production builds 404 it, the same kill-switch as
 * `/dev/maker-lab`.
 *
 * The proof's page, cale-ice's SHAPE on the lab's sample words (Maria & Jose — nobody's real event): the veil, the
 * cover, the reply card, a note, the countdown, E-Gifts with one bank card, and the sign-off — each drawn by the
 * guest page's REAL component, wearing the REAL Vintage look (`HostDraftLook`), and the kit decided by the page's own
 * rule (`artKitShows`):
 *
 *   ?decor=0   Decorations off (the couple's switch)            ?free=1   an event without Event Hub Pro
 *   ?veil=1    the Sheer veil over the cover, with its seal     ?photo=0  no cover photo (the oval holds the mark)
 *
 * Every picture here is Setnayan's own (`public/std/backgrounds`) or drawn on the page — never anybody's photo.
 */
const LAB_QR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" shape-rendering="crispEdges"><rect width="21" height="21" fill="#fff"/>' +
      [
        [0, 0], [14, 0], [0, 14],
      ]
        .map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#000"/>`)
        .join('') +
      Array.from({ length: 60 }, (_, i) => `<rect x="${8 + ((i * 7) % 13)}" y="${(i * 5) % 21}" width="1" height="1" fill="#000"/>`).join('') +
      '</svg>',
  );

const METHODS: GiftMethodForCard[] = [
  { method_kind: 'bank', label: 'Bank transfer', account_name: 'Maria Santos / Jose Reyes', handle: '0065 4028 3953', note: null, qrDisplayUrl: LAB_QR },
];

export default async function ArtKitLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const words = await eventWordsFor('wedding');
  const names = 'Maria & Jose';
  const date = '2026-12-18';
  const photo = sp.photo === '0' ? null : '/std/backgrounds/ballroom.webp';

  /* 🎚 THE PAGE'S OWN RULE — the theme is Vintage (worn, as on a Pro event), the switch and the Pro answer from the query. */
  const kit = artKitShows({ theme: 'vintage', decorations: sp.decor === '0' ? false : null, ownsPro: sp.free !== '1', tryOn: false });

  const look: GuestLook = {
    theme: 'vintage',
    art: null,
    accent: '#5C0700',
    vars: null,
    colours: INVITE_THEMES.vintage.palette,
    ombre: null,
    buttons: null,
    roles: null,
  };
  const card = replyCardOf({
    action: resolveArrivalAction({ slug: 'maria-and-jose', rsvpStatus: 'pending', eventDate: date, today: '2026-10-16', hasPass: true }),
    replyBy: 'Friday, December 4, 2026',
    seats: 1,
    organizer: 'the couple',
  });
  const gifts: GiftPageContent = {
    eventId: '00000000-0000-4000-8000-000000000000',
    words,
    hostName: names,
    displayName: names,
    hostPossessive: 'Maria & Jose’s',
    message: null,
    registryHref: null,
    wishes: [],
    wishShape: 'rows',
    ...giftCardsFor(METHODS, true),
    reader: { eventId: '00000000-0000-4000-8000-000000000000', giverName: '', recognised: true },
  };

  return (
    <HostDraftLook look={look}>
      <InvitationShell
        hubTheme="vintage"
        monogramText="M & J"
        stageLabel="Invitation"
        hideWatermark={false}
        kitClosing={kit ? { kit, names, date: formatEventDate(date), photoUrl: photo, mark: 'M & J', twoPeople: true } : null}
      >
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        {kit ? <KitStyle kit={kit} /> : null}
        {kit ? <ArtKitMotion /> : null}
        {sp.veil === '1' ? (
          <RevealMount
            enabled
            monogram="M&J"
            config={DEFAULT_REVEAL_CONFIG}
            ownsPro
            isStaffPreview={false}
            eventTemplate="veil-sheer"
            eventId="lab-art-kit-veil"
            kitSeal={kit ? <KitSeal kit={kit} mark="M & J" /> : null}
          />
        ) : null}
        <div data-lab-art-kit={kit ? 'on' : 'off'} className="sn-editorial">
          <PahinaMasthead
            displayName={names}
            eventDate={date}
            venueName="Santuario de San Antonio · Seda Vertis North"
            eyebrow="With thanksgiving to God and the blessing of our parents,"
            ground={
              photo
                ? { shape: 'full', css: null, still: photo, clip: null, parallax: false, veil: null, scrim: { color: '#eadbc6', opacity: 0.55 }, tone: 'ink' }
                : null
            }
            kitSlot={kit ? <KitSlot kit={kit} slot="cover" eager /> : null}
            monogramSlot={
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-gild font-serif text-2xl italic text-terracotta-700">
                M &amp; J
              </span>
            }
          />
          {card ? <ReplyCardRow card={card} kit={kit ? <KitSlot kit={kit} slot="reply" /> : null} /> : null}
          <div className="mt-12 space-y-10">
            <SpecialMessageWidget text="We can’t wait to celebrate with you." />
            <CountdownWidget targetIso={date} timeZone="Asia/Manila" kit={kit ? <KitSlot kit={kit} slot="countdown" /> : null} />
            <GuestWelcome
              parts={['gifts']}
              words={words}
              look={null}
              reminders={null}
              giftHref="#gifts"
              giftContent={Promise.resolve(gifts)}
              artKit={kit}
            />
          </div>
        </div>
      </InvitationShell>
    </HostDraftLook>
  );
}
