import { Ghost, Screen, Sk, SkCircle } from '@/components/skeletons';

/**
 * 👻 THE SHOP GHOST — Shop's own loader, in Shop's own shape (21 Nov 2026).
 *
 * Owner, on the supplier Shop page: *"loading feels long. and loading feels scattered and ungoranized. like there are
 * layers that are above each other that shouldn't be"*. Measured that day at 375 px: Shop had no `loading.tsx`, so it
 * showed the supplier HOME's loader (a completion strip and six stat tiles — a page Shop is not), and then the real page
 * arrived in pieces, one notice landing late and pushing everything down. Now this Ghost holds until the WHOLE page is
 * ready (page.tsx starts every part at once and draws none of them in a <Suspense> of its own), and then the page
 * replaces it in one go, in the same places.
 *
 * "D · Ghost" (HOUSE_DESIGN_STANDARD Part F1, `components/skeletons`): what is KNOWN shows as itself at once — the five
 * quick doors, the section names and their lines, the two Template names, Share. Only what is not known yet is a grey
 * block under the Sheen: the cover photo and name, the logo, the tools, the graphs, the badges, the cards. Nothing here
 * is a number, so no wrong number can show as real.
 *
 * The sizes are the page's own, measured live at 375 px (cover 208 · doors 55 + 72 · Template tiles 104 · tools
 * 150×178 · analytics card 255 · badge 84 + two lines). From 1280 it takes layout A like the page
 * (`supplier-frame.css`, `[data-shop-ghost-desk]`). 🔒 the-shop-arrives-in-one-go.test.ts
 */

/** A section's head exactly as the page draws it — the name and its line are known, so they show as themselves. */
function Head({ name, line }: { name: string; line: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-5">
      <Ghost known={name} textClassName="home-k2 !my-0" />
      <Ghost known={line} textClassName="text-xs text-ink/70" />
    </div>
  );
}

const QUICK = ['Promote', 'QR', 'Prints', 'Gifts', 'Plan'] as const;
const TEMPLATES = ['Forms Maker', 'Offer Maker'] as const;
/** The page's white frame (the quick doors, the Template tiles). */
const FRAME = 'rounded-[var(--sn-frame-radius)] bg-[rgb(var(--sn-frame-bg))] shadow-[var(--sn-frame-shadow-tile)]';

export default function ShopLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl pb-32" data-shop-ghost="">
      <Screen label="Loading your shop" className="">
        {/* The cover: its photo, the shop's name and its marks are not known yet. */}
        <Sk className="h-[208px] w-full rounded-b-3xl" />
        <div className="space-y-2.5 px-4 pt-3">
          <div className="flex items-center gap-2">
            <SkCircle size="h-[55px] w-[55px]" className="shrink-0" />
            <span className="inline-flex min-h-[48px] shrink-0 items-center rounded-full bg-[rgb(var(--sn-frame-bg))] px-4 text-[14px] font-semibold text-ink shadow-[var(--sn-frame-shadow-tile)]">
              <Ghost known="Share" />
            </span>
            <Sk className="h-12 min-w-0 flex-1 rounded-full" />
          </div>
          {/* THE FIVE — fixed doors, so their names are known. */}
          <div className="grid grid-cols-5 gap-1.5">
            {QUICK.map((w) => (
              <div key={w} className={`flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 ${FRAME}`}>
                <Sk className="h-7 w-7 rounded-lg" />
                <Ghost known={w} textClassName="whitespace-nowrap text-[12px] font-semibold leading-tight text-ink" />
              </div>
            ))}
          </div>
        </div>

        <div data-shop-ghost-desk="">
          <div data-shop-ghost-side="">
            <section aria-hidden>
              <Head name="Templates" line="Made once, sent to couples" />
              <div className="grid grid-cols-2 gap-2 px-4">
                {TEMPLATES.map((w) => (
                  <div key={w} className={`flex min-h-[104px] flex-col items-center justify-center gap-1 ${FRAME}`}>
                    <Sk className="h-10 w-10 rounded-xl" />
                    <Ghost known={w} textClassName="text-sm font-semibold leading-tight text-ink" />
                    <Sk className="h-3 w-14 rounded" />
                  </div>
                ))}
              </div>
            </section>
            <section aria-hidden>
              <Head name="Specialized tools" line="Each tool opens where you use it" />
              <div className="flex gap-2 overflow-hidden px-4 pb-3">
                {[0, 1, 2].map((i) => (
                  <Sk key={i} className="h-[178px] w-[150px] flex-none rounded-2xl" />
                ))}
              </div>
            </section>
            <section aria-hidden>
              <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
                <Ghost known="Analytics" textClassName="home-k2 !my-0" />
              </div>
              <div className="flex gap-3 overflow-hidden px-4 pb-1.5">
                <Sk className="h-[255px] w-[86%] flex-none rounded-2xl" />
                <Sk className="h-[255px] w-[86%] flex-none rounded-2xl" />
              </div>
            </section>
            <section aria-hidden>
              <Head name="Badges" line="Tap a badge to see how it’s earned" />
              <div className="flex gap-2 overflow-hidden px-4 pb-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex w-[96px] flex-none flex-col items-center gap-1.5 pt-1">
                    <SkCircle size="h-[84px] w-[84px]" />
                    <Sk className="h-3 w-16 rounded" />
                    <Sk className="h-2.5 w-10 rounded" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section aria-hidden className="px-4 pt-3" data-shop-ghost-services="">
            <div className="flex min-h-11 items-center">
              <Ghost known="Your bundles and services" textClassName="home-k2 !my-0" />
            </div>
            <Ghost known="Your bundles first, then each service you offer." textClassName="text-[12.5px] leading-snug text-ink/70" />
            <div className="mt-4 grid gap-3" data-shop-ghost-cards="">
              {[0, 1, 2].map((i) => (
                <Sk key={i} className="h-[112px] w-full rounded-2xl" />
              ))}
            </div>
          </section>
        </div>
      </Screen>
    </div>
  );
}
