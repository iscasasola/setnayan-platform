import { PabuyaCardList, PabuyaTrustNote, type PabuyaMethodCard } from '@/app/_components/pabuya/pabuya-card-list';
import { WelcomeGifts } from '@/app/[slug]/_components/guest-doorway-strip';
import { GiftTell } from '@/app/[slug]/pabuya/_components/gift-tell';
import { WishList, type GiftRecordReader } from '@/app/[slug]/pabuya/_components/wish-list';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { openWishCount, type WishListShape } from '@/lib/wish-list-guest';
import { labGuestWishList, labGuestWishState } from '../../details-lab/wish-list-fixture';

/**
 * 🧪 THE GUEST'S WISH LIST ON FIXTURES (DEV-ONLY — `/dev/maker-lab/guest?wish=…`; not a route of
 * its own). The REAL `WishList` and the REAL gift door, on the prototype's seed, laid out as
 * `/[slug]/pabuya` lays them out — so the four looks and the list's states can be put beside the
 * drawing with no database.
 *
 *   ?wish=five (default) · got · long · noprice · fail · door   &look=rows · side · tiles · ruled
 *   &known=0 — a reader the event does not recognise (numbers and QR withheld, and said so)
 *   &name=0  — a recognised guest whose invitation carries no name ("I sent it" asks for one)
 *   &mine=1  — the reader has already sent toward the luggage set ("You sent ₱1,000 ✓")
 *
 * "I sent it" opens the REAL record sheet. The lab has no guest session and no database, so a
 * press on Send is answered by the real route's own refusal — said in the sheet, in place.
 */
const SHAPES: readonly WishListShape[] = ['rows', 'side', 'tiles', 'ruled'];

const CARDS: PabuyaMethodCard[] = [
  { kind: 'gcash', label: 'GCash', accountName: 'Maria S.', handle: '0917 123 4567', note: null, qrUrl: null },
  { kind: 'bank', label: 'Bank transfer', accountName: 'BPI · Maria Santos', handle: '1234 5678 90', note: null, qrUrl: null },
];

export async function WishLab({
  state,
  look,
  known,
  named = true,
  mine = false,
}: {
  state: string;
  look?: string;
  known: boolean;
  named?: boolean;
  mine?: boolean;
}) {
  const words = await eventWordsFor('wedding');
  const shape = SHAPES.find((s) => s === look) ?? 'rows';
  const list = labGuestWishList(labGuestWishState(state), mine);
  const reader: GiftRecordReader = { eventId: '00000000-0000-4000-8000-000000000000', giverName: known && named ? 'Tita Nene' : '', recognised: known };
  const wishes = list.read ? list.wishes : [];
  const cards = known ? CARDS : CARDS.map((c) => ({ ...c, handle: null, qrUrl: null }));
  const withheld = !known ? (
    <p className="mt-3 text-center text-sm text-ink/65">
      Payment details are shown to invited guests. Open your own invitation link, or scan your QR, and the account numbers appear here.
    </p>
  ) : null;

  if (state === 'door') {
    return (
      <main className="min-h-dvh bg-cream text-ink">
        <div className="sn-editorial mx-auto w-full max-w-3xl px-4 py-10">
          <WelcomeGifts href="#gifts" words={words} look={look ? `gifts.${look}` : null} wishes={openWishCount(wishes)} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-cream text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        {wishes.length > 0 ? (
          <WishList
            wishes={wishes}
            shape={shape}
            hostName="Maria & Jose"
            hostPossessive="Maria & Jose’s"
            record={reader}
            ways={
              <>
                <PabuyaCardList methods={cards} idScope="wish-send-handle" />
                {withheld}
              </>
            }
          />
        ) : null}
        {wishes.length > 0 ? (
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta-700">Ways to give</p>
        ) : null}
        <PabuyaCardList methods={cards} />
        {withheld}
        <GiftTell hostName="Maria & Jose" record={reader} />
        <div className="mt-6">
          <PabuyaTrustNote audience="guest" organizerPossessive={words.theOrganizerPossessive} />
        </div>
      </div>
    </main>
  );
}
