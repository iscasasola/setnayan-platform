import { GuestWelcome } from '@/app/[slug]/_components/guest-welcome';
import { WelcomeGifts } from '@/app/[slug]/_components/guest-doorway-strip';
import { GiftPageBody } from '@/app/[slug]/pabuya/_components/gift-page-body';
import { giftCardsFor, type GiftMethodForCard, type GiftPageContent } from '@/app/[slug]/pabuya/_lib/gift-cards';
import type { GiftRecordReader } from '@/app/[slug]/pabuya/_components/wish-list';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { openWishCount, type WishListShape } from '@/lib/wish-list-guest';
import { labGuestWishList, labGuestWishState } from '../../details-lab/wish-list-fixture';

/**
 * 🧪 THE GUEST'S E-GIFTS ON FIXTURES (DEV-ONLY — `/dev/maker-lab/guest?wish=…`; not a route of
 * its own). The REAL `GiftPageBody` (what `/[slug]/pabuya` draws below its title), the REAL
 * withholding rule (`giftCardsFor`) and the REAL Welcome block, on the prototype's seed — so the
 * four looks and the list's states can be put beside the drawing with no database.
 *
 *   ?wish=five (default) · four · got · long · noprice · fail · door · welcome   &look=rows · side · tiles · ruled
 *   ?wish=welcome — the Welcome page's E-Gifts, drawn in place (2026-10-14): `GuestWelcome` itself
 *   &blocked=1 — (with welcome) a viewer the gift page would turn away: no door, so nothing is drawn
 *   &known=0 — a reader the event does not recognise (numbers and QR withheld, and said so)
 *   &name=0  — a recognised guest whose invitation carries no name ("I sent it" asks for one)
 *   &mine=1  — the reader has already sent toward the luggage set ("You sent ₱1,000 ✓")
 *
 * "I sent it" opens the REAL record sheet. The lab has no guest session and no database, so a
 * press on Send is answered by the real route's own refusal — said in the sheet, in place.
 */
const SHAPES: readonly WishListShape[] = ['rows', 'side', 'tiles', 'ruled'];
/** The look a shape is drawn by on Welcome (`wishListShape`, read backwards). */
const LOOK_OF: Readonly<Record<WishListShape, string | null>> = { rows: null, side: 'gifts.side-rule', tiles: 'gifts.centred', ruled: 'gifts.ruled' };

/** The couple's two ways to give, as `fetchEgiftMethods` hands them over — the rule below decides what a reader sees. */
const METHODS: GiftMethodForCard[] = [
  { method_kind: 'gcash', label: 'GCash', account_name: 'Maria S.', handle: '0917 123 4567', note: null, qrDisplayUrl: null },
  { method_kind: 'bank', label: 'Bank transfer', account_name: 'BPI · Maria Santos', handle: '1234 5678 90', note: null, qrDisplayUrl: null },
];

/** The lab canvas's E-Gifts (`page.tsx`): two ways to give and four wishes, for a host the event recognises. */
export function labGiftContent(words: GiftPageContent['words']): GiftPageContent {
  const list = labGuestWishList('four');
  return {
    eventId: '00000000-0000-4000-8000-000000000000',
    words,
    hostName: 'Maria & Jose',
    displayName: 'Maria & Jose',
    hostPossessive: 'Maria & Jose’s',
    message: null,
    registryHref: null,
    wishes: list.read ? list.wishes : [],
    wishShape: 'rows',
    ...giftCardsFor(METHODS, true),
    reader: { eventId: '00000000-0000-4000-8000-000000000000', giverName: '', recognised: true },
  };
}

export async function WishLab({
  state,
  look,
  known,
  named = true,
  mine = false,
  blocked = false,
}: {
  state: string;
  look?: string;
  known: boolean;
  named?: boolean;
  mine?: boolean;
  blocked?: boolean;
}) {
  const words = await eventWordsFor('wedding');
  const shape = SHAPES.find((s) => s === look) ?? 'rows';
  const list = labGuestWishList(labGuestWishState(state === 'welcome' ? 'four' : state), mine);
  const reader: GiftRecordReader = { eventId: '00000000-0000-4000-8000-000000000000', giverName: known && named ? 'Tita Nene' : '', recognised: known };
  const wishes = list.read ? list.wishes : [];
  const content: GiftPageContent = {
    eventId: reader.eventId,
    words,
    hostName: 'Maria & Jose',
    displayName: 'Maria & Jose',
    hostPossessive: 'Maria & Jose’s',
    message: null,
    registryHref: null,
    wishes,
    wishShape: shape,
    ...giftCardsFor(METHODS, known),
    reader,
  };

  if (state === 'door') {
    return (
      <main className="min-h-dvh bg-cream text-ink">
        <div className="sn-editorial mx-auto w-full max-w-3xl px-4 py-10">
          <WelcomeGifts href="#gifts" words={words} look={look ? `gifts.${look}` : null} wishes={openWishCount(wishes)} />
        </div>
      </main>
    );
  }

  if (state === 'welcome') {
    /* The Welcome page's own component, as `site-body.tsx` mounts it: the door's gate (`giftHref`) and the gift
       page's read (`giftContent`). A blocked viewer has no `giftHref` — the page would have drawn no door. */
    return (
      <main className="min-h-dvh bg-cream text-ink" data-lab-welcome-gifts={blocked ? 'blocked' : known ? 'known' : 'unknown'}>
        <div className="sn-editorial mx-auto w-full max-w-3xl px-4 py-10">
          <GuestWelcome
            parts={['gifts']}
            words={words}
            look={null}
            reminders={null}
            giftHref={blocked ? null : '/maria-and-jose/pabuya'}
            giftWishes={openWishCount(wishes)}
            giftContent={blocked ? null : Promise.resolve(content)}
            partLooks={{ gifts: LOOK_OF[shape] }}
          />
          {blocked ? <p className="text-center text-xs uppercase tracking-[0.2em] text-ink/50">(lab) nothing above: no gift door, so no E-Gifts</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-cream text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <GiftPageBody content={content} />
      </div>
    </main>
  );
}
