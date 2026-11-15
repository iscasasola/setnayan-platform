import { notFound } from 'next/navigation';
import { IapUnlockSheet } from '@/app/_components/iap/iap-unlock-sheet';
import { StudioBuyHero } from '@/app/dashboard/[eventId]/studio/_components/studio-buy-hero';
import { PapicAddedPreview } from './papic-added-preview';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

/**
 * 🧪 /dev/iap-doors-lab — the Apple doors of 23 Oct (Setnayan AI · Music Maker · Patiktok · Thank You; the Mood Board
 * pack was retired with the renders, 2026-10-26), drawn by the SHIPPED `IapUnlockSheet` with each page's own props, NO database:
 *
 *   ?door=setnayan-ai · music-maker · patiktok · thank-you · papic-added
 *   ?door=web-checkout — the WEBSITE's checkout drawer (the shipped `InlineCheckoutDrawer`), the other side of the
 *     same purchase: on the web it can carry the welcome price (owner 2026-10-28, "ONE PRICE EVERYWHERE"); in the
 *     app it must be the inert chip with no price. The welcome figure comes from the server; with no database here
 *     the walker stands in for that answer. SAMPLE accounts and amounts only.
 *
 * Apple's prices come from whatever `window.Capacitor` the walker hands it (a stand-in store with SAMPLE prices) —
 * the page types none. A dev page: 404 in production.
 */
const E = '00000000-0000-4000-8000-000000000000';
/** SAMPLE receiving account — not a real number. */
const LAB_RAILS = {
  bdo_account_name: null,
  bdo_account_number: null,
  bdo_qr_url: null,
  gcash_account_name: 'Sample Account',
  gcash_number: '0900 000 0000',
  gcash_qr_url: null,
  gcash_enabled: true,
  bdo_enabled: false,
};
const BTN = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream';

export default async function IapDoorsLab({ searchParams }: { searchParams: Promise<{ door?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const door = (await searchParams).door ?? 'setnayan-ai';
  return (
    <div className="min-h-dvh bg-cream px-4 py-6" data-iap-doors-lab={door}>
      {door === 'setnayan-ai' ? (
        <StudioBuyHero
          productName="Setnayan AI"
          promise="Stop guessing who to hire"
          action={
            <IapUnlockSheet
              eventId={E}
              serviceKey="SETNAYAN_AI"
              name="Setnayan AI"
              productId="com.setnayan.app.setnayan_ai_tier_c"
              line="One purchase · yours for this event."
              info="Setnayan AI ranks every supplier by how well they fit your date, budget and guest count, and keeps your deadlines and payments in view. It stays on for this event and everyone on it."
              triggerLabel="Unlock Setnayan AI"
              buyVerb="Unlock"
              triggerTestId="iap-setnayan-ai-unlock"
              triggerClassName="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--m-mulberry)] px-7 py-3 text-sm font-semibold text-[var(--m-paper)]"
            />
          }
        />
      ) : door === 'music-maker' ? (
        <div className="sn-tile space-y-3 p-5">
          <h2 className="text-lg font-semibold">Music Maker</h2>
          <p className="text-sm text-ink/70">Your music notes are saved.</p>
          <IapUnlockSheet
            eventId={E}
            serviceKey="PAKANTA"
            name="Music Maker"
            line="Your own song, written from your story."
            info="We compose it with Setnayan AI from your love story and the music notes above. When it’s ready it appears on this page and can play on your event page."
            triggerLabel="Pay"
            triggerTestId="iap-music-maker-pay"
            triggerClassName="inline-flex items-center justify-center gap-2 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-white"
          />
        </div>
      ) : door === 'patiktok' ? (
        <section className="sn-tile space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Keep your reels</h2>
          <IapUnlockSheet
            eventId={E}
            serviceKey="PATIKTOK_COMPILER"
            name="Patiktok"
            line="Save and share every reel your booth makes."
            info="No preview mark, download every reel, share them anywhere — all event day."
            triggerLabel="Save & share"
            triggerTestId="iap-patiktok-save"
            triggerClassName={BTN}
          />
        </section>
      ) : door === 'thank-you' ? (
        <div className="space-y-2">
          <IapUnlockSheet
            eventId={E}
            serviceKey="PAPIC_ADDON_THANK_YOU"
            name="Thank You"
            line="Save your Thank-You Video to your phone."
            info="Make the film here as often as you like. Once it’s on, make it again and it saves straight to your phone."
            triggerLabel="Save to my phone"
            triggerTestId="iap-thank-you-save"
            triggerClassName={BTN}
          />
        </div>
      ) : door === 'papic-added' ? (
        <PapicAddedPreview />
      ) : door === 'web-checkout' ? (
        <section className="sn-tile space-y-3 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Papic · 100 credits</h2>
          <InlineCheckoutDrawer
            serviceKey="PAPIC_POOL_100"
            displayName="Papic · 100 credits"
            originalPriceCentavos="9500"
            eventId={E}
            settings={LAB_RAILS}
            triggerLabel="Buy credits"
          />
        </section>
      ) : null}
    </div>
  );
}
