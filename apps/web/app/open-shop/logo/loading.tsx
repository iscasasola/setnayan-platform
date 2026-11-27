/**
 * /open-shop/logo — "Add your logo", the screen right after "Open my shop", while the server answers.
 *
 * WHY: the speed audit of 2026-11-27 (Group J) listed the open-shop steps: a tap here showed nothing until the server
 * answered — 3 reads in 3 steps before paint (the account, the active shop, its logo). Without this file it would
 * borrow `/open-shop`'s step-1 wizard skeleton, which is the wrong shape.
 *
 * SHAPE: inside the one open-shop layer (its head carries "Add your logo"), as `AddYourLogo` draws it — the wordmark
 * over the five step bars (all filled), the one line under the head (the page's own words, shown at once), the round
 * logo frame, the upload control and its hint, then the bottom bar with its one button on the right.
 */
import { Ghost, Screen, Sk, SkCircle } from '@/components/skeletons';

export default function OpenShopLogoLoading() {
  return (
    <Screen className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 px-4 pt-6 md:mx-auto md:w-full md:max-w-xl md:px-7 md:pb-9">
        <div className="grid gap-3">
          <Ghost className="h-3.5 w-24 rounded" />
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Sk key={i} className="h-1 flex-1 rounded-full" />
            ))}
          </div>
        </div>
        <Ghost
          known="Couples see your logo on every supplier card. Changes save on their own."
          className="h-3.5 w-4/5 rounded"
          textClassName="min-h-5 whitespace-normal text-sn-base leading-5 text-ink/70"
        />
        <div className="flex-1 space-y-4">
          {/* The round frame IS the editor. */}
          <SkCircle size="mx-auto h-48 w-48" />
          {/* The upload control and its hint. */}
          <Sk className="h-11 w-full rounded-md" />
          <Sk className="h-3 w-2/3 rounded" />
        </div>
        <div className="sticky bottom-0 -mx-4 mt-auto flex items-center justify-end gap-2.5 border-t border-ink/10 px-4 pb-3 pt-3 md:static md:mx-0 md:border-0 md:px-0 md:pt-1">
          <Sk className="h-11 w-32 rounded-full" />
        </div>
      </div>
    </Screen>
  );
}
