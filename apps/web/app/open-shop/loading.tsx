/**
 * /open-shop — the supplier sign-up wizard, while the server answers.
 *
 * WHY: the speed audit of 2026-11-27 (Group J) found a tap here showed nothing until the server answered —
 * 11 reads in 10 steps before paint (the account, the shop, the service tree and its specialties, the event types,
 * the fee schedule, the claim words, the inviter).
 *
 * SHAPE: it draws INSIDE the one open-shop layer (`layout.tsx` → `OpenShopLayer`), whose head already carries the
 * title and its line — so no title here, never said twice. Below it, step 1 as the wizard draws it on a phone: the
 * SETNAYAN wordmark over the five step bars and their names, "Shop name" and its box with the address line under it,
 * "Main service" over the search box and the category photo tiles, the Free line, then the sticky bottom bar holding
 * Continue. The two labels are the page's own words, shown at once.
 *
 * /open-shop/logo and /open-shop/invite carry their own loaders, so neither borrows this step-1 shape.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function OpenShopLoading() {
  return (
    <Screen className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 px-4 pt-6 md:px-7">
        {/* The wordmark over the five step bars and their names. */}
        <div className="grid gap-3">
          <Ghost className="h-3.5 w-24 rounded" />
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Sk key={i} className="h-1 flex-1 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5 md:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Sk key={i} className="h-2.5 w-3/4 rounded" />
            ))}
          </div>
        </div>
        {/* Shop name — its box, then the web address it makes. */}
        <div className="max-w-xl space-y-1">
          <Ghost known="Shop name" className="h-3.5 w-20 rounded" textClassName="min-h-5 text-sn-base font-medium leading-5 text-ink" />
          <Sk className="h-11 w-full rounded-md" />
          <Sk className="h-3 w-1/2 rounded" />
        </div>
        {/* Main service — the search box over the category photo tiles. */}
        <div className="max-w-xl space-y-1.5">
          <Ghost known="Main service" className="h-3.5 w-24 rounded" textClassName="min-h-5 text-sn-base font-medium leading-5 text-ink" />
          <Sk className="h-11 w-full rounded-md" />
          <Sk className="mt-2 h-2.5 w-28 rounded" />
          {Array.from({ length: 2 }).map((_, r) => (
            <div key={r} className="flex gap-2">
              {Array.from({ length: 3 }).map((_, c) => (
                <Sk key={c} className="h-24 min-w-0 flex-1 rounded-md" />
              ))}
            </div>
          ))}
        </div>
        {/* The Free line. */}
        <Sk className="h-3 w-4/5 max-w-xl rounded" />
      </div>
      {/* The bottom bar — Continue on the right. */}
      <div className="sticky bottom-0 mt-auto flex items-center justify-end gap-2.5 border-t border-ink/10 px-4 pb-3 pt-3 md:static md:border-0 md:px-7">
        <Sk className="h-11 w-32 rounded-full" />
      </div>
    </Screen>
  );
}
