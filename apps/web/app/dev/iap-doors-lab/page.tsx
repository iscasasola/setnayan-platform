import { notFound } from 'next/navigation';
import { IapUnlockSheet } from '@/app/_components/iap/iap-unlock-sheet';
import { StudioBuyHero } from '@/app/dashboard/[eventId]/studio/_components/studio-buy-hero';

/**
 * 🧪 /dev/iap-doors-lab — the five Apple doors of 23 Oct (Setnayan AI · Music Maker · Patiktok · Thank You · Mood Board
 * pack), drawn by the SHIPPED `IapUnlockSheet` with each page's own props, NO database:
 *
 *   ?door=setnayan-ai · music-maker · patiktok · thank-you · mood-board
 *
 * Apple's prices come from whatever `window.Capacitor` the walker hands it (a stand-in store with SAMPLE prices) —
 * the page types none. A dev page: 404 in production.
 */
const E = '00000000-0000-4000-8000-000000000000';
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
      ) : (
        <div className="flex flex-col items-end gap-1.5 text-right">
          <p className="text-sm font-semibold text-ink/75">Credits · none yet</p>
          <IapUnlockSheet
            eventId={E}
            serviceKey="MOODBOARD_RENDER_PACK"
            name="Mood Board · 50 renders"
            line="Use them on any part, or the whole look."
            info="Every box keeps its free colour preview. A photoreal render spends credits; buy another pack whenever you run low."
            triggerLabel="Buy renders"
            buyVerb="Buy"
            onLine="Your renders are on this event."
            plural
            triggerTestId="iap-mood-board-pack"
          />
        </div>
      )}
    </div>
  );
}
