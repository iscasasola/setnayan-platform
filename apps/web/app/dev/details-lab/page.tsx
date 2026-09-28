/**
 * /dev/details-lab — the Maker's Details page (three columns, the theme gallery,
 * the folded-in prints) on fixture data, with no sign-in and no database
 * (Details part 1, 2026-09-28). DEV-ONLY: production builds 404 this route, the
 * same kill-switch as `/dev/hero-lab`. NODE_ENV is inlined at build time, so
 * the guard is free and the lab never ships.
 *
 * Why it exists: the page is LAYOUT — a navigator that is a strip on a 375 px
 * phone and a column on a desk, an editor that opens under it, a gallery that
 * must not load ten pages at once — and no unit test lays out. It draws the
 * REAL `MakerDetails`. What needs the database says so honestly here: the
 * couple's print pictures answer "could not draw" (the print route asks who is
 * signed in), and the sample's pictures need the sample row.
 *
 *   ?item=invitation      open on one item (default: Theme, as a cold open)
 *   ?pro=1                a couple with Event Hub Pro
 *   ?type=birthday|wake   another celebration (default: wedding)
 */
import { notFound } from 'next/navigation';
import { MakerDetails } from '@/app/dashboard/[eventId]/launch/_components/maker-details';
import { INVITE_THEMES, pickableInviteThemes } from '@/lib/invite-themes';
import { formatFor, parsePrintDetails } from '@/lib/print-pieces';
import { detailsItemFor } from '@/lib/maker-details-items';
import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE } from '@/lib/event-type-profile';
import { updateEventSlug } from '@/app/dashboard/[eventId]/invitation/actions';
import { updateQrStyle } from '@/app/dashboard/[eventId]/launch/qr-look-actions';
import { updateSpecialMessage } from '@/app/dashboard/[eventId]/website/special-message/actions';

const EVENT = '00000000-0000-4000-8000-000000000000';

export default async function DetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const pro = one('pro') === '1';
  const profile = one('type') === 'wake' ? WAKE_PROFILE : one('type') === 'birthday' ? { ...GENERIC_PROFILE, eventType: 'birthday' } : WEDDING_PROFILE;
  const themes = pickableInviteThemes({ mayShowStdFilm: true });
  const stored = parsePrintDetails({ opening_line: 'Together with their families', include: undefined });
  return (
    <div className="h-dvh bg-cream text-ink">
      <MakerDetails
        eventId={EVENT}
        slug="indalecio-and-claire"
        slugAction={updateEventSlug.bind(null, EVENT, 'launch')}
        qr={{ ownsPro: pro, style: {}, inks: ['#1A1A1A'], storeShell: false }}
        qrStyleAction={updateQrStyle.bind(null, EVENT)}
        theme={{
          themes: themes.map((t) => ({ id: t.id, name: t.name, tier: t.tier })),
          current: 'house',
          ownsPro: pro,
          storeShell: false,
          suggested: 'vintage',
          sampleVersion: null,
          blurbs: Object.fromEntries(themes.map((t) => [t.id, INVITE_THEMES[t.id].blurb])),
          posters: {},
          tour: false,
          chosen: true,
        }}
        prints={{
          eventId: EVENT,
          slug: 'indalecio-and-claire',
          theme: 'house',
          ownsPro: pro,
          storeShell: false,
          previewVersion: null,
          formats: { pass: formatFor('pass', null)!, invitation: formatFor('invitation', null)!, card: formatFor('card', null)! },
        }}
        menu={{ saved: [], caterer: [], suggestions: [], flash: null }}
        stored={stored}
        hosts={[{ moderatorId: 'm1', label: 'Claire', contact: '0917 555 0101' }]}
        parents={[
          { guestId: null, name: 'Atty. Eufrocina M. Sacdalan-Casasola', card: null },
          { guestId: null, name: 'Mrs. Milagros Buanhog', card: null },
        ]}
        pabuyaMessage="Thank you for celebrating with us — every gift helps our new home begin."
        specialMessage="We can’t wait to celebrate with you on December 18."
        specialMessageAction={updateSpecialMessage.bind(null, EVENT)}
        hasPalette
        hasGifts={false}
        flash={null}
        stamp="lab"
        initialItem={detailsItemFor({ tool: 'details', item: one('item') })}
        eventContext={{ profile, solemn: profile === WAKE_PROFILE }}
      />
    </div>
  );
}
